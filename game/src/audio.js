// All sound is synthesised with WebAudio: short oscillator envelopes, no audio files.
// The context is created lazily on the first user gesture (start), so browsers never
// block it, and everything is wrapped so a missing AudioContext can never break play.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;
  let padNodes = null;

  function ensure() {
    if (context) return true;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return false;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      if (context.state === 'suspended') void context.resume();
      const now = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), now + dur);
      gain.gain.setValueAtTime(vol, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + dur + 0.02);
    } catch {
      // Sound is garnish: never let it interrupt the game.
    }
  }

  /** A soft two-note night pad that hums under play once the game has started. */
  function startPad() {
    if (!ensure() || padNodes) return;
    try {
      const gain = context.createGain();
      gain.gain.value = 0.035;
      gain.connect(master);
      const nodes = [];
      for (const freq of [110, 164.81, 220]) {
        const osc = context.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(gain);
        osc.start();
        nodes.push(osc);
      }
      padNodes = { gain, nodes };
    } catch {
      padNodes = null;
    }
  }

  return {
    unlock() {
      ensure();
      startPad();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get isMuted() {
      return muted;
    },
    shoot() {
      tone(720, 0.07, 'square', 0.08, 340);
    },
    dash() {
      tone(280, 0.14, 'sine', 0.12, 720);
    },
    hit() {
      tone(160, 0.18, 'sawtooth', 0.16, 60);
    },
    kill() {
      tone(520, 0.1, 'triangle', 0.12, 880);
    },
    ember() {
      tone(980, 0.09, 'sine', 0.1, 1420);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.12, 990);
      tone(990, 0.16, 'sine', 0.08, 1320);
    },
    wave() {
      tone(440, 0.2, 'triangle', 0.12, 660);
      tone(660, 0.28, 'triangle', 0.1, 880);
    },
    boss() {
      tone(98, 0.5, 'sawtooth', 0.16, 49);
    },
    win() {
      for (const [i, f] of [523.25, 659.25, 783.99, 1046.5].entries()) {
        setTimeout(() => tone(f, 0.4, 'triangle', 0.14), i * 130);
      }
    },
    lose() {
      for (const [i, f] of [392, 311.13, 233.08].entries()) {
        setTimeout(() => tone(f, 0.35, 'triangle', 0.12), i * 160);
      }
    },
  };
}
