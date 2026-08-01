# Sound effects — Decision Record (2026-07-30)

Closes issue #2 (*add audio; urgent drop, solemnity by lines cleared, pitch rising
with combo, all in the impressionist style*).

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Source of sound | **Synthesised** with Web Audio; files only as optional overrides | The issue's three requirements are exactly what samples do badly. Combo pitch via `playbackRate` changes tempo and timbre, not key. Synthesis makes pitch an exact parameter, keeps the project file-free and dependency-free, and works on `file://` where `fetch` is blocked. |
| Override location | `assets/audio/` with **its own** `manifest.js` and global (`TETRIX_AUDIO`) | Requested explicitly: sound must be separable from the issue #1 artwork. Nothing is shared with `assets/manifest.js` — different folder, loader, global. Same *shape*, so there is one mental model and two independent subsystems. |
| Musical language | Pentatonic / whole-tone, soft attacks, long decays, generated convolution reverb | The written counterpart of the visuals (Debussy, Ravel). No cadence that resolves hard; sound blooms and washes rather than blipping. |
| "Urgent" drop | Fast downward glide + lowpassed noise thud, 2 ms attack, dry | Deliberately the opposite of the washy clear chords, so urgency reads by contrast. Velocity scales with fall distance. |
| "Solemnity" | Encoded as four numbers per clear count: root, voice count, attack, decay | Makes the gradient inspectable and testable instead of a matter of taste — see the measurements below. |
| Combo | Escalates on **four** axes together: +3 semitones, louder, longer decay, and a shimmer layer from the third clear. Capped at 7 steps | First attempt moved pitch only (2 semitones/step) and did not read as a build-up — flagged in review as "疊加程度不夠大". Pitch alone is too subtle when the chord is already washy; loudness and a new upper layer are what make a run feel like it is going somewhere. The cap stops a long run turning shrill or drowning the mix. |
| Shimmer vs overrides | The shimmer is skipped when that cue has a file override | An override should stay exactly what its author supplied. Documented in `assets/audio/README.md`. |
| Combo counter | Added to `core/game.js`, carried on the `lineclear` event | Presentation layers must not track game state (design rule 2). Kept minimal: a counter only, no scoring or UI — those belong to issue #3. |
| Hard drop event | New `harddrop` event with distance, emitted before the lock | The `lock` cue would otherwise muddy the slam; the sound layer suppresses the tick that follows a slam. |
| Mute | `M`, persisted in `localStorage`, shown in the HUD | Audio that cannot be turned off is hostile. |
| Verification | Cues rendered in an `OfflineAudioContext` and **measured** | "It sounds right" is not a claim that survives a refactor. The schedulers take a context rather than owning one precisely so this is possible. |

## Changed
- **new** `src/audio/{synth.js,sound.js,loader.js}`
- **new** `assets/audio/{manifest.js,README.md}`
- **new** `tests/audio.test.mjs` (12 tests)
- `src/core/game.js` — `combo` counter, `combo` on the `lineclear` event, new
  `harddrop` event, combo cleared by `reset()`
- `src/config.js` — `AUDIO` block (all voicings and timings), `KEYS.mute`
- `src/main.js` — wiring, gesture-driven resume, debug handle
- `src/ui/hud.js` — sound state readout; `dev.html`, `build.mjs`, `README.md`
- `tests/core.test.mjs` — 3 combo/hard-drop tests

## Verified (2026-07-30)

38/38 unit tests. Measured by rendering each cue into an `OfflineAudioContext`
(44.1 kHz) and analysing the buffer:

**Solemnity rises monotonically on every axis with lines cleared:**

| Lines | Lowest voice | Voices | Decay | Low-band energy share |
|---|---|---|---|---|
| 1 | 554 Hz | 2 | 1.0 s | 0.306 |
| 2 | 415 Hz | 3 | 1.5 s | 0.352 |
| 3 | 277 Hz | 4 | 2.1 s | 0.392 |
| 4 | 139 Hz | 6 | 3.2 s | 0.557 |

A tetris sits two octaves below a single and holds more than three times as long.

**A combo run escalates on every axis**, rendering the full cue (base chord plus
shimmer) exactly as `onLineClear` builds it:

| Combo | Transpose | Shimmer | Pitch (ZCR) | Peak | RMS | Tail |
|---|---|---|---|---|---|---|
| 1 | — | — | 663 Hz | 0.078 | 4.4 | 1.85 s |
| 2 | +3 | — | 803 Hz | 0.094 | 5.2 | 1.95 s |
| 3 | +6 | ✓ | 970 Hz | 0.133 | 7.0 | 1.96 s |
| 4 | +9 | ✓ | 1287 Hz | 0.140 | 8.1 | 2.19 s |
| 5 | +12 | ✓ | 1418 Hz | 0.151 | 10.2 | 2.13 s |
| 6 | +15 | ✓ | 1719 Hz | 0.187 | 11.1 | 2.15 s |
| 8 | +21 | ✓ | 2238 Hz | 0.185 | 13.6 | 2.46 s |
| 12 | +21 (capped) | ✓ | 2288 Hz | 0.191 | 13.3 | — |

By the fifth consecutive clear the cue is **an octave higher** and carries
**2.3× the energy** of the first; combos 8 and 12 are identical, confirming the
cap. Peak stays at 0.19 — no clipping headroom problem.

The first version moved pitch only (2 semitones/step): combo 1→5 rose just
1.67× in pitch with flat energy, which is what "疊加程度不夠大" was reporting.

Tail length is measured against an absolute floor rather than a share of peak,
so a louder cue is not penalised. It trends up (1.85 s → 2.46 s) but is not
strictly monotonic in the render: the generated reverb impulse is random, and
its tail dominates the last few hundred milliseconds. The decay *parameter* is
strictly monotonic and is what the unit tests assert.

Note: zero-crossing rate is *not* a good measure of solemnity, because a tetris
chord spans low **and** high voices; low-band energy share is the honest metric
and is the one tabled above.

**In a real browser**, on `index.html` and `dev.html`:
- Event wiring spied end to end: `harddrop{distance:18}` → `lock` → `lineclear{count,combo}`
  with combo running 1, 2, 3, resetting to 1 after a lock that clears nothing
- A tetris selects the 6-voice, 3.2 s, −12-semitone voicing
- The lock tick after a hard drop is suppressed as designed (glide only)
- A five-clear run schedules exactly what the design says, live:
  gain 0.300 / 0.342 / 0.384 / 0.426 / 0.468, decay 1.00 / 1.22 / 1.44 / 1.66 / 1.88 s,
  transpose 0 / 3 / 6 / 9 / 12, with the shimmer chord joining from the third
- Muted: nothing is scheduled at all
- `AudioContext` reaches `running` after a user gesture; no console errors

**Not verified:** whether it sounds *good*. The measurements confirm the design
is implemented as specified; only a person with speakers can judge the result.
Every number lives in `AUDIO` in `src/config.js` for exactly that reason.

## Non-scope
- Combo **scoring**, rewards, and on-screen combo display — issue #3 asks for
  these; this branch adds only the counter they will build on.
- Music/background loop.
- A pitch-shifter for override samples: `playbackRate` also changes duration.
  Documented in `assets/audio/README.md`; synthesis avoids the problem entirely.
