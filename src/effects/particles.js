// Heart & star particle bursts for line clears. Runs on its own overlay
// canvas above the board so effects never dirty the playfield rendering.

function rand(lo, hi) {
  return lo + Math.random() * (hi - lo);
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function heartPath(ctx, s) {
  ctx.beginPath();
  ctx.moveTo(0, s);
  ctx.bezierCurveTo(-s, s * 0.4, -s * 0.9, -s * 0.6, 0, -s * 0.25);
  ctx.bezierCurveTo(s * 0.9, -s * 0.6, s, s * 0.4, 0, s);
  ctx.closePath();
}

function starPath(ctx, s) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? s : s * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function createParticles(canvas, effectsCfg) {
  const ctx = canvas.getContext('2d');
  let particles = [];

  return {
    get count() {
      return particles.length;
    },
    // cells: [{x, y}] in board coordinates; cellSize: px.
    burst(cells, cellSize) {
      for (const cell of cells) {
        for (let i = 0; i < effectsCfg.particlesPerCell; i++) {
          const shape = Math.random() < 0.5 ? 'heart' : 'star';
          particles.push({
            shape,
            color: pick(shape === 'heart' ? effectsCfg.heartColors : effectsCfg.starColors),
            x: (cell.x + rand(0.2, 0.8)) * cellSize,
            y: (cell.y + rand(0.2, 0.8)) * cellSize,
            vx: rand(-70, 70),
            vy: rand(-160, -40),
            rot: rand(0, Math.PI * 2),
            vr: rand(-3.5, 3.5),
            size: rand(5, 12),
            age: 0,
            ttl: rand(effectsCfg.particleTtlMs[0], effectsCfg.particleTtlMs[1]),
          });
        }
      }
    },
    update(dt) {
      const s = dt / 1000;
      for (const p of particles) {
        p.age += dt;
        p.x += p.vx * s;
        p.y += p.vy * s;
        p.vy += 140 * s; // gentle gravity so they float up then drift down
        p.rot += p.vr * s;
      }
      particles = particles.filter((p) => p.age < p.ttl);
    },
    draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        const life = 1 - p.age / p.ttl;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, life * 1.6);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        const size = p.size * (0.7 + 0.3 * life);
        if (p.shape === 'heart') heartPath(ctx, size);
        else starPath(ctx, size);
        ctx.fill();
        ctx.restore();
      }
    },
  };
}
