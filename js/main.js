// Батл-рояль: камера через плечо, хотбар с иконками, броня, шторм, боты-люди, круг эмоций
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildWorld, updateWorld, groundHeight, heightAt, WALK_R } from './world.js';
import { Character, CHARACTERS, EMOTES } from './character.js';
import { WEAPONS, buildGunMesh } from './weapons.js';
import { LootManager, CONSUMABLES, buildItemMesh } from './loot.js';
import { Zone } from './zone.js';
import { Bot, loadBotTemplate } from './bots.js';
import { Sfx } from './audio.js';
import { renderIcon } from './icons.js';

const BOT_COUNT = 7;
const DEFAULT_CHARACTER = 'fiftyCent';

// ---------- Рендерер и сцена ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.86;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(67, window.innerWidth / window.innerHeight, 0.1, 500);

// IBL-окружение: мягкие отражения на металле и коже (большой вклад в «дорогую» картинку)
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

// Мягкий bloom только для настоящих ярких источников. Белый снег не должен светиться.
const composerTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
  samples: 4, type: THREE.HalfFloatType,
});
const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(new RenderPass(scene, camera));
// GTAO: мягкое контактное затенение в углах и стыках — глубина «как в больших движках»
const ssaoPass = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
ssaoPass.updateGtaoMaterial({ radius: 0.35, distanceExponent: 1.6, thickness: 0.6, scale: 1.2 });
composer.addPass(ssaoPass);
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight), 0.14, 0.42, 0.97);
composer.addPass(bloomPass);
// SSAO рендерит без MSAA — сглаживаем FXAA-проходом
const fxaaPass = new ShaderPass(FXAAShader);
fxaaPass.material.uniforms.resolution.value.set(
  1 / (window.innerWidth * renderer.getPixelRatio()),
  1 / (window.innerHeight * renderer.getPixelRatio()));
composer.addPass(fxaaPass);
composer.addPass(new OutputPass());

window.addEventListener('resize', () => {
  fxaaPass.material.uniforms.resolution.value.set(
    1 / (window.innerWidth * renderer.getPixelRatio()),
    1 / (window.innerHeight * renderer.getPixelRatio()));
  ssaoPass.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Загрузка ----------
const manager = new THREE.LoadingManager();
manager.onProgress = (url, loaded, total) => {
  const p = Math.round(loaded / total * 100);
  document.getElementById('loadBar').style.width = p + '%';
  document.getElementById('loadText').textContent = p + '%';
};

const env = buildWorld(scene, manager);
const player = new Character(scene, manager);
const loot = new LootManager(scene);
const zone = new Zone(scene);
let bots = [];

// ---------- Состояние ----------
const state = {
  pos: new THREE.Vector3(0, 0, 6),
  vy: 0,
  onGround: true,
  fireCd: 0,
  hp: 100,
  armor: 0,
  alive: true,
  kills: 0,
  matchOver: false,
  slots: [null, null, null, null, null], // {kind:'weapon'|'use', key} | null
  slotIdx: 0,
  lastFireT: -10,
  time: 0,
  slideT: 0,      // остаток подката
  slideDir: new THREE.Vector3(),
  sprintToggled: false,
  stamina: 100,
  staminaRecoverDelay: 0,
  lootDropped: false,
  reloadT: 0,
  reloadDuration: 0,
  reloadSlotIdx: -1,
  bloom: 0,
  isMoving: false,
  isRunning: false,
};
const debugParams = new URLSearchParams(window.location.search);
const debugWeaponKey = debugParams.get('weapon');
const debugMoveMode = debugParams.get('move');
const initialCharacter = CHARACTERS[debugParams.get('character')]
  ? debugParams.get('character')
  : DEFAULT_CHARACTER;

// ---------- Ввод ----------
const input = {
  keys: new Set(), locked: false, shoot: false,
  aim: debugParams.get('aim') === '1',
  crouch: debugParams.get('pose') === 'crouch',
};
if (debugParams.get('move') === 'walk' || debugParams.get('move') === 'run') input.keys.add('KeyW');
if (debugParams.get('move') === 'run') state.sprintToggled = true;
let camYaw = 0, camPitch = 0.22;
let camDist = 3.8, camDistTarget = 3.8, fovTarget = 67;

window.addEventListener('keydown', e => {
  if (e.code === 'ControlLeft' || e.code === 'ControlRight') e.preventDefault();
  input.keys.add(e.code);
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && state.alive) {
    state.sprintToggled = !state.sprintToggled;
  }
  if (e.code === 'KeyB') toggleEmoteWheel();
  if (e.code === 'KeyE') tryPickup();
  if (e.code === 'KeyR') startReload();
  const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8'].indexOf(e.code);
  if (digit >= 0) {
    if (!emoteWheelHidden()) pickEmoteByIndex(digit);
    else if (digit < 5) selectSlot(digit);
  }
  if ((e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'KeyC') && !e.repeat) startCrouch();
});
window.addEventListener('keyup', e => {
  input.keys.delete(e.code);
  if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'KeyC') input.crouch = false;
});
window.addEventListener('blur', () => { input.keys.clear(); state.sprintToggled = false; });

