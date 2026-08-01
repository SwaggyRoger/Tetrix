// Versus orchestration: routes junk between two games, runs the clock, and
// decides who won. No DOM — it drives two game APIs and emits one event.

import { createEmitter } from './emitter.js';
import { STATE } from './game.js';
import { VERSUS_RULE } from './modes.js';

export const DRAW = -1;

// `players` is a pair of createGame() APIs. `limitMs` is ignored by the KO
// rule, which has no clock.
export function createMatch({ players, rule, limitMs = 120000 }) {
  const emitter = createEmitter();
  const timed = rule !== VERSUS_RULE.KO;
  let remaining = limitMs;
  let over = false;

  function scores() {
    return players.map((p) => p.game.score);
  }

  // `winner` is a player index, DRAW, or null to decide it on score.
  function finish(reason, winner = null) {
    if (over) return;
    over = true;
    const final = scores();
    let result = winner;
    if (result === null) {
      if (final[0] === final[1]) result = DRAW;
      else result = final[0] > final[1] ? 0 : 1;
    }
    for (const p of players) p.finish();
    emitter.emit('matchover', { winner: result, reason, scores: final });
  }

  players.forEach((player, i) => {
    const opponent = players[1 - i];
    if (rule !== VERSUS_RULE.SOLO) {
      player.game.on('garbage', ({ lines }) => opponent.receiveGarbage(lines));
    }
    player.game.on('gameover', () => {
      if (over) return;
      if (rule === VERSUS_RULE.SOLO) {
        // Nobody is knocked out in a score race: the survivor plays on and
        // the match ends when both boards are done (or the clock runs out).
        if (players.every((p) => p.game.state === STATE.GAME_OVER)) finish('topout');
      } else {
        finish('knockout', 1 - i);
      }
    });
  });

  return {
    on: emitter.on,
    get over() {
      return over;
    },
    get timed() {
      return timed;
    },
    // Milliseconds left, or null when this rule has no clock.
    get remainingMs() {
      return timed ? Math.max(0, remaining) : null;
    },
    tick(dt) {
      if (over || !timed) return;
      // A paused board must not lose time.
      if (!players.some((p) => p.game.state === STATE.PLAYING)) return;
      remaining -= dt;
      if (remaining <= 0) {
        remaining = 0;
        finish('time');
      }
    },
    // Used by the "quit to menu" path so listeners are not left dangling.
    abort() {
      finish('aborted', DRAW);
    },
  };
}
