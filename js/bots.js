// Боты-люди: клоны mixamo-персонажей, бродят по зоне, стреляют по ближайшей цели
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CHARACTERS, loadAnimLibrary, clipForRig, normalizeScale, holdGunAtHand } from './character.js';
import { buildGunMesh } from './weapons.js';
import { groundHeight } from './world.js';
import { EliminationEffect } from './elimination.js';

const NAMES = ['Кибер', 'Шустрый', 'Тень', 'Гроза', 'Валера', 'Штурм', 'Ниндзя', 'Босс', 'Хитрый', 'Молния'];
const TINTS = [0xff8a65, 0x64b5f6, 0xaed581, 0xfff176, 0xba68c8, 0x4dd0e1, 0xf48fb1, 0x90a4ae];

let templates = []; // [{scene, rotY}]
let lib = null;

export async function loadBotTemplate(manager) {
  const loader = new GLTFLoader(manager);
  const cfgs = Object.values(CHARACTERS).filter(cfg => cfg.bot !== false && cfg.type !== 'fbx');
  const modelByUrl = new Map();
  for (const cfg of cfgs) {
    if (!modelByUrl.has(cfg.url)) modelByUrl.set(cfg.url, loader.loadAsync(cfg.url));
  }
  const [gltfs, animLib] = await Promise.all([
    Promise.all(cfgs.map(c => modelByUrl.get(c.url))),
    loadAnimLibrary(manager),
  ]);
  templates = gltfs.map((g, i) => ({ scene: g.scene, rotY: cfgs[i].rotY || 0, tint: cfgs[i].tint, url: cfgs[i].url }));
  lib = animLib;
}

function rand(a, b) { return a + Math.random() * (b - a); }

