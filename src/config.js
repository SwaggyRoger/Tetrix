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

// Horizontal chrome per player column that is *not* a side panel: the frame
// gap, the picture-frame border, and the page padding. Used with the measured
// side widths to decide how wide a cell may be — which is what stops two
// versus boards running off the edge of a narrow window.
export const BOARD_MARGIN_PX = 92;

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
  // Versus only: junk rows sent to the opponent per clear. A single sends
  // nothing, so chasing singles is punished rather than rewarded.
  garbageLines: { 1: 0, 2: 1, 3: 2, 4: 4 },
  // Extra junk for a combo run, indexed by combo - 1 and clamped to the last
  // entry. A long run eventually outweighs the clear that carries it.
  comboGarbage: [0, 0, 1, 1, 2, 2, 3, 4],
};

// The map mode's levels. Each pattern is drawn bottom-up as text: '#' is a
// junk cell, '.' is empty, one string per row, aligned to the BOTTOM of the
// board and exactly BOARD.cols wide. Clear every junk cell to advance.
// `gravityScale` multiplies the fall delay — below 1 is faster.
//
// Drawing a new level needs no code: add an entry here.
export const MAP_LEVELS = [
  {
    name: 'Lily Pond 睡蓮池',
    gravityScale: 1.4,
    pattern: [
      '.......###',
      '....######',
      '..########',
    ],
  },
  {
    name: 'Poplar Row 白楊',
    gravityScale: 1.2,
    pattern: [
      '####.#####',
      '####.#####',
      '#####.####',
      '#####.####',
    ],
  },
  {
    name: 'Haystacks 乾草堆',
    gravityScale: 1,
    pattern: [
      '###....###',
      '###.##.###',
      '#..####..#',
      '#.######.#',
      '##.####.##',
    ],
  },
  {
    name: 'Rouen Façade 教堂',
    gravityScale: 0.85,
    pattern: [
      '#########.',
      '.#########',
      '#########.',
      '.#########',
      '#########.',
      '.#########',
    ],
  },
  {
    name: 'Water Lilies at Dusk 暮色',
    gravityScale: 0.7,
    pattern: [
      '#####.####',
      '####.#####',
      '###.######',
      '##.#######',
      '#.########',
      '.#########',
      '#.########',
      '##.#######',
    ],
  },
];

// Versus mode. Both clocked rules share one limit; the KO rule ignores it.
export const VERSUS = {
  limitMs: 120000,
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
  // Junk — map-mode levels and versus garbage. Deliberately the one stone-grey
  // in a painted palette, so "not yours, dig it out" reads at a glance.
  G: '#9A9187',
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
  reverb: { seconds: 2.6, decay: 2.4, mix: 0.34 },

  // A combo run escalates on four axes at once. Pitch alone was too subtle to
  // feel like a build-up, so each consecutive clear is also louder, rings
  // longer, and from the third one adds a bright arpeggio over the top.
  combo: {
    semitonesPerStep: 3, // a minor third per step — clearly audible, still consonant
    maxSteps: 7,         // caps the rise at +21 semitones
    gainPerStep: 0.14,
    maxGainScale: 1.9,
    decayPerStep: 0.22,  // seconds added per step
    maxDecayAdd: 1.4,
    sparkleFrom: 3,      // combo at which the shimmer layer joins
    sparkle: { semitones: [19, 24, 28], attack: 0.005, decay: 0.9, gain: 0.22, type: 'sine', spreadMs: 45 },
  },

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

  // The No Brainer sacrifice: the game-over voicing without the finality —
  // it drops, but it is quiet, short, and resolves. You lost a row, not a run.
  rescue: { semitones: [-5, 0, 3], attack: 0.02, decay: 1.1, gain: 0.22, type: 'sine', spreadMs: 90 },

  // Junk landing from the opponent: low, dull, and dry. Nothing to enjoy.
  garbage: { semitones: [-12, -11], attack: 0.008, decay: 0.45, gain: 0.2, type: 'triangle', spreadMs: 30 },

  levelUp: { semitones: [0, 4, 7, 12, 16], attack: 0.012, decay: 1.6, gain: 0.26, type: 'sine', spreadMs: 70 },
  gameOver: { semitones: [0, -2, -4, -8], attack: 0.06, decay: 2.8, gain: 0.3, type: 'sine', spreadMs: 220 },
};

// Player one, and the global shortcuts. `/` doubles for rotate-CCW so this
// whole set can be played from the right of the keyboard alone — which is
// what makes room for player two in versus mode.
export const KEYS = {
  left: ['ArrowLeft'],
  right: ['ArrowRight'],
  softDrop: ['ArrowDown'],
  hardDrop: [' '],
  rotateCW: ['ArrowUp', 'x', 'X'],
  rotateCCW: ['z', 'Z', '/'],
  hold: ['c', 'C', 'Shift'],
  pause: ['p', 'P', 'Escape'],
  restart: ['r', 'R'],
  start: ['Enter'],
  mute: ['m', 'M'],
};

// Player two in versus mode: the left hand block, chosen so it shares no key
// with KEYS above. Pause/restart/mute stay global on player one's set.
//
// Note this is a hardware limit, not a code one: cheap keyboards cannot
// always report six simultaneous keys from two hands (key ghosting). Nothing
// in software can fix that — see README.
export const KEYS_P2 = {
  left: ['a', 'A'],
  right: ['d', 'D'],
  softDrop: ['s', 'S'],
  hardDrop: ['w', 'W'],
  rotateCW: ['e', 'E'],
  rotateCCW: ['q', 'Q'],
  hold: ['f', 'F'],
};
