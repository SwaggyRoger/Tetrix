// Per-frame drawing of the playfield, ghost piece, and the Next/Hold
// previews. Knows nothing about game rules — it just reads game state.

import { ROTATIONS, MATRIX_SIZE } from '../core/tetromino.js';

const PREVIEW_CELL = 20; // px per cell inside Next/Hold panels

export function createRenderer({ boardCanvas, nextCanvas, holdCanvas, sprites, config }) {
  const { cols, rows, cellSize } = config.BOARD;
  boardCanvas.width = cols * cellSize;
  boardCanvas.height = rows * cellSize;
  nextCanvas.width = 5 * PREVIEW_CELL;
  nextCanvas.height = 10 * PREVIEW_CELL;
  holdCanvas.width = 5 * PREVIEW_CELL;
  holdCanvas.height = 3.4 * PREVIEW_CELL;

  const ctx = boardCanvas.getContext('2d');
  const nextCtx = nextCanvas.getContext('2d');
  const holdCtx = holdCanvas.getContext('2d');

  function drawSpriteCell(type, x, y, ghost = false) {
    const sprite = ghost ? sprites.ghost(type) : sprites.cell(type);
    ctx.drawImage(sprite, x * cellSize, y * cellSize);
  }

  function drawBoard(api) {
    const { game } = api;
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    ctx.fillStyle = config.CANVAS_STYLE.boardWash;
    ctx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

    ctx.strokeStyle = config.CANVAS_STYLE.gridLine;
    ctx.lineWidth = 1;
    for (let x = 1; x < cols; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize + 0.5, 0);
      ctx.lineTo(x * cellSize + 0.5, boardCanvas.height);
      ctx.stroke();
    }
    for (let y = 1; y < rows; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize + 0.5);
      ctx.lineTo(boardCanvas.width, y * cellSize + 0.5);
      ctx.stroke();
    }

    const grid = api.boardGrid;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x]) drawSpriteCell(grid[y][x], x, y);
      }
    }

    const piece = game.piece;
    if (piece && game.state !== 'gameover') {
      const cells = ROTATIONS[piece.type][piece.rot];
      const gy = api.ghostY();
      if (gy !== null && gy !== piece.y) {
        for (const [cx, cy] of cells) {
          if (gy + cy >= 0) drawSpriteCell(piece.type, piece.x + cx, gy + cy, true);
        }
      }
      for (const [cx, cy] of cells) {
        if (piece.y + cy >= 0) drawSpriteCell(piece.type, piece.x + cx, piece.y + cy);
      }
    }
  }

  function drawPreviewPiece(pctx, type, originY) {
    const cells = ROTATIONS[type][0];
    const size = MATRIX_SIZE[type];
    // Trim to the occupied bounding box so every piece looks centred.
    const xs = cells.map(([x]) => x);
    const ys = cells.map(([, y]) => y);
    const wCells = Math.max(...xs) - Math.min(...xs) + 1;
    const hCells = Math.max(...ys) - Math.min(...ys) + 1;
    const offsetX = (pctx.canvas.width - wCells * PREVIEW_CELL) / 2 - Math.min(...xs) * PREVIEW_CELL;
    const sprite = sprites.cell(type);
    for (const [cx, cy] of cells) {
      pctx.drawImage(
        sprite,
        offsetX + cx * PREVIEW_CELL,
        originY + (cy - Math.min(...ys)) * PREVIEW_CELL,
        PREVIEW_CELL,
        PREVIEW_CELL,
      );
    }
    return hCells * PREVIEW_CELL;
  }

  function drawNext(api) {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    let y = PREVIEW_CELL * 0.5;
    for (const type of api.game.queue) {
      y += drawPreviewPiece(nextCtx, type, y) + PREVIEW_CELL;
    }
  }

  function drawHold(api) {
    holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);
    if (api.game.holdType) {
      holdCtx.globalAlpha = api.game.canHold ? 1 : 0.35;
      drawPreviewPiece(holdCtx, api.game.holdType, PREVIEW_CELL * 0.5);
      holdCtx.globalAlpha = 1;
    }
  }

  return {
    draw(api) {
      drawBoard(api);
      drawNext(api);
      drawHold(api);
    },
  };
}