renderer.domElement.addEventListener('click', () => {
  if (!input.locked && state.alive) renderer.domElement.requestPointerLock();
  Sfx.unlock();
});
document.addEventListener('pointerlockchange', () => {
  input.locked = document.pointerLockElement === renderer.domElement;
  document.getElementById('clickHint').classList.toggle('hidden',
    input.locked || state.matchOver || !emoteWheelHidden());
});
document.addEventListener('mousemove', e => {
  if (!input.locked) return;
  camYaw -= e.movementX * 0.0026;
  camPitch = Math.min(1.15, Math.max(-0.35, camPitch + e.movementY * 0.0026));
});
window.addEventListener('mousedown', e => {
  if (!input.locked) return;
  if (e.button === 0) {
    const slot = state.slots[state.slotIdx];
    if (slot && slot.kind === 'use') useConsumable();
    else input.shoot = true;
  }
  if (e.button === 2) input.aim = true;
});
window.addEventListener('mouseup', e => {
  if (e.button === 0) input.shoot = false;
  if (e.button === 2) input.aim = false;
});
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('wheel', e => {
  const d = Math.sign(e.deltaY);
  selectSlot((state.slotIdx + d + 5) % 5);
});

// ---------- Присед / подкат ----------
function startCrouch() {
  if (!state.alive) return;
  input.crouch = true;
  const running = state.sprintToggled && state.stamina > 0;
  const moving = input.keys.has('KeyW') || input.keys.has('KeyA') || input.keys.has('KeyS') || input.keys.has('KeyD');
  if (running && moving && state.onGround && state.slideT <= 0) {
    state.slideT = 0.6;
    state.slideDir.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  }
}

// ---------- Иконки предметов (кэш) ----------
const iconCache = {};
function getItemIcon(slot) {
  const cacheKey = slot.kind + ':' + slot.key;
  if (iconCache[cacheKey]) return iconCache[cacheKey];
  let mesh, opts;
  if (slot.kind === 'weapon') {
    mesh = buildGunMesh(slot.key);
    opts = { yaw: Math.PI / 2 + 0.35, pitch: 0.3, fill: 0.95 };
  } else {
    mesh = buildItemMesh(slot.key);
    opts = { yaw: Math.PI / 5, pitch: 0.3, fill: 0.9 };
  }
  const url = renderIcon(mesh, opts);
  iconCache[cacheKey] = url;
  return url;
}

// ---------- Хотбар ----------
const hotbarEl = document.getElementById('hotbar');
const slotEls = [];
for (let i = 0; i < 5; i++) {
  const el = document.createElement('div');
  el.className = 'slot';
  el.innerHTML = `<span class="num">${i + 1}</span><span class="dot">·</span>`;
  el.addEventListener('click', () => selectSlot(i));
  hotbarEl.appendChild(el);
  slotEls.push(el);
}

function refreshHotbar() {
  for (let i = 0; i < 5; i++) {
    const slot = state.slots[i];
    const el = slotEls[i];
    el.classList.toggle('active', i === state.slotIdx);
    el.innerHTML = `<span class="num">${i + 1}</span>`;
    if (slot) {
      const img = document.createElement('img');
      img.src = getItemIcon(slot);
      el.appendChild(img);
      const name = document.createElement('span');
      name.className = 'wname';
      name.textContent = slot.kind === 'weapon' ? WEAPONS[slot.key].name : CONSUMABLES[slot.key].name;
      el.appendChild(name);
    } else {
      el.insertAdjacentHTML('beforeend', '<span class="dot">·</span>');
    }
  }
}

function selectSlot(i) {
  if (i !== state.slotIdx) cancelReload();
  state.slotIdx = i;
  const slot = state.slots[i];
  player.setWeapon(slot && slot.kind === 'weapon' ? slot.key : null);
  refreshHotbar();
}

// ---------- Расходники ----------
function useConsumable() {
  const slot = state.slots[state.slotIdx];
  if (!slot || slot.kind !== 'use') return;
  const eff = CONSUMABLES[slot.key].effect;
  if (eff.hp) {
    if (state.hp >= 100) return; // не тратить зря
    state.hp = Math.min(100, state.hp + eff.hp);
  }
  if (eff.armor) {
    if (state.armor >= 100) return;
    state.armor = Math.min(100, state.armor + eff.armor);
  }
  state.slots[state.slotIdx] = null;
  Sfx.pickup();
  refreshHotbar();
}

