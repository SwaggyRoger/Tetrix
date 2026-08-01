// Unit tests for the audio manifest validator and the combo→pitch mapping.
// Both are pure (no Web Audio, no DOM), so the rules that decide "loud error"
// vs "quiet fallback" — and the shape of the combo transposition — are pinned
// down here in Node. The synthesis itself is verified by rendering it offline
// in a real browser; see docs/plans/.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateAudioManifest, AUDIO_CUES, AUDIO_MANIFEST_VERSION } from '../src/audio/loader.js';
import { comboShift } from '../src/audio/sound.js';
import { semitoneHz } from '../src/audio/synth.js';
import { AUDIO } from '../src/config.js';

const manifest = (over = {}) => ({
  version: AUDIO_MANIFEST_VERSION,
  activeSet: 's',
  sets: { s: { cues: { hardDrop: 'assets/audio/samples/slam.mp3' } } },
  ...over,
});

test('no audio manifest is a normal state — everything synthesised', () => {
  for (const raw of [undefined, null]) {
    const r = validateAudioManifest(raw);
    assert.equal(r.set, null);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  }
});

test('activeSet null means synthesise everything, without complaint', () => {
  const r = validateAudioManifest(manifest({ activeSet: null }));
  assert.equal(r.set, null);
  assert.deepEqual(r.errors, []);
});

test('a partial cue set is valid and warns about nothing', () => {
  const r = validateAudioManifest(manifest());
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, [], 'unnamed cues are synthesised silently, not warned about');
  assert.deepEqual(r.set.cues, { hardDrop: 'assets/audio/samples/slam.mp3' });
});

test('an unsupported version fails loudly', () => {
  for (const version of [2, '1', undefined]) {
    const r = validateAudioManifest(manifest({ version }));
    assert.equal(r.set, null);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0], /version/);
  }
});

test('activeSet naming a missing set lists what is available', () => {
  const r = validateAudioManifest(manifest({ activeSet: 'nope' }));
  assert.equal(r.set, null);
  assert.match(r.errors[0], /"nope"/);
  assert.match(r.errors[0], /available: s/);
});

test('malformed shapes are errors, not crashes', () => {
  const cases = [
    ['array', []],
    ['string', 'sounds'],
    ['sets missing', { version: AUDIO_MANIFEST_VERSION, activeSet: 's' }],
    ['cues missing', { version: AUDIO_MANIFEST_VERSION, activeSet: 's', sets: { s: {} } }],
    ['activeSet not a string', manifest({ activeSet: 3 })],
  ];
  for (const [label, raw] of cases) {
    const r = validateAudioManifest(raw);
    assert.equal(r.set, null, label);
    assert.equal(r.errors.length, 1, label);
  }
});

test('blank paths and unknown cue names are dropped with a warning', () => {
  const r = validateAudioManifest(manifest({ sets: { s: { cues: { lock: '  ', bogus: 'x.mp3' } } } }));
  assert.deepEqual(r.errors, []);
  assert.equal(r.set.cues.lock, undefined);
  assert.equal(r.set.cues.bogus, undefined);
  assert.equal(r.warnings.filter((w) => /cues\.lock/.test(w)).length, 1);
  assert.equal(r.warnings.filter((w) => /cues\.bogus/.test(w)).length, 1);
});

test('every cue the sound module can play is a known cue name', () => {
  for (const n of [1, 2, 3, 4]) assert.ok(AUDIO_CUES.includes(`clear${n}`));
  for (const n of ['lock', 'hardDrop', 'levelUp', 'gameOver']) assert.ok(AUDIO_CUES.includes(n));
  // config must define a voicing for each clear count the game can produce
  for (const n of [1, 2, 3, 4]) assert.ok(AUDIO.clears[n], `AUDIO.clears[${n}] missing`);
});

test('combo transposition: first clear unshifted, then rising, then capped', () => {
  assert.equal(comboShift(AUDIO, 1), 0, 'a lone clear is not transposed');
  assert.equal(comboShift(AUDIO, 2), AUDIO.comboSemitonesPerStep);
  assert.equal(comboShift(AUDIO, 4), 3 * AUDIO.comboSemitonesPerStep);
  const capped = AUDIO.maxComboSteps * AUDIO.comboSemitonesPerStep;
  assert.equal(comboShift(AUDIO, 99), capped, 'stops rising at maxComboSteps');
  assert.equal(comboShift(AUDIO, 0), 0, 'a zero/absent combo is safe');
});

test('a higher combo is a strictly higher frequency', () => {
  const hz = (combo) => semitoneHz(AUDIO.rootHz, AUDIO.clears[1].semitones[0] + comboShift(AUDIO, combo));
  const pitches = [1, 2, 3, 4, 5].map(hz);
  for (let i = 1; i < pitches.length; i++) {
    assert.ok(pitches[i] > pitches[i - 1], `combo ${i + 1} must be higher than combo ${i}`);
  }
});

test('solemnity gradient: more lines means lower, fuller and longer', () => {
  const c = AUDIO.clears;
  for (const n of [2, 3, 4]) {
    assert.ok(c[n].semitones.length >= c[n - 1].semitones.length, `${n} lines: at least as many voices`);
    assert.ok(c[n].decay > c[n - 1].decay, `${n} lines: longer decay`);
    assert.ok(c[n].attack > c[n - 1].attack, `${n} lines: softer attack`);
    assert.ok(
      Math.min(...c[n].semitones) <= Math.min(...c[n - 1].semitones),
      `${n} lines: reaches at least as low`,
    );
  }
  assert.ok(Math.min(...c[4].semitones) < Math.min(...c[1].semitones), 'a tetris is the lowest of all');
});
