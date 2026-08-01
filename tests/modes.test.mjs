// Unit tests for the game modes: the No Brainer rescue, the map mode's
// levels, and the versus junk exchange. Run with: node --test tests/
// No browser, no DOM — core/ must stay importable in plain Node.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createBoard } from '../src/core/board.js';
import { createGame, GARBAGE } from '../src/core/game.js';
import { MODE, VERSUS_RULE, rulesFor, createCampaign } from '../src/core/modes.js';
import { createMatch, DRAW } from '../src/core/match.js';

// Deterministic RNG for reproducible tests.
function seededRng(seed = 42) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function makeGame(overrides = {}) {
  const api = createGame({ board: { cols: 10, rows: 20 }, rng: seededRng(), ...overrides });
  api.start();
  return api;
}

// Fills rows 16..19 except column 0, and puts a vertical I above that column —
// hard-dropping it clears four rows at once.
function armTetris(api) {
  const grid = api.boardGrid;
  for (let y = 16; y <= 19; y++) {
    for (let x = 1; x < 10; x++) grid[y][x] = 'J';
  }
  api.game.piece = { type: 'I', rot: 1, x: -2, y: 0 };
}

// Fills row 19 except cols 3..6 so a flat I dropped at x=3 completes it.
function armSingleClear(api) {
  const grid = api.boardGrid;
  for (let x = 0; x < 10; x++) if (x < 3 || x > 6) grid[19][x] = 'J';
  api.game.piece = { type: 'I', rot: 0, x: 3, y: 0 };
}

// ------------------------------------------------------------------ board --

test('dropBottomRow sacrifices the bottom row and everything falls one', () => {
  const board = createBoard(4, 4);
  for (let x = 0; x < 4; x++) board.grid[3][x] = 'I';
  board.grid[2][0] = 'T';
  const removed = board.dropBottomRow();
  assert.equal(removed.length, 4, 'the destroyed cells are reported');
  assert.deepEqual(removed[0], { x: 0, y: 3, type: 'I' });
  assert.equal(board.grid[3][0], 'T', 'the row above fell into its place');
  assert.deepEqual(board.grid[0], [null, null, null, null], 'a fresh row at the top');
});

test('pushGarbage fills from the bottom, leaving one hole, and reports a top-out', () => {
  const board = createBoard(4, 4);
  assert.equal(board.pushGarbage(2, 1, GARBAGE), false, 'an empty board absorbs it');
  assert.deepEqual(board.grid[3], [GARBAGE, null, GARBAGE, GARBAGE]);
  assert.deepEqual(board.grid[2], [GARBAGE, null, GARBAGE, GARBAGE]);
  assert.deepEqual(board.grid[1], [null, null, null, null]);

  board.grid[0][0] = 'T'; // now something is sitting against the ceiling
  assert.equal(board.pushGarbage(1, 1, GARBAGE), true, 'it was pushed off the top');
});

test('applyPattern is bottom-aligned and countType counts what it painted', () => {
  const board = createBoard(4, 4);
  board.applyPattern(['##..', '.##.'], GARBAGE);
  assert.deepEqual(board.grid[0], [null, null, null, null], 'nothing above the pattern');
  assert.deepEqual(board.grid[2], [GARBAGE, GARBAGE, null, null]);
  assert.deepEqual(board.grid[3], [null, GARBAGE, GARBAGE, null], 'the last row is the bottom');
  assert.equal(board.countType(GARBAGE), 4);
  assert.equal(board.countType('T'), 0);
});

// -------------------------------------------------------------- no brainer --

test('no brainer never ends: the ceiling costs the bottom row instead', () => {
  const api = makeGame({ rules: rulesFor(MODE.NO_BRAINER) });
  const rescues = [];
  api.game.on('rescue', (e) => rescues.push(e));

  // Every piece is dropped where it spawns, so the middle columns tower up
  // fast — classic play is over well before this loop ends.
  for (let i = 0; i < 300; i++) api.hardDrop();

  assert.equal(api.game.state, 'playing', 'the run survives the ceiling');
  assert.ok(rescues.length > 0, 'the bottom row was sacrificed at least once');
  assert.equal(api.game.rescues, rescues.length, 'every sacrifice is announced');
  assert.ok(rescues[0].cells.length > 0, 'the sacrificed row carried cells to burst');
});

