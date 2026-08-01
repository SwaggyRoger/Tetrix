// Composition root: builds the mode menu, then a *session* — one or two
// players, each with a game core, renderer, particles, input and HUD — and
// runs the requestAnimationFrame loop over it.
// This is the ONLY file that knows about every module.

import * as config from './config.js';
import { createGame, STATE } from './core/game.js';
import { MODE, VERSUS_RULE, rulesFor, createCampaign } from './core/modes.js';
import { createMatch, DRAW } from './core/match.js';
import { createSprites } from './render/sprites.js';
import { createRenderer } from './render/renderer.js';
import { installBackground } from './render/background.js';
import { createParticles } from './effects/particles.js';
import { createKeyboard } from './input/keyboard.js';
import { createHud } from './ui/hud.js';
import { createMenu } from './ui/menu.js';
import { loadSkin } from './assets/loader.js';
import { createSynth, scheduleChord, scheduleGlide, createBus, semitoneHz } from './audio/synth.js';
import { createSound, comboLift } from './audio/sound.js';
import { loadAudioSet } from './audio/loader.js';

const frame = document.getElementById('frame');
const playerTemplate = document.getElementById('player-template');

installBackground(document.getElementById('background'), config.CANVAS_STYLE);

// ---------------------------------------------------------------- sound ----
// Synthesised, so it is ready immediately and is shared by both players. The
// samples object is filled in later only if assets/audio/manifest.js names
// overrides; createSound holds the reference, so cues switch over in place.
const audioSamples = {};
const synth = createSynth(config.AUDIO);
const sound = createSound({ cfg: config.AUDIO, synth, samples: audioSamples });

loadAudioSet().then(({ setName, samples }) => {
  const names = Object.keys(samples);
  if (names.length === 0) return;
  Object.assign(audioSamples, samples);
  console.info(`[tetrix/audio] set "${setName}" applied (${names.join(', ')})`);
});

// Browsers only allow audio to start from a user gesture.
for (const evt of ['keydown', 'pointerdown']) {
  window.addEventListener(evt, () => sound.resume(), { once: true });
}

// --------------------------------------------------------------- sprites ---
const preferredCellSize = config.BOARD.cellSize;
let sprites = null;
let skinImages = {}; // filled in later if assets/manifest.js names a usable skin

// The board must fit the window. Height is the usual constraint; versus puts
// two boards side by side, so width can be the binding one instead.
function fitCellSize(playerCount) {
  const byHeight = Math.floor((window.innerHeight - config.PAGE_CHROME_PX) / config.BOARD.rows);
  let chrome = 0;
  for (const side of frame.querySelectorAll('.side')) chrome += side.offsetWidth;
  chrome += config.BOARD_MARGIN_PX * playerCount;
  const byWidth = Math.floor((window.innerWidth - chrome) / (config.BOARD.cols * playerCount));
  return Math.max(config.BOARD.minCellSize, Math.min(preferredCellSize, byHeight, byWidth));
}

// ------------------------------------------------------------- the session -
// Everything that belongs to one run of one mode. Replaced wholesale when the
// player picks a different mode, which is why nothing outside it holds a
// reference to a game.
let session = null;
// Set while an announcement is waiting to be dismissed (level cleared, match
// over). Enter or the overlay button runs it.
let pendingContinue = null;

function buildPlayer(index, count, mode) {
  const root = playerTemplate.content.firstElementChild.cloneNode(true);
  // Each column shows only its own player's keys.
  const wanted = String(index + 1);
  for (const panel of root.querySelectorAll('[data-controls]')) {
    if (panel.dataset.controls !== wanted) panel.remove();
  }
  frame.appendChild(root);

  const canvas = (name) => root.querySelector(`[data-canvas="${name}"]`);
  const api = createGame({
    board: config.BOARD,
    timing: config.TIMING,
    scoring: config.SCORING,
    gravityMs: config.gravityMs,
    rules: rulesFor(mode),
  });

  const player = {
    index,
    root,
    api,
    hud: createHud(root),
    canvases: {
      board: canvas('board'),
      effects: canvas('effects'),
      next: canvas('next'),
      hold: canvas('hold'),
    },
    renderer: null,
    particles: null,
    keyboard: null,
  };

  // Player one carries the global shortcuts (pause / restart / mute); player
  // two only ever moves a piece.
  const actions = {
    left: () => api.moveLeft(),
    right: () => api.moveRight(),
    softDrop: () => api.softDrop(),
    hardDrop: () => api.hardDrop(),
    rotateCW: () => api.rotate(1),
    rotateCCW: () => api.rotate(-1),
    hold: () => api.hold(),
  };
  if (index === 0) {
    Object.assign(actions, {
      pause: () => api.togglePause(),
      restart: () => restartSession(),
      start: () => pendingContinue?.(),
      mute: () => {
        const muted = sound.toggleMute();
        for (const p of session.players) p.hud.showMuted(muted);
      },
    });
  }
  player.keyboard = createKeyboard({
    keys: index === 0 ? config.KEYS : config.KEYS_P2,
    timing: config.TIMING,
    actions,
  });

  return player;
}

