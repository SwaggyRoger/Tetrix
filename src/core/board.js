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
    // Sacrifice the bottom row: it vanishes and everything above falls one
    // row. This is the No Brainer rescue — the stack can never reach the
    // ceiling because the oldest row is given up instead. Returns the cells
    // that were destroyed so the effects layer can burst them.
    dropBottomRow() {
      const y = rows - 1;
      const removed = [];
      for (let x = 0; x < cols; x++) {
        if (grid[y][x] !== null) removed.push({ x, y, type: grid[y][x] });
      }
      grid.pop();
      grid.unshift(Array(cols).fill(null));
      return removed;
    },
    // Push `lines` junk rows in from the bottom, each full except for the
    // column `holeX`. Returns true if the upward shift pushed occupied cells
    // off the top of the field (a top-out).
    pushGarbage(lines, holeX, type) {
      let toppedOut = false;
      for (let i = 0; i < lines; i++) {
        const evicted = grid.shift();
        if (evicted.some((c) => c !== null)) toppedOut = true;
        const row = Array(cols).fill(type);
        row[holeX] = null;
        grid.push(row);
      }
      return toppedOut;
    },
    // Paint a pre-built layout, used by the map mode's levels. `pattern` is an
    // array of strings, one per row, aligned to the BOTTOM of the board: '#'
    // is a filled cell, every other character is empty. Rows that would fall
    // above the top of the field are ignored.
    applyPattern(pattern, type) {
      const top = rows - pattern.length;
      pattern.forEach((line, i) => {
        const y = top + i;
        if (y < 0) return;
        for (let x = 0; x < cols; x++) grid[y][x] = line[x] === '#' ? type : null;
      });
    },
    countType(type) {
      let n = 0;
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) if (grid[y][x] === type) n++;
      }
      return n;
    },
    reset() {
      grid = makeGrid(cols, rows);
    },
  };
}
