// Keyboard and pointer input. Held keys give a movement vector; one-shot presses
// (start / restart, pause, dash, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.
// The mouse aims the lantern: its client position is mapped into field coordinates
// with the same letterbox transform the renderer uses.

import { FIELD } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter', 'Space']);
const DASH = new Set(['Space', 'ShiftLeft', 'ShiftRight']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);
const RESTART = new Set(['KeyR']);

/** Map a client (CSS pixel) position into the 1280x720 field. */
export function clientToField(clientX, clientY) {
  const scale = Math.min(window.innerWidth / FIELD.width, window.innerHeight / FIELD.height);
  const x = (window.innerWidth - FIELD.width * scale) / 2;
  const y = (window.innerHeight - FIELD.height * scale) / 2;
  return { x: (clientX - x) / scale, y: (clientY - y) / scale };
}

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let aim = { x: FIELD.width / 2, y: FIELD.height / 2 - 120 };
  let aimSeen = false;

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => held.clear());

  target.addEventListener('pointermove', (event) => {
    aim = clientToField(event.clientX, event.clientY);
    aimSeen = true;
  });
  target.addEventListener('pointerdown', (event) => {
    aim = clientToField(event.clientX, event.clientY);
    aimSeen = true;
    actions |= ACTION_CONFIRM;
  });

  function axis(neg, pos) {
    let value = 0;
    for (const code of neg) if (held.has(code)) value -= 1;
    for (const code of pos) if (held.has(code)) value += 1;
    return Math.max(-1, Math.min(1, value));
  }

  return {
    /** Normalised {x, y} movement vector, or {x:0, y:0} when still. */
    move() {
      const x = axis(LEFT, RIGHT);
      const y = axis(UP, DOWN);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** Where the lantern is aimed in field coordinates. */
    aim() {
      return aim;
    },
    get aimSeen() {
      return aimSeen;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