// ---------- Лут ----------
const pickupHintEl = document.getElementById('pickupHint');
let nearItem = null;

function tryPickup() {
  if (!nearItem || !state.alive) return;
  Sfx.pickup();
  const newSlot = { kind: nearItem.kind, key: nearItem.key };
  if (nearItem.kind === 'weapon') {
    const w = WEAPONS[nearItem.key];
    newSlot.ammo = w.mag;
    newSlot.reserve = w.reserve;
  }
  let idx = state.slots[state.slotIdx] ? state.slots.indexOf(null) : state.slotIdx;
  if (idx === -1) {
    // все слоты заняты — меняем текущий, старое выпадает рядом
    const old = state.slots[state.slotIdx];
    if (old.kind === 'weapon') loot.spawnWeapon(old.key, state.pos.x + 1, state.pos.z + 1);
    else loot.spawnConsumable(old.key, state.pos.x + 1, state.pos.z + 1);
    idx = state.slotIdx;
  }
  state.slots[idx] = newSlot;
  loot.take(nearItem);
  selectSlot(state.slotIdx);
}

// ---------- Круг эмоций ----------
const emoteWheel = document.getElementById('emoteWheel');
let wheelBuiltFor = '';

function emoteWheelHidden() { return emoteWheel.classList.contains('hidden'); }

function buildEmoteWheel() {
  if (wheelBuiltFor === player.key) return;
  wheelBuiltFor = player.key;
  emoteWheel.querySelectorAll('.emote-seg').forEach(el => el.remove());
  const labels = player.emoteList;
  const R = 185;
  labels.forEach((label, i) => {
    const a = -Math.PI / 2 + (i / labels.length) * Math.PI * 2;
    const seg = document.createElement('div');
    seg.className = 'emote-seg';
    seg.style.left = Math.cos(a) * R + 'px';
    seg.style.top = Math.sin(a) * R + 'px';
    const icon = player.getEmoteIcon(label);
    seg.innerHTML = `<span class="enum">${i + 1}</span>` +
      (icon ? `<img src="${icon}">` : '') +
      `<span class="ename">${label}</span>`;
    seg.addEventListener('click', () => { playEmote(label); });
    emoteWheel.appendChild(seg);
  });
}

function playEmote(label) {
  player.emote(label);
  Sfx.dance();
  emoteWheel.classList.add('hidden');
  if (state.alive) renderer.domElement.requestPointerLock();
}

function pickEmoteByIndex(i) {
  const labels = player.emoteList;
  if (i < labels.length) playEmote(labels[i]);
}

function toggleEmoteWheel() {
  if (state.matchOver) return;
  if (emoteWheelHidden()) {
    buildEmoteWheel();
    emoteWheel.classList.remove('hidden');
    document.exitPointerLock();
  } else {
    emoteWheel.classList.add('hidden');
    if (state.alive) renderer.domElement.requestPointerLock();
  }
}
document.getElementById('emoteBtn').addEventListener('click', () => { Sfx.unlock(); toggleEmoteWheel(); });

// ---------- Выбор персонажа ----------
const select = document.getElementById('charSelect');
for (const [key, cfg] of Object.entries(CHARACTERS)) {
  const opt = document.createElement('option');
  opt.value = key;
  opt.textContent = cfg.name;
  select.appendChild(opt);
}
select.value = initialCharacter;
select.addEventListener('change', async () => {
  select.disabled = true;
  try { await player.load(select.value); }
  catch (err) { console.error('Не удалось загрузить персонажа:', err); }
  select.disabled = false;
  wheelBuiltFor = ''; // пересобрать круг эмоций под нового персонажа
});

// ---------- Трассеры и частицы ----------
const tracers = [];
const particles = [];
const particleGeo = new THREE.SphereGeometry(0.05, 6, 5);

function addTracer(from, to, color) {
  const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, transparent: true }));
  scene.add(line);
  tracers.push({ line, life: 0.09 });
}

function spawnParticles(point, color, n) {
  for (let i = 0; i < n; i++) {
    const mesh = new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color, transparent: true }));
    mesh.position.copy(point);
    scene.add(mesh);
    particles.push({
      mesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4, (Math.random() - 0.5) * 4),
      life: 0.5,
    });
  }
}

// ---------- Урон и убийства ----------
const vignette = document.getElementById('hitVignette');
let vignetteT = 0;

