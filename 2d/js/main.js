// Главный модуль: цикл, зона, ввод, камера, отрисовка, HUD
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let W = 0, H = 0;
function resize() { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

let player = null;
let zone = null;
let camX = 0, camY = 0, shake = 0, hurtFlash = 0;
let gameState = 'menu'; // menu | play | over
let matchTime = 0;
let matchEnded = false;

const input = { keys: new Set(), mx: W / 2, my: H / 2, mouseDown: false, fireLatch: false };

// Текстура травы
const groundPattern = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#4a7c3a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = Math.random() < 0.5 ? 'rgba(62,112,47,0.6)' : 'rgba(104,160,80,0.5)';
    g.beginPath();
    g.arc(Math.random() * 256, Math.random() * 256, rand(1.5, 4), 0, 7);
    g.fill();
  }
  return ctx.createPattern(c, 'repeat');
})();

// ---------- Зона ----------
function initZone() {
  zone = {
    cx: world.size / 2, cy: world.size / 2, r: world.size * 0.75,
    phase: 0, state: 'wait', t: ZONE_PHASES[0].wait,
    from: null, to: null,
  };
  planNextCircle();
}

function planNextCircle() {
  const ph = ZONE_PHASES[zone.phase];
  const nr = Math.max(30, zone.r * ph.scale);
  const maxOff = Math.max(0, zone.r - nr);
  const a = rand(0, Math.PI * 2), d = rand(0, maxOff * 0.8);
  zone.to = {
    cx: clamp(zone.cx + Math.cos(a) * d, nr * 0.3, world.size - nr * 0.3),
    cy: clamp(zone.cy + Math.sin(a) * d, nr * 0.3, world.size - nr * 0.3),
    r: nr,
  };
}

function updateZone(dt) {
  if (zone.phase < ZONE_PHASES.length) {
    const ph = ZONE_PHASES[zone.phase];
    zone.t -= dt;
    if (zone.state === 'wait') {
      if (zone.t <= 0) {
        zone.from = { cx: zone.cx, cy: zone.cy, r: zone.r };
        zone.state = 'shrink';
        zone.t = ph.shrink;
      }
    } else {
      const k = 1 - Math.max(0, zone.t) / ph.shrink;
      zone.cx = lerp(zone.from.cx, zone.to.cx, k);
      zone.cy = lerp(zone.from.cy, zone.to.cy, k);
      zone.r = lerp(zone.from.r, zone.to.r, k);
      if (zone.t <= 0) {
        zone.phase++;
        if (zone.phase < ZONE_PHASES.length) {
          zone.state = 'wait';
          zone.t = ZONE_PHASES[zone.phase].wait;
          planNextCircle();
        }
      }
    }
  }
  // урон вне зоны (броню игнорирует)
  const dps = ZONE_PHASES[Math.min(zone.phase, ZONE_PHASES.length - 1)].dps;
  for (const e of entities) {
    if (!e.alive) continue;
    if (dist(e.x, e.y, zone.cx, zone.cy) > zone.r) {
      e.zoneAcc += dps * dt;
      if (e.zoneAcc >= 1) {
        const dmg = Math.floor(e.zoneAcc);
        e.zoneAcc -= dmg;
        e.hp -= dmg;
        if (e.isPlayer) hurtFlash = Math.max(hurtFlash, 0.25);
        if (e.hp <= 0) killEntity(e, null, null);
      }
    }
  }
}

// ---------- Запуск матча ----------
let selColor = PLAYER_COLORS[0];

function startGame() {
  generateWorld();
  entities = [];
  killfeed = [];
  let px, py, tries = 0;
  do {
    px = rand(250, world.size - 250);
    py = rand(250, world.size - 250);
    tries++;
  } while (pointBlocked(px, py, 24) && tries < 80);

  const name = (document.getElementById('nameInput').value || 'Боец').trim() || 'Боец';
  player = makeEntity(px, py, name, selColor, true);
  player.slots[0] = { kind: 'weapon', w: 'pistol', ammoIn: WEAPONS.pistol.mag };
  entities.push(player);
  initZone();
  spawnBots();
  matchTime = 0;
  matchEnded = false;
  shake = 0; hurtFlash = 0;
  camX = player.x - W / 2;
  camY = player.y - H / 2;
  gameState = 'play';
  document.getElementById('menu').classList.add('hidden');
  document.getElementById('endScreen').classList.add('hidden');
}

