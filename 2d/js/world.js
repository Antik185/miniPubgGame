// Состояние мира: препятствия, лут, пули, частицы
const world = {
  size: CONFIG.WORLD,
  obstacles: [],
  loots: [],
  bullets: [],
  particles: [],
  corpses: [],
  lootId: 0,
};

function overlapsAny(x, y, r) {
  for (const o of world.obstacles) {
    if (o.kind === 'crate' || o.kind === 'house') {
      if (x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r) return true;
    } else {
      if (dist(x, y, o.x, o.y) < r + (o.r || o.canopy || 20)) return true;
    }
  }
  return false;
}

// До 40 попыток найти свободное место под объект радиуса r
function tryPlace(r, fn) {
  for (let i = 0; i < 40; i++) {
    const x = rand(120, world.size - 120), y = rand(120, world.size - 120);
    if (!overlapsAny(x, y, r)) { fn(x, y); return; }
  }
}

function weightedWeapon() {
  const total = WEAPON_DROP_WEIGHTS.reduce((s, w) => s + w[1], 0);
  let roll = Math.random() * total;
  for (const [key, w] of WEAPON_DROP_WEIGHTS) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return 'pistol';
}

function randomLootItem() {
  const r = Math.random();
  if (r < 0.45) {
    const w = weightedWeapon();
    return { kind: 'weapon', w, ammoIn: WEAPONS[w].mag };
  }
  if (r < 0.70) return { kind: 'ammo', amount: randInt(25, 55) };
  if (r < 0.88) return { kind: 'medkit', count: 1 };
  return { kind: 'armor', amount: randInt(35, 60) };
}

function dropLoot(x, y, item) {
  world.loots.push({
    id: world.lootId++,
    x: clamp(x, 30, world.size - 30),
    y: clamp(y, 30, world.size - 30),
    item,
    bob: rand(0, Math.PI * 2),
  });
}

function generateWorld() {
  world.obstacles = [];
  world.loots = [];
  world.bullets = [];
  world.particles = [];
  world.corpses = [];

  // Дома
  for (let i = 0; i < 10; i++) {
    tryPlace(220, (x, y) => {
      const w = rand(140, 240), h = rand(120, 200);
      world.obstacles.push({
        kind: 'house', x: x - w / 2, y: y - h / 2, w, h,
        roof: pick(['#7d5a44', '#6e6259', '#846148', '#5f6e78']),
      });
    });
  }
  // Ящики
  for (let i = 0; i < 42; i++) {
    tryPlace(60, (x, y) => {
      const s = rand(36, 58);
      world.obstacles.push({ kind: 'crate', x: x - s / 2, y: y - s / 2, w: s, h: s });
    });
  }
  // Камни
  for (let i = 0; i < 45; i++) {
    tryPlace(55, (x, y) => world.obstacles.push({ kind: 'rock', x, y, r: rand(18, 42) }));
  }
  // Деревья
  for (let i = 0; i < 90; i++) {
    tryPlace(40, (x, y) => world.obstacles.push({ kind: 'tree', x, y, trunk: rand(8, 12), canopy: rand(38, 66) }));
  }
  // Кусты (не мешают ходить, слегка прячут)
  for (let i = 0; i < 65; i++) {
    world.obstacles.push({ kind: 'bush', x: rand(80, world.size - 80), y: rand(80, world.size - 80), r: rand(26, 44) });
  }

  // Лут: 40% возле построек, остальное по карте
  const spots = world.obstacles.filter(o => o.kind === 'house' || o.kind === 'crate');
  let placed = 0, attempts = 0;
  while (placed < CONFIG.LOOT_COUNT && attempts < CONFIG.LOOT_COUNT * 10) {
    attempts++;
    let x, y;
    if (placed < CONFIG.LOOT_COUNT * 0.4 && spots.length) {
      const s = pick(spots);
      const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
      const a = rand(0, Math.PI * 2), d = Math.max(s.w, s.h) / 2 + rand(30, 90);
      x = clamp(cx + Math.cos(a) * d, 60, world.size - 60);
      y = clamp(cy + Math.sin(a) * d, 60, world.size - 60);
    } else {
      x = rand(80, world.size - 80);
      y = rand(80, world.size - 80);
    }
    if (pointBlocked(x, y, 14)) continue;
    dropLoot(x, y, randomLootItem());
    placed++;
  }
}
