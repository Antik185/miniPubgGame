// ИИ ботов: бродят к зоне, замечают врагов, стреляют с разбросом, лечатся
function spawnBots() {
  const names = BOT_NAMES.slice();
  for (let i = 0; i < CONFIG.BOT_COUNT; i++) {
    let x, y, tries = 0;
    do {
      x = rand(150, world.size - 150);
      y = rand(150, world.size - 150);
      tries++;
    } while ((pointBlocked(x, y, 22) || dist(x, y, player.x, player.y) < 600) && tries < 60);

    const name = names.length ? names.splice(randInt(0, names.length - 1), 1)[0] : 'Бот ' + (i + 1);
    const b = makeEntity(x, y, name, pick(PLAYER_COLORS), false);
    const w = weightedWeapon();
    b.slots[0] = { kind: 'weapon', w, ammoIn: WEAPONS[w].mag };
    if (Math.random() < 0.6) b.slots[1] = { kind: 'medkit', count: randInt(1, 2) };
    b.armor = Math.random() < 0.5 ? randInt(20, 60) : 0;
    b.aimErr = rand(0.18, 0.38); // «меткость»: чем меньше, тем опаснее бот
    b.idleT = rand(0, 3);        // пауза между перебежками
    botPickRoam(b);
    entities.push(b);
  }
}

function botPickRoam(b) {
  // точка внутри безопасной зоны (целевой, если зона сужается)
  const zc = zone.state === 'shrink' && zone.to ? zone.to : { cx: zone.cx, cy: zone.cy, r: zone.r };
  const a = rand(0, Math.PI * 2), d = rand(0, Math.max(60, zc.r * 0.8));
  b.roamX = clamp(zc.cx + Math.cos(a) * d, 60, world.size - 60);
  b.roamY = clamp(zc.cy + Math.sin(a) * d, 60, world.size - 60);
}

function updateBot(b, dt) {
  b.thinkT -= dt;
  if (b.thinkT <= 0) {
    b.thinkT = rand(0.25, 0.5);
    // ищем ближайшего видимого врага
    let best = null, bd = 450;
    for (const e of entities) {
      if (e === b || !e.alive) continue;
      const d = dist(b.x, b.y, e.x, e.y);
      if (d < bd && hasLOS(b.x, b.y, e.x, e.y)) { bd = d; best = e; }
    }
    b.target = best;
    if (Math.random() < 0.3) b.strafeDir *= -1;
    if (!b.target && b.hp < 50 && b.healT <= 0) startHeal(b);
  }

  const outside = dist(b.x, b.y, zone.cx, zone.cy) > zone.r - 40;
  let mx = 0, my = 0;

  if (b.target && b.target.alive) {
    const t = b.target;
    const d = dist(b.x, b.y, t.x, t.y);
    const w = activeWeapon(b);
    const range = w ? w.range : CONFIG.MELEE_RANGE;
    const wantDist = w ? range * 0.45 : 20;
    const a = angTo(b.x, b.y, t.x, t.y);
    // держим дистанцию и стрейфим
    const approach = d > wantDist ? 1 : -0.7;
    mx = Math.cos(a) * approach + Math.cos(a + Math.PI / 2) * b.strafeDir * 0.8;
    my = Math.sin(a) * approach + Math.sin(a + Math.PI / 2) * b.strafeDir * 0.8;
    b.dir = a;
    b.sprint = false;
    if (d < range * 0.95 && b.healT <= 0) {
      // прицел с ошибкой, растущей с дистанцией
      const err = b.aimErr * (d / range + 0.3);
      const ax = t.x + Math.cos(a + Math.PI / 2) * rand(-1, 1) * d * err;
      const ay = t.y + Math.sin(a + Math.PI / 2) * rand(-1, 1) * d * err;
      tryFire(b, ax, ay);
    }
  } else {
    if (b.idleT > 0 && !outside) {
      b.idleT -= dt; // отдыхаем на месте
    } else {
      if (dist(b.x, b.y, b.roamX, b.roamY) < 50) {
        botPickRoam(b);
        if (!outside) b.idleT = rand(1, 4);
      } else if (outside && dist(b.roamX, b.roamY, zone.cx, zone.cy) > zone.r) {
        botPickRoam(b); // цель тоже вне зоны — выбрать новую
      }
      if (b.idleT <= 0 || outside) {
        const a = angTo(b.x, b.y, b.roamX, b.roamY);
        mx = Math.cos(a);
        my = Math.sin(a);
        b.dir = a;
      }
    }
    b.sprint = outside; // вне зоны — бегом
  }
  moveEntity(b, mx, my, dt);
}