test('classic play still ends at the ceiling', () => {
  const api = makeGame({ rules: rulesFor(MODE.CLASSIC) });
  for (let i = 0; i < 300 && api.game.state === 'playing'; i++) api.hardDrop();
  assert.equal(api.game.state, 'gameover');
});

// ------------------------------------------------------------------- map ----

test('a map level is painted at the bottom and restored by reset', () => {
  const api = makeGame();
  api.loadPattern(['..########']);
  assert.equal(api.garbageLeft(), 8);
  assert.equal(api.boardGrid[19][0], null);
  assert.equal(api.boardGrid[19][2], GARBAGE);

  api.reset();
  assert.equal(api.garbageLeft(), 8, 'restarting a level puts the stone back');
  assert.equal(api.game.score, 0);
});

test('clearing the rows a level sits on empties it', () => {
  const api = makeGame();
  api.loadPattern(['.#########']);
  assert.equal(api.garbageLeft(), 9);
  api.game.piece = { type: 'I', rot: 1, x: -2, y: 0 }; // vertical I into column 0
  api.hardDrop();
  assert.equal(api.garbageLeft(), 0, 'the level is cleared once its row goes');
});

test('the campaign walks its levels once and then reports completion', () => {
  const campaign = createCampaign({ levels: [{ name: 'a' }, { name: 'b' }] });
  assert.equal(campaign.index, 0);
  assert.equal(campaign.total, 2);
  assert.equal(campaign.level.name, 'a');

  assert.equal(campaign.advance(), true);
  assert.equal(campaign.level.name, 'b');
  assert.equal(campaign.advance(), false, 'there is no third level');
  assert.equal(campaign.complete, true);
  assert.equal(campaign.level, null);

  campaign.reset();
  assert.equal(campaign.index, 0);
  assert.equal(campaign.complete, false);
});

// ----------------------------------------------------------------- rules ----

test('each mode declares only what it changes', () => {
  assert.deepEqual(rulesFor(MODE.CLASSIC), {});
  assert.deepEqual(rulesFor(MODE.NO_BRAINER), { topOut: 'rescue' });
  assert.deepEqual(rulesFor(MODE.VERSUS), { sendsGarbage: true });
});

test('gravityScale stretches the fall interval, and can be changed mid-run', () => {
  const api = makeGame({ rules: { gravityScale: 2 } });
  api.game.piece = { type: 'O', rot: 0, x: 4, y: 0 };
  api.tick(1000); // one unscaled step at level 1; doubled, it is not due yet
  assert.equal(api.game.piece.y, 0);
  api.tick(1000);
  assert.equal(api.game.piece.y, 1, 'the doubled step fell due at 2000ms');

  api.setRules({ gravityScale: 0.5 });
  api.game.piece.y = 0;
  api.tick(500);
  assert.equal(api.game.piece.y, 1, 'halving the scale makes it fall twice as fast');
});

// ---------------------------------------------------------------- versus ----

test('a tetris sends four junk rows; a single sends none', () => {
  const api = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const sent = [];
  api.game.on('garbage', (e) => sent.push(e));

  armSingleClear(api);
  api.hardDrop();
  assert.deepEqual(sent, [], 'chasing singles attacks nobody');

  api.reset();
  armTetris(api);
  api.hardDrop();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].lines, 4);
});

test('a combo run adds junk on top of the clear that carries it', () => {
  const api = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const sent = [];
  api.game.on('garbage', (e) => sent.push(e));

  // Three singles in a row: worth nothing each, but the third rides a combo
  // of 3, which is the first step that pays.
  for (let i = 0; i < 3; i++) {
    armSingleClear(api);
    api.hardDrop();
  }
  assert.equal(api.game.combo, 3);
  assert.deepEqual(
    sent.map((e) => ({ lines: e.lines, combo: e.combo })),
    [{ lines: 1, combo: 3 }],
  );
});

