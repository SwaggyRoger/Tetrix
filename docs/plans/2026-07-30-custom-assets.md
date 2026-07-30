# Custom assets — Decision Record (2026-07-30)

Closes issue #1 ("Architecture fix": *add an "asset" folder so we can add our
own media*).

## Goal
Let anyone drop their own artwork in and see it in the game **without touching
code and without re-running the build**, while keeping the two properties the
project already had: a double-clickable single-file `index.html`, and a game
that always starts.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Folder name | `assets/` (issue said "asset") | Plural is the near-universal convention; trivially renameable if the issue author prefers the literal name. |
| Manifest format | `assets/manifest.js` assigning `window.TETRIX_ASSETS`, **not** `manifest.json` | `fetch()`/XHR are blocked on `file://` (null origin), so the double-clickable `index.html` could never read a `.json`. A `<script src>` tag reads fine from `file://`. This constraint drives the whole design. |
| Asset delivery | Images stay **external** files, loaded at runtime; only code is bundled into `index.html` | The whole point is swapping art without a build. Base64-embedding at build time would restore the true single file but make the art unswappable — the opposite of the request. |
| Distribution unit | folder = `index.html` + `assets/` | Consequence of the above. `index.html` alone still plays, with the built-in painting. |
| Load timing | Painted sprites render immediately; images repaint the sprites when (and if) they arrive | Artwork is an upgrade, never a startup gate. First frame is unchanged in speed. |
| Failure policy | Malformed **manifest** → `console.error` naming the field, fall back. Missing/broken **file** → `console.warn`, that piece keeps its painted sprite. | Typos must be findable; a bad PNG must never cost you the game. Recorded as README design rule 8. |
| Partial skins | Supported — `cells` may name any subset of `I J L O S T Z` | Lets someone replace one piece without producing a full set. |
| Ghost pieces | Derived from the same image (alpha + dashed border) | No second set of files to author. |
| Validation | `validateManifest()` is pure (no DOM/Image) and unit-tested in Node | Keeps the loud-vs-quiet rules pinned down without a browser. |

## Changed
- **new** `assets/{manifest.js,README.md}`, `assets/skins/example/*.png` (7 demo tiles)
- **new** `src/assets/loader.js` — validation + preload, no DOM in the pure part
- **new** `tests/assets.test.mjs` — 10 tests over the validation rules
- `src/render/sprites.js` — `createSprites(palette, cellSize, images = {})`; blit an
  image when given one, otherwise paint dabs exactly as before
- `src/main.js` — loads the skin after first paint, rebuilds renderers on success
- `dev.html` — plain `<script src="assets/manifest.js">` before the module entry
- `build.mjs` — `assets/loader.js` added to `MODULES`
- `README.md` — architecture map, design rule 8, distribution note, test command

## Non-scope (deliberately not built)
- **Audio.** There is no sound system at all yet; a loader alone would not make a
  dropped `.mp3` audible. Needs `src/audio/` subscribing to `lock`/`lineclear`/
  `levelup`, then an `audio` block in the manifest. See README roadmap.
- **Background / UI images.** Same manifest can grow a `background` key later.
- **Rule extensibility** (new pieces, new scoring). Separate concern: piece shapes
  and kicks are still hardwired in `core/tetromino.js`, and scoring/level curve
  are inline in `core/game.js`. Would be its own decision record.

## Verified (2026-07-30)
24/24 unit tests. In a real browser, on both `dev.html` (modules over http) and the
generated `index.html`:
- `activeSkin: null` → unchanged impressionist painting, **zero** console output
- `activeSkin: 'example'` → all 7 pieces, ghost and Next/Hold previews use the PNGs;
  `[tetrix/assets] skin "example" applied (7 pieces)`
- one broken path → `could not load … for piece T — painted sprite used instead`,
  6 pieces skinned, T painted, game playable
- `activeSkin` naming a missing skin → `console.error` listing available skins, whole
  board falls back, game playable
- `index.html` opened directly from `file://` loads `assets/manifest.js` and its PNGs

Note: browsers cache `assets/manifest.js` aggressively on `file://` — a hard reload
is needed after editing it. Worth knowing before someone reports "my skin doesn't apply".
