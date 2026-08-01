// Keyboard input with DAS (delayed auto shift) for left/right and a fixed
// repeat rate for soft drop. Actions are injected, so this module has no
// dependency on game internals — easy to add touch/gamepad modules later.

// Builds the lookup used to turn a keydown into an action.
//
// Matching on `event.key` alone is not enough. With an IME active (注音, kana,
// pinyin…) a letter keydown reports `key === 'Process'`, so nothing matched
// until the player forced a real letter through with Shift — which is why the
// shortcuts appeared to need capitals. `event.code` is the physical key and is
// unaffected by the IME, by Caps Lock, or by which case was produced, so every
// single-character binding also registers its code ('c' → 'KeyC', ' ' → 'Space').
//
// Pure and export-only so it can be unit-tested in Node without a DOM.
export function buildKeyMap(keys) {
  const map = new Map();
  for (const [action, list] of Object.entries(keys)) {
    for (const k of list) {
      map.set(k, action);
      if (k.length !== 1) continue;
      map.set(k.toLowerCase(), action);
      map.set(k.toUpperCase(), action);
      if (/[a-z]/i.test(k)) map.set(`Key${k.toUpperCase()}`, action);
      else if (k === ' ') map.set('Space', action);
      else if (/[0-9]/.test(k)) map.set(`Digit${k}`, action);
    }
  }
  return map;
}

export function createKeyboard({ keys, timing, actions }) {
  const keyToAction = buildKeyMap(keys);

  // Held state for auto-repeating actions.
  const held = {
    left: null,
    right: null,
    softDrop: null,
  };

  // `key` first so named keys (ArrowLeft, Enter, Shift) win; `code` is the
  // fallback that survives an IME, Caps Lock, and either letter case.
  function actionFor(e) {
    return keyToAction.get(e.key) ?? keyToAction.get(e.code);
  }

  function onKeyDown(e) {
    const action = actionFor(e);
    if (!action) return;
    e.preventDefault();
    if (e.repeat) return; // we do our own repeat

    if (action in held) {
      held[action] = { t: 0, repeatAcc: 0 };
      actions[action](); // fire immediately on press
    } else {
      actions[action]();
    }
  }

  function onKeyUp(e) {
    const action = actionFor(e);
    if (action && action in held) held[action] = null;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    // Call once per frame with elapsed ms.
    update(dt) {
      for (const dir of ['left', 'right']) {
        const h = held[dir];
        if (!h) continue;
        h.t += dt;
        if (h.t >= timing.dasMs) {
          h.repeatAcc += dt;
          while (h.repeatAcc >= timing.arrMs) {
            h.repeatAcc -= timing.arrMs;
            actions[dir]();
          }
        }
      }
      const sd = held.softDrop;
      if (sd) {
        sd.repeatAcc += dt;
        while (sd.repeatAcc >= timing.softDropMs) {
          sd.repeatAcc -= timing.softDropMs;
          actions.softDrop();
        }
      }
    },
    destroy() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    },
  };
}