test('clearing lines cancels incoming junk before any is forwarded', () => {
  const api = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const sent = [];
  api.game.on('garbage', (e) => sent.push(e));
  api.receiveGarbage(3);

  armTetris(api); // worth four rows
  api.hardDrop();

  assert.equal(api.game.pendingGarbage, 0, 'all three incoming rows were cancelled');
  assert.deepEqual(sent.map((e) => e.lines), [1], 'only the surplus is forwarded');
  assert.equal(api.boardGrid.flat().filter((c) => c === GARBAGE).length, 0, 'none of it landed');
});

test('junk lands after the next lock, as one batch with a single hole', () => {
  const api = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const landed = [];
  api.game.on('garbagelanded', (e) => landed.push(e));
  api.receiveGarbage(2);
  assert.equal(api.boardGrid.flat().filter((c) => c === GARBAGE).length, 0, 'not mid-piece');

  api.game.piece = { type: 'O', rot: 0, x: 4, y: 0 };
  api.hardDrop();

  const grid = api.boardGrid;
  assert.deepEqual(landed, [{ lines: 2 }]);
  assert.equal(grid[19].filter((c) => c === GARBAGE).length, 9, 'full but for one hole');
  assert.equal(grid[18].filter((c) => c === GARBAGE).length, 9);
  assert.equal(grid[19].indexOf(null), grid[18].indexOf(null), 'one hole for the whole batch');
  assert.equal(api.game.pendingGarbage, 0);
  assert.equal(api.game.state, 'playing', 'two rows do not bury anyone');
});

test('knockout: the survivor wins the moment the other tops out', () => {
  const a = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const b = makeGame({ rules: rulesFor(MODE.VERSUS), rng: seededRng(7) });
  const match = createMatch({ players: [a, b], rule: VERSUS_RULE.KO });
  const results = [];
  match.on('matchover', (e) => results.push(e));

  assert.equal(match.remainingMs, null, 'the KO rule has no clock');
  for (let i = 0; i < 300 && results.length === 0; i++) a.hardDrop();

  assert.equal(results.length, 1);
  assert.equal(results[0].winner, 1, 'the player still standing');
  assert.equal(results[0].reason, 'knockout');
  assert.equal(b.game.state, 'gameover', 'both boards stop');
  assert.equal(match.over, true);
});

test('versus routes junk between the boards, and the score race does not', () => {
  const duel = [makeGame({ rules: rulesFor(MODE.VERSUS) }), makeGame({ rules: rulesFor(MODE.VERSUS) })];
  createMatch({ players: duel, rule: VERSUS_RULE.KO });
  armTetris(duel[0]);
  duel[0].hardDrop();
  assert.equal(duel[1].game.pendingGarbage, 4, 'the tetris crossed over');

  const race = [makeGame({ rules: rulesFor(MODE.VERSUS) }), makeGame({ rules: rulesFor(MODE.VERSUS) })];
  createMatch({ players: race, rule: VERSUS_RULE.SOLO });
  armTetris(race[0]);
  race[0].hardDrop();
  assert.equal(race[1].game.pendingGarbage, 0, 'a score race leaves the other board alone');
});

test('a timed match runs out the clock and the higher score wins', () => {
  const a = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const b = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const match = createMatch({ players: [a, b], rule: VERSUS_RULE.TIMED, limitMs: 1000 });
  const results = [];
  match.on('matchover', (e) => results.push(e));
  a.game.score = 500;

  match.tick(400);
  assert.equal(match.remainingMs, 600);
  assert.equal(results.length, 0);

  match.tick(700);
  assert.equal(results.length, 1);
  assert.equal(results[0].reason, 'time');
  assert.equal(results[0].winner, 0);
  assert.deepEqual(results[0].scores, [500, 0]);
  assert.equal(match.remainingMs, 0);
});

test('the clock does not run while both boards are paused', () => {
  const a = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const b = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const match = createMatch({ players: [a, b], rule: VERSUS_RULE.TIMED, limitMs: 1000 });
  a.togglePause();
  b.togglePause();
  match.tick(500);
  assert.equal(match.remainingMs, 1000);
});

test('level scores level: a tie on the clock is a draw', () => {
  const a = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const b = makeGame({ rules: rulesFor(MODE.VERSUS) });
  const match = createMatch({ players: [a, b], rule: VERSUS_RULE.TIMED, limitMs: 100 });
  const results = [];
  match.on('matchover', (e) => results.push(e));
  match.tick(200);
  assert.equal(results[0].winner, DRAW);
});
