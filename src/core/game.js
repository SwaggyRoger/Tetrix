// Game state machine: spawning, gravity, lock delay, rotation with kicks,
// scoring, levels, hold. Pure logic — drives everything via tick(dt) and
// emits events; it never touches the DOM.

import { createBoard } from './board.js';
import { createBag } from './bag.js';
import { createEmitter } from './emitter.js';
import { ROTATIONS, kicksFor, spawnPosition } from './tetromino.js';

export const STATE = {
  READY: 'ready', // waiting on the start screen; nothing moves until start()
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'gameover',
};

// Cell type used for junk: the map mode's pre-built levels and the versus
// mode's incoming garbage rows. It is not a tetromino, so it can never be
// spawned — it only ever arrives on the board already placed.
export const GARBAGE = 'G';

// `rules` is what makes one mode differ from another. The defaults reproduce
// classic play exactly, so a mode only has to name what it changes.
export const DEFAULT_RULES = {
  // 'gameover' ends the run at the ceiling; 'rescue' sacrifices the bottom
  // row instead and plays on forever (the No Brainer mode).
  topOut: 'gameover',
  // Versus only: line clears send junk rows to the opponent.
  sendsGarbage: false,
  // Multiplies every gravity step. > 1 is slower, < 1 is faster; this is the
  // hook a future hard mode raises.
  gravityScale: 1,
};

