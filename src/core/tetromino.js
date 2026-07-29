// Tetromino definitions: base shapes, precomputed rotation states, and
// SRS wall-kick tables. Pure data + pure functions — no DOM.

const BASE_SHAPES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

export const TYPES = Object.keys(BASE_SHAPES); // ['I','J','L','O','S','T','Z']

function rotateCW(matrix) {
  const n = matrix.length;
  const out = Array.from({ length: n }, () => Array(n).fill(0));
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) out[x][n - 1 - y] = matrix[y][x];
  }
  return out;
}

function cellsOf(matrix) {
  const cells = [];
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix.length; x++) {
      if (matrix[y][x]) cells.push([x, y]);
    }
  }
  return cells;
}

// ROTATIONS[type][rot] = list of [x, y] offsets, rot in 0..3 (CW order).
export const ROTATIONS = {};
export const MATRIX_SIZE = {};
for (const type of TYPES) {
  let m = BASE_SHAPES[type];
  MATRIX_SIZE[type] = m.length;
  ROTATIONS[type] = [];
  for (let r = 0; r < 4; r++) {
    ROTATIONS[type].push(cellsOf(m));
    m = rotateCW(m);
  }
}

// SRS wall kicks, expressed in screen coordinates (y grows downward, so the
// standard tables' y offsets are negated here). Key: `${from}>${to}`.
const KICKS_JLSTZ = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
};

const KICKS_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
};

export function kicksFor(type, fromRot, toRot) {
  if (type === 'O') return [[0, 0]];
  const table = type === 'I' ? KICKS_I : KICKS_JLSTZ;
  return table[`${fromRot}>${toRot}`];
}

export function spawnPosition(type, boardCols) {
  const size = MATRIX_SIZE[type];
  return {
    x: Math.floor((boardCols - size) / 2),
    y: type === 'I' ? -1 : 0,
  };
}