// Sprites and canvas sizes depend on the cell size, which depends on the
// window and the number of boards — so this reruns on resize too.
function buildRenderers() {
  if (!session) return;
  config.BOARD.cellSize = fitCellSize(session.players.length);
  sprites = createSprites(config.PALETTE, config.BOARD.cellSize, skinImages);
  for (const p of session.players) {
    p.renderer = createRenderer({
      boardCanvas: p.canvases.board,
      nextCanvas: p.canvases.next,
      holdCanvas: p.canvases.hold,
      sprites,
      config,
    });
    p.canvases.effects.width = p.canvases.board.width;
    p.canvases.effects.height = p.canvases.board.height;
    p.particles = createParticles(p.canvases.effects, config.EFFECTS);
  }
}

function wireEvents(player, mode) {
  const { api, hud } = player;
  api.game.on('lineclear', ({ cells, count, combo }) => {
    player.particles.burst(cells, config.BOARD.cellSize);
    sound.onLineClear({ count, combo });
    if (mode === MODE.MAP && api.garbageLeft() === 0) levelCleared(player);
  });
  api.game.on('harddrop', ({ distance }) => sound.onHardDrop({ distance }));
  api.game.on('lock', () => sound.onLock());
  api.game.on('levelup', () => sound.onLevelUp());
  api.game.on('rescue', ({ cells }) => {
    player.particles.burst(cells, config.BOARD.cellSize);
    sound.onRescue();
  });
  api.game.on('garbagelanded', () => sound.onGarbage());
  api.game.on('gameover', ({ score }) => {
    if (mode !== MODE.VERSUS) hud.saveHighScore(score);
    sound.onGameOver();
  });
}

// ------------------------------------------------------------- map mode ----
function loadLevel(player) {
  const level = session.campaign.level;
  player.api.loadPattern(level.pattern);
  player.api.setRules({ gravityScale: level.gravityScale });
  player.hud.setRow('objective', String(player.api.garbageLeft()));
  player.hud.setLabel(`Level ${session.campaign.index + 1}/${session.campaign.total} · ${level.name}`);
}

function levelCleared(player) {
  const campaign = session.campaign;
  if (!campaign.advance()) {
    player.api.finish();
    player.hud.announce(
      'campaign',
      `<h2>All Clear</h2><p>每一關都通過了！</p><p>Score ${player.api.game.score}</p>` +
        '<button data-action="restart">Play Again 再玩一次</button><button data-action="menu">Menu 選單</button>',
    );
    return;
  }
  loadLevel(player);
  player.api.togglePause(); // hold the celebration until the player is ready
  player.hud.announce(
    `level-${campaign.index}`,
    `<h2>Level ${campaign.index + 1}</h2><p>${campaign.level.name}</p>` +
      '<button data-action="continue">Continue 繼續</button><p class="hint">or press Enter · 或按 Enter</p>',
  );
  pendingContinue = () => {
    pendingContinue = null;
    player.hud.announce(null);
    player.api.togglePause();
  };
}

// -------------------------------------------------------------- versus -----
function versusResult(winner, reason, scores) {
  const reasons = {
    knockout: 'Knockout 擊倒',
    time: "Time's up 時間到",
    topout: 'Both boards are done 兩邊都結束了',
    aborted: 'Match abandoned 中止',
  };
  const tail =
    '<button data-action="restart">Rematch 再一場</button><button data-action="menu">Menu 選單</button>';
  for (const p of session.players) {
    const head =
      winner === DRAW ? '<h2>Draw 平手</h2>' : `<h2>${winner === p.index ? 'Winner 勝' : 'Defeat 敗'}</h2>`;
    p.hud.announce(
      'result',
      `${head}<p>${reasons[reason] ?? reason}</p><p>${scores[0]} — ${scores[1]}</p>${tail}`,
    );
  }
}

