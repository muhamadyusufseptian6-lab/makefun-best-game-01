// Emberlight — Lantern Keeper: every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves the run lasts: beat the Grand Warden on wave 10 to win. */
export const FINAL_WAVE = 10;

export const PLAYER = {
  radius: 16,
  speed: 330,
  maxHp: 5,
  fireInterval: 0.16,
  bulletSpeed: 760,
  bulletDamage: 1,
  bulletRadius: 5,
  dashSpeed: 980,
  dashTime: 0.16,
  dashCooldown: 1.6,
  invulnerable: 1.0,
  pickupRadius: 92,
};

export const COMBO = { window: 3.0, step: 0.1, maxBonus: 2.0 };

export const ENEMY = {
  drifter: { hp: 2, speed: 78, radius: 18, damage: 1, score: 20, ember: 2 },
  dart: { hp: 1, speed: 165, radius: 13, damage: 1, score: 30, ember: 1 },
  spitter: { hp: 3, speed: 62, radius: 17, damage: 1, score: 40, ember: 2 },
  brute: { hp: 8, speed: 46, radius: 28, damage: 2, score: 80, ember: 4 },
  warden: { hp: 60, speed: 52, radius: 46, damage: 2, score: 500, ember: 10 },
  grandWarden: { hp: 110, speed: 58, radius: 54, damage: 2, score: 1000, ember: 16 },
};

/** Enemy orbs (spitter / warden shots). */
export const ORB = { speed: 210, radius: 8, damage: 1 };

/** Wave N fields this many ordinary foes, plus a warden on waves 5 and 10. */
export function waveSize(wave) {
  return 6 + wave * 3;
}

export const PICKUP = {
  ember: { score: 5, radius: 9 },
  heart: { radius: 12 },
  star: { radius: 13, duration: 10 },
  shield: { radius: 13, duration: 5 },
};

export const POOLS = { enemies: 48, bullets: 96, orbs: 64, pickups: 64, particles: 256, floaters: 32 };

/** A lantern-lit night garden: deep indigo night, warm amber light, teal leaves. */
export const PALETTE = {
  backdrop: '#070a18',
  nightTop: '#131a38',
  nightBottom: '#0a0e22',
  ground: '#101830',
  leaf: '#123527',
  leafLight: '#1a4a34',
  glow: '#ffb347',
  glowSoft: '#ffd98a',
  flame: '#ff8c42',
  text: '#f5efe0',
  muted: '#9aa5c4',
  panel: '#171e33',
  panelEdge: '#2c3a63',
  player: '#ffd98a',
  bullet: '#ffe9b0',
  drifter: '#8b5cf6',
  dart: '#f472b6',
  spitter: '#34d399',
  brute: '#f87171',
  warden: '#c084fc',
  orb: '#e879f9',
  ember: '#ffb347',
  heart: '#fb7185',
  star: '#facc15',
  shield: '#67e8f9',
  danger: '#f87171',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberlight.best';
