// Unit tests for the asset manifest validator. Run with: node --test tests/
// validateManifest is deliberately pure (no DOM, no Image) so the rules that
// decide "loud error" vs "quiet fallback" are pinned down here in Node.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateManifest, PIECE_TYPES, MANIFEST_VERSION } from '../src/assets/loader.js';

const fullCells = Object.fromEntries(PIECE_TYPES.map((t) => [t, `assets/skins/x/${t}.png`]));
const manifest = (over = {}) => ({
  version: MANIFEST_VERSION,
  activeSkin: 'x',
  skins: { x: { cells: fullCells } },
  ...over,
});

test('no manifest at all is a normal state, not an error', () => {
  for (const raw of [undefined, null]) {
    const r = validateManifest(raw);
    assert.equal(r.skin, null);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  }
});

test('activeSkin null means "use the painted sprites" without complaint', () => {
  const r = validateManifest(manifest({ activeSkin: null }));
  assert.equal(r.skin, null);
  assert.deepEqual(r.errors, []);
});

test('a complete manifest resolves every piece type', () => {
  const r = validateManifest(manifest());
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.skin.name, 'x');
  assert.deepEqual(Object.keys(r.skin.cells).sort(), [...PIECE_TYPES].sort());
});

test('an unsupported version fails loudly and yields no skin', () => {
  for (const version of [2, '1', undefined]) {
    const r = validateManifest(manifest({ version }));
    assert.equal(r.skin, null);
    assert.equal(r.errors.length, 1);
    assert.match(r.errors[0], /version/);
  }
});

test('activeSkin pointing at a missing skin names the available ones', () => {
  const r = validateManifest(manifest({ activeSkin: 'nope' }));
  assert.equal(r.skin, null);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /"nope"/);
  assert.match(r.errors[0], /available: x/);
});

test('a malformed manifest shape is an error, not a crash', () => {
  const cases = [
    ['array', []],
    ['string', 'skins/x'],
    ['skins missing', { version: MANIFEST_VERSION, activeSkin: 'x' }],
    ['cells missing', { version: MANIFEST_VERSION, activeSkin: 'x', skins: { x: {} } }],
    ['activeSkin not a string', manifest({ activeSkin: 7 })],
  ];
  for (const [label, raw] of cases) {
    const r = validateManifest(raw);
    assert.equal(r.skin, null, label);
    assert.equal(r.errors.length, 1, label);
  }
});

test('a partial skin is valid — missing pieces warn and keep the painted sprite', () => {
  const r = validateManifest(manifest({ skins: { x: { cells: { I: 'a.png', O: 'b.png' } } } }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(Object.keys(r.skin.cells).sort(), ['I', 'O']);
  assert.equal(r.warnings.length, PIECE_TYPES.length - 2);
  for (const w of r.warnings) assert.match(w, /painted sprite/);
});

test('blank paths and unknown piece keys are dropped with a warning', () => {
  const r = validateManifest(
    manifest({ skins: { x: { cells: { ...fullCells, S: '   ', Q: 'q.png' } } } }),
  );
  assert.deepEqual(r.errors, []);
  assert.equal(r.skin.cells.S, undefined);
  assert.equal(r.skin.cells.Q, undefined);
  assert.equal(r.warnings.filter((w) => /cells\.S/.test(w)).length, 1);
  assert.equal(r.warnings.filter((w) => /cells\.Q/.test(w)).length, 1);
});

test('paths are trimmed', () => {
  const r = validateManifest(manifest({ skins: { x: { cells: { I: '  a.png\n' } } } }));
  assert.equal(r.skin.cells.I, 'a.png');
});

test('a skin naming no usable image warns but still is not an error', () => {
  const r = validateManifest(manifest({ skins: { x: { cells: {} } } }));
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.skin.cells, {});
  assert.ok(r.warnings.some((w) => /no usable images/.test(w)));
});