// Пули: сначала броня, остаток — в хп. Шторм бьёт мимо брони.
function damagePlayer(d, from) {
  if (!state.alive || state.matchOver) return;
  const absorbed = Math.min(state.armor, d);
  state.armor -= absorbed;
  state.hp -= (d - absorbed);
  vignetteT = 0.35;
  Sfx.hurt();
  if (state.hp <= 0) {
    state.hp = 0;
    state.alive = false;
    endMatch(false, from);
  }
}

let killMsgT = 0;
function showKillMsg(text) {
  const el = document.getElementById('killMsg');
  el.textContent = text;
  el.classList.remove('hidden');
  killMsgT = 2.5;
}

function onBotKilled(bot, killerName) {
  if (killerName === 'Вы') {
    state.kills++;
    showKillMsg(`Устранение! ${bot.name} (всего: ${state.kills})`);
    Sfx.kill();
  }
  loot.spawnWeapon(['smg', 'rifle', 'shotgun', 'sniper'][Math.floor(Math.random() * 4)],
    bot.group.position.x, bot.group.position.z);
}

function playersLeft() {
  return (state.alive ? 1 : 0) + bots.filter(b => b.alive).length;
}

function dropPlayerLoot() {
  if (state.lootDropped) return;
  state.lootDropped = true;
  let n = 0;
  for (const slot of state.slots) {
    if (!slot) continue;
    const a = (n++ / Math.max(1, state.slots.filter(Boolean).length)) * Math.PI * 2;
    const x = state.pos.x + Math.cos(a) * 0.9;
    const z = state.pos.z + Math.sin(a) * 0.9;
    if (slot.kind === 'weapon') loot.spawnWeapon(slot.key, x, z);
    else loot.spawnConsumable(slot.key, x, z);
  }
  state.slots.fill(null);
  refreshHotbar();
}

function endMatch(victory, killerName) {
  if (state.matchOver) return;
  state.matchOver = true;
  document.exitPointerLock();
  const screen = document.getElementById('endScreen');
  const title = document.getElementById('endTitle');
  const sub = document.getElementById('endSub');
  if (victory) {
    title.textContent = '🏆 ПОБЕДА!';
    sub.textContent = `Королевская победа! Устранений: ${state.kills}`;
    Sfx.win();
    player.emote(EMOTES[0].label); // победный танец
  } else {
    title.textContent = 'ПОРАЖЕНИЕ';
    sub.textContent = `Тебя устранил ${killerName}. Место: ${playersLeft() + 1} из ${BOT_COUNT + 1}. Устранений: ${state.kills}`;
    Sfx.lose();
    state.sprintToggled = false;
    dropPlayerLoot();
    player.eliminate();
  }
  if (victory) screen.classList.remove('hidden');
  else setTimeout(() => screen.classList.remove('hidden'), 1050);
}
document.getElementById('restartBtn').addEventListener('click', () => location.reload());

// ---------- Стрельба ----------
const raycaster = new THREE.Raycaster();
const _muzzle = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _shotRight = new THREE.Vector3();
const _shotUp = new THREE.Vector3();

function currentWeapon() {
  const slot = state.slots[state.slotIdx];
  return slot && slot.kind === 'weapon' ? WEAPONS[slot.key] : null;
}

function currentWeaponSlot() {
  const slot = state.slots[state.slotIdx];
  return slot && slot.kind === 'weapon' ? slot : null;
}

function cancelReload() {
  state.reloadT = 0;
  state.reloadDuration = 0;
  state.reloadSlotIdx = -1;
  player.setReloading(false, 0);
}

function startReload() {
  const slot = currentWeaponSlot();
  const w = currentWeapon();
  if (!slot || !w || state.reloadT > 0 || !state.alive) return;
  if (slot.ammo >= w.mag || slot.reserve <= 0) return;
  state.reloadT = w.reloadTime;
  state.reloadDuration = w.reloadTime;
  state.reloadSlotIdx = state.slotIdx;
  input.shoot = false;
  player.setReloading(true, 0);
}

function updateReload(dt) {
  if (state.reloadT <= 0) return;
  if (state.reloadSlotIdx !== state.slotIdx || !state.alive) { cancelReload(); return; }
  state.reloadT -= dt;
  player.setReloading(true, 1 - Math.max(0, state.reloadT) / state.reloadDuration);
  if (state.reloadT > 0) return;
  const slot = currentWeaponSlot();
  const w = currentWeapon();
  if (slot && w) {
    const needed = w.mag - slot.ammo;
    const loaded = Math.min(needed, slot.reserve);
    slot.ammo += loaded;
    slot.reserve -= loaded;
  }
  cancelReload();
}

