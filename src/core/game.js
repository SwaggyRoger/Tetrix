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

export function createGame({ board: boardCfg, timing, scoring, gravityMs, rng } = {}) {
  const cols = boardCfg?.cols ?? 10;
  const rows = boardCfg?.rows ?? 20;
  const lockDelayMs = timing?.lockDelayMs ?? 500;
  const score1 = scoring?.lineClear ?? { 1: 100, 2: 300, 3: 500, 4: 800 };
  const softDropPerCell = scoring?.softDropPerCell ?? 1;
  const hardDropPerCell = scoring?.hardDropPerCell ?? 2;
  const linesPerLevel = scoring?.linesPerLevel ?? 10;
  const gravityFn = gravityMs ?? ((level) => Math.max(1000 * 0.82 ** (level - 1), 55));

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
    on: emitter.on,
  };

  let gravityTimer = 0;
  let lockTimer = 0;
  let grounded = false;

  function cellsOf(piece) {
    return ROTATIONS[piece.type][piece.rot];
  }

  function refillQueue() {
    while (game.queue.length < 3) game.queue.push(bag.next());
  }

  function spawn(type) {
    const { x, y } = spawnPosition(type, cols);
    const piece = { type, rot: 0, x, y };
    if (board.collides(cellsOf(piece), x, y)) {
      game.piece = piece; // leave it visible where it jammed
      endGame();
      return;
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

  function lockPiece() {
    const p = game.piece;
    const topOut = board.merge(cellsOf(p), p.x, p.y, p.type);
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
    } else {
      game.combo = 0;
    }

    if (topOut) {
      endGame();
      return;
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
      const step = gravityFn(game.level);
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
    reset() {
      board.reset();
      bag = createBag(rng);
      game.queue = [];
      game.holdType = null;
      game.canHold = true;
      game.score = 0;
      game.lines = 0;
      game.level = 1;
      game.combo = 0;
      game.state = STATE.PLAYING;
      spawnNext();
    },
    game,
  };

  return api;
}
