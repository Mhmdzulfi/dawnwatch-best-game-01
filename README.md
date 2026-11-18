# Dawnwatch

An original bastion-defence arcade game, built for the [best-game-01](https://make.fun/c/best-game-01) competition on [make.fun](https://make.fun).

[![Competition](https://make.fun/badge/best-game-01.svg)](https://make.fun/c/best-game-01)
[![Rank](https://make.fun/badge/best-game-01/Mhmdzulfi/dawnwatch-best-game-01/rank.svg)](https://make.fun/c/best-game-01)
[![Reward](https://make.fun/badge/best-game-01/Mhmdzulfi/dawnwatch-best-game-01/reward.svg)](https://make.fun/c/best-game-01)

## The game

Guard the dawn crystal at the centre of the field against twelve waves of night shards. Aim the turret with the mouse or the A/D keys and shoot the shards before they reach the crystal. Glowing orbs drop power-ups: tri-shot, rapid fire, and the aegis shield. Survive all twelve waves to see the dawn.

## How it is built

- `game/` — the game itself: a dependency-free HTML/JS canvas game (`game/index.html`, sources in `game/src/`).
- `main.ts` — the competition entrypoint: copies the game and its screenshots into the output directory and writes the entry dossier.
- `screenshots/` — real screenshots of the game running in a browser (title, play, siege, end).
- `vendor/makefun-game.ts` — the competition's dossier helper, shipped by the kit.

## Play it locally

```
node serve.ts
```

then open the printed address in a browser.

## License

MIT — see `LICENSE`.
