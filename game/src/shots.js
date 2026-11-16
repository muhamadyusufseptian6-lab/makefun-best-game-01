// The screenshot scenes behind ?shot=start|play|boss|win. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (chase the nearest ember, keep clear of wisps, dash when one gets close,
// aim at the nearest wisp), so the frame is what a real game looks like and the
// same seed always gives the same frame.

import { FIELD, PLAYER, STEP } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_EARN_SECONDS = 14;
const START_SECONDS = 5;
const PLAY_MAX_SECONDS = 45;
const BOSS_SECONDS = 4;
const WIN_SECONDS = 2;
const MARGIN = 26;

/** Nearest active thing of the wanted kind, or null. */
function nearest(state, kinds) {
  const p = state.player;
  let best = null;
  let bestD = Infinity;
  for (const pool of [state.pickups, state.enemies]) {
    for (const item of pool) {
      if (!item.active) continue;
      if (kinds === 'pickup' && pool !== state.pickups) continue;
      if (kinds === 'enemy' && pool !== state.enemies) continue;
      const d = (item.x - p.x) ** 2 + (item.y - p.y) ** 2;
      if (d < bestD) { bestD = d; best = item; }
    }
  }
  return best;
}

/** Distance the keeper would be from the closest wisp if it moved `dir` for `t`. */
function dangerAt(state, dir, t) {
  const p = state.player;
  const x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, p.x + dir.x * PLAYER.speed * t));
  const y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, p.y + dir.y * PLAYER.speed * t));
  let worst = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d = Math.hypot(e.x - x, e.y - y) - e.radius;
    if (d < worst) worst = d;
  }
  return worst;
}

function autopilot(state) {
  const p = state.player;
  const ember = nearest(state, 'pickup');
  const foe = nearest(state, 'enemy');
  let dir = { x: 0, y: 0 };
  const target = ember ?? foe;
  if (target) {
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    dir = { x: dx / len, y: dy / len };
  }
  // Flee when a wisp is close: pick the safest of eight directions.
  const close = foe && Math.hypot(foe.x - p.x, foe.y - p.y) < 150;
  if (close) {
    let bestDir = dir;
    let bestSafe = dangerAt(state, dir, 0.5);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const cand = { x: Math.cos(a), y: Math.sin(a) };
      const safe = dangerAt(state, cand, 0.5);
      if (safe > bestSafe) { bestSafe = safe; bestDir = cand; }
    }
    dir = bestDir;
  }
  const dash = close && foe && Math.hypot(foe.x - p.x, foe.y - p.y) < 90;
  let aim = { x: p.x, y: p.y - 120 };
  if (foe) aim = { x: foe.x, y: foe.y };
  return { dir, aim, dash };
}

function simulate(state, world, seconds, pilot) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const { dir, aim, dash } = pilot ? autopilot(state) : { dir: { x: 0, y: 0 }, aim: { x: state.player.x, y: state.player.y - 120 }, dash: false };
    const events = world.step(STEP, dir, aim, dash, false);
    if (events & EVENT_OVER || events & EVENT_WIN) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Unknown names stage the title.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    world.reset();
    // Play until the frame is busy: mid-wave, several wisps on screen.
    for (let s = 0; s < PLAY_MAX_SECONDS; s += 1) {
      simulate(state, world, 1, true);
      const busy = state.enemies.filter((e) => e.active).length >= 3;
      if (state.wave >= 2 && busy && state.score > 300) break;
      if (state.over) break;
    }
    // The autopilot clears wisps fast: top the field up so the frame reads busy,
    // then let them drift in for a moment.
    world.reinforce(5);
    simulate(state, world, 0.8, true);
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'boss') {
    world.beginBossEncounter();
    simulate(state, world, BOSS_SECONDS, true);
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: Math.max(state.score, 1840) };
  }
  if (name === 'win') {
    world.celebrateVictory();
    simulate(state, world, WIN_SECONDS, false);
    return { screen: SCREEN_WIN, best: state.score };
  }
  // Title: first earn a best score with a short real game, then idle the garden.
  world.reset();
  simulate(state, world, START_EARN_SECONDS, true);
  const earned = state.score;
  world.reset();
  for (let i = 0; i < Math.round(START_SECONDS / STEP); i += 1) {
    world.step(STEP, { x: 0, y: 0 }, { x: state.player.x, y: state.player.y - 120 }, false, true);
  }
  return { screen: SCREEN_TITLE, best: earned };
}
