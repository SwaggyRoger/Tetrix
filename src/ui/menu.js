// The start screen: pick a mode, then any options that mode needs, then play.
// Pure DOM — it reports a choice through `onStart` and knows nothing about how
// a game is built.

import { MODE, VERSUS_RULE } from '../core/modes.js';

const MODE_CARDS = [
  {
    mode: MODE.CLASSIC,
    title: 'Classic 經典',
    desc: 'The original endless run. 原本的無盡模式。',
  },
  {
    mode: MODE.NO_BRAINER,
    title: 'No Brainer 無腦模式',
    desc: 'It never ends. Reach the ceiling and the bottom row is sacrificed instead. 永遠不會結束；堆到頂就犧牲最底下一行。',
  },
  {
    mode: MODE.MAP,
    title: 'Map 地圖闖關',
    desc: 'Dig the stone out of each level to advance. 把每關的石塊全部清光才過關。',
  },
  {
    mode: MODE.VERSUS,
    title: 'Versus 雙人對戰',
    desc: 'Two players, one keyboard. 同一個鍵盤，兩個人對打。',
  },
];

const RULE_CARDS = [
  {
    rule: VERSUS_RULE.KO,
    title: 'Knockout 擊倒',
    desc: 'Clears send junk to your opponent. First one to the ceiling loses. 消行送垃圾給對手，先堆到頂的人輸。',
  },
  {
    rule: VERSUS_RULE.TIMED,
    title: 'Timed 計時對戰',
    desc: 'Junk flies both ways on a two-minute clock; highest score wins, but topping out loses immediately. 一樣送垃圾，兩分鐘後比分數，中途頂線直接輸。',
  },
  {
    rule: VERSUS_RULE.SOLO,
    title: 'Score Race 各自計分',
    desc: 'No junk. Two minutes, highest score wins. 互不干擾，兩分鐘內比分數。',
  },
];

function cardList(items, attr) {
  return items
    .map(
      (item, i) =>
        `<li><button class="mode-btn" data-${attr}="${item[attr]}">` +
        `<strong><span class="num">${i + 1}</span>${item.title}</strong>` +
        `<span class="desc">${item.desc}</span></button></li>`,
    )
    .join('');
}

export function createMenu({ root, onStart }) {
  let screen = null; // 'modes' | 'versus' | null (hidden)

  function render() {
    if (screen === 'modes') {
      root.innerHTML =
        '<div class="menu-card"><h2>Tetrix</h2><p class="subtitle">choose a mode · 選擇模式</p>' +
        `<ul class="mode-list">${cardList(MODE_CARDS, 'mode')}</ul>` +
        '<p class="hint">1–4 or click · 按數字鍵或點選</p>' +
        '<p class="hint">More modes are on the way · 更多模式陸續加入</p></div>';
    } else if (screen === 'versus') {
      root.innerHTML =
        '<div class="menu-card"><h2>Versus 雙人對戰</h2><p class="subtitle">choose the rules · 選擇規則</p>' +
        `<ul class="mode-list">${cardList(RULE_CARDS, 'rule')}</ul>` +
        '<p class="controls-note">P1 ← ↑ → ↓ · Space · Shift &nbsp;|&nbsp; P2 A W D S · E/Q · F</p>' +
        '<button class="mode-back" data-back>← Back 返回</button></div>';
    }
    root.classList.toggle('hidden', screen === null);
  }

  function choose(mode) {
    if (mode === MODE.VERSUS) {
      screen = 'versus';
      render();
      return;
    }
    screen = null;
    render();
    onStart({ mode });
  }

  root.addEventListener('click', (e) => {
    const back = e.target.closest('[data-back]');
    if (back) {
      screen = 'modes';
      render();
      return;
    }
    const btn = e.target.closest('[data-mode], [data-rule]');
    if (!btn) return;
    if (btn.dataset.mode) {
      choose(btn.dataset.mode);
    } else {
      screen = null;
      render();
      onStart({ mode: MODE.VERSUS, rule: btn.dataset.rule });
    }
  });

  return {
    get open() {
      return screen !== null;
    },
    show() {
      screen = 'modes';
      render();
    },
    hide() {
      screen = null;
      render();
    },
    // Digit shortcuts. Returns true if the key was consumed, so the caller
    // knows not to pass it on to the game.
    handleKey(key) {
      if (screen === null) return false;
      if (key === 'Escape' && screen === 'versus') {
        screen = 'modes';
        render();
        return true;
      }
      const n = Number(key);
      if (!Number.isInteger(n) || n < 1) return false;
      if (screen === 'modes') {
        const card = MODE_CARDS[n - 1];
        if (!card) return false;
        choose(card.mode);
        return true;
      }
      const card = RULE_CARDS[n - 1];
      if (!card) return false;
      screen = null;
      render();
      onStart({ mode: MODE.VERSUS, rule: card.rule });
      return true;
    },
  };
}