function showEnd(won, place) {
  document.getElementById('endTitle').textContent = won ? '\u{1F3C6} ПОБЕДА!' : 'ВЫ ВЫБЫЛИ';
  document.getElementById('endStats').textContent =
    'Место: #' + place + ' из ' + (CONFIG.BOT_COUNT + 1) + ' · Убийств: ' + player.kills;
  document.getElementById('endScreen').classList.remove('hidden');
  gameState = 'over';
}

// ---------- Ввод ----------
window.addEventListener('keydown', e => {
  input.keys.add(e.code);
  if (gameState !== 'play' || !player || !player.alive) return;
  if (e.code.startsWith('Digit')) {
    const n = +e.code.slice(5);
    if (n >= 1 && n <= 5) switchSlot(n - 1);
  }
  if (e.code === 'KeyR') startReload(player);
  if (e.code === 'KeyE') tryPickup(player);
  if (e.code === 'KeyG') dropActive(player);
  if (e.code === 'KeyF') startHeal(player);
});
window.addEventListener('keyup', e => input.keys.delete(e.code));
window.addEventListener('blur', () => { input.keys.clear(); input.mouseDown = false; });
canvas.addEventListener('mousemove', e => { input.mx = e.clientX; input.my = e.clientY; });
canvas.addEventListener('mousedown', e => {
  if (e.button === 0) { input.mouseDown = true; input.fireLatch = true; Sfx.unlock(); }
});
window.addEventListener('mouseup', e => { if (e.button === 0) input.mouseDown = false; });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  if (gameState !== 'play' || !player || !player.alive) return;
  const d = e.deltaY > 0 ? 1 : -1;
  switchSlot((player.active + d + 5) % 5);
}, { passive: false });
canvas.addEventListener('contextmenu', e => e.preventDefault());

function switchSlot(i) {
  if (player.active === i) return;
  player.active = i;
  player.reloadT = 0;
}

function screenToWorld(sx, sy) { return { x: sx + camX, y: sy + camY }; }

// ---------- Обновление ----------
function update(dt) {
  matchTime += dt;
  updateZone(dt);

  if (player.alive) {
    let dx = 0, dy = 0;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) dy--;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) dy++;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) dx--;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) dx++;
    player.sprint = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight');
    moveEntity(player, dx, dy, dt);

    const aim = screenToWorld(input.mx, input.my);
    player.dir = angTo(player.x, player.y, aim.x, aim.y);
    const w = activeWeapon(player);
    if (input.mouseDown && (input.fireLatch || (w && w.auto))) {
      tryFire(player, aim.x, aim.y);
      input.fireLatch = false;
    }
    autoPickup(player);
  }

  for (const e of entities) {
    if (!e.alive) continue;
    updateTimers(e, dt);
    if (!e.isPlayer) updateBot(e, dt);
  }

  // мягкое расталкивание персонажей
  for (let i = 0; i < entities.length; i++) {
    const a = entities[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < entities.length; j++) {
      const b = entities[j];
      if (!b.alive) continue;
      const d = dist(a.x, a.y, b.x, b.y), min = a.r + b.r;
      if (d < min && d > 0) {
        const push = (min - d) / 2, ang = angTo(b.x, b.y, a.x, a.y);
        a.x += Math.cos(ang) * push; a.y += Math.sin(ang) * push;
        b.x -= Math.cos(ang) * push; b.y -= Math.sin(ang) * push;
      }
    }
  }

  updateBullets(dt);
  updateParticles(dt);

  for (let i = killfeed.length - 1; i >= 0; i--) {
    killfeed[i].t -= dt;
    if (killfeed[i].t <= 0) killfeed.splice(i, 1);
  }
  for (let i = world.corpses.length - 1; i >= 0; i--) {
    world.corpses[i].t -= dt;
    if (world.corpses[i].t <= 0) world.corpses.splice(i, 1);
  }
  shake = Math.max(0, shake - dt * 30);
  hurtFlash = Math.max(0, hurtFlash - dt);

  if (!matchEnded) {
    const alive = entities.filter(e => e.alive).length;
    if (!player.alive) { matchEnded = true; showEnd(false, alive + 1); }
    else if (alive === 1) { matchEnded = true; showEnd(true, 1); }
  }
}

