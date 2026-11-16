// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, paused,
// game over and victory.
//
// ?seed=N fixes the falling pattern. ?shot=start|play|boss|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_EMBER, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_SHOOT, EVENT_WAVE, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_DASH, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Wave 1. Gather embers and banish the wisps.');
  }

  function endGame(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    if (won) {
      audio.win();
      announce(`Dawn breaks! You won with score ${world.state.score}. Best ${best}.`);
    } else {
      audio.lose();
      announce(`Game over. Score ${world.state.score}. Best ${best}.`);
    }
  }

  function handleActions(actions) {
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function react(events) {
    if (events & EVENT_SHOOT) audio.shoot();
    if (events & EVENT_KILL) audio.kill();
    if (events & EVENT_EMBER) audio.ember();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_WAVE) audio.wave();
    if (events & EVENT_BOSS) audio.boss();
  }

  function step(dash) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, { x: world.state.player.x, y: world.state.player.y - 120 }, false, true);
      return;
    }
    const move = input.move();
    const aim = input.aimSeen ? input.aim() : (() => {
      // No mouse yet: aim at the nearest wisp so the lantern still fights.
      let tx = world.state.player.x;
      let ty = world.state.player.y - 120;
      let bestD = Infinity;
      for (const e of world.state.enemies) {
        if (!e.active) continue;
        const d = (e.x - world.state.player.x) ** 2 + (e.y - world.state.player.y) ** 2;
        if (d < bestD) { bestD = d; tx = e.x; ty = e.y; }
      }
      return { x: tx, y: ty };
    })();
    const events = world.step(STEP, move, aim, dash, false);
    react(events);
    if (events & EVENT_WIN) endGame(true);
    else if (events & EVENT_OVER) endGame(false);
    else if (events & EVENT_HIT) announce(world.state.player.hp === 1 ? 'Hit. 1 heart left.' : `Hit. ${world.state.player.hp} hearts left.`);
    else if (events & EVENT_BOSS) announce('The Warden awakens!');
    else if (events & EVENT_WAVE) announce(`Wave ${world.state.wave}.`);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    const wasPlaying = screen === SCREEN_PLAY;
    handleActions(actions);
    const dash = Boolean(actions & ACTION_DASH) && wasPlaying;
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(dash && screen === SCREEN_PLAY);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, muted);
  }

  // Leaving the tab pauses a running game rather than letting wisps close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberlight. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
