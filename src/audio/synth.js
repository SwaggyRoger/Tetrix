// Impressionist synthesiser. Every sound is built from oscillators at runtime,
// so there are no audio files to ship and pitch is an exact parameter — which
// is what makes "higher pitch on higher combo" a real transposition rather than
// a sped-up sample.
//
// The scheduling functions take a context and a destination rather than owning
// them, so the exact same graph can be rendered into an OfflineAudioContext and
// measured. That is how the sound design is verified — see docs/plans/.

// Convert a semitone offset from the root into a frequency.
export function semitoneHz(rootHz, semitones) {
  return rootHz * Math.pow(2, semitones / 12);
}

// A decaying noise burst used as a reverb impulse response: cheap, and it gives
// the wash of tone that the painted visuals ask for.
export function createReverbImpulse(ctx, seconds, decay) {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

// Soft attack, long exponential tail. Never rings a hard edge.
function envelope(ctx, at, attack, decay, peak) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(Math.max(peak, 0.0002), at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
  return gain;
}

// A voicing: one oscillator per semitone, entries staggered by `spreadMs` so
// the chord blooms rather than lands as a block.
// Returns the time the cue finishes.
export function scheduleChord(ctx, destination, spec, { rootHz, at, semitoneShift = 0, velocity = 1 }) {
  const start = at ?? ctx.currentTime;
  const spread = (spec.spreadMs ?? 0) / 1000;
  let end = start;
  spec.semitones.forEach((semi, i) => {
    const t = start + i * spread;
    const osc = ctx.createOscillator();
    osc.type = spec.type ?? 'sine';
    osc.frequency.setValueAtTime(semitoneHz(rootHz, semi + semitoneShift), t);
    // A touch of detune keeps stacked voices from sounding electronically exact.
    osc.detune.setValueAtTime((i % 2 === 0 ? 1 : -1) * 4, t);
    const gain = envelope(ctx, t, spec.attack, spec.decay, (spec.gain * velocity) / spec.semitones.length);
    osc.connect(gain).connect(destination);
    osc.start(t);
    osc.stop(t + spec.attack + spec.decay + 0.05);
    end = Math.max(end, t + spec.attack + spec.decay);
  });
  return end;
}

// The urgent one: a fast downward glide plus a filtered noise thud.
export function scheduleGlide(ctx, destination, spec, { rootHz, at, velocity = 1 }) {
  const start = at ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = spec.type ?? 'sawtooth';
  osc.frequency.setValueAtTime(semitoneHz(rootHz, spec.fromSemitone), start);
  osc.frequency.exponentialRampToValueAtTime(
    semitoneHz(rootHz, spec.toSemitone),
    start + (spec.glideMs ?? 90) / 1000,
  );
  // Roll the top off so the sawtooth reads as urgency, not harshness.
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.setValueAtTime(2600, start);
  const gain = envelope(ctx, start, spec.attack, spec.decay, spec.gain * velocity);
  osc.connect(tone).connect(gain).connect(destination);
  osc.start(start);
  osc.stop(start + spec.attack + spec.decay + 0.05);

  if (spec.noiseGain) {
    const length = Math.max(1, Math.floor(ctx.sampleRate * (spec.noiseDecay ?? 0.15)));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const thud = ctx.createBiquadFilter();
    thud.type = 'lowpass';
    thud.frequency.setValueAtTime(900, start);
    const noiseGain = envelope(ctx, start, 0.001, spec.noiseDecay ?? 0.15, spec.noiseGain * velocity);
    src.connect(thud).connect(noiseGain).connect(destination);
    src.start(start);
  }
  return start + spec.attack + spec.decay;
}

// Builds the shared graph — master gain, a softening lowpass, and a reverb send
// — on any context. Returns the node cues should connect to.
export function createBus(ctx, cfg) {
  const master = ctx.createGain();
  master.gain.value = cfg.masterVolume;

  const soften = ctx.createBiquadFilter();
  soften.type = 'lowpass';
  soften.frequency.value = 5200;

  const dry = ctx.createGain();
  dry.gain.value = 1 - cfg.reverb.mix;
  const wet = ctx.createGain();
  wet.gain.value = cfg.reverb.mix;

  const convolver = ctx.createConvolver();
  convolver.buffer = createReverbImpulse(ctx, cfg.reverb.seconds, cfg.reverb.decay);

  const input = ctx.createGain();
  input.connect(dry).connect(soften);
  input.connect(convolver).connect(wet).connect(soften);
  soften.connect(master).connect(ctx.destination);

  return { input, master };
}

// Live wrapper: owns a real AudioContext, created lazily on the first user
// gesture because browsers refuse to start audio before one.
export function createSynth(cfg) {
  let ctx = null;
  let bus = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Ctor) return false; // no Web Audio (very old browser) — stay silent
    ctx = new Ctor();
    bus = createBus(ctx, cfg);
    return true;
  }

  return {
    get ready() {
      return ctx !== null && ctx.state === 'running';
    },
    get muted() {
      return muted;
    },
    // Must be called from a user gesture (the Game Start button / a keypress).
    resume() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
    },
    setMuted(value) {
      muted = value;
      if (bus) bus.master.gain.value = value ? 0 : cfg.masterVolume;
    },
    chord(spec, opts = {}) {
      if (muted || !ensure() || ctx.state !== 'running') return;
      scheduleChord(ctx, bus.input, spec, { rootHz: cfg.rootHz, at: ctx.currentTime, ...opts });
    },
    glide(spec, opts = {}) {
      if (muted || !ensure() || ctx.state !== 'running') return;
      scheduleGlide(ctx, bus.input, spec, { rootHz: cfg.rootHz, at: ctx.currentTime, ...opts });
    },
  };
}
