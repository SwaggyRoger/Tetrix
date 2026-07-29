// All gameplay/visual tunables live here so collaborators can adjust
// behaviour without touching logic. Keep this file dependency-free.

export const BOARD = {
  cols: 10,
  rows: 20,
  cellSize: 34, // px
};

// Milliseconds per gravity step for a given level (1-based).
export function gravityMs(level) {
  return Math.max(1000 * Math.pow(0.82, level - 1), 55);
}

export const TIMING = {
  lockDelayMs: 500,
  dasMs: 170,       // delay before auto-repeat of left/right
  arrMs: 40,        // auto-repeat rate of left/right
  softDropMs: 40,   // soft-drop repeat rate while held
};

export const SCORING = {
  lineClear: { 1: 100, 2: 300, 3: 500, 4: 800 }, // multiplied by level
  softDropPerCell: 1,
  hardDropPerCell: 2,
  linesPerLevel: 10,
};

// Monet-inspired palette: pond blues, wisteria, ochre, willow green, lilac, poppy.
export const PALETTE = {
  I: '#5FA3B5',
  J: '#7B85B8',
  L: '#D9A15F',
  O: '#E3C567',
  S: '#8FAE6E',
  T: '#B287B6',
  Z: '#C9797B',
};

export const CANVAS_STYLE = {
  pageTop: '#f6f1e3',      // cream canvas
  pageBottom: '#cfe0e4',   // pale pond blue
  boardWash: 'rgba(252, 249, 240, 0.72)', // translucent panel over the painting
  gridLine: 'rgba(90, 80, 70, 0.08)',
  backgroundDabs: ['#cfe0e4', '#e8d8e0', '#dbe6c9', '#f2e3c0', '#c9d8ea', '#e6c9c9'],
};

export const EFFECTS = {
  particlesPerCell: 6,
  heartColors: ['#e58fa2', '#d96d8a', '#f0b3c0', '#c9797b'],
  starColors: ['#e9c46a', '#f4d58d', '#d9a15f', '#f7e8b0'],
  particleTtlMs: [700, 1300], // min..max lifetime
};

export const KEYS = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  softDrop: ['ArrowDown'],
  hardDrop: [' '],
  rotateCW: ['ArrowUp', 'x', 'X'],
  rotateCCW: ['z', 'Z'],
  hold: ['c', 'C', 'Shift'],
  pause: ['p', 'P', 'Escape'],
  restart: ['r', 'R'],
};