function shoot() {
  const w = currentWeapon();
  const slot = currentWeaponSlot();
  if (!w || !slot || state.reloadT > 0) return;
  if (slot.ammo <= 0) { startReload(); return; }
  slot.ammo--;
  state.fireCd = w.rof;
  state.lastFireT = state.time;
  if (!w.auto) input.shoot = false;
  Sfx.shot();
  player.kickWeapon(w.scope ? 0.18 : w.pellets > 1 ? 0.16 : 0.1);

  const botMeshes = [];
  for (const b of bots) if (b.alive) botMeshes.push(...b.meshes);
  player.getMuzzleWorld(_muzzle);

  const movementMultiplier = state.isRunning ? 2.15 : state.isMoving ? 1.55 : 1;
  const aimMultiplier = input.aim ? 0.38 : 1;
  const totalSpread = (w.spread + state.bloom) * movementMultiplier * aimMultiplier;
  _shotRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  _shotUp.set(0, 1, 0).applyQuaternion(camera.quaternion);

  for (let p = 0; p < w.pellets; p++) {
    camera.getWorldDirection(_dir);
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * totalSpread;
    _dir.addScaledVector(_shotRight, Math.cos(a) * r);
    _dir.addScaledVector(_shotUp, Math.sin(a) * r);
    _dir.normalize();
    raycaster.set(camera.position, _dir);
    raycaster.far = 200;
    const hits = raycaster.intersectObjects([...botMeshes, ...env.solid], false);
    const hit = hits.find(h => h.distance > camDist + 0.4);
    const end = hit ? hit.point : raycaster.ray.at(120, new THREE.Vector3());
    addTracer(_muzzle, end, 0xffe89a);

    if (hit) {
      const bot = hit.object.userData.bot;
      if (bot && bot.alive) {
        spawnParticles(hit.point, 0xff5252, 5);
        if (bot.takeDamage(w.dmg)) onBotKilled(bot, 'Вы');
        else Sfx.hit();
      } else {
        spawnParticles(hit.point, 0x9c9c9c, 3);
      }
    }
  }
  state.bloom = Math.min(0.12, state.bloom + w.bloom);
  if (slot.ammo <= 0 && slot.reserve > 0) startReload();
}

// ---------- Движение и камера ----------
const WALK_SPEED = 2.6, RUN_SPEED = 6.0, CROUCH_SPEED = 1.5, SLIDE_SPEED = 8.5;
const JUMP_V = 6.5, GRAVITY = 16;
const _fwd = new THREE.Vector3(), _right = new THREE.Vector3(), _move = new THREE.Vector3();
const _camOff = new THREE.Vector3(), _head = new THREE.Vector3(), _shoulder = new THREE.Vector3();

// Перемещение с коллизиями: деревья непроходимы, на камни можно запрыгнуть
function tryMove(dx, dz) {
  const step = (nx, nz) => {
    // непроходимые стволы
    for (const c of env.colliders) {
      const d = Math.hypot(nx - c.x, nz - c.z);
      if (d < c.r + 0.35) return false;
    }
    // слишком высокий уступ (камень) — нужен прыжок
    const h = heightAt(nx, nz);
    if (h - state.pos.y > 0.55) return false;
    return true;
  };
  if (step(state.pos.x + dx, state.pos.z + dz)) {
    state.pos.x += dx; state.pos.z += dz;
  } else {
    if (step(state.pos.x + dx, state.pos.z)) state.pos.x += dx; // скольжение вдоль
    else if (step(state.pos.x, state.pos.z + dz)) state.pos.z += dz;
  }
}

