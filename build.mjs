// Zero-dependency bundler: generates the double-clickable index.html from
// dev.html + styles.css + src/. Run after ANY change to src/, styles.css or
// dev.html:   node build.mjs
//
// It concatenates the ES modules into one classic <script> (so the game runs
// from file:// where module imports are blocked). Each module is wrapped in
// an IIFE to keep private helpers private; its `export`ed names are exposed
// to the shared top-level scope. Works because our modules only ever use
//   export function NAME / export const NAME    (see README design rules)
// and unique export names across modules.

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

// Dependency order: core first, then config, then the browser-facing layers.
const MODULES = [
  'core/emitter.js',
  'core/tetromino.js',
  'core/bag.js',
  'core/board.js',
  'core/game.js',
  'config.js',
  'assets/loader.js',
  'render/sprites.js',
  'render/background.js',
  'render/renderer.js',
  'effects/particles.js',
  'input/keyboard.js',
  'ui/hud.js',
];

function bundleModule(relPath) {
  const src = readFileSync(join(root, 'src', relPath), 'utf8');
  const exportNames = [...src.matchAll(/^export (?:function|const) ([A-Za-z0-9_$]+)/gm)].map(
    (m) => m[1],
  );
  if (exportNames.length === 0) {
    throw new Error(`${relPath}: no exports found — only 'export function/const NAME' is supported`);
  }
  const body = src.replace(/^import .*\n?/gm, '').replace(/^export /gm, '');
  const ns = '__m_' + relPath.replace(/[^A-Za-z0-9]/g, '_');
  return [
    `// ---- src/${relPath} ----`,
    `const ${ns} = (() => {`,
    body.trimEnd(),
    `return { ${exportNames.join(', ')} };`,
    `})();`,
    `const { ${exportNames.join(', ')} } = ${ns};`,
    relPath === 'config.js' ? `const config = ${ns}; // main.js uses 'import * as config'` : '',
    '',
  ].join('\n');
}

const seen = new Set();
let bundle = "'use strict';\n\n";
for (const m of MODULES) {
  const part = bundleModule(m);
  for (const name of part.matchAll(/^const \{ (.+) \} =/gm)) {
    for (const n of name[1].split(', ')) {
      if (seen.has(n)) throw new Error(`duplicate export name '${n}' (from ${m})`);
      seen.add(n);
    }
  }
  bundle += part + '\n';
}

bundle +=
  '// ---- src/main.js ----\n' + readFileSync(join(root, 'src/main.js'), 'utf8').replace(/^import .*\n?/gm, '');

if (bundle.includes('</script>')) {
  throw new Error('bundle would break the inline <script> tag');
}

const dev = readFileSync(join(root, 'dev.html'), 'utf8');
const css = readFileSync(join(root, 'styles.css'), 'utf8');

let html = dev
  .replace('<!DOCTYPE html>', () => '<!DOCTYPE html>\n<!-- GENERATED FILE — do not edit. Edit src/, styles.css or dev.html, then run: node build.mjs -->')
  .replace(/^\s*<!-- DEVELOPMENT entry:[\s\S]*?-->\n/m, '')
  .replace('<link rel="stylesheet" href="styles.css" />', () => `<style>\n${css}</style>`)
  .replace('<script type="module" src="src/main.js"></script>', () => `<script>\n${bundle}</script>`);

if (html.includes('<script type="module"') || html.includes('<link rel="stylesheet"')) {
  throw new Error('template substitution failed — dev.html markup changed?');
}

writeFileSync(join(root, 'index.html'), html);
console.log(`index.html generated (${(html.length / 1024).toFixed(1)} kB, ${MODULES.length + 1} modules inlined)`);
