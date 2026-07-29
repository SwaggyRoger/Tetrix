// 7-bag randomizer: every 7 consecutive pieces contain each tetromino
// exactly once. RNG is injectable so tests can be deterministic.

import { TYPES } from './tetromino.js';

export function createBag(rng = Math.random) {
  let bag = [];

  function refill() {
    bag = [...TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }

  return {
    next() {
      if (bag.length === 0) refill();
      return bag.pop();
    },
  };
}
