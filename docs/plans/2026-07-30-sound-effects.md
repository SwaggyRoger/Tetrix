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
| Combo | Whole-tone transposition, 2 semitones per consecutive clear, capped at 6 steps | A real key change, consonant with the scale. The cap stops a long run turning shrill. |
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

**Combo raises pitch monotonically** (zero-crossing rate as a pitch proxy):
607 → 759 → 771 → 1014 → 1318 Hz for combos 1, 2, 3, 5, 9. Combo 9 is capped at
12 semitones — exactly double combo 1, as designed.

Note: zero-crossing rate is *not* a good measure of solemnity, because a tetris
chord spans low **and** high voices; low-band energy share is the honest metric
and is the one tabled above.

**In a real browser**, on `index.html` and `dev.html`:
- Event wiring spied end to end: `harddrop{distance:18}` → `lock` → `lineclear{count,combo}`
  with combo running 1, 2, 3, resetting to 1 after a lock that clears nothing
- A tetris selects the 6-voice, 3.2 s, −12-semitone voicing
- The lock tick after a hard drop is suppressed as designed (glide only)
- Combo transposition at the synth: shift 0, 2, 4 semitones for combos 1, 2, 3
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
