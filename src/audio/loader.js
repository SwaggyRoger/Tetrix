// Optional audio overrides. Everything is synthesised by default, so this layer
// exists purely so someone can drop real recordings in later without touching
// code. It reads `window.TETRIX_AUDIO`, set by assets/audio/manifest.js.
//
// Deliberately independent of src/assets/loader.js: different folder, different
// manifest, different global. Swapping artwork must never disturb sound and vice
// versa. The two share a shape on purpose — one mental model, two subsystems.
//
// Files are loaded through <audio> elements rather than fetch + decodeAudioData
// because fetch is blocked on file://, where the double-clickable index.html runs.

export const AUDIO_CUES = [
  'lock',
  'hardDrop',
  'clear1',
  'clear2',
  'clear3',
  'clear4',
  'rescue',
  'garbage',
  'levelUp',
  'gameOver',
];

export const AUDIO_MANIFEST_VERSION = 1;

export const AUDIO_GLOBAL = 'TETRIX_AUDIO';

const SAMPLE_TIMEOUT_MS = 10000;

// Pure — no DOM — so the loud-vs-quiet rules are unit-tested in Node.
// Returns { set: { name, cues } | null, errors: [], warnings: [] }.
// A null set means "synthesise everything", which is the normal default.
export function validateAudioManifest(raw) {
  const errors = [];
  const warnings = [];
  const fail = (msg) => {
    errors.push(msg);
    return { set: null, errors, warnings };
  };

  if (raw === undefined || raw === null) return { set: null, errors, warnings };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return fail(`audio manifest must be an object, got ${Array.isArray(raw) ? 'array' : typeof raw}`);
  }
  if (raw.version !== AUDIO_MANIFEST_VERSION) {
    return fail(
      `audio manifest version ${JSON.stringify(raw.version)} is not supported (expected ${AUDIO_MANIFEST_VERSION})`,
    );
  }

  const active = raw.activeSet;
  if (active === undefined || active === null) return { set: null, errors, warnings };
  if (typeof active !== 'string') {
    return fail(`activeSet must be a string or null, got ${typeof active}`);
  }

  const sets = raw.sets;
  if (sets === undefined || sets === null || typeof sets !== 'object' || Array.isArray(sets)) {
    return fail(`activeSet is "${active}" but "sets" is missing or not an object`);
  }
  const set = sets[active];
  if (set === undefined) {
    const available = Object.keys(sets);
    return fail(
      `activeSet "${active}" is not defined in "sets" (available: ${available.length ? available.join(', ') : 'none'})`,
    );
  }
  if (typeof set !== 'object' || set === null || Array.isArray(set)) {
    return fail(`sets["${active}"] must be an object`);
  }
  if (typeof set.cues !== 'object' || set.cues === null || Array.isArray(set.cues)) {
    return fail(`sets["${active}"].cues must be an object mapping cue name -> file path`);
  }

  const cues = {};
  for (const cue of AUDIO_CUES) {
    const path = set.cues[cue];
    if (path === undefined || path === null) continue; // silently synthesised
    if (typeof path !== 'string' || path.trim() === '') {
      warnings.push(`set "${active}": cues.${cue} must be a non-empty path string — ignored`);
      continue;
    }
    cues[cue] = path.trim();
  }
  for (const key of Object.keys(set.cues)) {
    if (!AUDIO_CUES.includes(key)) {
      warnings.push(`set "${active}": cues.${key} is not a cue name (${AUDIO_CUES.join(' ')}) — ignored`);
    }
  }
  if (Object.keys(cues).length === 0) {
    warnings.push(`set "${active}" names no usable files — every cue stays synthesised`);
  }

  return { set: { name: active, cues }, errors, warnings };
}

function loadSample(path) {
  return new Promise((resolve) => {
    const el = new Audio();
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), SAMPLE_TIMEOUT_MS);
    el.addEventListener('canplaythrough', () => done(el), { once: true });
    el.addEventListener('error', () => done(null), { once: true });
    el.preload = 'auto';
    el.src = path;
    el.load();
  });
}

// (`export const` rather than `export async function`: build.mjs only detects
// the `export function` / `export const` forms — see README design rule 6.)
export const loadAudioSet = async (rawManifest, console_ = console) => {
  const raw = rawManifest !== undefined ? rawManifest : globalThis[AUDIO_GLOBAL];
  const { set, errors, warnings } = validateAudioManifest(raw);

  for (const e of errors) console_.error(`[tetrix/audio] ${e} — every cue stays synthesised`);
  for (const w of warnings) console_.warn(`[tetrix/audio] ${w}`);
  if (!set) return { setName: null, samples: {} };

  const entries = Object.entries(set.cues);
  const loaded = await Promise.all(entries.map(([, path]) => loadSample(path)));

  const samples = {};
  entries.forEach(([cue, path], i) => {
    if (loaded[i]) samples[cue] = loaded[i];
    else console_.warn(`[tetrix/audio] could not load "${path}" for cue ${cue} — synthesised instead`);
  });
  return { setName: set.name, samples };
};
