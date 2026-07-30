// Composition root: builds the game core, renderer, particles, input and
// HUD, wires them together, and runs the requestAnimationFrame loop.
// This is the ONLY file that knows about every module.

import * as config from './config.js';
import { createGame } from './core/game.js';
import { createSprites } from './render/sprites.js';
import { createRenderer } from './render/renderer.js';
import { installBackground } from './render/background.js';
import { createParticles } from './effects/particles.js';
import { createKeyboard } from './input/keyboard.js';
import { createHud } from './ui/hud.js';
import { loadSkin } from './assets/loader.js';

const boardCanvas = document.getElementById('board');
const effectsCanvas = document.getElementById('effects');
const nextCanvas = document.getElementById('next');
const holdCanvas = document.getElementById('hold');

installBackground(document.getElementById('background'), config.CANVAS_STYLE);

const gameApi = createGame({
  board: config.BOARD,
  timing: config.TIMING,
  scoring: config.SCORING,
  gravityMs: config.gravityMs,
});

// The board must fit the window: shrink the cell size (and thus repaint the
// sprites and resize every canvas) whenever the viewport demands it.
const preferredCellSize = config.BOARD.cellSize;

function fitCellSize() {
  const available = window.innerHeight - config.PAGE_CHROME_PX;
  const fit = Math.floor(available / config.BOARD.rows);
  return Math.max(config.BOARD.minCellSize, Math.min(preferredCellSize, fit));
}

let sprites;
let renderer;
let particles;
let skinImages = {}; // filled in later if assets/manifest.js names a usable skin

function buildRenderers() {
  config.BOARD.cellSize = fitCellSize();
  sprites = createSprites(config.PALETTE, config.BOARD.cellSize, skinImages);
  renderer = createRenderer({ boardCanvas, nextCanvas, holdCanvas, sprites, config });
  effectsCanvas.width = boardCanvas.width;
  effectsCanvas.height = boardCanvas.height;
  particles = createParticles(effectsCanvas, config.EFFECTS);
}

buildRenderers();

// External artwork is an upgrade, never a gate: the painted sprites are already
// on screen, and we only repaint once (and if) the images actually arrive.
loadSkin().then(({ skinName, images }) => {
  if (Object.keys(images).length === 0) return;
  skinImages = images;
  buildRenderers();
  renderer.draw(gameApi);
  console.info(`[tetrix/assets] skin "${skinName}" applied (${Object.keys(images).length} pieces)`);
});

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    buildRenderers();
    renderer.draw(gameApi);
  }, 150);
});

const hud = createHud();

gameApi.game.on('lineclear', ({ cells }) => {
  particles.burst(cells, config.BOARD.cellSize);
});
gameApi.game.on('gameover', ({ score }) => {
  hud.saveHighScore(score);
});

// Start from the ready screen, or begin a fresh game after game over.
function startOrRestart() {
  if (gameApi.game.state === 'ready') gameApi.start();
  else if (gameApi.game.state === 'gameover') gameApi.reset();
}

const keyboard = createKeyboard({
  keys: config.KEYS,
  timing: config.TIMING,
  actions: {
    left: () => gameApi.moveLeft(),
    right: () => gameApi.moveRight(),
    softDrop: () => gameApi.softDrop(),
    hardDrop: () => gameApi.hardDrop(),
    rotateCW: () => gameApi.rotate(1),
    rotateCCW: () => gameApi.rotate(-1),
    hold: () => gameApi.hold(),
    pause: () => gameApi.togglePause(),
    restart: () => {
      if (gameApi.game.state !== 'ready') gameApi.reset();
    },
    start: startOrRestart,
  },
});

document.getElementById('overlay').addEventListener('click', (e) => {
  if (e.target.id === 'btn-start') startOrRestart();
});

// Paint the first frame synchronously so the start screen is visible even
// before requestAnimationFrame begins (e.g. hidden/backgrounded panes).
renderer.draw(gameApi);
hud.update(gameApi);

let last = performance.now();
function frame(now) {
  const dt = Math.min(now - last, 100); // clamp huge tab-switch deltas
  last = now;

  keyboard.update(dt);
  gameApi.tick(dt);
  particles.update(dt);

  renderer.draw(gameApi);
  particles.draw();
  hud.update(gameApi);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug/testing handle (used by automated verification; harmless in prod).
window.__tetrix = { gameApi, particles, renderer, hud, config };