function updateCamera() {
  const tx = player.x - W / 2 + (input.mx - W / 2) * 0.12;
  const ty = player.y - H / 2 + (input.my - H / 2) * 0.12;
  camX = lerp(camX, tx, 0.12);
  camY = lerp(camY, ty, 0.12);
}

function onScreen(x, y, pad) {
  return x > camX - pad && x < camX + W + pad && y > camY - pad && y < camY + H + pad;
}

// ---------- Отрисовка мира ----------
function render() {
  ctx.fillStyle = '#324f28';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  const ox = shake > 0.2 ? rand(-shake, shake) : 0;
  const oy = shake > 0.2 ? rand(-shake, shake) : 0;
  ctx.translate(-camX + ox, -camY + oy);

  ctx.fillStyle = groundPattern;
  ctx.fillRect(0, 0, world.size, world.size);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, world.size, world.size);

  drawCorpses();
  drawLoot();
  drawObstaclesLow();
  drawEntities();
  drawBullets();
  drawObstaclesHigh();
  drawParticles();
  drawZoneWorld();

  ctx.restore();
  drawHUD();
}

function drawCorpses() {
  for (const c of world.corpses) {
    if (!onScreen(c.x, c.y, 40)) continue;
    ctx.globalAlpha = Math.min(1, c.t / 10);
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(c.x - 10, c.y - 10); ctx.lineTo(c.x + 10, c.y + 10);
    ctx.moveTo(c.x + 10, c.y - 10); ctx.lineTo(c.x - 10, c.y + 10);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawLoot() {
  const t = performance.now() / 1000;
  let near = null;
  if (player && player.alive) near = nearestLoot(player, CONFIG.PICKUP_RADIUS);

  for (const l of world.loots) {
    if (!onScreen(l.x, l.y, 40)) continue;
    const y = l.y + Math.sin(t * 2 + l.bob) * 2;
    const it = l.item;
    // свечение
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.arc(l.x, y, 16, 0, 7);
    ctx.fill();

    if (it.kind === 'weapon') {
      const w = WEAPONS[it.w];
      ctx.strokeStyle = w.tier;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(l.x, y, 15, 0, 7); ctx.stroke();
      ctx.save();
      ctx.translate(l.x, y);
      ctx.rotate(-0.55);
      ctx.fillStyle = w.color;
      ctx.fillRect(-w.len * 0.3, -2.5, w.len * 0.6, 5);
      ctx.fillStyle = '#222';
      ctx.fillRect(w.len * 0.3 - 4, -1.5, 4, 3);
      ctx.fillRect(-w.len * 0.15, 2, 4, 5);
      ctx.restore();
    } else if (it.kind === 'ammo') {
      ctx.fillStyle = '#d9b23a';
      ctx.fillRect(l.x - 7, y - 5, 14, 10);
      ctx.fillStyle = '#8f6f14';
      ctx.fillRect(l.x - 7, y - 1, 14, 2);
    } else if (it.kind === 'medkit') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(l.x - 8, y - 6, 16, 12);
      ctx.fillStyle = '#d33';
      ctx.fillRect(l.x - 2, y - 4, 4, 8);
      ctx.fillRect(l.x - 5, y - 1, 10, 2);
    } else if (it.kind === 'armor') {
      ctx.fillStyle = '#4a7fd6';
      ctx.beginPath();
      ctx.moveTo(l.x - 8, y - 6);
      ctx.lineTo(l.x + 8, y - 6);
      ctx.lineTo(l.x + 6, y + 7);
      ctx.lineTo(l.x, y + 9);
      ctx.lineTo(l.x - 6, y + 7);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#6f9de6';
      ctx.fillRect(l.x - 4, y - 3, 8, 6);
    }

    // подсказка возле ближайшего предмета
    if (l === near) {
      const needE = it.kind === 'weapon' || it.kind === 'medkit';
      const label = (needE ? '[E] ' : '') + lootLabel(it);
      ctx.font = 'bold 13px Segoe UI, Arial';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(l.x - tw / 2 - 6, y - 38, tw + 12, 20);
      ctx.fillStyle = '#ffd766';
      ctx.textAlign = 'center';
      ctx.fillText(label, l.x, y - 24);
      ctx.textAlign = 'left';
    }
  }
}

function drawObstaclesLow() {
  for (const o of world.obstacles) {
    if (o.kind === 'rock') {
      if (!onScreen(o.x, o.y, o.r + 20)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(o.x, o.y + o.r * 0.35, o.r, o.r * 0.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#7f858c';
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#989ea6';
      ctx.beginPath(); ctx.arc(o.x - o.r * 0.25, o.y - o.r * 0.3, o.r * 0.6, 0, 7); ctx.fill();
    } else if (o.kind === 'crate') {
      if (!onScreen(o.x, o.y, 100)) continue;
      ctx.fillStyle = '#5d3e20';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.fillStyle = '#8a5c2e';
      ctx.fillRect(o.x, o.y - 6, o.w, o.h);
      ctx.strokeStyle = '#4d3319';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x, o.y - 6, o.w, o.h);
      ctx.beginPath();
      ctx.moveTo(o.x, o.y - 6); ctx.lineTo(o.x + o.w, o.y - 6 + o.h);
      ctx.moveTo(o.x + o.w, o.y - 6); ctx.lineTo(o.x, o.y - 6 + o.h);
      ctx.stroke();
    } else if (o.kind === 'house') {
      if (!onScreen(o.x + o.w / 2, o.y + o.h / 2, Math.max(o.w, o.h) + 60)) continue;
      // стены (виден низ — эффект высоты)
      ctx.fillStyle = '#57493c';
      ctx.fillRect(o.x - 2, o.y, o.w + 4, o.h + 6);
      // крыша, приподнятая вверх
      ctx.fillStyle = o.roof;
      ctx.fillRect(o.x - 5, o.y - 14, o.w + 10, o.h + 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(o.x - 5, o.y - 14, o.w + 10, o.h + 10);
      ctx.beginPath();
      ctx.moveTo(o.x - 5, o.y - 14 + (o.h + 10) / 2);
      ctx.lineTo(o.x + 5 + o.w, o.y - 14 + (o.h + 10) / 2);
      ctx.stroke();
    } else if (o.kind === 'tree') {
      if (!onScreen(o.x, o.y, 30)) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(o.x, o.y + 6, o.trunk + 6, (o.trunk + 6) * 0.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6e4b28';
      ctx.beginPath(); ctx.arc(o.x, o.y, o.trunk, 0, 7); ctx.fill();
    }
  }
}

function drawObstaclesHigh() {
  for (const o of world.obstacles) {
    if (o.kind === 'tree') {
      if (!onScreen(o.x, o.y, o.canopy + 30)) continue;
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = '#2e5d27';
      ctx.beginPath(); ctx.arc(o.x, o.y - 16, o.canopy, 0, 7); ctx.fill();
      ctx.fillStyle = '#3f7c33';
      ctx.beginPath(); ctx.arc(o.x - o.canopy * 0.15, o.y - 20, o.canopy * 0.72, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    } else if (o.kind === 'bush') {
      if (!onScreen(o.x, o.y, o.r + 20)) continue;
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#35682c';
      ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#457f38';
      ctx.beginPath(); ctx.arc(o.x - o.r * 0.3, o.y - o.r * 0.2, o.r * 0.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x + o.r * 0.3, o.y + o.r * 0.15, o.r * 0.45, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}

function drawEntities() {
  const sorted = entities.filter(e => e.alive).sort((a, b) => a.y - b.y);
  for (const e of sorted) {
    if (!onScreen(e.x, e.y, 60)) continue;
    drawCharacter(e);
  }
}

function drawCharacter(e) {
  const bob = e.moving ? Math.sin(e.walkPhase) * 2 : 0;
  // тень
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + 10, 14, 6, 0, 0, 7);
  ctx.fill();

  // руки + оружие (под головой)
  ctx.save();
  ctx.translate(e.x, e.y - 3);
  ctx.rotate(e.dir);
  const punch = e.meleeSwing > 0 ? 8 : 0;
  const w = activeWeapon(e);
  if (w) {
    ctx.fillStyle = w.color;
    ctx.fillRect(10, -3, w.len, 6);
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(10 + w.len - 6, -2, 6, 4);
  }
  ctx.fillStyle = '#e0b089';
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(13 + punch, -7, 5, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(13 + punch, 7, 5, 0, 7); ctx.fill(); ctx.stroke();
  ctx.restore();

  // тело
  ctx.fillStyle = e.color;
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(e.x, e.y - 3 + bob * 0.3, 13, 0, 7);
  ctx.fill();
  ctx.stroke();
  // броня — обводка
  if (e.armor > 0) {
    ctx.strokeStyle = 'rgba(90,150,255,0.85)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y - 3 + bob * 0.3, 15.5, 0, 7);
    ctx.stroke();
  }
  // голова, чуть приподнята — вид «сверху-сбоку»
  ctx.fillStyle = '#e8b98c';
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(e.x, e.y - 12 + bob * 0.5, 8.5, 0, 7);
  ctx.fill();
  ctx.stroke();

  // имя и полоска HP
  ctx.font = 'bold 12px Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillText(e.name, e.x + 1, e.y - 30);
  ctx.fillStyle = e.isPlayer ? '#ffe37a' : '#e8e8e8';
  ctx.fillText(e.name, e.x, e.y - 31);
  ctx.textAlign = 'left';
  if (!e.isPlayer) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(e.x - 16, e.y - 27, 32, 4);
    ctx.fillStyle = e.hp > 50 ? '#5fd35f' : e.hp > 25 ? '#e8c04a' : '#e05545';
    ctx.fillRect(e.x - 16, e.y - 27, 32 * (e.hp / e.maxHp), 4);
  }
  // прогресс перезарядки / лечения
  let prog = 0, col = '';
  if (e.reloadT > 0) { prog = 1 - e.reloadT / e.reloadTotal; col = '#e8c04a'; }
  else if (e.healT > 0) { prog = 1 - e.healT / CONFIG.HEAL_TIME; col = '#5fd35f'; }
  if (prog > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(e.x - 20, e.y + 20, 40, 5);
    ctx.fillStyle = col;
    ctx.fillRect(e.x - 20, e.y + 20, 40 * prog, 5);
  }
}

function drawBullets() {
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const b of world.bullets) {
    if (!onScreen(b.x, b.y, 60)) continue;
    ctx.strokeStyle = 'rgba(255,230,150,0.9)';
    ctx.beginPath();
    ctx.moveTo(b.px, b.py);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
}

function drawParticles() {
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

function drawZoneWorld() {
  // затемнение вне зоны
  ctx.beginPath();
  ctx.rect(camX - 50, camY - 50, W + 100, H + 100);
  ctx.arc(zone.cx, zone.cy, zone.r, 0, Math.PI * 2, true);
  ctx.fillStyle = 'rgba(45, 90, 220, 0.22)';
  ctx.fill();
  // граница зоны
  ctx.strokeStyle = 'rgba(80, 140, 255, 0.85)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(zone.cx, zone.cy, zone.r, 0, 7);
  ctx.stroke();
  // следующий круг
  if (zone.phase < ZONE_PHASES.length && zone.to) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.arc(zone.to.cx, zone.to.cy, zone.to.r, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ---------- HUD ----------
function drawHUD() {
  const alive = entities.filter(e => e.alive).length;

  // верхняя панель: живые + таймер зоны
  ctx.font = 'bold 17px Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(W / 2 - 130, 10, 260, 52);
  ctx.fillStyle = '#fff';
  ctx.fillText('Живых: ' + alive, W / 2, 32);
  ctx.font = '14px Segoe UI, Arial';
  if (zone.phase >= ZONE_PHASES.length) {
    ctx.fillStyle = '#ff7b6b';
    ctx.fillText('Финальная зона!', W / 2, 52);
  } else if (zone.state === 'wait') {
    ctx.fillStyle = '#cfe0ff';
    ctx.fillText('Зона сузится через ' + Math.ceil(zone.t) + ' с', W / 2, 52);
  } else {
    ctx.fillStyle = '#ff7b6b';
    ctx.fillText('ЗОНА СУЖАЕТСЯ! ' + Math.ceil(zone.t) + ' с', W / 2, 52);
  }

  // предупреждение, если вне зоны + стрелка к зоне
  if (player.alive && dist(player.x, player.y, zone.cx, zone.cy) > zone.r) {
    const pulse = 0.6 + Math.sin(performance.now() / 150) * 0.4;
    ctx.fillStyle = 'rgba(255,60,40,' + (0.5 * pulse + 0.3) + ')';
    ctx.font = 'bold 20px Segoe UI, Arial';
    ctx.fillText('ВЫ ВНЕ ЗОНЫ!', W / 2, 92);
    const a = angTo(player.x, player.y, zone.cx, zone.cy);
    const px = player.x - camX, py = player.y - camY;
    ctx.save();
    ctx.translate(px + Math.cos(a) * 55, py + Math.sin(a) * 55);
    ctx.rotate(a);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(12, 0); ctx.lineTo(-6, -8); ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.textAlign = 'left';

  // килфид
  ctx.font = '13px Segoe UI, Arial';
  for (let i = 0; i < killfeed.length; i++) {
    const k = killfeed[i];
    ctx.globalAlpha = Math.min(1, k.t);
    const tw = ctx.measureText(k.text).width;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(12, 12 + i * 24, tw + 14, 20);
    ctx.fillStyle = '#ffd4d4';
    ctx.fillText(k.text, 19, 27 + i * 24);
  }
  ctx.globalAlpha = 1;

  drawInventoryHUD();
  drawMinimap();

  // красная вспышка при уроне
  if (hurtFlash > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
    g.addColorStop(0, 'rgba(200,0,0,0)');
    g.addColorStop(1, 'rgba(200,0,0,' + (hurtFlash * 0.8) + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawInventoryHUD() {
  const slotW = 62, gap = 8;
  const total = 5 * slotW + 4 * gap;
  const x0 = W / 2 - total / 2, y0 = H - 86;

  // HP и броня
  const barW = total;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(x0, y0 - 34, barW, 14);
  ctx.fillStyle = player.hp > 50 ? '#5fd35f' : player.hp > 25 ? '#e8c04a' : '#e05545';
  ctx.fillRect(x0 + 2, y0 - 32, (barW - 4) * clamp(player.hp / player.maxHp, 0, 1), 10);
  ctx.font = 'bold 11px Segoe UI, Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.fillText(Math.ceil(player.hp) + ' HP', x0 + barW / 2, y0 - 23);
  if (player.armor > 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x0, y0 - 46, barW, 9);
    ctx.fillStyle = '#5a96ff';
    ctx.fillRect(x0 + 2, y0 - 44, (barW - 4) * (player.armor / 100), 5);
  }

  // слоты
  for (let i = 0; i < 5; i++) {
    const x = x0 + i * (slotW + gap);
    const activeSlot = i === player.active;
    ctx.fillStyle = activeSlot ? 'rgba(40,55,35,0.85)' : 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y0, slotW, 58);
    ctx.strokeStyle = activeSlot ? '#ffd766' : 'rgba(255,255,255,0.25)';
    ctx.lineWidth = activeSlot ? 2.5 : 1.5;
    ctx.strokeRect(x, y0, slotW, 58);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Segoe UI, Arial';
    ctx.textAlign = 'left';
    ctx.fillText(i + 1, x + 4, y0 + 12);

    const s = player.slots[i];
    if (!s) continue;
    const cx = x + slotW / 2, cy = y0 + 28;
    if (s.kind === 'weapon') {
      const w = WEAPONS[s.w];
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.4);
      ctx.fillStyle = w.color;
      ctx.fillRect(-w.len * 0.35, -3, w.len * 0.7, 6);
      ctx.fillStyle = '#1e1e1e';
      ctx.fillRect(w.len * 0.35 - 5, -2, 5, 4);
      ctx.fillRect(-w.len * 0.1, 3, 5, 6);
      ctx.restore();
      ctx.font = 'bold 11px Segoe UI, Arial';
      ctx.textAlign = 'right';
      ctx.fillStyle = s.ammoIn > 0 ? '#fff' : '#e05545';
      ctx.fillText(s.ammoIn, x + slotW - 5, y0 + 52);
    } else if (s.kind === 'medkit') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(cx - 10, cy - 8, 20, 16);
      ctx.fillStyle = '#d33';
      ctx.fillRect(cx - 3, cy - 5, 6, 10);
      ctx.fillRect(cx - 7, cy - 2, 14, 4);
      ctx.font = 'bold 11px Segoe UI, Arial';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.fillText('×' + s.count, x + slotW - 5, y0 + 52);
    }
  }
  ctx.textAlign = 'left';

  // инфо об активном оружии и запас патронов
  const act = player.slots[player.active];
  ctx.font = 'bold 15px Segoe UI, Arial';
  ctx.fillStyle = '#fff';
  const infoX = x0 + total + 16;
  if (act && act.kind === 'weapon') {
    ctx.fillText(WEAPONS[act.w].name, infoX, y0 + 22);
    ctx.font = '14px Segoe UI, Arial';
    ctx.fillStyle = '#d9c98a';
    ctx.fillText(act.ammoIn + ' / ' + player.ammo + ' патр.', infoX, y0 + 42);
    if (player.reloadT > 0) {
      ctx.fillStyle = '#e8c04a';
      ctx.fillText('Перезарядка...', infoX, y0 + 60);
    }
  } else if (act && act.kind === 'medkit') {
    ctx.fillText('Аптечка (ЛКМ / F)', infoX, y0 + 22);
  } else {
    ctx.fillText('Кулаки', infoX, y0 + 22);
  }
}

function drawMinimap() {
  const ms = 170, mx = W - ms - 14, my = 14, k = ms / world.size;
  ctx.fillStyle = 'rgba(20,30,16,0.75)';
  ctx.fillRect(mx, my, ms, ms);
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx, my, ms, ms);
  ctx.save();
  ctx.beginPath();
  ctx.rect(mx, my, ms, ms);
  ctx.clip();
  // постройки
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  for (const o of world.obstacles) {
    if (o.kind === 'house') ctx.fillRect(mx + o.x * k, my + o.y * k, o.w * k, o.h * k);
  }
  // текущая зона
  ctx.strokeStyle = 'rgba(90,150,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mx + zone.cx * k, my + zone.cy * k, zone.r * k, 0, 7);
  ctx.stroke();
  // следующая
  if (zone.to && zone.phase < ZONE_PHASES.length) {
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(mx + zone.to.cx * k, my + zone.to.cy * k, zone.to.r * k, 0, 7);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // игрок
  if (player.alive) {
    ctx.save();
    ctx.translate(mx + player.x * k, my + player.y * k);
    ctx.rotate(player.dir);
    ctx.fillStyle = '#ffd766';
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// ---------- Меню ----------
(function initMenu() {
  const colorsDiv = document.getElementById('colors');
  PLAYER_COLORS.forEach((c, i) => {
    const d = document.createElement('div');
    d.className = 'swatch' + (i === 0 ? ' sel' : '');
    d.style.background = c;
    d.onclick = () => {
      selColor = c;
      colorsDiv.querySelectorAll('.swatch').forEach(s => s.classList.remove('sel'));
      d.classList.add('sel');
    };
    colorsDiv.appendChild(d);
  });
  document.getElementById('playBtn').onclick = () => { Sfx.unlock(); startGame(); };
  document.getElementById('restartBtn').onclick = () => { Sfx.unlock(); startGame(); };
})();

// ---------- Цикл ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  if (gameState === 'play' || gameState === 'over') {
    update(dt);
    if (player.alive) updateCamera();
    render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
