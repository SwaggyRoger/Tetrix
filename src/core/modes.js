// What the game modes are, and the map mode's level progression. Pure data
// and pure logic — the layouts themselves live in config.js so a designer can
// draw new levels without opening this file.

export const MODE = {
  CLASSIC: 'classic',     // the original endless run
  NO_BRAINER: 'nobrainer', // never ends; the ceiling costs you the bottom row
  MAP: 'map',             // dig the pre-built junk out of each level
  VERSUS: 'versus',       // two players, one keyboard
};

export const VERSUS_RULE = {
  KO: 'ko',       // junk flies both ways; first to the ceiling loses
  TIMED: 'timed', // junk flies both ways, on a clock; highest score wins
  SOLO: 'solo',   // no junk, on a clock; purely a race for score
};

// The `rules` object each mode hands to createGame. Anything not named here
// keeps its classic default, so a mode only declares what it changes.
export function rulesFor(mode) {
  switch (mode) {
    case MODE.NO_BRAINER:
      return { topOut: 'rescue' };
    case MODE.VERSUS:
      return { sendsGarbage: true };
    default:
      return {};
  }
}

// Walks the map mode through its levels. Deliberately knows nothing about a
// board: the caller loads `level.pattern` and asks the game when the junk is
// gone. That keeps the progression testable on its own.
export function createCampaign({ levels }) {
  let index = 0;
  return {
    get index() {
      return index;
    },
    get total() {
      return levels.length;
    },
    get level() {
      return levels[index] ?? null;
    },
    get complete() {
      return index >= levels.length;
    },
    // Move to the next level. False means the campaign has been finished.
    advance() {
      index += 1;
      return index < levels.length;
    },
    reset() {
      index = 0;
    },
  };
}
