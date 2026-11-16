# Emberlight — Lantern Keeper

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/muhamadyusufseptian6-lab/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/muhamadyusufseptian6-lab/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

An original top-down arena survival game for **best-game-01** ("Make the best game").
You are the keeper of a lantern in a night garden overrun with shadow wisps.
Gather embers, banish wisps, survive 10 waves and defeat the Grand Warden to win.

## How to play

- **Move:** WASD or arrow keys
- **Aim:** mouse (the lantern fires on its own toward your aim)
- **Dash:** Space or Shift (brief burst + invulnerability, 1.6 s cooldown)
- **Pause:** P or Esc · **Sound:** M · **Restart:** Space / Enter / R / click

## The game

- 10 waves of escalating wisps: drifters, darting lungers, orb-spitting
  spitters, brutes, and a Warden boss on wave 5 and the Grand Warden on wave 10.
- Kill combo multiplier (up to x3), ember pickups that magnetise toward you,
  hearts, triple-flame stars and moon shields.
- Score, best score (kept in localStorage), wave, hearts, combo and dash
  cooldown on the HUD; wave banners, boss health bar, particles, screen
  shake and synthesised WebAudio sound (no audio files).
- Title, pause, game-over and victory screens, each with a restart.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network, no dependencies: `game/index.html` plus its ES
modules under `game/src/`. Node 22.18+ and a desktop browser are all it needs.

## Screenshots

The four shots in `screenshots/` are real renders of the game, staged
deterministically with `?shot=start|play|boss|win&seed=1` (see `shots.json`
and `game/src/shots.js`).

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This copies `game/` and `screenshots/` to `out/` and writes
`out/dossier.json` with the vendored `vendor/makefun-game.ts` library.

---

<sub>Entered on [make.fun](https://make.fun/?ref=515temp1&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
