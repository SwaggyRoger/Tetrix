// Optional external artwork. `assets/manifest.js` drops a plain object on
// `window.TETRIX_ASSETS`; this module validates it, loads the images it names,
// and hands the renderer a (possibly partial) map of piece type -> Image.
//
// Two rules govern everything here:
//   1. A malformed manifest FAILS LOUDLY (console.error naming the field), so
//      typos are found immediately instead of silently doing nothing.
//   2. A missing or broken image FALLS BACK quietly to the painted sprite.
//      The game must always start, whatever state assets/ is in.
//
// Note the manifest is a .js file, not .json, on purpose: `fetch()` is blocked
// on file:// (null origin), so the double-clickable index.html could never read
// a .json. A <script> tag reads fine from file://.

export const PIECE_TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

// Bump only on a breaking manifest format change; the loader refuses a
// manifest whose version it does not understand.
export const MANIFEST_VERSION = 1;

export const ASSET_GLOBAL = 'TETRIX_ASSETS';

const IMAGE_TIMEOUT_MS = 10000;

// Pure — no DOM, no network — so this is unit-tested in Node.
// Returns { skin: { name, cells } | null, errors: [], warnings: [] }.
// A null skin means "use the built-in painted sprites", which is a perfectly
// normal outcome (no manifest, or activeSkin left null), not a failure.
export function validateManifest(raw) {
  const errors = [];
  const warnings = [];
  const fail = (msg) => {
    errors.push(msg);
    return { skin: null, errors, warnings };
  };

  if (raw === undefined || raw === null) return { skin: null, errors, warnings };
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return fail(`manifest must be an object, got ${Array.isArray(raw) ? 'array' : typeof raw}`);
  }
  if (raw.version !== MANIFEST_VERSION) {
    return fail(`manifest version ${JSON.stringify(raw.version)} is not supported (expected ${MANIFEST_VERSION})`);
  }

  const active = raw.activeSkin;
  if (active === undefined || active === null) return { skin: null, errors, warnings };
  if (typeof active !== 'string') {
    return fail(`activeSkin must be a string or null, got ${typeof active}`);
  }

  const skins = raw.skins;
  if (skins === undefined || skins === null || typeof skins !== 'object' || Array.isArray(skins)) {
    return fail(`activeSkin is "${active}" but "skins" is missing or not an object`);
  }
  const skin = skins[active];
  if (skin === undefined) {
    const available = Object.keys(skins);
    return fail(
      `activeSkin "${active}" is not defined in "skins" (available: ${available.length ? available.join(', ') : 'none'})`,
    );
  }
  if (typeof skin !== 'object' || skin === null || Array.isArray(skin)) {
    return fail(`skins["${active}"] must be an object`);
  }
  if (typeof skin.cells !== 'object' || skin.cells === null || Array.isArray(skin.cells)) {
    return fail(`skins["${active}"].cells must be an object mapping piece type -> image path`);
  }

  const cells = {};
  for (const type of PIECE_TYPES) {
    const path = skin.cells[type];
    if (path === undefined || path === null) {
      warnings.push(`skin "${active}": no image for piece ${type} — that piece keeps the painted sprite`);
      continue;
    }
    if (typeof path !== 'string' || path.trim() === '') {
      warnings.push(`skin "${active}": cells.${type} must be a non-empty path string — ignored`);
      continue;
    }
    cells[type] = path.trim();
  }
  for (const key of Object.keys(skin.cells)) {
    if (!PIECE_TYPES.includes(key)) {
      warnings.push(`skin "${active}": cells.${key} is not a piece type (${PIECE_TYPES.join(' ')}) — ignored`);
    }
  }
  if (Object.keys(cells).length === 0) {
    warnings.push(`skin "${active}" names no usable images — the whole board keeps the painted sprites`);
  }

  return { skin: { name: active, cells }, errors, warnings };
}

function loadImage(path) {
  return new Promise((resolve) => {
    const img = new Image();
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    // Never let a hung request stall the upgrade forever.
    const timer = setTimeout(() => done(null), IMAGE_TIMEOUT_MS);
    img.onload = () => done(img.naturalWidth > 0 ? img : null);
    img.onerror = () => done(null);
    img.src = path;
  });
}

// Reads the manifest global, validates, and preloads. Resolves with
// { skinName, images } where images maps piece type -> Image for the files
// that actually loaded. Never rejects.
// (`export const` rather than `export async function`: build.mjs only detects
// the `export function` / `export const` forms — see README design rule 6.)
export const loadSkin = async (rawManifest, console_ = console) => {
  const raw = rawManifest !== undefined ? rawManifest : globalThis[ASSET_GLOBAL];
  const { skin, errors, warnings } = validateManifest(raw);

  for (const e of errors) console_.error(`[tetrix/assets] ${e} — falling back to the painted sprites`);
  for (const w of warnings) console_.warn(`[tetrix/assets] ${w}`);
  if (!skin) return { skinName: null, images: {} };

  const entries = Object.entries(skin.cells);
  const loaded = await Promise.all(entries.map(([, path]) => loadImage(path)));

  const images = {};
  entries.forEach(([type, path], i) => {
    if (loaded[i]) images[type] = loaded[i];
    else console_.warn(`[tetrix/assets] could not load "${path}" for piece ${type} — painted sprite used instead`);
  });
  return { skinName: skin.name, images };
};
