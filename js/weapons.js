// Оружие: характеристики + внешний вид (простые low-poly модельки)
import * as THREE from 'three';

export const WEAPONS = {
  pistol: {
    name: 'Пистолет', icon: 'P', color: 0x9aa5b1,
    dmg: 22, rof: 0.35, spread: 0.022, bloom: 0.009, pellets: 1, auto: false, aimFov: 48,
    mag: 12, reserve: 48, reloadTime: 1.25,
  },
  smg: {
    name: 'ПП', icon: 'S', color: 0x4fc3f7,
    dmg: 11, rof: 0.09, spread: 0.045, bloom: 0.007, pellets: 1, auto: true, aimFov: 48,
    mag: 30, reserve: 120, reloadTime: 1.55,
  },
  rifle: {
    name: 'Автомат', icon: 'A', color: 0x81c784,
    dmg: 24, rof: 0.16, spread: 0.02, bloom: 0.006, pellets: 1, auto: true, aimFov: 45,
    mag: 30, reserve: 90, reloadTime: 1.75,
  },
  shotgun: {
    name: 'Дробовик', icon: 'D', color: 0xffb74d,
    dmg: 10, rof: 0.9, spread: 0.105, bloom: 0.018, pellets: 6, auto: false, aimFov: 50,
    mag: 5, reserve: 30, reloadTime: 2.15,
  },
  sniper: {
    name: 'Снайперка', icon: 'C', color: 0xba68c8,
    dmg: 85, rof: 1.5, spread: 0.002, bloom: 0.012, pellets: 1, auto: false, aimFov: 14, scope: true,
    mag: 5, reserve: 20, reloadTime: 2.4,
  },
};

// Канвас-текстуры для оружия: тонкая царапанность металла и зерно полимера
let gunMaps = null;
function getGunMaps() {
  if (gunMaps) return gunMaps;
  const make = (base, fleck, count, alpha) => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < count; i++) {
      ctx.globalAlpha = alpha * (0.4 + Math.random() * 0.6);
      ctx.fillStyle = fleck;
      ctx.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, Math.random() < 0.3 ? 4 + Math.random() * 9 : 1);
    }
    ctx.globalAlpha = 1;
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(2, 2);
    return t;
  };
  gunMaps = {
    metal: make('#565d64', '#9aa3ab', 900, 0.28),
    polymer: make('#63676b', '#3a3e42', 1400, 0.4),
  };
  return gunMaps;
}

// Модель пушки; у всех — ствол вдоль -Z, muzzle на конце ствола
export function buildGunMesh(key) {
  const w = WEAPONS[key];
  const maps = getGunMaps();
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x2a3138, map: maps.metal, bumpMap: maps.metal, bumpScale: 0.012,
    roughness: 0.32, metalness: 0.85,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: w.color, map: maps.metal, roughness: 0.38, metalness: 0.55,
  });
  const polymerMat = new THREE.MeshStandardMaterial({
    color: 0x181d22, map: maps.polymer, bumpMap: maps.polymer, bumpScale: 0.02,
    roughness: 0.68, metalness: 0.06,
  });

  const long = key === 'sniper' ? 0.5 : key === 'rifle' ? 0.36 : key === 'shotgun' ? 0.4 : 0.2;
  const bodyLength = key === 'pistol' ? 0.24 : key === 'smg' ? 0.31 : 0.38;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.105, bodyLength), bodyMat);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, long, 8), accentMat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.035, -(bodyLength / 2 + long / 2));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.06), bodyMat);
  grip.position.set(0, -0.1, 0.08);
  grip.rotation.x = -0.18;
  g.add(body, barrel, grip);

  // Явные точки хвата: код персонажа совмещает gripAnchor с оружейной
  // костью, поэтому ладонь держит рукоять, а не геометрический центр пушки.
  const gripAnchor = new THREE.Object3D();
  gripAnchor.name = 'gripAnchor';
  gripAnchor.position.set(0, -0.095, 0.08);
  const supportGrip = new THREE.Object3D();
  supportGrip.name = 'supportGrip';
  supportGrip.position.set(0, 0, key === 'pistol' ? -0.075 : -(bodyLength / 2 + long * 0.2));
  g.add(gripAnchor, supportGrip);

  if (key === 'pistol') {
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.09, 0.042), polymerMat);
    magazine.name = 'magazine';
    magazine.position.set(0, -0.11, 0.08);
    magazine.rotation.x = -0.18;
    g.add(magazine);
  }

  if (key !== 'pistol') {
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.115, key === 'smg' ? 0.2 : 0.3), polymerMat);
    stock.position.set(0, 0, bodyLength / 2 + (key === 'smg' ? 0.08 : 0.13));
    stock.scale.y = 0.82;
    const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.095, long * 0.55), polymerMat);
    handguard.position.set(0, 0.015, -(bodyLength / 2 + long * 0.23));
    g.add(stock, handguard);
  }

  if (key === 'rifle' || key === 'smg') {
    const magazine = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.17, 0.075), accentMat);
    magazine.name = 'magazine';
    magazine.position.set(0, -0.115, -0.045);
    magazine.rotation.x = -0.16;
    g.add(magazine);
  }
  if (key === 'shotgun') {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, long * 0.86, 10), bodyMat);
    tube.rotation.x = Math.PI / 2;
    tube.position.set(0, -0.025, -(bodyLength / 2 + long * 0.42));
    g.add(tube);
  }
  if (key === 'sniper') {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.19, 12), bodyMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.11, -0.05);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.032, 12), new THREE.MeshBasicMaterial({ color: 0x62c9ff }));
    lens.position.set(0, 0.11, -0.151);
    g.add(scope, lens);
  }
  // мушка и планка — мелочи, которые продают силуэт
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.03, 0.02), bodyMat);
  sight.position.set(0, 0.075, -(bodyLength / 2 + long * 0.82));
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.016, bodyLength * 0.8), polymerMat);
  rail.position.set(0, 0.062, 0);
  g.add(sight, rail);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.035, -(bodyLength / 2 + long));
  muzzle.name = 'muzzle';
  g.add(muzzle);
  g.scale.setScalar(key === 'pistol' ? 0.62 : 0.72);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
