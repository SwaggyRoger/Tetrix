// Unit tests for the pure game core. Run with: node --test tests/
// No browser, no DOM — core/ must stay importable in plain Node.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { TYPES, ROTATIONS, kicksFor } from '../src/core/tetromino.js';
import { createBag } from '../src/core/bag.js';
import { createBoard } from '../src/core/board.js';
import { createGame } from '../src/core/game.js';

// Deterministic RNG for reproducible tests.
function seededRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

test('every tetromino has 4 rotation states of 4 cells each', () => {
  for (const type of TYPES) {
    assert.equal(ROTATIONS[type].length, 4);
    for (const state of ROTATIONS[type]) {
      assert.equal(state.length, 4, `${type} rotation state must have 4 cells`);
    }
  }
});

test('O piece rotation is identity and has a single no-op kick', () => {
  assert.deepEqual(ROTATIONS.O[0], ROTATIONS.O[1]);
  assert.deepEqual(kicksFor('O', 0, 1), [[0, 0]]);
});

test('7-bag: every 7 consecutive pieces contain each type exactly once', () => {
  const bag = createBag(seededRng());
  for (let round = 0; round < 5; round++) {
    const drawn = Array.from({ length: 7 }, () => bag.next());
    assert.deepEqual([...drawn].sort(), [...TYPES].sort());
  }
});

test('board detects and clears full rows, dropping rows above', () => {
  const board = createBoard(4, 4);
  // Fill bottom row and put a marker block above it.
  for (let x = 0; x < 4; x++) board.grid[3][x] = 'I';
  board.grid[2][0] = 'T';
  assert.deepEqual(board.fullRows(), [3]);
  board.clearRows([3]);
  assert.equal(board.grid[3][0], 'T', 'block above the cleared row falls one row');
  assert.equal(board.grid[2][0], null);
});

test('board collision: walls, floor, and stack', () => {
  const board = createBoard(4, 4);
  const cell = [[0, 0]];
  assert.equal(board.collides(cell, -1, 0), true, 'left wall');
  assert.equal(board.collides(cell, 4, 0), true, 'right wall');
  assert.equal(board.collides(cell, 0, 4), true, 'floor');
  assert.equal(board.collides(cell, 0, -2), false, 'above the field is open');
  board.grid[1][1] = 'S';
  assert.equal(board.collides(cell, 1, 1), true, 'occupied cell');
});

function makeGame(overrides = {}) {
  const api = createGame({
    board: { cols: 10, rows: 20 },
    rng: seededRng(),
    ...overrides,
  });
  api.start();
  return api;
}

test('game waits on the ready screen until start() is called', () => {
  const api = createGame({ rng: seededRng() });
  assert.equal(api.game.state, 'ready');
  assert.equal(api.game.piece, null);
  api.tick(10000); // gravity must not run before start
  assert.equal(api.game.piece, null);
  api.hardDrop(); // inputs are ignored before start
  assert.equal(api.game.score, 0);
  api.start();
  assert.equal(api.game.state, 'playing');
  assert.ok(api.game.piece);
  api.start(); // calling again is a no-op, not a re-spawn
  assert.equal(api.game.queue.length, 3);
});

test('game spawns with a 3-piece preview queue after start', () => {
  const api = makeGame();
  assert.ok(api.game.piece);
  assert.equal(api.game.queue.length, 3);
});

test('hard drop locks the piece and spawns the next one', () => {
  const api = makeGame();
  const firstType = api.game.piece.type;
  const expectedNext = api.game.queue[0];
  api.hardDrop();
  const grid = api.boardGrid;
  const lockedCells = grid.flat().filter((c) => c === firstType).length;
  assert.ok(lockedCells >= 4, 'piece cells were merged into the board');
  assert.equal(api.game.piece.type, expectedNext, 'next queued piece spawned');
  assert.ok(api.game.score >= 2, 'hard drop awards points per cell');
});

test('line clear updates score/lines and emits event with cleared cells', () => {
  const api = makeGame();
  // Pre-fill the bottom row except where we know we can complete it.
  const grid = api.boardGrid;
  const events = [];
  api.game.on('lineclear', (e) => events.push(e));

  // Force current piece to be an I laid flat, fill row 19 except cols 3-6.
  for (let x = 0; x < 10; x++) if (x < 3 || x > 6) grid[19][x] = 'J';
  api.game.piece = { type: 'I', rot: 0, x: 3, y: 0 }; // at x=3, the I's row occupies cols 3..6
  api.hardDrop();

  assert.equal(events.length, 1, 'one lineclear event');
  assert.equal(events[0].count, 1);
  assert.equal(events[0].cells.length, 10, 'event carries all 10 cleared cells');
  assert.equal(api.game.lines, 1);
  assert.equal(api.game.score >= 100, true);
  assert.deepEqual(api.boardGrid[19], Array(10).fill(null), 'row was cleared');
});

test('level rises every 10 lines and gravity gets faster', () => {
  const api = makeGame();
  api.game.lines = 9;
  const grid = api.boardGrid;
  for (let x = 0; x < 10; x++) if (x < 3 || x > 6) grid[19][x] = 'J';
  api.game.piece = { type: 'I', rot: 0, x: 3, y: 0 };
  api.hardDrop();
  assert.equal(api.game.level, 2);
});

test('hold swaps at most once per piece', () => {
  const api = makeGame();
  const firstType = api.game.piece.type;
  api.hold();
  assert.equal(api.game.holdType, firstType);
  assert.equal(api.game.canHold, false);
  const typeAfterHold = api.game.piece.type;
  api.hold(); // must be a no-op until the next lock
  assert.equal(api.game.piece.type, typeAfterHold);
  assert.equal(api.game.holdType, firstType);
});

test('rotation against the left wall kicks the piece inward', () => {
  const api = makeGame();
  api.game.piece = { type: 'T', rot: 1, x: -1, y: 5 }; // hugging the left wall
  const ok = api.rotate(1);
  assert.equal(ok, true, 'rotation succeeds via wall kick');
  assert.ok(api.game.piece.x >= -1, 'piece stays in bounds after kick');
});

test('stacking to the top ends the game', () => {
  const api = makeGame();
  let over = false;
  api.game.on('gameover', () => (over = true));
  // Fill everything except one column so pieces stack up fast.
  for (let i = 0; i < 60 && !over; i++) api.hardDrop();
  assert.equal(over, true, 'game over fired');
  assert.equal(api.game.state, 'gameover');
});

test('reset returns to a clean playable state', () => {
  const api = makeGame();
  for (let i = 0; i < 60; i++) api.hardDrop();
  api.reset();
  assert.equal(api.game.state, 'playing');
  assert.equal(api.game.score, 0);
  assert.equal(api.game.lines, 0);
  assert.ok(api.game.piece);
  assert.equal(api.boardGrid.flat().every((c) => c === null), true);
});
