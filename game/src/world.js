// The game's rules and state, with no drawing and no browser in it: the lantern
// keeper, the shadow wisps, bullets and orbs, pickups, waves and the wardens, the
// combo, the score and the win. step() advances one fixed step and returns what
// happened as bit flags, so the caller can react (sound, announcements) without
// the world knowing about screens or sound. Pools are allocated once at boot.

import { COMBO, ENEMY, FIELD, FINAL_WAVE, ORB, PICKUP, PLAYER, POOLS } from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_EMBER = 4;
export const EVENT_PICKUP = 8;
export const EVENT_WAVE = 16;
export const EVENT_BOSS = 32;
export const EVENT_OVER = 64;
export const EVENT_WIN = 128;
export const EVENT_SHOOT = 256;

export const KIND_DRIFTER = 'drifter';
export const KIND_DART = 'dart';
export const KIND_SPITTER = 'spitter';
export const KIND_BRUTE = 'brute';
export const KIND_WARDEN = 'warden';
export const KIND_GRAND = 'grandWarden';

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2,
    hp: PLAYER.maxHp, fireTimer: 0, dashTime: 0, dashCooldown: 0,
    dashX: 1, dashY: 0, spreadTimer: 0, shieldTimer: 0, invulnerable: 0,
    aimX: FIELD.width / 2, aimY: FIELD.height / 2 - 120,
  };
  const enemies = [];
  for (let i = 0; i < POOLS.enemies; i += 1) {
    enemies.push({ active: false, kind: KIND_DRIFTER, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 16, speed: 60, damage: 1, score: 0, ember: 0, t: 0, shootTimer: 0, flash: 0, seed: 0 });
  }
  const bullets = [];
  for (let i = 0; i < POOLS.bullets; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 1, radius: 5, life: 0 });
  const orbs = [];
  for (let i = 0; i < POOLS.orbs; i += 1) orbs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: ORB.radius, life: 0 });
  const pickups = [];
  for (let i = 0; i < POOLS.pickups; i += 1) pickups.push({ active: false, kind: 'ember', x: 0, y: 0, vx: 0, vy: 0, t: 0 });
  const particles = [];
  for (let i = 0; i < POOLS.particles; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#fff' });
  const floaters = [];
  for (let i = 0; i < POOLS.floaters; i += 1) floaters.push({ active: false, x: 0, y: 0, life: 0, text: '' });

  const state = {
    player, enemies, bullets, orbs, pickups, particles, floaters,
    score: 0, wave: 0, combo: 0, comboTimer: 0, kills: 0, embers: 0,
    time: 0, banner: '', bannerTimer: 0, intermission: 0, shake: 0,
    boss: null, won: false, over: false, spawnQueue: [], spawnTimer: 0,
  };

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (!p) return;
      const a = random() * Math.PI * 2;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
      p.maxLife = 0.4 + random() * 0.5;
      p.life = p.maxLife;
      p.size = 2 + random() * 4;
      p.color = color;
    }
  }

  function floater(x, y, text) {
    const f = free(floaters);
    if (!f) return;
    f.active = true;
    f.x = x; f.y = y;
    f.life = 1.0;
    f.text = text;
  }

  function multiplier() {
    return 1 + Math.min(state.combo, 20) * COMBO.step;
  }

  function spawnPickup(kind, x, y) {
    const p = free(pickups);
    if (!p) return;
    p.active = true;
    p.kind = kind;
    p.x = Math.max(20, Math.min(FIELD.width - 20, x));
    p.y = Math.max(20, Math.min(FIELD.height - 20, y));
    const a = random() * Math.PI * 2;
    p.vx = Math.cos(a) * 40;
    p.vy = Math.sin(a) * 40;
    p.t = random() * Math.PI * 2;
  }

  function spawnEnemy(kind, x, y) {
    const e = free(enemies);
    if (!e) return null;
    const def = ENEMY[kind];
    e.active = true;
    e.kind = kind;
    e.x = x; e.y = y;
    e.vx = 0; e.vy = 0;
    e.hp = def.hp; e.maxHp = def.hp;
    e.radius = def.radius; e.speed = def.speed;
    e.damage = def.damage; e.score = def.score; e.ember = def.ember;
    e.t = random() * 10;
    e.shootTimer = 1 + random() * 1.5;
    e.flash = 0;
    e.seed = random() * Math.PI * 2;
    if (kind === KIND_WARDEN || kind === KIND_GRAND) state.boss = e;
    return e;
  }

  function edgePoint() {
    const side = Math.floor(random() * 4);
    const m = 30;
    if (side === 0) return { x: random() * FIELD.width, y: m };
    if (side === 1) return { x: random() * FIELD.width, y: FIELD.height - m };
    if (side === 2) return { x: m, y: random() * FIELD.height };
    return { x: FIELD.width - m, y: random() * FIELD.height };
  }

  /** The mix of ordinary foes for a wave, shuffled. */
  function buildQueue(wave) {
    const queue = [];
    const n = 6 + wave * 3;
    for (let i = 0; i < n; i += 1) {
      const r = random();
      if (wave >= 4 && r < 0.14) queue.push(KIND_BRUTE);
      else if (wave >= 3 && r < 0.34) queue.push(KIND_SPITTER);
      else if (wave >= 2 && r < 0.58) queue.push(KIND_DART);
      else queue.push(KIND_DRIFTER);
    }
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = queue[i];
      queue[i] = queue[j];
      queue[j] = tmp;
    }
    return queue;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = buildQueue(wave);
    state.spawnTimer = 0.4;
    state.intermission = 0;
    if (wave === 5 || wave === FINAL_WAVE) {
      const at = edgePoint();
      spawnEnemy(wave === FINAL_WAVE ? KIND_GRAND : KIND_WARDEN, at.x, at.y);
      state.banner = wave === FINAL_WAVE ? 'THE GRAND WARDEN' : 'THE WARDEN AWAKENS';
      state.bannerTimer = 2.6;
      return EVENT_BOSS;
    }
    state.banner = `Wave ${wave}`;
    state.bannerTimer = 1.8;
    return EVENT_WAVE;
  }

  function fireBullet(x, y, angle, damage) {
    const b = free(bullets);
    if (!b) return;
    b.active = true;
    b.x = x; b.y = y;
    b.vx = Math.cos(angle) * PLAYER.bulletSpeed;
    b.vy = Math.sin(angle) * PLAYER.bulletSpeed;
    b.damage = damage;
    b.radius = PLAYER.bulletRadius;
    b.life = 1.1;
  }

  function fireOrb(x, y, angle) {
    const o = free(orbs);
    if (!o) return;
    o.active = true;
    o.x = x; o.y = y;
    o.vx = Math.cos(angle) * ORB.speed;
    o.vy = Math.sin(angle) * ORB.speed;
    o.radius = ORB.radius;
    o.life = 4;
  }

  function killEnemy(e, events) {
    e.active = false;
    const gained = Math.round(e.score * multiplier());
    state.score += gained;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    floater(e.x, e.y - e.radius, `+${gained}`);
    burst(e.x, e.y, e.kind === KIND_BRUTE || e.kind === KIND_WARDEN || e.kind === KIND_GRAND ? '#f87171' : '#c4b5fd', e.kind === KIND_BRUTE ? 22 : 12, 220);
    for (let i = 0; i < e.ember; i += 1) spawnPickup('ember', e.x + (random() - 0.5) * 40, e.y + (random() - 0.5) * 40);
    const roll = random();
    if (e.kind === KIND_BRUTE || e.kind === KIND_WARDEN || e.kind === KIND_GRAND) {
      spawnPickup(roll < 0.5 ? 'heart' : 'star', e.x, e.y);
    } else if (roll < 0.03) {
      spawnPickup('heart', e.x, e.y);
    } else if (roll < 0.07) {
      spawnPickup(random() < 0.5 ? 'star' : 'shield', e.x, e.y);
    }
    if (state.boss === e) {
      state.boss = null;
      if (e.kind === KIND_GRAND) {
        state.won = true;
        burst(e.x, e.y, '#ffd98a', 60, 380);
        burst(e.x, e.y, '#ffb347', 40, 260);
        return events | EVENT_KILL | EVENT_WIN;
      }
      state.score += 250;
      floater(e.x, e.y - 60, 'Warden banished! +250');
    }
    return events | EVENT_KILL;
  }

  function hurtPlayer(damage) {
    if (player.invulnerable > 0 || player.shieldTimer > 0 || player.dashTime > 0) return 0;
    player.hp -= damage;
    player.invulnerable = PLAYER.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
    state.shake = 0.35;
    burst(player.x, player.y, '#fb7185', 16, 260);
    if (player.hp <= 0) {
      player.hp = 0;
      state.over = true;
      burst(player.x, player.y, '#ffd98a', 50, 320);
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.hp = PLAYER.maxHp;
    player.fireTimer = 0;
    player.dashTime = 0;
    player.dashCooldown = 0;
    player.spreadTimer = 0;
    player.shieldTimer = 0;
    player.invulnerable = 0;
    for (const e of enemies) e.active = false;
    for (const b of bullets) b.active = false;
    for (const o of orbs) o.active = false;
    for (const p of pickups) p.active = false;
    for (const p of particles) p.active = false;
    for (const f of floaters) f.active = false;
    state.score = 0;
    state.wave = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.kills = 0;
    state.embers = 0;
    state.time = 0;
    state.banner = '';
    state.bannerTimer = 0;
    state.intermission = 0;
    state.shake = 0;
    state.boss = null;
    state.won = false;
    state.over = false;
    state.spawnQueue = [];
    state.spawnTimer = 0;
  }

  /**
   * One fixed step. `move` is a normalised vector, `aim` a field point, `dash` a
   * fresh dash press. With `harmless` set (the title screen's backdrop) wisps drift
   * and embers float but nothing can hurt the keeper and nothing scores.
   */
  function step(dt, move, aim, dash, harmless) {
    let events = 0;
    state.time += dt;
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.spreadTimer > 0) player.spreadTimer -= dt;
    if (player.shieldTimer > 0) player.shieldTimer -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;

    // --- player movement and dash ---
    if (dash && player.dashCooldown <= 0 && player.dashTime <= 0) {
      const dx = move.x !== 0 || move.y !== 0 ? move.x : aim.x - player.x;
      const dy = move.x !== 0 || move.y !== 0 ? move.y : aim.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      player.dashX = dx / len;
      player.dashY = dy / len;
      player.dashTime = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      burst(player.x, player.y, '#ffd98a', 8, 160);
    }
    let speed = PLAYER.speed;
    if (player.dashTime > 0) {
      player.dashTime -= dt;
      speed = PLAYER.dashSpeed;
      player.x += player.dashX * speed * dt;
      player.y += player.dashY * speed * dt;
    } else {
      player.x += move.x * speed * dt;
      player.y += move.y * speed * dt;
    }
    player.x = Math.max(PLAYER.radius, Math.min(FIELD.width - PLAYER.radius, player.x));
    player.y = Math.max(PLAYER.radius, Math.min(FIELD.height - PLAYER.radius, player.y));
    player.aimX = aim.x;
    player.aimY = aim.y;

    // --- firing: always on, toward the aim (or the nearest wisp when idle) ---
    if (!harmless) {
      player.fireTimer -= dt;
      if (player.fireTimer <= 0) {
        let tx = aim.x;
        let ty = aim.y;
        if (!aim || (Math.abs(tx - player.x) < 4 && Math.abs(ty - player.y) < 4)) {
          let bestD = Infinity;
          for (const e of enemies) {
            if (!e.active) continue;
            const d = dist2(e.x, e.y, player.x, player.y);
            if (d < bestD) { bestD = d; tx = e.x; ty = e.y; }
          }
        }
        const base = Math.atan2(ty - player.y, tx - player.x);
        if (player.spreadTimer > 0) {
          fireBullet(player.x, player.y, base - 0.22, PLAYER.bulletDamage);
          fireBullet(player.x, player.y, base, PLAYER.bulletDamage);
          fireBullet(player.x, player.y, base + 0.22, PLAYER.bulletDamage);
        } else {
          fireBullet(player.x, player.y, base, PLAYER.bulletDamage);
        }
        player.fireTimer = PLAYER.fireInterval;
        events |= EVENT_SHOOT;
      }
    }

    // --- spawning and wave flow ---
    if (!harmless) {
      if (state.wave === 0) {
        events |= startWave(1);
      } else if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          const at = edgePoint();
          // Keep spawns away from the keeper so nothing appears on top of them.
          if (dist2(at.x, at.y, player.x, player.y) > 220 * 220) {
            spawnEnemy(state.spawnQueue.shift(), at.x, at.y);
          }
          state.spawnTimer = Math.max(0.35, 0.9 - state.wave * 0.05);
        }
      } else if (!state.boss && !enemies.some((e) => e.active)) {
        if (state.intermission <= 0) {
          state.intermission = 2.5;
          const bonus = 50 * state.wave;
          state.score += bonus;
          floater(player.x, player.y - 40, `Wave clear! +${bonus}`);
        }
        state.intermission -= dt;
        if (state.intermission <= 0) {
          if (state.wave >= FINAL_WAVE) {
            // The Grand Warden was the last wave: handled by EVENT_WIN on its death.
          } else {
            events |= startWave(state.wave + 1);
          }
        }
      }
    } else if (state.wave === 0 && enemies.filter((e) => e.active).length < 6) {
      // Title backdrop: a few wisps wandering the garden.
      const at = edgePoint();
      spawnEnemy(random() < 0.7 ? KIND_DRIFTER : KIND_DART, at.x, at.y);
      if (random() < 0.5) spawnPickup('ember', 100 + random() * (FIELD.width - 200), 100 + random() * (FIELD.height - 200));
    }

    // --- enemies ---
    for (const e of enemies) {
      if (!e.active) continue;
      e.t += dt;
      if (e.flash > 0) e.flash -= dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      if (e.kind === KIND_DRIFTER) {
        const wob = Math.sin(e.t * 3 + e.seed) * 0.6;
        e.vx = (nx + -ny * wob) * e.speed;
        e.vy = (ny + nx * wob) * e.speed;
      } else if (e.kind === KIND_DART) {
        // Circle at range, then lunge.
        if (Math.floor(e.t / 1.6) % 2 === 0) {
          e.vx = nx * e.speed * 0.55;
          e.vy = ny * e.speed * 0.55;
        } else {
          e.vx = nx * e.speed * 1.9;
          e.vy = ny * e.speed * 1.9;
        }
      } else if (e.kind === KIND_SPITTER) {
        if (d < 220) { e.vx = -nx * e.speed; e.vy = -ny * e.speed; }
        else if (d > 320) { e.vx = nx * e.speed; e.vy = ny * e.speed; }
        else { e.vx = -ny * e.speed * 0.7; e.vy = nx * e.speed * 0.7; }
        if (!harmless) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0 && d < 560) {
            fireOrb(e.x, e.y, Math.atan2(dy, dx));
            e.shootTimer = 2.4;
          }
        }
      } else if (e.kind === KIND_BRUTE) {
        e.vx = nx * e.speed;
        e.vy = ny * e.speed;
      } else {
        // Wardens: slow chase, radial bursts, enraged below half health.
        const enraged = e.hp < e.maxHp / 2;
        const sp = enraged ? e.speed * 1.5 : e.speed;
        e.vx = nx * sp;
        e.vy = ny * sp;
        if (!harmless) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            const n = enraged ? 12 : 8;
            for (let i = 0; i < n; i += 1) fireOrb(e.x, e.y, (i / n) * Math.PI * 2 + e.t);
            e.shootTimer = enraged ? 2.2 : 3.0;
          }
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.x = Math.max(e.radius, Math.min(FIELD.width - e.radius, e.x));
      e.y = Math.max(e.radius, Math.min(FIELD.height - e.radius, e.y));

      if (!harmless && dist2(e.x, e.y, player.x, player.y) < (e.radius + PLAYER.radius) * (e.radius + PLAYER.radius)) {
        events |= hurtPlayer(e.damage);
        // Shove the wisp back so one touch is not a chain of hits.
        e.x -= nx * 26;
        e.y -= ny * 26;
        if (state.over) break;
      }
    }

    // --- player bullets vs wisps ---
    for (const b of bullets) {
      if (!b.active) continue;
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        const rr = e.radius + b.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.active = false;
          e.hp -= b.damage;
          e.flash = 0.12;
          burst(b.x, b.y, '#ffe9b0', 3, 120);
          if (e.hp <= 0) events |= killEnemy(e, 0);
          break;
        }
      }
      if (state.won) break;
    }

    // --- enemy orbs vs keeper ---
    for (const o of orbs) {
      if (!o.active) continue;
      o.life -= dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.life <= 0 || o.x < -30 || o.x > FIELD.width + 30 || o.y < -30 || o.y > FIELD.height + 30) {
        o.active = false;
        continue;
      }
      if (!harmless && dist2(o.x, o.y, player.x, player.y) < (o.radius + PLAYER.radius) * (o.radius + PLAYER.radius)) {
        o.active = false;
        events |= hurtPlayer(ORB.damage);
        if (state.over) break;
      }
    }

    // --- pickups: drift, magnet embers, collect ---
    for (const p of pickups) {
      if (!p.active) continue;
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      const d2 = dist2(p.x, p.y, player.x, player.y);
      if (p.kind === 'ember' && d2 < PLAYER.pickupRadius * PLAYER.pickupRadius) {
        const d = Math.sqrt(d2) || 1;
        p.x += ((player.x - p.x) / d) * 420 * dt;
        p.y += ((player.y - p.y) / d) * 420 * dt;
      }
      if (!harmless && d2 < (PLAYER.radius + 14) * (PLAYER.radius + 14)) {
        p.active = false;
        if (p.kind === 'ember') {
          state.score += PICKUP.ember.score;
          state.embers += 1;
          events |= EVENT_EMBER;
        } else if (p.kind === 'heart') {
          player.hp = Math.min(PLAYER.maxHp, player.hp + 1);
          floater(player.x, player.y - 30, '+1 heart');
          events |= EVENT_PICKUP;
        } else if (p.kind === 'star') {
          player.spreadTimer = PICKUP.star.duration;
          floater(player.x, player.y - 30, 'Triple flame!');
          events |= EVENT_PICKUP;
        } else if (p.kind === 'shield') {
          player.shieldTimer = PICKUP.shield.duration;
          floater(player.x, player.y - 30, 'Moon shield!');
          events |= EVENT_PICKUP;
        }
      }
    }

    // --- particles and floaters ---
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
    }
    for (const f of floaters) {
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) { f.active = false; continue; }
      f.y -= 34 * dt;
    }

    if (state.won) events |= EVENT_WIN;
    if (state.over) events |= EVENT_OVER;
    return events;
  }

  /** Screenshot staging: top the field up with `count` ordinary wisps at the edges. */
  function reinforce(count) {
    const kinds = [KIND_DRIFTER, KIND_DRIFTER, KIND_DART, KIND_SPITTER, KIND_BRUTE];
    for (let i = 0; i < count; i += 1) {
      const at = edgePoint();
      if (dist2(at.x, at.y, player.x, player.y) > 200 * 200) {
        spawnEnemy(kinds[Math.floor(random() * kinds.length)], at.x, at.y);
      }
    }
  }

  /** Screenshot staging: wave 5's warden, mid-fight, with a healthy keeper. */  function beginBossEncounter() {
    reset();
    state.score = 1840;
    state.kills = 41;
    player.hp = PLAYER.maxHp;
    state.wave = 5;
    const at = edgePoint();
    spawnEnemy(KIND_WARDEN, at.x, at.y);
    spawnEnemy(KIND_DRIFTER, 220, 180);
    spawnEnemy(KIND_SPITTER, FIELD.width - 240, 200);
    spawnEnemy(KIND_DART, FIELD.width / 2, 130);
    spawnPickup('ember', FIELD.width / 2 - 60, FIELD.height - 160);
    spawnPickup('ember', FIELD.width / 2 + 80, FIELD.height - 200);
    state.banner = 'THE WARDEN AWAKENS';
    state.bannerTimer = 2.6;
    state.spawnQueue = [];
  }

  /** Screenshot staging: the Grand Warden has fallen; the garden is lit. */
  function celebrateVictory() {
    reset();
    state.score = 12480;
    state.kills = 213;
    state.embers = 96;
    state.wave = FINAL_WAVE;
    player.hp = 2;
    state.won = true;
    for (let i = 0; i < 5; i += 1) {
      burst(240 + i * 200, 200 + (i % 2) * 220, i % 2 ? '#ffd98a' : '#ff8c42', 24, 300);
    }
    spawnPickup('ember', FIELD.width / 2 - 120, 300);
    spawnPickup('ember', FIELD.width / 2 + 120, 300);
    spawnPickup('heart', FIELD.width / 2, 420);
  }

  reset();
  return { state, reset, step, startWave, reinforce, beginBossEncounter, celebrateVictory, multiplier };
}
