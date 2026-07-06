function rand(a, b) { return a + Math.random() * (b - a); }
function randInt(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
function angTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

// Точка внутри непроходимого препятствия (для пуль и линии видимости)
function pointBlocked(x, y, pad) {
  for (const o of world.obstacles) {
    if (o.kind === 'rock' || o.kind === 'tree') {
      const r = (o.kind === 'tree' ? o.trunk : o.r) + pad;
      const dx = x - o.x, dy = y - o.y;
      if (dx * dx + dy * dy < r * r) return o;
    } else if (o.kind === 'crate' || o.kind === 'house') {
      if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return o;
    }
  }
  return null;
}

// Есть ли прямая видимость между двумя точками
function hasLOS(x1, y1, x2, y2) {
  const d = dist(x1, y1, x2, y2);
  const steps = Math.ceil(d / 24);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (pointBlocked(lerp(x1, x2, t), lerp(y1, y2, t), 0)) return false;
  }
  return true;
}

// Вытолкнуть круг (персонажа) из прямоугольника
function resolveCircleRect(e, rc) {
  const nx = clamp(e.x, rc.x, rc.x + rc.w);
  const ny = clamp(e.y, rc.y, rc.y + rc.h);
  const dx = e.x - nx, dy = e.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= e.r * e.r) return;
  if (d2 === 0) { e.y = rc.y - e.r; return; } // центр оказался внутри
  const d = Math.sqrt(d2);
  const push = e.r - d;
  e.x += dx / d * push;
  e.y += dy / d * push;
}

// Вытолкнуть круг из круга
function resolveCircleCircle(e, cx, cy, cr) {
  const dx = e.x - cx, dy = e.y - cy;
  const min = e.r + cr;
  const d2 = dx * dx + dy * dy;
  if (d2 >= min * min || d2 === 0) return;
  const d = Math.sqrt(d2);
  e.x += dx / d * (min - d);
  e.y += dy / d * (min - d);
}