function updatePlayer(dt) {
  _fwd.set(-Math.sin(camYaw), 0, -Math.cos(camYaw));
  _right.set(-_fwd.z, 0, _fwd.x); // вправо от направления взгляда
  _move.set(0, 0, 0);
  if (state.alive) {
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) _move.add(_fwd);
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) _move.sub(_fwd);
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) _move.sub(_right);
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) _move.add(_right);
    if (debugMoveMode === 'walk' || debugMoveMode === 'run') _move.add(_fwd);
  }
  const moving = _move.lengthSq() > 0;
  const sliding = state.slideT > 0;
  const crouching = input.crouch && !sliding;
  let running = state.sprintToggled && moving && !crouching && !sliding && state.stamina > 0;
  state.isMoving = moving;
  state.isRunning = running;
  player.setSlideFrozen(sliding);

  if (running) {
    state.stamina = Math.max(0, state.stamina - 19 * dt);
    state.staminaRecoverDelay = 0.65;
    if (state.stamina <= 0) {
      state.sprintToggled = false;
      running = false;
    }
  } else {
    state.staminaRecoverDelay = Math.max(0, state.staminaRecoverDelay - dt);
    if (state.staminaRecoverDelay <= 0) state.stamina = Math.min(100, state.stamina + 13 * dt);
  }
  state.isRunning = running;

  if (sliding) {
    state.slideT -= dt;
    const k = state.slideT / 0.6; // затухание
    const sp = SLIDE_SPEED * (0.4 + 0.6 * k) * dt;
    tryMove(state.slideDir.x * sp, state.slideDir.z * sp);
    player.setPose('slide');
  } else if (moving) {
    if (player.emoting) player.stopEmote();
    _move.normalize();
    const sp = (crouching ? CROUCH_SPEED : running ? RUN_SPEED : WALK_SPEED) * dt;
    tryMove(_move.x * sp, _move.z * sp);
    player.setPose(crouching ? 'crouch' : 'stand');
  } else {
    player.setPose(crouching ? 'crouch' : 'stand');
  }
  // не уходим глубоко в воду
  const r = Math.hypot(state.pos.x, state.pos.z);
  if (r > WALK_R) state.pos.multiplyScalar(WALK_R / r);

  // поворот модели
  const aimingNow = state.reloadT <= 0 && (input.aim || (state.time - state.lastFireT < 0.5));
  player.setAiming(aimingNow && !!currentWeapon() && state.alive, camPitch);
  let targetA = null;
  if (sliding) targetA = Math.atan2(state.slideDir.x, state.slideDir.z);
  else if (aimingNow && state.alive) targetA = camYaw + Math.PI;
  else if (moving) targetA = Math.atan2(_move.x, _move.z);
  if (targetA !== null) {
    let d = targetA - player.group.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    player.group.rotation.y += d * Math.min(1, dt * 14);
  }

  // прыжок и гравитация (heightAt учитывает камни — на них можно запрыгнуть)
  const gh = heightAt(state.pos.x, state.pos.z);
  if (state.alive && input.keys.has('Space') && state.onGround && !sliding) {
    state.vy = JUMP_V;
    state.onGround = false;
    Sfx.jump();
  }
  state.vy -= GRAVITY * dt;
  state.pos.y += state.vy * dt;
  if (state.pos.y <= gh) {
    state.pos.y = gh;
    state.vy = 0;
    state.onGround = true;
  }
  player.group.position.copy(state.pos);

  // анимация
  if (state.alive && !player.emoting && !sliding) {
    if (!state.onGround) { /* в полёте оставляем текущую */ }
    else if (moving) player.play(running && !crouching ? 'run' : 'walk');
    else player.play('idle');
  }

  // стрельба
  updateReload(dt);
  state.bloom = Math.max(0, state.bloom - dt * 0.045);
  state.fireCd -= dt;
  if (state.alive && input.shoot && state.fireCd <= 0 && input.locked) shoot();

  // камера через плечо; скоуп — «выходим в прицел» (вид от первого лица)
  const w = currentWeapon();
  // Подкат/присед никогда не должны внезапно переключать камеру в first-person.
  const scoped = input.aim && w && w.scope && !crouching && !sliding;
  camDistTarget = scoped ? 0.2 : input.aim ? (crouching || sliding ? 3.15 : 2.65) : 3.8;
  // У снайперки 14° допустимы только внутри настоящего scope. Иначе Ctrl
  // оставлял third-person камеру, но сохранял экстремальный «первый» зум.
  fovTarget = scoped ? w.aimFov : input.aim && w ? Math.max(w.aimFov, 46) : 67;
  camDist += (camDistTarget - camDist) * Math.min(1, dt * 10);
  camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 10);
  camera.updateProjectionMatrix();
  if (player.model) player.model.visible = !scoped;
  if (player.gun) player.gun.visible = !scoped;

  // Камера следует за грудной клеткой, а не за опущенным тазом: при Ctrl
  // персонаж остаётся виден целиком и ракурс не превращается в first-person.
  const headH = sliding ? 1.08 : crouching ? 1.3 : 1.55;
  _head.copy(state.pos).add(new THREE.Vector3(0, headH, 0));
  _camOff.set(
    Math.sin(camYaw) * Math.cos(camPitch),
    Math.sin(camPitch),
    Math.cos(camYaw) * Math.cos(camPitch)
  ).multiplyScalar(camDist);
  _shoulder.copy(_right).multiplyScalar(scoped ? 0 : input.aim ? 0.75 : 0.55);
  camera.position.copy(_head).add(_camOff).add(_shoulder);
  const camGround = Math.max(heightAt(camera.position.x, camera.position.z), -0.3) + 0.35;
  if (camera.position.y < camGround) camera.position.y = camGround;
  _head.add(_shoulder);
  camera.lookAt(_head);

  // оверлеи прицела
  document.getElementById('scopeOverlay').classList.toggle('hidden', !scoped);
  const crosshairEl = document.getElementById('crosshair');
  crosshairEl.classList.toggle('hidden', !!scoped);
  const hudSpread = w ? (w.spread + state.bloom) * (running ? 2.15 : moving ? 1.55 : 1) * (input.aim ? 0.38 : 1) : 0;
  crosshairEl.style.transform = `translate(-50%, -50%) scale(${1 + hudSpread * 8})`;
}