export function createGame({ board: boardCfg, timing, scoring, gravityMs, rng, rules } = {}) {
  const cols = boardCfg?.cols ?? 10;
  const rows = boardCfg?.rows ?? 20;
  const lockDelayMs = timing?.lockDelayMs ?? 500;
  const score1 = scoring?.lineClear ?? { 1: 100, 2: 300, 3: 500, 4: 800 };
  const softDropPerCell = scoring?.softDropPerCell ?? 1;
  const hardDropPerCell = scoring?.hardDropPerCell ?? 2;
  const linesPerLevel = scoring?.linesPerLevel ?? 10;
  const gravityFn = gravityMs ?? ((level) => Math.max(1000 * 0.82 ** (level - 1), 55));
  const garbageTable = scoring?.garbageLines ?? { 1: 0, 2: 1, 3: 2, 4: 4 };
  // Indexed by combo - 1, clamped to the last entry.
  const comboGarbage = scoring?.comboGarbage ?? [0, 0, 1, 1, 2, 2, 3, 4];
  const rule = { ...DEFAULT_RULES, ...rules };
  const random = rng ?? Math.random;

  const board = createBoard(cols, rows);
  const emitter = createEmitter();
  let bag = createBag(rng);

  const game = {
    board,
    state: STATE.READY,
    piece: null, // { type, rot, x, y }
    queue: [],
    holdType: null,
    canHold: true,
    score: 0,
    lines: 0,
    level: 1,
    // Consecutive locks that cleared at least one row. 1 on the first clear,
    // 2 on the next one in a row, back to 0 as soon as a piece locks without
    // clearing. Carried on the `lineclear` event so presentation layers can
    // react to a run without tracking state of their own.
    combo: 0,
    // Junk rows sent by the opponent that have not landed yet. They are
    // applied after the next lock resolves, so a piece already in flight is
    // never yanked out from under the player.
    pendingGarbage: 0,
    // How many times the bottom row has been sacrificed (No Brainer only).
    rescues: 0,
    on: emitter.on,
  };

  let gravityTimer = 0;
  let lockTimer = 0;
  let grounded = false;
  // Level layout the map mode wants restored on every reset().
  let startPattern = null;

  function cellsOf(piece) {
    return ROTATIONS[piece.type][piece.rot];
  }

  function refillQueue() {
    while (game.queue.length < 3) game.queue.push(bag.next());
  }

  // The ceiling has been reached. Under 'gameover' that is the end; under
  // 'rescue' the bottom row is sacrificed instead and play continues.
  // Returns true if the game survived.
  function topOut() {
    if (rule.topOut !== 'rescue') {
      endGame();
      return false;
    }
    const cells = board.dropBottomRow();
    game.rescues += 1;
    emitter.emit('rescue', { cells, rescues: game.rescues });
    return true;
  }

  function spawn(type) {
    const { x, y } = spawnPosition(type, cols);
    let piece = { type, rot: 0, x, y };
    // Rescuing frees one row at a time, so a deeply buried spawn may need
    // several. Bounded by the board height: an empty board always has room,
    // so this can only run out of attempts if something is badly wrong —
    // end the game rather than spin.
    for (let attempt = 0; board.collides(cellsOf(piece), piece.x, piece.y); attempt++) {
      game.piece = piece; // leave it visible where it jammed
      if (attempt >= rows) {
        endGame();
        return;
      }
      if (!topOut()) return;
      piece = { type, rot: 0, x, y };
    }
    game.piece = piece;
    gravityTimer = 0;
    lockTimer = 0;
    grounded = false;
  }

  function spawnNext() {
    refillQueue();
    spawn(game.queue.shift());
    refillQueue();
  }

  function endGame() {
    game.state = STATE.GAME_OVER;
    emitter.emit('gameover', { score: game.score, lines: game.lines, level: game.level });
  }

  function tryMove(dx, dy) {
    const p = game.piece;
    if (!p) return false;
    if (board.collides(cellsOf(p), p.x + dx, p.y + dy)) return false;
    p.x += dx;
    p.y += dy;
    if (dx !== 0) lockTimer = 0; // successful shift resets lock delay
    return true;
  }

  function isGrounded() {
    const p = game.piece;
    return board.collides(cellsOf(p), p.x, p.y + 1);
  }

  // Junk rows earned by one lock: a single clear sends nothing, and a long
  // combo run eventually matches the clear itself. Kept here rather than in
  // the versus wiring so the number is testable without a second player.
  function garbageFor(count, combo) {
    const base = garbageTable[count] ?? 0;
    const i = Math.min(Math.max(combo, 1), comboGarbage.length) - 1;
    return base + comboGarbage[i];
  }

  function lockPiece() {
    const p = game.piece;
    const overCeiling = board.merge(cellsOf(p), p.x, p.y, p.type);
    emitter.emit('lock', { piece: { ...p } });
    game.canHold = true;

    const full = board.fullRows();
    if (full.length > 0) {
      const cells = [];
      for (const y of full) {
        for (let x = 0; x < cols; x++) cells.push({ x, y, type: board.cellAt(x, y) });
      }
      board.clearRows(full);
      game.lines += full.length;
      game.combo += 1;
      game.score += (score1[full.length] ?? 0) * game.level;
      const newLevel = Math.floor(game.lines / linesPerLevel) + 1;
      if (newLevel > game.level) {
        game.level = newLevel;
        emitter.emit('levelup', { level: newLevel });
      }
      emitter.emit('lineclear', { rows: full, count: full.length, cells, combo: game.combo });

      if (rule.sendsGarbage) {
        // Clearing lines cancels incoming junk before any is forwarded — the
        // standard versus rule, and the reason attacking is also a defence.
        let outgoing = garbageFor(full.length, game.combo);
        const cancelled = Math.min(game.pendingGarbage, outgoing);
        game.pendingGarbage -= cancelled;
        outgoing -= cancelled;
        if (outgoing > 0) emitter.emit('garbage', { lines: outgoing, combo: game.combo });
      }
    } else {
      game.combo = 0;
    }

    if (overCeiling) {
      if (!topOut()) return;
    }

    if (game.pendingGarbage > 0) {
      const lines = game.pendingGarbage;
      game.pendingGarbage = 0;
      // One hole per delivery, not per row: a stack of junk with a single
      // column open is dug out with one well-placed piece, which is what
      // makes a big hit recoverable.
      const buried = board.pushGarbage(lines, Math.floor(random() * cols), GARBAGE);
      emitter.emit('garbagelanded', { lines });
      if (buried && !topOut()) return;
    }

    spawnNext();
  }

  const api = {
    get boardGrid() {
      return board.grid;
    },
    start() {
      if (game.state !== STATE.READY) return;
      spawnNext();
      game.state = STATE.PLAYING;
    },
    tick(dt) {
      if (game.state !== STATE.PLAYING || !game.piece) return;
      if (isGrounded()) {
        grounded = true;
        lockTimer += dt;
        if (lockTimer >= lockDelayMs) lockPiece();
        return;
      }
      if (grounded) {
        // Walked off a ledge — falling again.
        grounded = false;
        lockTimer = 0;
      }
      gravityTimer += dt;
      const step = gravityFn(game.level) * rule.gravityScale;
      while (gravityTimer >= step) {
        gravityTimer -= step;
        if (!tryMove(0, 1)) break;
      }
    },
    moveLeft() {
      if (game.state === STATE.PLAYING) tryMove(-1, 0);
    },
    moveRight() {
      if (game.state === STATE.PLAYING) tryMove(1, 0);
    },
    softDrop() {
      if (game.state !== STATE.PLAYING) return;
      if (tryMove(0, 1)) {
        game.score += softDropPerCell;
        gravityTimer = 0;
      }
    },
    hardDrop() {
      if (game.state !== STATE.PLAYING || !game.piece) return;
      let dist = 0;
      while (tryMove(0, 1)) dist++;
      game.score += dist * hardDropPerCell;
      // Announced before the lock so a listener can sound the impact ahead of
      // any line-clear cue it triggers.
      emitter.emit('harddrop', { distance: dist, type: game.piece.type });
      lockPiece();
    },
    rotate(dir) {
      // dir: 1 = CW, -1 = CCW
      if (game.state !== STATE.PLAYING || !game.piece) return false;
      const p = game.piece;
      const toRot = (p.rot + dir + 4) % 4;
      for (const [kx, ky] of kicksFor(p.type, p.rot, toRot)) {
        if (!board.collides(ROTATIONS[p.type][toRot], p.x + kx, p.y + ky)) {
          p.rot = toRot;
          p.x += kx;
          p.y += ky;
          lockTimer = 0; // successful rotation resets lock delay
          return true;
        }
      }
      return false;
    },
    hold() {
      if (game.state !== STATE.PLAYING || !game.canHold || !game.piece) return;
      const current = game.piece.type;
      game.canHold = false;
      if (game.holdType === null) {
        game.holdType = current;
        spawnNext();
      } else {
        const swapped = game.holdType;
        game.holdType = current;
        spawn(swapped);
      }
    },
    ghostY() {
      const p = game.piece;
      if (!p) return null;
      let y = p.y;
      while (!board.collides(cellsOf(p), p.x, y + 1)) y++;
      return y;
    },
    togglePause() {
      if (game.state === STATE.PLAYING) game.state = STATE.PAUSED;
      else if (game.state === STATE.PAUSED) game.state = STATE.PLAYING;
    },
    // Change a rule mid-run. The map mode uses it to wind the gravity up
    // level by level without rebuilding the game.
    setRules(partial) {
      Object.assign(rule, partial);
    },
    // Junk queued by the opponent. It lands after the next lock, so the
    // player always gets to finish the piece they are holding.
    receiveGarbage(lines) {
      if (game.state !== STATE.PLAYING) return;
      game.pendingGarbage += lines;
    },
    // The map mode's level layout. Remembered so restarting a level (R) or
    // reset() puts the same junk back rather than starting empty.
    loadPattern(pattern) {
      startPattern = pattern ?? null;
      board.reset();
      if (startPattern) board.applyPattern(startPattern, GARBAGE);
    },
    // Junk cells still on the board — the map mode's win condition is that
    // this reaches zero.
    garbageLeft() {
      return board.countType(GARBAGE);
    },
    // Ends the run from outside the core (a versus timer running out, the
    // opponent being knocked out). Never fires twice.
    finish() {
      if (game.state === STATE.GAME_OVER) return;
      endGame();
    },
    reset() {
      board.reset();
      if (startPattern) board.applyPattern(startPattern, GARBAGE);
      bag = createBag(rng);
      game.queue = [];
      game.holdType = null;
      game.canHold = true;
      game.score = 0;
      game.lines = 0;
      game.level = 1;
      game.combo = 0;
      game.pendingGarbage = 0;
      game.rescues = 0;
      game.state = STATE.PLAYING;
      spawnNext();
    },
    game,
  };

  return api;
}
