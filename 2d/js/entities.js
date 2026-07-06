// Персонажи (игрок и боты), стрельба, урон, инвентарь
let entities = [];
let killfeed = [];

function addKillfeed(text) {
  killfeed.unshift({ text, t: 6 });
  if (killfeed.length > 6) killfeed.pop();
}

function makeEntity(x, y, name, color, isPlayer) {
  return {
    x, y, r: CONFIG.PLAYER_R, dir: 0,
    hp: 100, maxHp: 100, armor: 0,
    name, color, isPlayer,
    alive: true,
    slots: [null, null, null, null, null],
    active: 0,
    ammo: isPlayer ? 30 : 9999,
    fireCd: 0, reloadT: 0, reloadTotal: 0,
    healT: 0, healSlot: -1,
    meleeCd: 0, meleeSwing: 0,
    kills: 0, zoneAcc: 0,
    moving: false, sprint: false, walkPhase: rand(0, 10),
    // поля для ИИ ботов
    thinkT: rand(0, 0.4), target: null,
    roamX: x, roamY: y, strafeDir: 1, aimErr: 0.25,
  };
}

function activeWeapon(e) {
  const s = e.slots[e.active];
  return s && s.kind === 'weapon' ? WEAPONS[s.w] : null;
}

function moveEntity(e, dx, dy, dt) {
  let speed = CONFIG.BASE_SPEED;
  if (e.healT > 0) speed *= 0.5;
  else if (e.sprint) speed *= CONFIG.SPRINT_MULT;
  const len = Math.hypot(dx, dy);
  e.moving = len > 0.01;
  if (e.moving) {
    e.x += dx / len * speed * dt;
    e.y += dy / len * speed * dt;
    e.walkPhase += dt * 12;
  }
  e.x = clamp(e.x, e.r, world.size - e.r);
  e.y = clamp(e.y, e.r, world.size - e.r);
  for (const o of world.obstacles) {
    if (o.kind === 'rock') resolveCircleCircle(e, o.x, o.y, o.r);
    else if (o.kind === 'tree') resolveCircleCircle(e, o.x, o.y, o.trunk);
    else if (o.kind === 'crate' || o.kind === 'house') resolveCircleRect(e, o);
  }
}

function tryFire(e, tx, ty) {
  if (!e.alive || e.reloadT > 0 || e.healT > 0) return;
  const slot = e.slots[e.active];
  if (slot && slot.kind === 'medkit') { startHeal(e); return; }
  if (!slot) { melee(e, tx, ty); return; }
  if (slot.kind !== 'weapon') return;

  const w = WEAPONS[slot.w];
  if (e.fireCd > 0) return;
  if (slot.ammoIn <= 0) {
    if (e.isPlayer && e.ammo <= 0) Sfx.empty();
    startReload(e);
    return;
  }
  slot.ammoIn--;
  e.fireCd = w.rof * (e.isPlayer ? 1 : rand(1.05, 1.5));
  const baseAng = angTo(e.x, e.y, tx, ty);
  e.dir = baseAng;
  for (let i = 0; i < w.pellets; i++) {
    const a = baseAng + rand(-w.spread, w.spread);
    const mx = e.x + Math.cos(a) * (e.r + 8);
    const my = e.y + Math.sin(a) * (e.r + 8);
    world.bullets.push({
      x: mx, y: my, px: mx, py: my,
      vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
      dmg: w.dmg, left: w.range, owner: e, weapon: slot.w,
    });
  }
  spawnParticles(e.x + Math.cos(baseAng) * (e.r + 14), e.y + Math.sin(baseAng) * (e.r + 14), 3, '#ffd54a', 70, 0.08);
  if (e.isPlayer || (player && dist(e.x, e.y, player.x, player.y) < 900)) Sfx.shot(slot.w);
  if (e.isPlayer) shake = Math.min(shake + (slot.w === 'sniper' ? 6 : 2), 10);
}

