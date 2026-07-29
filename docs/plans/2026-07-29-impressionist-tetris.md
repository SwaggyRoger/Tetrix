# Impressionist Tetris — Implementation Plan (2026-07-29)

Decisions: see `2026-07-29-impressionist-tetris-decisions.md`.

## File layout

```
tetrix/
├── index.html              entry page, loads src/main.js as module
├── styles.css              page chrome (frame, HUD typography)
├── README.md               architecture map + how to run/test/contribute
├── .gitignore
├── docs/plans/             this plan + decision record
├── src/
│   ├── config.js           ALL tunables: board size, gravity curve, palette, effects
│   ├── main.js             composition root: builds game, renderer, input, loop
│   ├── core/               PURE logic — no DOM, no canvas, importable in Node
│   │   ├── tetromino.js    shapes, rotation states, SRS-lite kick tables
│   │   ├── bag.js          7-bag randomizer (injectable RNG for tests)
│   │   ├── board.js        grid, collision, line detection/clearing
│   │   └── game.js         state machine: gravity, lock delay, scoring, levels, hold
│   ├── render/
│   │   ├── sprites.js      impressionist cell sprites (pre-rendered offscreen)
│   │   ├── background.js   Monet-style painted backdrop
│   │   └── renderer.js     draws board/ghost/next/hold each frame
│   ├── effects/
│   │   └── particles.js    heart & star particles on line clear
│   ├── input/
│   │   └── keyboard.js     key mapping + DAS auto-repeat
│   └── ui/
│       └── hud.js          score / level / lines / high score DOM bindings
└── tests/
    └── core.test.mjs       node --test over core/
```

## Tasks (executed inline, in order)

1. **Core logic** — tetromino defs, bag, board, game state machine. Events emitted
   (`lineclear`, `lock`, `gameover`, `levelup`) so render/effects subscribe without
   coupling. Verify: unit tests pass.
2. **Config + composition root** — `config.js`, `main.js`, `index.html`, `styles.css`.
3. **Impressionist rendering** — sprite pre-render with paint dabs, background,
   per-frame renderer with ghost piece + next/hold previews.
4. **Effects** — particle system; hearts + stars spawn from cleared cells.
5. **Input + HUD** — keyboard with DAS, pause, restart; HUD with localStorage high score.
6. **Docs + git** — README, .gitignore, git init + initial commit.

## Verification gates
- `node --test tests/` → 0 failures
- Launch via static server, screenshot: painterly board visible, piece falls
- Force a line clear via `window.__tetrix` debug handle → hearts/stars visible
- Keyboard: move/rotate/soft/hard drop/hold/pause all respond
