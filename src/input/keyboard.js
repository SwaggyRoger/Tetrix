// Keyboard input with DAS (delayed auto shift) for left/right and a fixed
// repeat rate for soft drop. Actions are injected, so this module has no
// dependency on game internals — easy to add touch/gamepad modules later.

export function createKeyboard({ keys, timing, actions }) {
  const keyToAction = new Map();
  for (const [action, list] of Object.entries(keys)) {
    for (const k of list) keyToAction.set(k, action);
  }

  // Held state for auto-repeating actions.
  const held = {
    left: null,
    right: null,
    softDrop: null,
  };

  function onKeyDown(e) {
    const action = keyToAction.get(e.key);
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
    const action = keyToAction.get(e.key);
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
