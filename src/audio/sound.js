// Maps game events to cues. This is the only file that knows what a "line
// clear" should sound like; synth.js knows how to make a sound, loader.js knows
// where optional files live, and core/ knows nothing about any of it.

// How far up to transpose for a combo run. The first clear of a run is
// unshifted; each consecutive one steps up, capped so it never turns shrill.
export function comboShift(cfg, combo) {
  const steps = Math.min(Math.max(combo - 1, 0), cfg.maxComboSteps);
  return steps * cfg.comboSemitonesPerStep;
}

export function createSound({ cfg, synth, samples = {}, storage = globalThis.localStorage }) {
  let muted = false;
  // A hard drop emits `harddrop` immediately followed by `lock`. The slam
  // already contains its own impact, so the settle tick would only muddy it.
  let skipNextLock = false;
  try {
    muted = storage?.getItem('tetrix.muted') === '1';
  } catch {
    muted = false; // private browsing / storage disabled — just start unmuted
  }
  synth.setMuted(muted);

  // An override file replaces the synthesised cue. Pitch still moves with the
  // combo, but via playbackRate, which also shortens the sample — unavoidable
  // without a full pitch-shifter, and documented in assets/audio/README.md.
  function playSample(el, semitoneShift, velocity) {
    const node = el.cloneNode();
    node.volume = Math.min(1, cfg.masterVolume * velocity);
    node.playbackRate = Math.pow(2, semitoneShift / 12);
    const played = node.play();
    if (played && typeof played.catch === 'function') played.catch(() => {});
  }

  function cue(name, spec, { semitoneShift = 0, velocity = 1, glide = false } = {}) {
    if (muted) return;
    const sample = samples[name];
    if (sample) {
      playSample(sample, semitoneShift, velocity);
      return;
    }
    if (glide) synth.glide(spec, { velocity });
    else synth.chord(spec, { semitoneShift, velocity });
  }

  return {
    get muted() {
      return muted;
    },
    // Browsers will not start audio outside a user gesture; call this from the
    // start button and from keydown.
    resume() {
      synth.resume();
    },
    setMuted(value) {
      muted = value;
      synth.setMuted(value);
      try {
        storage?.setItem('tetrix.muted', value ? '1' : '0');
      } catch {
        /* storage unavailable — the setting just won't persist */
      }
    },
    toggleMute() {
      this.setMuted(!muted);
      return muted;
    },
    onLock() {
      if (skipNextLock) {
        skipNextLock = false;
        return;
      }
      cue('lock', cfg.lock);
    },
    onHardDrop({ distance = 0 } = {}) {
      skipNextLock = true;
      // A longer fall reads as a heavier landing.
      cue('hardDrop', cfg.hardDrop, { velocity: 0.6 + 0.4 * Math.min(distance / 18, 1), glide: true });
    },
    onLineClear({ count = 1, combo = 1 } = {}) {
      const spec = cfg.clears[Math.min(Math.max(count, 1), 4)];
      cue(`clear${Math.min(Math.max(count, 1), 4)}`, spec, { semitoneShift: comboShift(cfg, combo) });
    },
    onLevelUp() {
      cue('levelUp', cfg.levelUp);
    },
    onGameOver() {
      cue('gameOver', cfg.gameOver);
    },
  };
}
