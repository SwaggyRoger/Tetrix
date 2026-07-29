// HUD: score / lines / level readouts, pause & game-over overlay, and the
// localStorage high score. Pure DOM bindings — no game logic.

const STORAGE_KEY = 'tetrix.highscore';

export function createHud() {
  const el = {
    score: document.getElementById('stat-score'),
    lines: document.getElementById('stat-lines'),
    level: document.getElementById('stat-level'),
    high: document.getElementById('stat-high'),
    overlay: document.getElementById('overlay'),
  };

  let high = Number(localStorage.getItem(STORAGE_KEY) || 0);
  el.high.textContent = high;

  function setOverlay(html) {
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
      if (game.state === 'paused') {
        setOverlay('<h2>Paused</h2><p>Press P to resume · 按 P 繼續</p>');
      } else if (game.state === 'gameover') {
        setOverlay(`<h2>Game Over</h2><p>Score ${game.score}</p><p>Press R to restart · 按 R 重新開始</p>`);
      } else {
        setOverlay(null);
      }
    },
    saveHighScore(score) {
      if (score >= high) localStorage.setItem(STORAGE_KEY, String(score));
    },
  };
}
