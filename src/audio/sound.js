// Maps game events to cues. This is the only file that knows what a "line
// clear" should sound like; synth.js knows how to make a sound, loader.js knows
// where optional files live, and core/ knows nothing about any of it.

// How much a combo run escalates the clear cue. The first clear of a run is
// untouched; each consecutive one lifts pitch, gain and decay together, and
// past `sparkleFrom` a shimmer layer joins on top. Pitch on its own was not
// enough to read as a build-up.
export function comboLift(cfg, combo) {
  const c = cfg.combo;
  const steps = Math.min(Math.max(combo - 1, 0), c.maxSteps);
  return {
    steps,
    semitoneShift: steps * c.semitonesPerStep,
    gainScale: Math.min(1 + steps * c.gainPerStep, c.maxGainScale),
    decayAdd: Math.min(steps * c.decayPerStep, c.maxDecayAdd),
    sparkle: combo >= c.sparkleFrom,
  };
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
      const n = Math.min(Math.max(count, 1), 4);
      const lift = comboLift(cfg, combo);
      const base = cfg.clears[n];
      cue(
        `clear${n}`,
        { ...base, gain: base.gain * lift.gainScale, decay: base.decay + lift.decayAdd },
        { semitoneShift: lift.semitoneShift },
      );
      // The shimmer is a synthesised layer on top. It is skipped when the cue
      // has been overridden with a file, so an override stays exactly what the
      // author supplied — see assets/audio/README.md.
      if (lift.sparkle && !muted && !samples[`clear${n}`]) {
        synth.chord(cfg.combo.sparkle, { semitoneShift: lift.semitoneShift });
      }
    },
    onLevelUp() {
      cue('levelUp', cfg.levelUp);
    },
    onGameOver() {
      cue('gameOver', cfg.gameOver);
    },
  };
}