function melee(e, tx, ty) {
  if (e.meleeCd > 0) return;
  e.meleeCd = CONFIG.MELEE_CD;
  e.meleeSwing = 0.18;
  e.dir = angTo(e.x, e.y, tx, ty);
  Sfx.punch();
  for (const other of entities) {
    if (other === e || !other.alive) continue;
    if (dist(e.x, e.y, other.x, other.y) < CONFIG.MELEE_RANGE + other.r) {
      const a = angTo(e.x, e.y, other.x, other.y);
      const diff = Math.abs(((a - e.dir) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
      if (diff < 1.1) damageEntity(other, CONFIG.MELEE_DMG, e, 'кулаки');
    }
  }
}

function startReload(e) {
  const slot = e.slots[e.active];
  if (!slot || slot.kind !== 'weapon' || e.reloadT > 0) return;
  const w = WEAPONS[slot.w];
  if (slot.ammoIn >= w.mag || e.ammo <= 0) return;
  e.reloadT = w.reload;
  e.reloadTotal = w.reload;
  if (e.isPlayer) Sfx.reload();
}

function finishReload(e) {
  const slot = e.slots[e.active];
  if (!slot || slot.kind !== 'weapon') return;
  const need = WEAPONS[slot.w].mag - slot.ammoIn;
  const take = Math.min(need, e.ammo);
  slot.ammoIn += take;
  e.ammo -= take;
}

function startHeal(e) {
  if (e.healT > 0 || e.hp >= e.maxHp) return;
  const idx = e.slots.findIndex(s => s && s.kind === 'medkit' && s.count > 0);
  if (idx < 0) return;
  e.healSlot = idx;
  e.healT = CONFIG.HEAL_TIME;
  if (e.isPlayer) Sfx.heal();
}

function finishHeal(e) {
  const s = e.slots[e.healSlot];
  if (s && s.kind === 'medkit') {
    s.count--;
    if (s.count <= 0) e.slots[e.healSlot] = null;
    e.hp = Math.min(e.maxHp, e.hp + CONFIG.HEAL_AMOUNT);
  }
}

function damageEntity(e, dmg, attacker, weaponName) {
  if (!e.alive) return;
  if (e.armor > 0) {
    const absorbed = Math.min(e.armor, dmg * 0.6);
    e.armor -= absorbed;
    dmg -= absorbed;
  }
  e.hp -= dmg;
  spawnParticles(e.x, e.y, 5, '#b3202a', 120, 0.35);
  if (e.isPlayer) { hurtFlash = 0.4; Sfx.hurt(); }
  else if (attacker && attacker.isPlayer) Sfx.hit();
  if (e.hp <= 0) killEntity(e, attacker, weaponName);
}

function killEntity(e, attacker, weaponName) {
  e.alive = false;
  e.hp = 0;
  world.corpses.push({ x: e.x, y: e.y, color: e.color, t: 40 });
  spawnParticles(e.x, e.y, 14, '#b3202a', 160, 0.6);
  // выпадает всё снаряжение
  for (const s of e.slots) {
    if (!s) continue;
    const a = rand(0, Math.PI * 2), d = rand(14, 40);
    dropLoot(e.x + Math.cos(a) * d, e.y + Math.sin(a) * d, s);
  }
  if (!e.isPlayer) dropLoot(e.x + rand(-25, 25), e.y + rand(-25, 25), { kind: 'ammo', amount: randInt(20, 45) });
  e.slots = [null, null, null, null, null];
  if (attacker && attacker.alive) {
    attacker.kills++;
    if (attacker.isPlayer) Sfx.kill();
  }
  if (attacker) addKillfeed(attacker.name + ' убил ' + e.name + ' (' + (weaponName || '?') + ')');
  else addKillfeed(e.name + ' погиб в зоне');
}

function updateTimers(e, dt) {
  e.fireCd -= dt;
  e.meleeCd -= dt;
  if (e.meleeSwing > 0) e.meleeSwing -= dt;
  if (e.reloadT > 0) {
    e.reloadT -= dt;
    if (e.reloadT <= 0) finishReload(e);
  }
  if (e.healT > 0) {
    e.healT -= dt;
    if (e.healT <= 0) finishHeal(e);
  }
}

// ---- Пули ----
function updateBullets(dt) {
  for (let i = world.bullets.length - 1; i >= 0; i--) {
    const b = world.bullets[i];
    b.px = b.x; b.py = b.y;
    const stepLen = Math.hypot(b.vx, b.vy) * dt;
    const steps = Math.max(1, Math.ceil(stepLen / 10));
    let dead = false;
    for (let s = 0; s < steps && !dead; s++) {
      b.x += b.vx * dt / steps;
      b.y += b.vy * dt / steps;
      b.left -= stepLen / steps;
      if (b.x < 0 || b.y < 0 || b.x > world.size || b.y > world.size) { dead = true; break; }
      if (pointBlocked(b.x, b.y, 2)) {
        spawnParticles(b.x, b.y, 3, '#c9a44a', 90, 0.15);
        dead = true;
        break;
      }
      for (const e of entities) {
        if (!e.alive || e === b.owner) continue;
        const dx = e.x - b.x, dy = e.y - b.y;
        if (dx * dx + dy * dy < e.r * e.r) {
          damageEntity(e, b.dmg, b.owner, WEAPONS[b.weapon].name);
          dead = true;
          break;
        }
      }
      if (b.left <= 0) dead = true;
    }
    if (dead) world.bullets.splice(i, 1);
  }
}

// ---- Частицы ----
function spawnParticles(x, y, n, color, speed, life) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), v = rand(speed * 0.3, speed);
    world.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      life: rand(life * 0.5, life), maxLife: life,
      color, size: rand(2, 4),
    });
  }
}

