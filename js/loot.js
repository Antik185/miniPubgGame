// Лут на карте: оружие, аптечки, щиты. Всё подбирается в инвентарь (E).
import * as THREE from 'three';
import { WEAPONS, buildGunMesh } from './weapons.js';
import { groundHeight } from './world.js';

function rand(a, b) { return a + Math.random() * (b - a); }

// Расходники: kind → параметры
export const CONSUMABLES = {
  heal: { name: 'Аптечка', useTime: 0, effect: { hp: 50 } },
  shield25: { name: 'Малый щит', useTime: 0, effect: { armor: 25 } },
  shield50: { name: 'Большой щит', useTime: 0, effect: { armor: 50 } },
};

// Модель предмета (используется и для лута на земле, и для иконок в хотбаре)
export function buildItemMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'heal') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.52),
      new THREE.MeshLambertMaterial({ color: 0xe53935 }));
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.34, 0.52),
      new THREE.MeshLambertMaterial({ color: 0xe53935 }));
    g.add(box, c1, c2);
  } else {
    // синяя бочка щита: малая или большая
    const big = kind === 'shield50';
    const h = big ? 0.62 : 0.4;
    const r = big ? 0.26 : 0.18;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14),
      new THREE.MeshPhongMaterial({ color: 0x2196f3, shininess: 80 }));
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, h * 0.15, 14),
      new THREE.MeshPhongMaterial({ color: 0x90caf9 }));
    cap.position.y = h / 2 + h * 0.07;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, 0.02, 6, 16),
      new THREE.MeshLambertMaterial({ color: 0x1565c0 }));
    ring.rotation.x = Math.PI / 2;
    g.add(body, cap, ring);
  }
  return g;
}

export class LootManager {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  // Лут лежит на земле без подсветки — просто подходишь и подбираешь
  spawnWeapon(key, x, z) {
    const group = new THREE.Group();
    const gun = buildGunMesh(key);
    gun.scale.setScalar(1.02);
    gun.position.y = 0.16;
    gun.rotation.set(0.12, Math.random() * Math.PI * 2, 0.42);
    group.add(gun);
    group.position.set(x, groundHeight(x, z), z);
    this.scene.add(group);
    this.items.push({ group, kind: 'weapon', key, taken: false, phase: Math.random() * 6 });
  }

  spawnConsumable(kind, x, z) {
    const group = new THREE.Group();
    const item = buildItemMesh(kind);
    item.position.y = 0.05;
    item.rotation.y = Math.random() * Math.PI * 2;
    group.add(item);
    group.position.set(x, groundHeight(x, z), z);
    this.scene.add(group);
    this.items.push({ group, kind: 'use', key: kind, taken: false, phase: Math.random() * 6 });
  }

  populate() {
    const keys = Object.keys(WEAPONS);
    this.spawnWeapon('pistol', 2.5, 3.5); // гарантированный старт
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(6, 34);
      this.spawnWeapon(keys[Math.floor(Math.random() * keys.length)], Math.cos(a) * r, Math.sin(a) * r);
    }
    const cons = ['heal', 'heal', 'heal', 'heal', 'shield25', 'shield25', 'shield25', 'shield25', 'shield50', 'shield50', 'shield50'];
    for (const kind of cons) {
      const a = Math.random() * Math.PI * 2;
      const r = rand(5, 32);
      this.spawnConsumable(kind, Math.cos(a) * r, Math.sin(a) * r);
    }
  }

  nearest(pos, maxDist = 2.2) {
    let best = null, bestD = maxDist;
    for (const it of this.items) {
      if (it.taken) continue;
      const d = Math.hypot(it.group.position.x - pos.x, it.group.position.z - pos.z);
      if (d < bestD) { bestD = d; best = it; }
    }
    return best;
  }

  take(item) {
    item.taken = true;
    this.scene.remove(item.group);
  }

  update() { /* лут статичен — лежит на земле */ }
}
