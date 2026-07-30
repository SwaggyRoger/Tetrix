// Impressionist cell sprites. Each tetromino colour is painted ONCE onto an
// offscreen canvas as layers of short brush "dabs" with hue/light jitter,
// then blitted every frame — painterly look at 60 fps.

function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hsla(h, s, l, a) {
  return `hsla(${h}, ${clamp(s, 0, 100)}%, ${clamp(l, 0, 100)}%, ${a})`;
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function paintDabs(ctx, size, base, { count, alpha, lightShift = 0 }) {
  for (let i = 0; i < count; i++) {
    const len = rand(size * 0.18, size * 0.45);
    const angle = -0.65 + rand(-0.5, 0.5); // diagonal stroke bias
    const x = rand(size * 0.08, size * 0.92);
    const y = rand(size * 0.08, size * 0.92);
    ctx.strokeStyle = hsla(
      base.h + rand(-12, 12),
      base.s + rand(-14, 10),
      base.l + lightShift + rand(-14, 14),
      rand(alpha[0], alpha[1]),
    );
    ctx.lineWidth = rand(2, 4.2);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - (Math.cos(angle) * len) / 2, y - (Math.sin(angle) * len) / 2);
    ctx.lineTo(x + (Math.cos(angle) * len) / 2, y + (Math.sin(angle) * len) / 2);
    ctx.stroke();
  }
}

function paintCell(size, hex) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const base = hexToHsl(hex);

  // Under-painting: a slightly muted wash of the base colour.
  ctx.fillStyle = hsla(base.h, base.s * 0.8, base.l * 0.92, 1);
  ctx.fillRect(0, 0, size, size);

  // Body strokes, then light catching the top-left, shadow at bottom-right.
  paintDabs(ctx, size, base, { count: 26, alpha: [0.2, 0.5] });
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size * 0.65, size * 0.65);
  ctx.clip();
  paintDabs(ctx, size, base, { count: 8, alpha: [0.25, 0.5], lightShift: 18 });
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(size * 0.4, size * 0.4, size * 0.6, size * 0.6);
  ctx.clip();
  paintDabs(ctx, size, base, { count: 7, alpha: [0.2, 0.4], lightShift: -16 });
  ctx.restore();

  // A soft, hand-drawn edge instead of a hard border.
  ctx.strokeStyle = hsla(base.h, base.s, base.l - 24, 0.35);
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
  return canvas;
}

function paintGhost(size, hex) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const base = hexToHsl(hex);
  ctx.fillStyle = hsla(base.h, base.s * 0.7, base.l, 0.12);
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = hsla(base.h, base.s, base.l - 10, 0.4);
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  return canvas;
}

// An external image scaled into one cell. Kept as its own offscreen canvas so
// the per-frame draw stays a plain blit, exactly like the painted sprites.
function blitImage(size, img) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, size, size);
  return canvas;
}

function imageGhost(size, img) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.globalAlpha = 0.22;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, size, size);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(90, 80, 70, 0.4)';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  return canvas;
}

// `images` is an optional { type: HTMLImageElement } map from src/assets/loader.js.
// Any type absent from it keeps the built-in impressionist painting, so a
// partial or empty skin is a valid state rather than an error.
export function createSprites(palette, cellSize, images = {}) {
  const cells = {};
  const ghosts = {};
  for (const [type, hex] of Object.entries(palette)) {
    const img = images[type];
    cells[type] = img ? blitImage(cellSize, img) : paintCell(cellSize, hex);
    ghosts[type] = img ? imageGhost(cellSize, img) : paintGhost(cellSize, hex);
  }
  return {
    cell: (type) => cells[type],
    ghost: (type) => ghosts[type],
  };
}