// ---------- Эффекты ----------
function updateEffects(dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    t.line.material.opacity = Math.max(0, t.life / 0.09);
    if (t.life <= 0) {
      scene.remove(t.line);
      t.line.geometry.dispose();
      tracers.splice(i, 1);
    }
  }
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); continue; }
    p.vel.y -= 9 * dt;
    p.mesh.position.addScaledVector(p.vel, dt);
    p.mesh.material.opacity = p.life / 0.5;
  }
  if (vignetteT > 0) {
    vignetteT -= dt;
    vignette.style.opacity = Math.max(0, vignetteT / 0.35);
  }
  if (killMsgT > 0) {
    killMsgT -= dt;
    if (killMsgT <= 0) document.getElementById('killMsg').classList.add('hidden');
  }
}

// ---------- HUD ----------
const mmCtx = document.getElementById('minimap').getContext('2d');

function updateHud() {
  document.getElementById('hpFill').style.width = Math.max(0, state.hp) + '%';
  document.getElementById('hpText').textContent = Math.ceil(state.hp);
  document.getElementById('armorFill').style.width = Math.max(0, state.armor) + '%';
  document.getElementById('armorText').textContent = Math.ceil(state.armor);
  const ammoHud = document.getElementById('ammoHud');
  const weaponSlot = currentWeaponSlot();
  ammoHud.classList.toggle('hidden', !weaponSlot);
  if (weaponSlot) {
    document.getElementById('magAmmo').textContent = weaponSlot.ammo;
    document.getElementById('reserveAmmo').textContent = weaponSlot.reserve;
    const reloadLabel = document.getElementById('reloadLabel');
    reloadLabel.textContent = state.reloadT > 0
      ? `ПЕРЕЗАРЯДКА ${Math.max(0, state.reloadT).toFixed(1)}с`
      : (weaponSlot.ammo === 0 ? 'НЕТ ПАТРОНОВ' : '');
  }
  const staminaEl = document.getElementById('stamina');
  const sprinting = state.sprintToggled && _move.lengthSq() > 0 && state.stamina > 0 && !input.crouch;
  staminaEl.classList.toggle('hidden', !sprinting);
  document.getElementById('staminaFill').style.width = state.stamina + '%';
  document.getElementById('staminaText').textContent = Math.ceil(state.stamina);
  document.getElementById('players').textContent = 'Игроков: ' + playersLeft();
  document.getElementById('killCount').textContent = '☠ ' + state.kills;
  const zi = document.getElementById('zoneInfo');
  zi.innerHTML = zone.statusText;
  zi.classList.toggle('warn', zone.state === 'shrink');

  nearItem = state.alive ? loot.nearest(state.pos) : null;
  pickupHintEl.classList.toggle('hidden', !nearItem);
  if (nearItem) {
    const label = nearItem.kind === 'weapon' ? WEAPONS[nearItem.key].name : CONSUMABLES[nearItem.key].name;
    pickupHintEl.innerHTML = `<span class="key">E</span> Подобрать: ${label}`;
  }

  // шторм: синяя пелена, когда за зоной
  const outside = !zone.contains(state.pos);
  document.getElementById('stormOverlay').style.opacity = outside && state.alive ? 1 : 0;
}