export class Bot {
  constructor(scene, idx) {
    this.scene = scene;
    this.name = NAMES[idx % NAMES.length] + '-' + (idx + 1);
    this.hp = 100;
    this.alive = true;
    this.removeT = -1;
    this.deathT = 0;
    this.eliminationEffect = null;

    const tpl = templates[idx % templates.length];
    this.rotY = tpl.rotY;
    this.model = SkeletonUtils.clone(tpl.scene);
    const tint = new THREE.Color(TINTS[idx % TINTS.length]);
    if (tpl.tint) tint.lerp(new THREE.Color(tpl.tint), 0.55);
    this.model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        o.material = o.material.clone();
        o.material.color.lerp(tint, 0.3); // «костюм» — цветовой оттенок
      }
    });
    this.model.rotation.y = this.rotY;
    normalizeScale(this.model);
    this.modelBaseScale = this.model.scale.clone();

    this.group = new THREE.Group();
    this.group.add(this.model);
    // невидимый хитбокс — рейкаст по скиновым мешам ненадёжен
    this.hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 1.75, 8),
      new THREE.MeshBasicMaterial()
    );
    this.hitbox.position.y = 0.875;
    this.hitbox.visible = false;
    this.hitbox.userData.bot = this;
    this.group.add(this.hitbox);
    this.meshes = [this.hitbox];

    const a = Math.random() * Math.PI * 2;
    const r = rand(14, 32);
    this.group.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    this.group.position.y = groundHeight(this.group.position.x, this.group.position.z);
    scene.add(this.group);

    this.hand = this.model.getObjectByName('mixamorigRightHand');
    this.gun = buildGunMesh('rifle');
    this.group.add(this.gun);
    this.muzzle = this.gun.getObjectByName('muzzle');

    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    for (const n of ['idle', 'run']) {
      this.actions[n] = this.mixer.clipAction(clipForRig(n, tpl.url));
    }
    this.current = null;
    this.play('idle');

    this.wanderTarget = new THREE.Vector3();
    this.pickWander(38);
    this.fireT = rand(0.5, 2);
    this.thinkT = 0;
  }

  play(name) {
    const a = this.actions[name];
    if (!a || this.current === a) return;
    a.reset();
    if (this.current) a.crossFadeFrom(this.current, 0.2, false);
    a.play();
    this.current = a;
  }

  pickWander(zoneR) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * Math.max(2, zoneR - 2);
    this.wanderTarget.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  }

  takeDamage(d) {
    if (!this.alive) return false;
    this.hp -= d;
    if (this.hp <= 0) {
      this.alive = false;
      this.mixer.stopAllAction();
      this.deathT = 1.25;
      this.removeT = 1.4;
      this.gun.visible = false;
      this.hitbox.visible = false;
      this.eliminationEffect = new EliminationEffect(this.scene, this.group.position.clone());
      this.model.traverse(o => {
        if (!o.isMesh) return;
        o.material.transparent = true;
        o.material.depthWrite = false;
        if (o.material.emissive) o.material.emissive.setHex(0x1477a8);
      });
      return true;
    }
    return false;
  }

  update(dt, ctx) {
    this.mixer.update(dt);
    holdGunAtHand(this.gun, this.hand, this.group);
    if (!this.alive) {
      this.deathT -= dt;
      const k = Math.max(0, this.deathT / 1.25);
      this.model.scale.copy(this.modelBaseScale).multiplyScalar(Math.max(0.04, k));
      this.model.position.y = (1 - k) * 1.1;
      this.model.traverse(o => { if (o.isMesh) o.material.opacity = k; });
      if (this.eliminationEffect && !this.eliminationEffect.update(dt)) this.eliminationEffect = null;
      if (this.removeT > 0) {
        this.removeT -= dt;
        if (this.removeT <= 0) this.scene.remove(this.group);
      }
      return;
    }

    const pos = this.group.position;

    // цель: ближайший живой (игрок или бот)
    let target = null, tDist = 24;
    if (ctx.playerAlive) {
      const d = pos.distanceTo(ctx.playerPos);
      if (d < tDist) { tDist = d; target = { pos: ctx.playerPos, isPlayer: true }; }
    }
    for (const b of ctx.bots) {
      if (b === this || !b.alive) continue;
      const d = pos.distanceTo(b.group.position);
      if (d < tDist) { tDist = d; target = { pos: b.group.position, bot: b }; }
    }

    // движение
    let dest = this.wanderTarget;
    const outside = Math.hypot(pos.x, pos.z) > ctx.zoneR;
    if (outside) dest = new THREE.Vector3(0, 0, 0);
    else if (target && tDist < 9) dest = null;

    if (dest) {
      const dir = new THREE.Vector3().subVectors(dest, pos); dir.y = 0;
      if (dir.length() < 1.5 && !outside) {
        this.pickWander(ctx.zoneR);
      } else {
        dir.normalize();
        pos.addScaledVector(dir, 4.2 * dt);
        pos.y = groundHeight(pos.x, pos.z);
        this.group.rotation.y = Math.atan2(dir.x, dir.z);
        this.play('run');
      }
    } else {
      this.play('idle');
    }

    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = rand(4, 8); if (!target) this.pickWander(ctx.zoneR); }

    // стрельба
    this.fireT -= dt;
    if (target && this.fireT <= 0) {
      this.fireT = rand(0.7, 1.4);
      const dir = new THREE.Vector3().subVectors(target.pos, pos);
      this.group.rotation.y = Math.atan2(dir.x, dir.z);
      const from = this.muzzle ? this.muzzle.getWorldPosition(new THREE.Vector3())
        : pos.clone().add(new THREE.Vector3(0, 1.3, 0));
      const to = target.pos.clone().add(new THREE.Vector3(rand(-0.6, 0.6), rand(0.8, 1.6), rand(-0.6, 0.6)));
      ctx.addTracer(from, to, 0xff7043);
      const hitChance = Math.max(0.12, 0.5 - tDist * 0.015);
      if (Math.random() < hitChance) {
        const dmg = Math.round(rand(6, 13));
        if (target.isPlayer) ctx.damagePlayer(dmg, this.name);
        else if (target.bot.takeDamage(dmg)) ctx.onBotKilled(target.bot, this.name);
      }
    }
  }
}
