// Full-page Monet-style backdrop: a soft sky-to-pond gradient covered in
// hundreds of translucent elliptical dabs. Painted once (and on resize).

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

export function paintBackground(canvas, style) {
  const w = (canvas.width = window.innerWidth);
  const h = (canvas.height = window.innerHeight);
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, style.pageTop);
  grad.addColorStop(1, style.pageBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const dabCount = Math.round((w * h) / 3800);
  for (let i = 0; i < dabCount; i++) {
    const color = style.backgroundDabs[Math.floor(rand(0, style.backgroundDabs.length))];
    ctx.save();
    ctx.translate(rand(0, w), rand(0, h));
    ctx.rotate(rand(-0.5, 0.5));
    ctx.globalAlpha = rand(0.1, 0.32);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, rand(10, 42), rand(5, 14), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function installBackground(canvas, style) {
  paintBackground(canvas, style);
  window.addEventListener('resize', () => paintBackground(canvas, style));
}
