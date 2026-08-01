# Game modes — Decision Record (2026-08-01)

Partly closes issue #3 (*enrich the game: combos, several selectable modes, ZT
stacking, a combo reward*). This branch delivers **item 2, the modes**, to the
shape the issue author specified in follow-up: three new modes rather than
five, with the remaining two and the hard-mode acceleration deferred.

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| How a mode differs | A `rules` object passed to `createGame` (`topOut`, `sendsGarbage`, `gravityScale`), defaulting to classic behaviour | A mode then *declares only what it changes*. No `if (mode === …)` anywhere in the core, and a future mode is a new rules object rather than a new branch through the state machine. |
| No Brainer's ceiling | On top-out, `dropBottomRow()` — the bottom row is destroyed and everything falls one — then play continues | Exactly what was asked for ("到頂線的時候最下面一行被堆疊的結果直接被消失"). Spawn retries the rescue up to `rows` times, because one freed row is not always enough to seat a buried piece. |
| Rescue scoring | No points, no combo, no line count | It is a bailout, not an achievement. Counting it as a clear would make the mode the best way to farm score, which would quietly break Classic's leaderboard. |
| Map levels | Text patterns in `config.js`, bottom-aligned, `'#'` = stone | Drawing a level needs no code and no tooling — you can read the shape straight out of the config. Difficulty is layout **plus** a per-level `gravityScale`. |
| Map win condition | "No cells of type `G` remain" | One rule, trivially checkable, and it composes with the junk mechanic instead of duplicating it. `garbageLeft()` drives both the HUD readout and the advance. |
| Junk cell type | A new type `G`, painted stone-grey via `PALETTE` | `createSprites` walks the palette, so junk got a sprite for free. Grey is the only unpainted colour in a Monet palette — "not yours, dig it out" reads instantly. |
| Versus rules | All three offered at the start screen, not one chosen for the player | Asked for explicitly ("我希望可以是能選擇的"). KO, Timed and Score Race differ in whether junk flies and whether a clock runs — one selector, three genuinely different games. |
| Junk table | 2/3/4 rows send 1/2/4, a single sends nothing; combo adds a growing bonus | A single sending nothing is what stops the dominant strategy from being "clear one row as fast as possible". The combo bonus is the versus half of issue #3's combo request. |
| Junk cancellation | Lines cleared cancel incoming junk before any is forwarded | Standard versus rule, and the thing that makes a big hit survivable: attacking *is* defending. Without it a first strike snowballs and the match is decided in ten seconds. |
| Junk delivery timing | After the *next* lock, never mid-piece | A board that shifts under a falling piece feels broken rather than hard. |
| Junk holes | One hole per delivery, not per row | A four-row hit is then dug out with one well-placed I. Per-row holes make a big attack unrecoverable. |
| Two players | Two `createGame` instances, two `createKeyboard` instances, two HUDs | Both were already factories with injected dependencies — versus needed no change to either. The work was all in the presentation layer. |
| Player-column markup | One `<template>` in `dev.html`, stamped once or twice by `main.js` | Duplicating a whole column in HTML guarantees the two drift apart. Ids became `data-` attributes scoped to the column, which is what let `createHud` become per-player. |
| Key split | P1 keeps its set (plus `/` for rotate-CCW); P2 gets `A W S D / Q E / F` | P1's whole set is now reachable from the right of the keyboard, which is what frees the left hand for P2. No key is shared. Ghosting on cheap keyboards is a hardware limit and is documented rather than worked around. |
| Session lifecycle | Picking a mode destroys the previous session wholesale and rebuilds | Half-resetting a two-player match (clock, winner, junk in flight) is where the bugs would live. Teardown is one function and listeners die with the emitters. |
| Board sizing | `fitCellSize` now also fits the **width**, divided by the number of boards | Two boards side by side is the first layout that can be width-bound rather than height-bound. |

## Changed
- **new** `src/core/modes.js` (mode ids, versus rules, `rulesFor`, `createCampaign`),
  `src/core/match.js` (junk routing, clock, winner), `src/ui/menu.js`
