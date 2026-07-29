// The playfield grid. Cells hold either null or a tetromino type string
// ('I'..'Z') — rendering decides what a type looks like.

export function createBoard(cols, rows) {
  let grid = makeGrid(cols, rows);

  function makeGrid(w, h) {
    return Array.from({ length: h }, () => Array(w).fill(null));
  }

  return {
    cols,
    rows,
    get grid() {
      return grid;
    },
    cellAt(x, y) {
      return y >= 0 ? grid[y][x] : null;
    },
    // cells: [x, y] offsets; px/py: piece origin. Cells above the top
    // (y < 0) only collide with the side walls.
    collides(cells, px, py) {
      for (const [cx, cy] of cells) {
        const x = px + cx;
        const y = py + cy;
        if (x < 0 || x >= cols || y >= rows) return true;
        if (y >= 0 && grid[y][x] !== null) return true;
      }
      return false;
    },
    // Returns true if any merged cell landed above the visible field (top-out).
    merge(cells, px, py, type) {
      let topOut = false;
      for (const [cx, cy] of cells) {
        const x = px + cx;
        const y = py + cy;
        if (y < 0) {
          topOut = true;
          continue;
        }
        grid[y][x] = type;
      }
      return topOut;
    },
    fullRows() {
      const rowsFound = [];
      for (let y = 0; y < rows; y++) {
        if (grid[y].every((c) => c !== null)) rowsFound.push(y);
      }
      return rowsFound;
    },
    clearRows(rowIndexes) {
      const keep = grid.filter((_, y) => !rowIndexes.includes(y));
      while (keep.length < rows) keep.unshift(Array(cols).fill(null));
      grid = keep;
    },
    reset() {
      grid = makeGrid(cols, rows);
    },
  };
}