function formatClock(ms) {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

// ------------------------------------------------------------- lifecycle ---
function destroySession() {
  if (!session) return;
  // No teardown call on the match: it owns no timers, and every listener it
  // registered lives on emitters that are discarded with the session.
  for (const p of session.players) p.keyboard.destroy();
  frame.innerHTML = '';
  session = null;
  pendingContinue = null;
}

function startSession({ mode, rule }) {
  destroySession();
  const count = mode === MODE.VERSUS ? 2 : 1;
  frame.classList.toggle('two-up', count === 2);

  session = { mode, rule, players: [], campaign: null, match: null };
  for (let i = 0; i < count; i++) session.players.push(buildPlayer(i, count, mode));
  buildRenderers();
  for (const p of session.players) wireEvents(p, mode);

  for (const p of session.players) {
    p.hud.showMuted(sound.muted);
    p.hud.setRow('combo', null);
    p.hud.setRow('objective', null);
    p.hud.setRow('timer', null);
  }

  if (mode === MODE.MAP) {
    session.campaign = createCampaign({ levels: config.MAP_LEVELS });
    loadLevel(session.players[0]);
  } else if (mode === MODE.VERSUS) {
    session.match = createMatch({
      players: session.players.map((p) => p.api),
      rule,
      limitMs: config.VERSUS.limitMs,
    });
    session.match.on('matchover', ({ winner, reason, scores }) => versusResult(winner, reason, scores));
    session.players.forEach((p, i) => {
      p.hud.setLabel(`Player ${i + 1}`);
      p.hud.setRow('high', null); // a duel is not a personal best
    });
  } else if (mode === MODE.NO_BRAINER) {
    session.players[0].hud.setLabel('No Brainer 無腦模式');
  }

  for (const p of session.players) p.api.start();
  sound.resume();
}

function restartSession() {
  if (!session) return;
  pendingContinue = null;
  // A versus match is stateful beyond the two boards (clock, winner), so a
  // rematch is a fresh session rather than two resets.
  if (session.mode === MODE.VERSUS) {
    startSession({ mode: session.mode, rule: session.rule });
    return;
  }
  // Restore the level layout *before* resetting, so reset() spawns onto the
  // board the player is about to replay rather than an empty one. Playing
  // again after the last level means starting the campaign over — there is no
  // current level to restore.
  if (session.mode === MODE.MAP) {
    if (session.campaign.complete) session.campaign.reset();
    loadLevel(session.players[0]);
  }
  for (const p of session.players) {
    p.hud.announce(null);
    p.api.reset();
  }
}

function toMenu() {
  destroySession();
  frame.classList.remove('two-up');
  menu.show();
}

const menu = createMenu({ root: document.getElementById('menu'), onStart: startSession });

frame.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'continue') pendingContinue?.();
  else if (btn.dataset.action === 'restart') restartSession();
  else if (btn.dataset.action === 'menu') toMenu();
});

// The menu owns the keyboard while it is open, so a digit choosing a mode is
// never also a game input.
window.addEventListener(
  'keydown',
  (e) => {
    if (menu.handleKey(e.key)) e.preventDefault();
  },
  true,
);

let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(buildRenderers, 150);
});

// External artwork is an upgrade, never a gate: the painted sprites are already
// on screen, and we only repaint once (and if) the images actually arrive.
loadSkin().then(({ skinName, images }) => {
  if (Object.keys(images).length === 0) return;
  skinImages = images;
  buildRenderers();
  console.info(`[tetrix/assets] skin "${skinName}" applied (${Object.keys(images).length} pieces)`);
});

menu.show();

let last = performance.now();
function tickFrame(now) {
  const dt = Math.min(now - last, 100); // clamp huge tab-switch deltas
  last = now;

  if (session) {
    for (const p of session.players) {
      p.keyboard.update(dt);
      p.api.tick(dt);
      p.particles.update(dt);
    }
    if (session.match) {
      session.match.tick(dt);
      const left = session.match.remainingMs;
      for (const p of session.players) p.hud.setRow('timer', left === null ? null : formatClock(left));
    }
    if (session.mode === MODE.MAP) {
      const p = session.players[0];
      p.hud.setRow('objective', String(p.api.garbageLeft()));
    }
    for (const p of session.players) {
      p.renderer.draw(p.api);
      p.particles.draw();
      p.hud.update(p.api);
    }
  }

  requestAnimationFrame(tickFrame);
}
requestAnimationFrame(tickFrame);

// Debug/testing handle (used by automated verification; harmless in prod).
// The audio entry exposes the schedulers so cues can be rendered into an
// OfflineAudioContext and measured — that is how the sound design is verified.
window.__tetrix = {
  get session() {
    return session;
  },
  get gameApi() {
    return session?.players[0].api ?? null;
  },
  startSession,
  toMenu,
  menu,
  config,
  sound,
  STATE,
  MODE,
  VERSUS_RULE,
  audio: { synth, scheduleChord, scheduleGlide, createBus, semitoneHz, comboLift },
};
