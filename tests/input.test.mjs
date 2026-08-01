// Unit tests for key binding resolution. buildKeyMap is pure, so the rules that
// make shortcuts survive an IME and Caps Lock are pinned down here in Node.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildKeyMap } from '../src/input/keyboard.js';
import { KEYS } from '../src/config.js';

const map = buildKeyMap(KEYS);
// Mirrors keyboard.js: event.key first, event.code as the fallback.
const resolve = (e) => map.get(e.key) ?? map.get(e.code);

test('letter shortcuts work in either case', () => {
  const cases = [['c', 'hold'], ['p', 'pause'], ['r', 'restart'], ['z', 'rotateCCW'], ['x', 'rotateCW']];
  for (const [lower, action] of cases) {
    const code = `Key${lower.toUpperCase()}`;
    assert.equal(resolve({ key: lower, code }), action, `lowercase ${lower}`);
    assert.equal(resolve({ key: lower.toUpperCase(), code }), action, `uppercase ${lower}`);
  }
});

test('an IME swallowing the letter still triggers the action', () => {
  // With 注音/kana/pinyin active a letter keydown reports key === 'Process';
  // this is the regression that made shortcuts appear to need capitals.
  assert.equal(resolve({ key: 'Process', code: 'KeyP' }), 'pause');
  assert.equal(resolve({ key: 'Process', code: 'KeyC' }), 'hold');
  assert.equal(resolve({ key: 'Process', code: 'KeyX' }), 'rotateCW');
  // Some browsers report an unidentified key instead.
  assert.equal(resolve({ key: 'Unidentified', code: 'KeyR' }), 'restart');
});

test('named keys still match on key, not code', () => {
  assert.equal(resolve({ key: 'ArrowLeft', code: 'ArrowLeft' }), 'left');
  assert.equal(resolve({ key: 'ArrowRight', code: 'ArrowRight' }), 'right');
  assert.equal(resolve({ key: 'ArrowDown', code: 'ArrowDown' }), 'softDrop');
  assert.equal(resolve({ key: 'ArrowUp', code: 'ArrowUp' }), 'rotateCW');
  assert.equal(resolve({ key: 'Enter', code: 'Enter' }), 'start');
  assert.equal(resolve({ key: 'Escape', code: 'Escape' }), 'pause');
  assert.equal(resolve({ key: 'Shift', code: 'ShiftLeft' }), 'hold');
});

test('space hard-drops whether reported as key or code', () => {
  assert.equal(resolve({ key: ' ', code: 'Space' }), 'hardDrop');
  assert.equal(resolve({ key: 'Process', code: 'Space' }), 'hardDrop');
});

test('unbound keys resolve to nothing', () => {
  assert.equal(resolve({ key: 'q', code: 'KeyQ' }), undefined);
  assert.equal(resolve({ key: 'Tab', code: 'Tab' }), undefined);
});

// Guards future bindings: anything added to KEYS is covered automatically.
test('every configured binding is reachable', () => {
  for (const [action, list] of Object.entries(KEYS)) {
    for (const k of list) {
      assert.equal(map.get(k), action, `${action}: ${JSON.stringify(k)}`);
      if (k.length === 1 && /[a-z]/i.test(k)) {
        assert.equal(map.get(`Key${k.toUpperCase()}`), action, `${action}: physical key for ${k}`);
      }
    }
  }
});
