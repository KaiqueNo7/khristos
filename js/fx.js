export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let pace = 1;
export const getPace = () => pace;
export const setPace = value => { pace = value; };
export const sleep = ms => new Promise(resolve => setTimeout(resolve, reduced ? Math.min(ms, 60) : ms / pace));

export const GOLD = '#f4dc98';
export const WHITE = '#fff7dc';
export const RED = '#ff7a5c';
export const PURPLE = '#c07ae8';
export const DUSK = '#6a2f8c';
export const BLUE = '#8eabf2';

let canvas = null;
let ctx = null;
let parts = [];
let running = false;
let last = 0;
let unit = 1;
const sprites = new Map();

function sprite(color) {
  if (sprites.has(color)) return sprites.get(color);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  sprites.set(color, c);
  return c;
}

function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(innerWidth * dpr);
  canvas.height = Math.round(innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

export function initFx(el) {
  canvas = el;
  ctx = canvas.getContext('2d');
  resize();
  addEventListener('resize', resize);
}

export function setUnit(scale) {
  unit = scale;
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  ctx.globalCompositeOperation = 'lighter';
  const alive = [];
  for (const p of parts) {
    p.age += dt;
    if (p.age < 0) {
      alive.push(p);
      continue;
    }
    const k = p.age / p.life;
    if (k >= 1) {
      if (p.done) p.done();
      continue;
    }
    alive.push(p);
    if (p.path) {
      const t = 1 - (1 - k) * (1 - k);
      const u = 1 - t;
      p.x = u * u * p.path[0] + 2 * u * t * p.path[2] + t * t * p.path[4];
      p.y = u * u * p.path[1] + 2 * u * t * p.path[3] + t * t * p.path[5];
    } else {
      p.vx *= 1 - p.drag * dt;
      p.vy = p.vy * (1 - p.drag * dt) + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    const fade = p.path ? Math.min(1, k * 6) * (k > 0.85 ? (1 - k) / 0.15 : 1) : 1 - k * k;
    if (p.ring) {
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = (1 - k) * 10 * unit + 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.2 + k), 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const size = p.size * (p.grow ? 1 + k * p.grow : 1 - k * 0.5);
    ctx.globalAlpha = fade * p.alpha;
    ctx.drawImage(sprite(p.color), p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
  parts = alive;
  if (parts.length) requestAnimationFrame(frame);
  else {
    running = false;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
  }
}

function add(p) {
  parts.push({ age: 0, life: 0.7, size: 16 * unit, alpha: 1, vx: 0, vy: 0, grav: 0, drag: 1.5, ...p });
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
}

const rnd = (a, b) => a + Math.random() * (b - a);

export const fx = {
  burst(x, y, { color = GOLD, n = 26, speed = 260, life = 0.75, size = 18, grav = 120 } = {}) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2);
      const v = rnd(0.25, 1) * speed * unit;
      add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: i % 4 ? color : WHITE, life: rnd(0.5, 1) * life, size: rnd(0.5, 1.2) * size * unit, grav: grav * unit });
    }
  },
  ring(x, y, { color = GOLD, size = 160, life = 0.6 } = {}) {
    if (reduced) return;
    add({ x, y, ring: true, color, size: size * unit, life });
  },
  pillar(rect, { color = GOLD, n = 46, life = 1.1 } = {}) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      add({ x: rnd(rect.left, rect.right), y: rnd(rect.top + rect.height * 0.4, rect.bottom), vx: rnd(-12, 12) * unit, vy: rnd(-420, -160) * unit, color: i % 3 ? color : WHITE, life: rnd(0.5, 1) * life, size: rnd(10, 30) * unit, drag: 0.6, age: -rnd(0, 0.25) });
    }
  },
  smoke(rect, { color = DUSK, n = 30, life = 1.2 } = {}) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      add({ x: rnd(rect.left, rect.right), y: rnd(rect.top, rect.bottom), vx: rnd(-40, 40) * unit, vy: rnd(-70, 20) * unit, color: i % 3 ? color : '#7a2030', life: rnd(0.6, 1) * life, size: rnd(40, 90) * unit, alpha: 0.2, grow: 1.4, drag: 1, age: -rnd(0, 0.2) });
    }
  },
  stream(from, to, { color = GOLD, n = 14, life = 0.75 } = {}) {
    if (reduced) return Promise.resolve();
    return new Promise(resolve => {
      let first = true;
      setTimeout(resolve, life * 1400 + 300);
      for (let i = 0; i < n; i++) {
        const mx = (from.x + to.x) / 2 + rnd(-140, 140) * unit;
        const my = (from.y + to.y) / 2 + rnd(-140, 140) * unit;
        add({
          x: from.x,
          y: from.y,
          path: [from.x + rnd(-24, 24) * unit, from.y + rnd(-14, 14) * unit, mx, my, to.x, to.y],
          color: i % 3 ? color : WHITE,
          life: life * rnd(0.85, 1.25),
          size: rnd(14, 26) * unit,
          age: -i * 0.028,
          done: () => {
            fx.burst(to.x, to.y, { color, n: 3, speed: 90, life: 0.4, size: 12, grav: 0 });
            if (first) {
              first = false;
              resolve();
            }
          }
        });
      }
    });
  },
  dust(width, height) {
    if (reduced) return;
    for (let i = 0; i < 3; i++) {
      add({ x: rnd(0, width), y: rnd(height * 0.2, height * 0.9), vx: rnd(-8, 8), vy: rnd(-16, -4), color: GOLD, life: rnd(3, 6), size: rnd(4, 9) * unit, alpha: 0.35, drag: 0, grav: 0 });
    }
  }
};