function updateParticles(dt) {
  for (let i = world.particles.length - 1; i >= 0; i--) {
    const p = world.particles[i];
    p.life -= dt;
    if (p.life <= 0) { world.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.9;
    p.vy *= 0.9;
  }
}

// ---- Лут: подбор и выбрасывание ----
function lootLabel(item) {
  if (item.kind === 'weapon') return WEAPONS[item.w].name;
  if (item.kind === 'ammo') return 'Патроны ×' + item.amount;
  if (item.kind === 'medkit') return item.count > 1 ? 'Аптечка ×' + item.count : 'Аптечка';
  if (item.kind === 'armor') return 'Бронежилет';
  return '?';
}

function nearestLoot(e, radius) {
  let best = null, bd = radius;
  for (const l of world.loots) {
    const d = dist(e.x, e.y, l.x, l.y);
    if (d < bd) { bd = d; best = l; }
  }
  return best;
}

function removeLoot(l) {
  const i = world.loots.indexOf(l);
  if (i >= 0) world.loots.splice(i, 1);
}

// Патроны и броня подбираются автоматически при касании
function autoPickup(e) {
  for (let i = world.loots.length - 1; i >= 0; i--) {
    const l = world.loots[i];
    const k = l.item.kind;
    if (k !== 'ammo' && k !== 'armor') continue;
    if (k === 'armor' && e.armor >= 100) continue;
    if (dist(e.x, e.y, l.x, l.y) < e.r + 14) {
      if (k === 'ammo') e.ammo += l.item.amount;
      else e.armor = Math.min(100, e.armor + l.item.amount);
      world.loots.splice(i, 1);
      if (e.isPlayer) Sfx.pickup();
    }
  }
}

function tryPickup(e) {
  const l = nearestLoot(e, CONFIG.PICKUP_RADIUS);
  if (!l) return;
  const item = l.item;
  if (item.kind === 'ammo') { e.ammo += item.amount; removeLoot(l); Sfx.pickup(); return; }
  if (item.kind === 'armor') { e.armor = Math.min(100, e.armor + item.amount); removeLoot(l); Sfx.pickup(); return; }
  // аптечки складываются в стопку
  if (item.kind === 'medkit') {
    const stack = e.slots.find(s => s && s.kind === 'medkit' && s.count < 5);
    if (stack) { stack.count += item.count; removeLoot(l); Sfx.pickup(); return; }
  }
  let idx = e.slots.indexOf(null);
  if (idx < 0) {
    // все слоты заняты — меняем активный
    dropLoot(e.x + rand(-20, 20), e.y + rand(-20, 20), e.slots[e.active]);
    idx = e.active;
    e.reloadT = 0;
  }
  e.slots[idx] = item;
  removeLoot(l);
  Sfx.pickup();
}

function dropActive(e) {
  const s = e.slots[e.active];
  if (!s) return;
  dropLoot(e.x + Math.cos(e.dir) * 40, e.y + Math.sin(e.dir) * 40, s);
  e.slots[e.active] = null;
  e.reloadT = 0;
}
