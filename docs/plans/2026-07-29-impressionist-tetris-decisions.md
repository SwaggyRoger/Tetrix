# Impressionist Tetris — Decision Record (2026-07-29)

## Goal
A browser Tetris game with:
1. Maintainable, collaboration-friendly architecture
2. Impressionist (印象派) visual style — painterly brush-stroke blocks, Monet-like palette
3. Heart / star particle effects when lines are cleared

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Tech stack | Vanilla JS + ES modules, **no framework, no build step** | Zero tooling to learn; any collaborator can open `index.html` behind any static server. Smallest possible maintenance surface. |
| Rendering | HTML5 Canvas (2 layers: board + particles) | Painterly strokes need per-pixel control; DOM/CSS can't do brush textures. |
| Architecture | Layered: `core/` (pure logic, no DOM) ÷ `render/` ÷ `effects/` ÷ `input/` ÷ `ui/` | Pure core is unit-testable in Node without a browser; renderers are swappable. |
| Testing | Node built-in test runner (`node --test`) over the pure core | No dev-dependencies at all; CI-ready with one command. |
| Impressionist technique | Pre-render each cell sprite once to an offscreen canvas using layered random "dabs" (short strokes with hue/alpha jitter), then blit | Painterly look at 60 fps without per-frame stroke cost. |
| Effects | Custom particle system drawing heart/star paths, spawned per cleared cell | Small (~100 lines), no library needed. |
| Rotation system | SRS-lite (standard spawn orientations + wall kicks for JLSTZ/I) | Familiar feel to Tetris players; simple enough to maintain. |
| Randomizer | 7-bag | Standard, prevents droughts, trivially testable. |
| Config | All tunables in `src/config.js` | Collaborators change speed/palette/effects without touching logic. |
| Version control | `git init` on `main`, conventional layout, README with architecture map | Requested collaboration-readiness. |

## Non-scope (deferred — see README roadmap)
- Sound / music
- Touch controls / mobile layout
- Online leaderboard, persistence beyond `localStorage` high score
- Hold piece is IN scope (cheap, expected by players); ghost piece IN scope.

## What shipped vs planned
Shipped as planned (2026-07-29). All 13 core unit tests pass; verified in a real
browser: painterly rendering, ghost piece, next/hold previews, keyboard event
path, pause/restart, and the heart/star burst on line clear (60 particles for a
single-line clear at 6/cell). One test-authoring fix during Verify: the forced
I-piece x-coordinate in two tests was off by one (piece origin vs occupied
columns). Debug handle `window.__tetrix` was extended with `renderer`/`hud` to
allow manual frame driving when the browser pane isn't compositing (rAF paused).