- **new** `tests/modes.test.mjs` (19 tests)
- `src/core/board.js` — `dropBottomRow`, `pushGarbage`, `applyPattern`, `countType`
- `src/core/game.js` — `rules`, `GARBAGE`, rescue on top-out, junk send/cancel/land,
  `receiveGarbage`, `loadPattern`, `garbageLeft`, `setRules`, `finish`;
  new `rescue` and `garbagelanded` events
- `src/config.js` — `MAP_LEVELS`, `VERSUS`, `KEYS_P2`, `BOARD_MARGIN_PX`,
  `PALETTE.G`, `SCORING.garbageLines`/`comboGarbage`, `AUDIO.rescue`/`AUDIO.garbage`
- `src/ui/hud.js` — one HUD per player column, `announce`, `setRow`, `setLabel`
- `src/main.js` — rebuilt around a session; `src/audio/sound.js`, `src/audio/loader.js`
- `dev.html`, `styles.css`, `build.mjs`, `README.md`

## Verified (2026-08-01)

**66/66 unit tests pass** (47 existing + 19 new).

> ⚠️ **Node is not installed on the machine this was built on**, so
> `node --test tests/` and `node build.mjs` were *not* run here. Instead:
> - the repo's real `.test.mjs` files were executed **unmodified** in a browser,
>   with `node:test` / `node:assert/strict` supplied through an import map —
>   the assertions and the modules under test are the committed ones;
> - `index.html` was generated by a line-for-line Python port of `build.mjs`,
>   which was first proved **byte-identical** to the committed `index.html`
>   when run against the committed sources.
>
> Both commands should still be run before merging, as the final check.

**In a real browser**, on both `dev.html` (ES modules) and the generated
`index.html` (single file), with no console errors in either:

- **Menu** — four modes by click and by digit; the versus screen offers all
  three rule sets and backs out to the mode list.
- **Classic** — unchanged from before this branch: same board, same cell size
  (28 px at 1280×720), same HUD.
- **No Brainer** — 400 hard drops with no lateral movement: 696 rescues, state
  still `playing`. Classic under the identical loop is `gameover`.
- **Map** — level 1 paints 17 stone cells bottom-aligned as drawn; the HUD
  reads `Level 1/5 · Lily Pond 睡蓮池` and `STONE 17`. Clearing the stone rows
  advances to level 2 (36 cells), pauses, shows the level card, and `Continue`
  resumes play.
- **Versus** — a tetris on P1 queues 4 junk rows on P2; they land on P2's next
  lock as four rows sharing one hole column, pushing P2's stack up. A top-out
  ends the match with `WINNER 勝` / `DEFEAT 敗`, the reason, and the score line.
  The Timed rule shows a live `2:00` clock on both columns; the KO rule shows
  none.
- **Lifecycle** — pause overlay's `Menu` empties the frame and reopens the
  picker; `R` restarts with a clean board and zero score.
- **Layout** — no overflow in either axis at 1280×720 or 1024×700; versus at
  1024×700 falls back to a 20 px cell.

**Not verified:** how the two new cues (`rescue`, `garbage`) actually *sound* —
only that they are wired and scheduled. Both live in `AUDIO` in `config.js` for
exactly that reason. Two players also share one audio bus, so a cue does not
tell you whose board it came from.

## Non-scope
- **Issue #3 items 1, 3 and 4.** A combo *readout* is included (the HUD shows
  `×N` while a run is alive, in every mode) and combos now pay in versus junk —
  but combo **scoring**, the **ZT stacking** mechanic and its visual effect,
  and the reward for five combos within a line budget are all still open. ZT
  was never defined precisely enough to build; it needs a spec before code.
- **The other two modes and the hard-mode acceleration** from the original
  five-mode request. `rulesFor` and `gravityScale` are the hooks they will use;
  the menu has room for them.
- Per-player audio panning, and more than two players.
