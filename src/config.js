// All gameplay/visual tunables live here so collaborators can adjust
// behaviour without touching logic. Keep this file dependency-free.

export const BOARD = {
  cols: 10,
  rows: 20,
  cellSize: 34,    // px — the preferred size; shrunk at runtime to fit the window
  minCellSize: 16, // px — never smaller than this, even on tiny windows
};

// Vertical page chrome around the board (title + paddings + frame border),
// used to compute how much height is left for the board itself.
export const PAGE_CHROME_PX = 150;

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

// Impressionist sound. Everything is synthesised at runtime from these numbers
// — no audio files needed — so pitch is an exact parameter rather than a
// playback-rate hack. Harmony is built on a pentatonic/whole-tone colour
// (Debussy's palette): soft attacks, long decays, nothing that resolves hard.
//
// `semitones` are offsets from `rootHz`. Read the `clears` table top to bottom
// and you can see the requested "solemnity" gradient in the numbers: the root
// drops an octave, voices are added, and attack/decay both stretch out.
export const AUDIO = {
  enabled: true,
  masterVolume: 0.45,
  rootHz: 277.18, // C#4 — the black-key pentatonic everything is transposed from
  comboSemitonesPerStep: 2, // whole-tone step per extra combo; keeps the colour
  maxComboSteps: 6,         // stop transposing up beyond this, or it turns shrill
  reverb: { seconds: 2.6, decay: 2.4, mix: 0.34 },

  // Soft landing: a barely-there tap so ordinary play is not noisy.
  lock: { semitones: [12], attack: 0.004, decay: 0.2, gain: 0.09, type: 'triangle' },

  // "Urgent" hard drop: fast downward glide plus a short noise impact — dry and
  // percussive, deliberately the opposite of the washy line-clear chords.
  hardDrop: {
    fromSemitone: 15,
    toSemitone: -5,
    attack: 0.002,
    glideMs: 90,
    decay: 0.32,
    gain: 0.3,
    type: 'sawtooth',
    noiseGain: 0.16,
    noiseDecay: 0.16,
  },

  // Line clears: 1 = light shimmer high up, 4 = low, wide and slow to fade.
  clears: {
    1: { semitones: [12, 16], attack: 0.01, decay: 1.0, gain: 0.3, type: 'sine', spreadMs: 25 },
    2: { semitones: [7, 12, 16], attack: 0.018, decay: 1.5, gain: 0.36, type: 'sine', spreadMs: 35 },
    3: { semitones: [0, 7, 12, 19], attack: 0.03, decay: 2.1, gain: 0.42, type: 'triangle', spreadMs: 45 },
    4: { semitones: [-12, -5, 0, 7, 12, 19], attack: 0.055, decay: 3.2, gain: 0.5, type: 'triangle', spreadMs: 60 },
  },

  levelUp: { semitones: [0, 4, 7, 12, 16], attack: 0.012, decay: 1.6, gain: 0.26, type: 'sine', spreadMs: 70 },
  gameOver: { semitones: [0, -2, -4, -8], attack: 0.06, decay: 2.8, gain: 0.3, type: 'sine', spreadMs: 220 },
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
  start: ['Enter'],
  mute: ['m', 'M'],
};