function drawMinimap() {
  const S = 150, C = S / 2, scale = C / 46;
  mmCtx.clearRect(0, 0, S, S);
  mmCtx.fillStyle = 'rgba(20,60,90,0.85)';
  mmCtx.fillRect(0, 0, S, S);
  mmCtx.fillStyle = '#d8e8ee';
  mmCtx.beginPath(); mmCtx.arc(C, C, 38 * scale, 0, 7); mmCtx.fill();
  mmCtx.fillStyle = '#36414e';
  mmCtx.fillRect(C - 12.5 * scale, C - 38 * scale, 25 * scale, 76 * scale);
  mmCtx.fillRect(C - 37 * scale, C - 4 * scale, 74 * scale, 14 * scale);
  mmCtx.fillStyle = '#8796a0';
  mmCtx.fillRect(C + 9.5 * scale, C - 2 * scale, 15 * scale, 14 * scale);
  mmCtx.strokeStyle = '#46b5ff'; mmCtx.lineWidth = 2;
  mmCtx.beginPath(); mmCtx.arc(C, C, zone.r * scale, 0, 7); mmCtx.stroke();
  mmCtx.fillStyle = '#ffd54a';
  for (const it of loot.items) {
    if (it.taken) continue;
    mmCtx.fillRect(C + it.group.position.x * scale - 1.5, C + it.group.position.z * scale - 1.5, 3, 3);
  }
  mmCtx.fillStyle = '#ff5252';
  for (const b of bots) {
    if (!b.alive) continue;
    mmCtx.beginPath();
    mmCtx.arc(C + b.group.position.x * scale, C + b.group.position.z * scale, 3, 0, 7);
    mmCtx.fill();
  }
  mmCtx.save();
  mmCtx.translate(C + state.pos.x * scale, C + state.pos.z * scale);
  mmCtx.rotate(-camYaw + Math.PI);
  mmCtx.fillStyle = '#ffffff';
  mmCtx.beginPath();
  mmCtx.moveTo(0, -6); mmCtx.lineTo(4, 4); mmCtx.lineTo(-4, 4);
  mmCtx.closePath(); mmCtx.fill();
  mmCtx.restore();
}

// ---------- FPS ----------
let fpsAcc = 0, fpsN = 0, fpsT = 0;
function updateFps(dt) {
  fpsAcc += dt; fpsN++; fpsT += dt;
  if (fpsT >= 0.5) {
    document.getElementById('fps').textContent = Math.round(fpsN / fpsAcc) + ' fps';
    fpsAcc = 0; fpsN = 0; fpsT = 0;
  }
}

// ---------- Цикл ----------
const clock = new THREE.Clock();
const botCtx = {
  playerPos: state.pos,
  get playerAlive() { return state.alive && !state.matchOver; },
  get bots() { return bots; },
  get zoneR() { return zone.r; },
  addTracer,
  damagePlayer,
  onBotKilled,
};

function tick(dt) {
  state.time += dt;
  if (player.model) updatePlayer(dt);
  player.update(dt);

  zone.update(dt);
  if (state.alive && !state.matchOver && !zone.contains(state.pos)) {
    state.hp -= zone.dps * dt; // шторм бьёт мимо брони
    if (state.hp <= 0) { state.hp = 0; state.alive = false; endMatch(false, 'шторм'); }
  }
  for (const b of bots) {
    if (b.alive && !zone.contains(b.group.position)) {
      if (b.takeDamage(zone.dps * dt)) onBotKilled(b, 'Зона');
    }
    b.update(dt, botCtx);
  }

  if (!state.matchOver && state.alive && bots.length && bots.every(b => !b.alive)) {
    endMatch(true);
  }

  loot.update(state.time);
  updateWorld(env, state.time);
  updateEffects(dt);
  updateHud();
  drawMinimap();
  updateFps(dt);
  composer.render();
}

function frame() {
  tick(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(frame);
}

// ---------- Старт ----------
(async () => {
  try {
    await Promise.all([
      player.load(initialCharacter).catch(async err => {
        console.warn('Импортированный FBX не загрузился, используем Мишель:', err);
        select.dataset.loadError = err?.stack || err?.message || String(err);
        select.value = 'michelle';
        await player.load('michelle');
      }),
      loadBotTemplate(manager),
    ]);
  } catch (err) {
    console.error('Ошибка загрузки моделей:', err);
    document.getElementById('loadText').textContent = 'Ошибка загрузки модели — проверь интернет';
    return;
  }
  player.group.position.copy(state.pos);
  loot.populate();
  bots = Array.from({ length: BOT_COUNT }, (_, i) => new Bot(scene, i));
  if (debugWeaponKey && WEAPONS[debugWeaponKey]) {
    const w = WEAPONS[debugWeaponKey];
    state.slots[0] = { kind: 'weapon', key: debugWeaponKey, ammo: w.mag, reserve: w.reserve };
    state.slotIdx = 0;
    player.setWeapon(debugWeaponKey);
    if (debugParams.get('reload') === '1') {
      state.slots[0].ammo = Math.max(0, w.mag - 5);
      startReload();
    }
    if (debugParams.has('reloadPose')) {
      player.setReloading(true, Number(debugParams.get('reloadPose')) || 0.45);
    }
  }
  refreshHotbar();
  document.getElementById('loading').classList.add('done');
  frame();
})();

// Отладочный доступ из консоли (и для тестов)
window.__game = {
  scene, camera, renderer, composer, ssaoPass, player, state, env, input, zone, loot,
  get bots() { return bots; },
  step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) tick(dt); },
  shoot, damagePlayer, tryPickup, selectSlot, useConsumable, playEmote, buildEmoteWheel,
};
