// Drawing only: the world's state and the current screen in, pixels out. The
// 1280x720 playfield is scaled to fit the window and centred, the margin filled
// with the backdrop colour. A lantern-lit night garden: warm glow against deep
// indigo, distinct silhouettes per wisp so each reads at a glance.

import { FIELD, FINAL_WAVE, FONT, PALETTE, PLAYER } from './config.js';
import { createRandom } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const HEART = 18;

function cachedLabel(prefix) {
  let value = -1;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function roundRectPath(context, x, y, w, h, r) {
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + w, y, x + w, y + h, r);
  context.arcTo(x + w, y + h, x, y + h, r);
  context.arcTo(x, y + h, x, y, r);
  context.arcTo(x, y, x + w, y, r);
  context.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');
  const waveLabel = cachedLabel('Wave ');
  const finalLabel = cachedLabel('Score ');
  const comboLabel = cachedLabel('Combo x');

  // The night sky's stars and garden tufts never move: fixed seed, drawn once.
  const stars = [];
  const tufts = [];
  {
    const rng = createRandom(20261115);
    for (let i = 0; i < 110; i += 1) {
      stars.push({ x: rng() * FIELD.width, y: rng() * FIELD.height * 0.62, r: 0.6 + rng() * 1.6, tw: rng() * Math.PI * 2 });
    }
    for (let i = 0; i < 26; i += 1) {
      tufts.push({ x: rng() * FIELD.width, y: FIELD.height - 30 - rng() * 90, r: 14 + rng() * 26 });
    }
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawBackground(time) {
    const grad = context.createLinearGradient(0, 0, 0, FIELD.height);
    grad.addColorStop(0, PALETTE.nightTop);
    grad.addColorStop(1, PALETTE.nightBottom);
    context.fillStyle = grad;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    for (const s of stars) {
      const a = 0.35 + 0.4 * Math.abs(Math.sin(time * 0.7 + s.tw));
      context.globalAlpha = a;
      context.fillStyle = '#e8ecff';
      context.beginPath();
      context.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    // Garden floor: soft dark tufts along the bottom.
    for (const t of tufts) {
      context.fillStyle = PALETTE.leaf;
      context.beginPath();
      context.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.leafLight;
      context.beginPath();
      context.arc(t.x - t.r * 0.3, t.y - t.r * 0.25, t.r * 0.5, 0, Math.PI * 2);
      context.fill();
    }
    // A faint moon in the corner, clear of the hearts HUD.
    context.fillStyle = '#f5efe0';
    context.globalAlpha = 0.9;
    context.beginPath();
    context.arc(FIELD.width - 96, 178, 34, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.nightTop;
    context.beginPath();
    context.arc(FIELD.width - 108, 170, 30, 0, Math.PI * 2);
    context.fill();
  }

  function drawGlow(x, y, radius, color, alpha) {
    const g = context.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    context.globalAlpha = alpha;
    context.fillStyle = g;
    context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    context.globalAlpha = 1;
  }

  function drawEnemy(e, time) {
    const flash = e.flash > 0;
    const body = flash ? '#ffffff' : PALETTE[e.kind === 'drifter' ? 'drifter' : e.kind === 'dart' ? 'dart' : e.kind === 'spitter' ? 'spitter' : e.kind === 'brute' ? 'brute' : 'warden'];
    context.fillStyle = body;
    context.strokeStyle = body;
    const r = e.radius;
    const wob = Math.sin(time * 4 + e.seed) * 2;
    if (e.kind === 'drifter') {
      context.beginPath();
      context.arc(e.x, e.y + wob * 0.4, r, 0, Math.PI * 2);
      context.fill();
      // Wisp tail.
      context.globalAlpha = 0.5;
      context.beginPath();
      context.arc(e.x, e.y + r * 0.8, r * 0.55, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = 1;
    } else if (e.kind === 'dart') {
      const a = Math.atan2(e.vy, e.vx);
      context.save();
      context.translate(e.x, e.y);
      context.rotate(a);
      context.beginPath();
      context.moveTo(r + 6, 0);
      context.lineTo(-r * 0.7, r * 0.75);
      context.lineTo(-r * 0.35, 0);
      context.lineTo(-r * 0.7, -r * 0.75);
      context.closePath();
      context.fill();
      context.restore();
    } else if (e.kind === 'spitter') {
      context.save();
      context.translate(e.x, e.y);
      context.rotate(Math.PI / 4 + Math.sin(time * 2 + e.seed) * 0.15);
      context.fillRect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5);
      context.restore();
    } else if (e.kind === 'brute') {
      context.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        const px = e.x + Math.cos(a) * r;
        const py = e.y + Math.sin(a) * r;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    } else {
      // Warden: big crowned orb with a pulsing ring.
      drawGlow(e.x, e.y, r * 2.6, '#a855f7', 0.35);
      context.beginPath();
      context.arc(e.x, e.y, r, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#e9d5ff';
      context.lineWidth = 3;
      context.beginPath();
      context.arc(e.x, e.y, r + 8 + Math.sin(time * 3) * 3, 0, Math.PI * 2);
      context.stroke();
      // Crown spikes.
      context.fillStyle = '#e9d5ff';
      for (let i = -1; i <= 1; i += 1) {
        context.beginPath();
        context.moveTo(e.x + i * 16 - 7, e.y - r + 6);
        context.lineTo(e.x + i * 16, e.y - r - 16);
        context.lineTo(e.x + i * 16 + 7, e.y - r + 6);
        context.closePath();
        context.fill();
      }
    }
    // Eyes, always watching the keeper.
    if (e.kind !== 'dart') {
      context.fillStyle = '#1b1030';
      const ex = e.x - r * 0.32;
      const ex2 = e.x + r * 0.32;
      const ey = e.y - r * 0.15;
      context.beginPath();
      context.arc(ex, ey, Math.max(2.5, r * 0.14), 0, Math.PI * 2);
      context.arc(ex2, ey, Math.max(2.5, r * 0.14), 0, Math.PI * 2);
      context.fill();
    }
    // Wounded wisps show a health arc.
    if (e.hp < e.maxHp && e.maxHp > 3) {
      context.strokeStyle = 'rgba(245,239,224,0.85)';
      context.lineWidth = 4;
      context.beginPath();
      context.arc(e.x, e.y, r + 10, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * e.hp) / e.maxHp);
      context.stroke();
    }
  }

  function drawPickup(p, time) {
    const bob = Math.sin(time * 3 + p.t) * 3;
    const y = p.y + bob;
    if (p.kind === 'ember') {
      drawGlow(p.x, y, 26, PALETTE.ember, 0.5);
      context.fillStyle = PALETTE.ember;
      context.save();
      context.translate(p.x, y);
      context.rotate(Math.PI / 4);
      const s = 8;
      context.fillRect(-s / 2, -s / 2, s, s);
      context.restore();
    } else if (p.kind === 'heart') {
      drawGlow(p.x, y, 26, PALETTE.heart, 0.5);
      context.fillStyle = PALETTE.heart;
      context.beginPath();
      context.arc(p.x - 5, y - 2, 6, 0, Math.PI * 2);
      context.arc(p.x + 5, y - 2, 6, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(p.x - 10, y);
      context.lineTo(p.x, y + 11);
      context.lineTo(p.x + 10, y);
      context.closePath();
      context.fill();
    } else if (p.kind === 'star') {
      drawGlow(p.x, y, 30, PALETTE.star, 0.55);
      context.fillStyle = PALETTE.star;
      context.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = i % 2 === 0 ? 13 : 6;
        const px = p.x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
      context.fill();
    } else {
      drawGlow(p.x, y, 30, PALETTE.shield, 0.55);
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(p.x, y, 11, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.shield;
      context.beginPath();
      context.arc(p.x, y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPlayer(p, time) {
    // The lantern's warm light comes first, under everything else of the keeper.
    drawGlow(p.x, p.y, 150, PALETTE.glow, 0.30);
    drawGlow(p.x, p.y, 70, PALETTE.flame, 0.35);
    if (p.invulnerable > 0 && Math.floor(p.invulnerable * 10) % 2 === 0) return; // blink after a hit
    if (p.shieldTimer > 0) {
      context.strokeStyle = PALETTE.shield;
      context.lineWidth = 3;
      context.globalAlpha = 0.7 + 0.3 * Math.sin(time * 6);
      context.beginPath();
      context.arc(p.x, p.y, PLAYER.radius + 12, 0, Math.PI * 2);
      context.stroke();
      context.globalAlpha = 1;
    }
    // Lantern body.
    context.fillStyle = '#3a2a12';
    roundRectPath(context, p.x - 13, p.y - 17, 26, 34, 8);
    context.fill();
    const flick = 0.85 + Math.sin(time * 9) * 0.08 + Math.sin(time * 23) * 0.05;
    context.fillStyle = PALETTE.glowSoft;
    context.globalAlpha = flick;
    roundRectPath(context, p.x - 9, p.y - 12, 18, 24, 6);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = PALETTE.flame;
    context.beginPath();
    context.ellipse(p.x, p.y + 1, 4.5, 7 + Math.sin(time * 11) * 1.5, 0, 0, Math.PI * 2);
    context.fill();
    // Cap and handle.
    context.fillStyle = '#3a2a12';
    context.fillRect(p.x - 8, p.y - 21, 16, 5);
    context.strokeStyle = '#3a2a12';
    context.lineWidth = 3;
    context.beginPath();
    context.arc(p.x, p.y - 21, 8, Math.PI, 0);
    context.stroke();
    // Aim tick: a short line toward the lantern's aim.
    const a = Math.atan2(p.aimY - p.y, p.aimX - p.x);
    context.strokeStyle = 'rgba(255,233,176,0.9)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(p.x + Math.cos(a) * (PLAYER.radius + 6), p.y + Math.sin(a) * (PLAYER.radius + 6));
    context.lineTo(p.x + Math.cos(a) * (PLAYER.radius + 16), p.y + Math.sin(a) * (PLAYER.radius + 16));
    context.stroke();
  }

  function drawHud(state, best, muted) {
    const p = state.player;
    context.textBaseline = 'top';
    text(scoreLabel(state.score), 24, 18, 28, PALETTE.text, 'left');
    text(bestLabel(best), 24, 52, 18, PALETTE.muted, 'left');
    text(waveLabel(state.wave), FIELD.width / 2, 18, 28, PALETTE.text, 'center');
    text(`of ${FINAL_WAVE}`, FIELD.width / 2, 52, 18, PALETTE.muted, 'center');
    // Hearts, top right.
    for (let i = 0; i < PLAYER.maxHp; i += 1) {
      const x = FIELD.width - 24 - i * (HEART + 8);
      context.fillStyle = i < p.hp ? PALETTE.heart : 'rgba(251,113,133,0.25)';
      context.beginPath();
      context.arc(x - 5, 26, 6, 0, Math.PI * 2);
      context.arc(x + 5, 26, 6, 0, Math.PI * 2);
      context.fill();
      context.beginPath();
      context.moveTo(x - 10, 28);
      context.lineTo(x, 39);
      context.lineTo(x + 10, 28);
      context.closePath();
      context.fill();
    }
    // Combo under the score.
    if (state.combo >= 2) {
      text(comboLabel((1 + Math.min(state.combo, 20) * 0.1).toFixed(1)), 24, 84, 22, PALETTE.glow, 'left');
      const w = 130;
      context.fillStyle = 'rgba(255,179,71,0.25)';
      context.fillRect(24, 112, w, 6);
      context.fillStyle = PALETTE.glow;
      context.fillRect(24, 112, w * Math.max(0, state.comboTimer / 3), 6);
    }
    // Dash cooldown, bottom left.
    const ready = p.dashCooldown <= 0;
    text(ready ? 'DASH ready  [Space]' : 'DASH …', 24, FIELD.height - 34, 18, ready ? PALETTE.glow : PALETTE.muted, 'left');
    const dw = 150;
    context.fillStyle = 'rgba(255,179,71,0.25)';
    context.fillRect(24, FIELD.height - 14, dw, 5);
    context.fillStyle = PALETTE.glow;
    context.fillRect(24, FIELD.height - 14, dw * (ready ? 1 : 1 - p.dashCooldown / 1.6), 5);
    // Active power-ups, bottom centre.
    let py = FIELD.height - 34;
    if (p.spreadTimer > 0) {
      text(`Triple flame ${Math.ceil(p.spreadTimer)}s`, FIELD.width / 2, py, 18, PALETTE.star, 'center');
      py -= 24;
    }
    if (p.shieldTimer > 0) {
      text(`Moon shield ${Math.ceil(p.shieldTimer)}s`, FIELD.width / 2, py, 18, PALETTE.shield, 'center');
    }
    // Boss health bar.
    if (state.boss) {
      const b = state.boss;
      const bw = 420;
      const bx = (FIELD.width - bw) / 2;
      const by = 118;
      text(b.kind === 'grandWarden' ? 'THE GRAND WARDEN' : 'THE WARDEN', FIELD.width / 2, by - 26, 18, '#e9d5ff', 'center');
      context.fillStyle = 'rgba(192,132,252,0.25)';
      context.fillRect(bx, by, bw, 10);
      context.fillStyle = '#c084fc';
      context.fillRect(bx, by, bw * Math.max(0, b.hp / b.maxHp), 10);
    }
    // Wave banner.
    if (state.bannerTimer > 0) {
      const a = Math.min(1, state.bannerTimer);
      context.globalAlpha = a;
      text(state.banner, FIELD.width / 2, 190, 52, PALETTE.glowSoft, 'center');
      context.globalAlpha = 1;
    }
    text(muted ? 'M: sound off' : 'M: sound on', FIELD.width - 24, FIELD.height - 34, 16, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(7,10,24,0.55)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    roundRectPath(context, x, y, PANEL.width, height, 18);
    context.fill();
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    roundRectPath(context, x, y, PANEL.width, height, 18);
    context.stroke();
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 46, accent || PALETTE.text, 'center');
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + PANEL.top + i * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.glow, 'center');
  }

  const TITLE_LINES = [
    'The night garden is overrun with shadow wisps.',
    'Keep your lantern lit: gather embers, banish wisps,',
    'and defeat the Grand Warden on wave 10 to win.',
    'Move with WASD or arrows. Aim with the mouse.',
    'Dash with Space. Pause with P. Sound with M.',
    '',
  ];
  const PAUSED_LINES = ['The wisps will wait for you.', ''];
  const OVER_LINES = ['', '', '', ''];
  const WIN_LINES = ['', '', '', ''];

  /** Paint one frame: the garden, then the HUD or a panel for the screen. */
  function draw(state, screen, best, muted) {
    const time = state.time;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    const sx = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 22 : 0;
    const sy = state.shake > 0 ? (Math.random() - 0.5) * state.shake * 22 : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawBackground(time);
    for (const p of state.pickups) if (p.active) drawPickup(p, time);
    for (const e of state.enemies) if (e.active) drawEnemy(e, time);
    for (const o of state.orbs) {
      if (!o.active) continue;
      drawGlow(o.x, o.y, 22, PALETTE.orb, 0.5);
      context.fillStyle = PALETTE.orb;
      context.beginPath();
      context.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      context.fill();
    }
    for (const b of state.bullets) {
      if (!b.active) continue;
      drawGlow(b.x, b.y, 16, PALETTE.bullet, 0.7);
      context.fillStyle = PALETTE.bullet;
      context.beginPath();
      context.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      context.fill();
    }
    drawPlayer(state.player, time);
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.textBaseline = 'alphabetic';
    for (const f of state.floaters) {
      if (!f.active) continue;
      context.globalAlpha = Math.max(0, f.life);
      text(f.text, f.x, f.y, 20, PALETTE.glowSoft, 'center');
    }
    context.globalAlpha = 1;

    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('EMBERLIGHT', TITLE_LINES, 'Press Space or click to light the lantern', PALETTE.glow);
      return;
    }
    drawHud(state, best, muted);
    if (screen === SCREEN_PAUSED) {
      PAUSED_LINES[1] = bestLabel(best);
      drawPanel('Paused', PAUSED_LINES, 'Press P to keep playing', PALETTE.text);
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = finalLabel(state.score);
      OVER_LINES[1] = bestLabel(best);
      OVER_LINES[2] = `Wisps banished ${state.kills}   ·   Embers gathered ${state.embers}`;
      OVER_LINES[3] = `You reached wave ${Math.max(1, state.wave)} of ${FINAL_WAVE}`;
      drawPanel('The light went out', OVER_LINES, 'Press Space or click to try again', PALETTE.danger);
    } else if (screen === SCREEN_WIN) {
      WIN_LINES[0] = finalLabel(state.score);
      WIN_LINES[1] = bestLabel(best);
      WIN_LINES[2] = `Wisps banished ${state.kills}   ·   Embers gathered ${state.embers}`;
      WIN_LINES[3] = `The Grand Warden is banished — the garden glows again!`;
      drawPanel('DAWN BREAKS', WIN_LINES, 'Press Space or click to play again', PALETTE.glow);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
