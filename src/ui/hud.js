// HUD: score / lines / level readouts, the pause & game-over overlay, and the
// localStorage high score. Pure DOM bindings — no game logic.
//
// One HUD per player. Everything is looked up with data attributes *inside*
// the player's own column, so versus mode is simply two calls to createHud
// rather than a second set of element ids.

const STORAGE_KEY = 'tetrix.highscore';

export function createHud(root) {
  const stat = (name) => root.querySelector(`[data-stat="${name}"]`);
  const el = {
    label: root.querySelector('[data-label]'),
    score: stat('score'),
    lines: stat('lines'),
    level: stat('level'),
    high: stat('high'),
    sound: stat('sound'),
    combo: stat('combo'),
    objective: stat('objective'),
    timer: stat('timer'),
    overlay: root.querySelector('[data-overlay]'),
  };

  let high = Number(localStorage.getItem(STORAGE_KEY) || 0);
  if (el.high) el.high.textContent = high;

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

  // An announcement (versus result, level cleared) outranks whatever the game
  // state would have shown, until it is cleared with announce(null).
  let announcement = null;

  // A stat row is only meaningful in some modes; hiding the whole row keeps
  // the panel from showing a permanently blank "Time".
  function setRow(name, text) {
    const node = el[name];
    if (!node) return;
    const row = node.closest('[data-row]') ?? node;
    if (text === null || text === undefined) {
      row.hidden = true;
    } else {
      row.hidden = false;
      node.textContent = text;
    }
  }

  return {
    update(api) {
      const { game } = api;
      el.score.textContent = game.score;
      el.lines.textContent = game.lines;
      el.level.textContent = game.level;
      if (el.high && game.score > high) {
        high = game.score;
        el.high.textContent = high;
      }
      if (el.combo) setRow('combo', game.combo > 1 ? `×${game.combo}` : null);

      if (announcement) {
        setOverlay(announcement.key, announcement.html);
      } else if (game.state === 'paused') {
        setOverlay(
          'paused',
          '<h2>Paused</h2><p>Press P to resume · 按 P 繼續</p><button data-action="menu">Menu 選單</button>',
        );
      } else if (game.state === 'gameover') {
        setOverlay(
          `gameover-${game.score}`,
          `<h2>Game Over</h2><p>Score ${game.score}</p><button data-action="restart">Play Again 再玩一次</button><button data-action="menu">Menu 選單</button><p class="hint">or press R · 或按 R</p>`,
        );
      } else {
        setOverlay(null, null);
      }
    },
    // Take over this player's overlay; announce(null) hands it back to update().
    announce(key, html) {
      announcement = key === null ? null : { key, html };
      if (key === null) setOverlay(null, null);
    },
    setLabel(text) {
      if (el.label) el.label.textContent = text;
    },
    setRow,
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
