// HUD: score / lines / level readouts, pause & game-over overlay, and the
// localStorage high score. Pure DOM bindings — no game logic.

const STORAGE_KEY = 'tetrix.highscore';

export function createHud() {
  const el = {
    score: document.getElementById('stat-score'),
    lines: document.getElementById('stat-lines'),
    level: document.getElementById('stat-level'),
    high: document.getElementById('stat-high'),
    sound: document.getElementById('stat-sound'),
    overlay: document.getElementById('overlay'),
  };

  let high = Number(localStorage.getItem(STORAGE_KEY) || 0);
  el.high.textContent = high;

  // Only rewrite the overlay when its content actually changes, so buttons
  // inside it keep their identity (and hover/focus state) across frames.
  let overlayKey = null;
  function setOverlay(key, html) {
    if (key === overlayKey) return;
    overlayKey = key;
    if (html) {
      el.overlay.innerHTML = html;
      el.overlay.classList.remove('hidden');
    } else {
      el.overlay.classList.add('hidden');
    }
  }

  return {
    update(api) {
      const { game } = api;
      el.score.textContent = game.score;
      el.lines.textContent = game.lines;
      el.level.textContent = game.level;
      if (game.score > high) {
        high = game.score;
        el.high.textContent = high;
      }
      if (game.state === 'ready') {
        setOverlay('ready', '<h2>Tetrix</h2><p>印象派俄羅斯方塊</p><button id="btn-start">Game Start</button><p class="hint">or press Enter · 或按 Enter</p>');
      } else if (game.state === 'paused') {
        setOverlay('paused', '<h2>Paused</h2><p>Press P to resume · 按 P 繼續</p>');
      } else if (game.state === 'gameover') {
        setOverlay(`gameover-${game.score}`, `<h2>Game Over</h2><p>Score ${game.score}</p><button id="btn-start">Play Again 再玩一次</button><p class="hint">or press R · 或按 R</p>`);
      } else {
        setOverlay(null, null);
      }
    },
    saveHighScore(score) {
      if (score >= high) localStorage.setItem(STORAGE_KEY, String(score));
    },
    // Reflects the mute toggle (M). Guarded so the HUD still works if the
    // markup predates the sound panel.
    showMuted(muted) {
      if (el.sound) el.sound.textContent = muted ? 'Off 靜音' : 'On';
    },
  };
}
