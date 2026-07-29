# Tetrix — An Impressionist Tetris 印象派俄羅斯方塊

A browser Tetris rendered like an impressionist painting: every block is
painted with layered brush dabs in a Monet-inspired palette, and cleared
lines burst into hearts and stars.

**Zero dependencies. No build step.** Vanilla JavaScript ES modules — any
static file server runs it, and the game core is unit-tested in plain Node.

## Run it

```bash
npx http-server -p 8123 .
# then open http://localhost:8123
```

(Any static server works — ES modules just can't load from `file://`.)

## Test it

```bash
node --test tests/
```

Tests cover only `src/core/` (pure logic). Rendering/effects are verified
visually — see `docs/plans/` for the verification checklist.

## Controls

| Key | Action |
|---|---|
| ← → | Move 移動 |
| ↑ / X | Rotate clockwise 順時針旋轉 |
| Z | Rotate counter-clockwise 逆時針旋轉 |
| ↓ | Soft drop 緩降 |
| Space | Hard drop 直落 |
| C / Shift | Hold 保留方塊 |
| P / Esc | Pause 暫停 |
| R | Restart 重新開始 |

## Architecture 架構

```
index.html            entry page (5 canvases + HUD markup)
styles.css            page chrome only — game visuals are all canvas
src/
├── config.js         ★ ALL tunables: board size, speed curve, palette,
│                       particle settings, key bindings. Start here.
├── main.js           composition root — the only file that imports everything
├── core/             PURE game logic. No DOM, no canvas. Runs in Node.
│   ├── tetromino.js  shapes, rotation states, SRS wall-kick tables
│   ├── bag.js        7-bag randomizer (RNG injectable for tests)
│   ├── board.js      grid, collision, line detect/clear
│   ├── game.js       state machine: gravity, lock delay, scoring, hold
│   └── emitter.js    tiny pub/sub so core can announce events
├── render/           reads game state, draws it. Never mutates game state.
│   ├── sprites.js    impressionist cell painting (pre-rendered offscreen)
│   ├── background.js Monet-style page backdrop
│   └── renderer.js   per-frame board/ghost/next/hold drawing
├── effects/
│   └── particles.js  heart & star bursts on line clear
├── input/
│   └── keyboard.js   key mapping + DAS auto-repeat (actions injected)
└── ui/
    └── hud.js        score/level/lines DOM bindings, overlay, high score
tests/
└── core.test.mjs     node --test unit tests over src/core/
docs/plans/           decision records & implementation plans per feature
```

### Design rules (please keep these when contributing)

1. **`core/` stays pure.** No `document`, no `window`, no canvas imports.
   That's what keeps it testable in Node and the logic reusable.
2. **One-way data flow.** `core` emits events → `render`/`effects`/`ui`
   consume them. Rendering never mutates game state.
3. **Tunables go in `config.js`**, not inline. Changing game feel or the
   palette must never require touching logic files.
4. **`main.js` is the only wiring point.** New modules (sound, touch input,
   gamepad) get created as siblings and wired there — nothing else changes.
5. Add a test in `tests/` for any rule change in `core/`, and run
   `node --test tests/` before pushing.

## Extension ideas (roadmap, not yet built)

- Sound: add `src/audio/` module, subscribe to `lineclear` / `lock` /
  `levelup` events in `main.js`.
- Touch controls: add `src/input/touch.js` exposing the same injected-actions
  interface as `keyboard.js`.
- More paintings: alternative palettes (Van Gogh, Renoir) are just another
  `PALETTE` object in `config.js`.

## Debugging

The running game exposes `window.__tetrix = { gameApi, particles, config }`
in the console — you can inspect state, force pieces, or trigger bursts.
