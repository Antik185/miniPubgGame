// Стилизованный мир: остров с травой, озеро, деревья, камни, горы, облака, мишени
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const NATURE = 'assets/vendor/kenney-nature-kit/Models/GLTF format/';

// Готовые модели природы (Kenney Nature Kit): сосны, валуны, камни.
// Загружаются асинхронно и заменяют места, размеченные в buildWorld.
async function scatterNature(scene, manager, { pineSpots, isleParents, stoneSpots }, solid, trees) {
  const loader = new GLTFLoader(manager);
  const load = names => Promise.all(names.map(n => loader.loadAsync(NATURE + n)));
  const [pines, stones] = await Promise.all([
    load(['tree_pineTallA_detailed.glb', 'tree_pineTallB_detailed.glb', 'tree_pineTallC_detailed.glb', 'tree_pineTallD_detailed.glb']),
    load(['stone_smallA.glb', 'stone_smallD.glb', 'stone_smallG.glb', 'rock_smallB.glb']),
  ]);
  const prep = gltf => {
    const model = gltf.scene;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box = new THREE.Box3().setFromObject(model);
    return { model, height: box.max.y - box.min.y };
  };
  const pineTpls = pines.map(prep);
  const stoneTpls = stones.map(prep);

  const place = (tpl, x, y, z, targetH, parent, sway) => {
    const clone = tpl.model.clone(true);
    clone.scale.setScalar(targetH / tpl.height);
    clone.position.set(x, y, z);
    clone.rotation.y = Math.random() * Math.PI * 2;
    clone.userData.windPhase = Math.random() * Math.PI * 2;
    parent.add(clone);
    clone.traverse(o => { if (o.isMesh) solid.push(o); });
    if (sway) trees.push(clone);
    return clone;
  };

  for (const s of pineSpots) {
    place(pineTpls[Math.floor(Math.random() * pineTpls.length)], s.x, s.y, s.z, s.h, scene, true);
  }
  for (const parent of isleParents) {
    place(pineTpls[Math.floor(Math.random() * pineTpls.length)], 0, 0.6, 0, 4.5 + Math.random() * 2, parent, true);
  }
  for (const s of stoneSpots) {
    place(stoneTpls[Math.floor(Math.random() * stoneTpls.length)], s.x, s.y, s.z, s.h, scene, false);
  }
}

export const ISLAND_R = 38;   // радиус травяного острова
export const WALK_R = 41;     // дальше игрок не заходит (по пояс в воде)
export const WATER_Y = -0.45;

function rand(a, b) { return a + Math.random() * (b - a); }

function makeNoiseTexture(size, base, fleck, count, repeat) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = rand(0.08, 0.32);
    ctx.fillStyle = fleck;
    const r = rand(0.5, 3.5);
    ctx.fillRect(Math.random() * size, Math.random() * size, r, rand(1, 8));
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat, repeat);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeLeafTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  const gradient = ctx.createLinearGradient(10, 54, 52, 8);
  gradient.addColorStop(0, '#234f22');
  gradient.addColorStop(1, '#75a84a');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(32, 3);
  ctx.bezierCurveTo(59, 16, 57, 43, 32, 60);
  ctx.bezierCurveTo(7, 43, 5, 16, 32, 3);
  ctx.fill();
  ctx.strokeStyle = 'rgba(210,235,150,.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(32, 57); ctx.lineTo(32, 9); ctx.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Высота земли: плоский остров, за краем — пологий спуск в воду
export function groundHeight(x, z) {
  const r = Math.hypot(x, z);
  const yardBlend = THREE.MathUtils.smoothstep(r, 12, 28);
  const rolling = (
    Math.sin(x * 0.13) * 0.72 +
    Math.cos(z * 0.16) * 0.56 +
    Math.sin((x + z) * 0.075) * 0.5
  );
  const ridgeA = Math.exp(-((x + 24) ** 2 / 150 + (z + 5) ** 2 / 210)) * 5.8;
  const ridgeB = Math.exp(-((x - 22) ** 2 / 180 + (z + 19) ** 2 / 130)) * 4.4;
  const ridgeC = Math.exp(-((x + 3) ** 2 / 170 + (z - 30) ** 2 / 100)) * 3.6;
  const terrain = (rolling + ridgeA + ridgeB + ridgeC) * yardBlend;
  if (r < ISLAND_R) return terrain;
  return terrain - (r - ISLAND_R) * 0.42;
}

// Большие камни, на которые можно залезть (заполняется в buildWorld)
const climbRocks = [];

// Высота поверхности с учётом камней: на вершине камня можно стоять
export function heightAt(x, z) {
  let h = groundHeight(x, z);
  for (const rk of climbRocks) {
    const d = Math.hypot(x - rk.x, z - rk.z);
    if (d < rk.r * 0.85) h = Math.max(h, rk.top);
  }
  return h;
}

export function buildWorld(scene, loadingManager = undefined) {
  scene.background = new THREE.Color(0x4a5ca6);
  scene.fog = new THREE.Fog(0xb9d2df, 74, 245);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(280, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x343b88) },
        horizonColor: { value: new THREE.Color(0xa7d5e4) },
      },
      vertexShader: 'varying vec3 vWorld; void main(){ vec4 w=modelMatrix*vec4(position,1.0); vWorld=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }',
      fragmentShader: 'varying vec3 vWorld; uniform vec3 topColor; uniform vec3 horizonColor; void main(){ float h=clamp(normalize(vWorld).y*.9+.18,0.,1.); gl_FragColor=vec4(mix(horizonColor,topColor,pow(h,.72)),1.); }',
    })
  );
  scene.add(sky);

  // свет
  const hemi = new THREE.HemisphereLight(0xcfe5f2, 0x263646, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe8ca, 1.45);
  sun.position.set(-34, 58, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
  sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
  sun.shadow.camera.far = 150;
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 5;
  scene.add(sun);

  const solid = []; // препятствия, о которые останавливаются пули
  const textureLoader = new THREE.TextureLoader();
  function tiledTexture(url, x, y = x) {
    const texture = textureLoader.load(url);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(x, y);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }

  // остров (с юбкой, уходящей под воду); PlaneGeometry — чтобы было плоское плато
  const groundGeo = new THREE.PlaneGeometry((ISLAND_R + 14) * 2, (ISLAND_R + 14) * 2, 80, 80);
  groundGeo.rotateX(-Math.PI / 2);
  const pos = groundGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, groundHeight(pos.getX(i), pos.getZ(i)));
  }
  groundGeo.computeVertexNormals();
  const groundMap = tiledTexture('assets/textures/snow-ground.png', 18);
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
    color: 0xd9e4e9, map: groundMap, bumpMap: groundMap, bumpScale: 0.055,
    roughness: 0.96, metalness: 0,
  }));
  ground.receiveShadow = true;
  scene.add(ground);
  solid.push(ground);

  // frozen sea
  const waterGeo = new THREE.PlaneGeometry(600, 600, 90, 90);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshPhongMaterial({
    color: 0x4ba8cf, transparent: true, opacity: 0.88, shininess: 170, specular: 0xe4fbff,
  }));
  water.position.y = WATER_Y;
  scene.add(water);
  const waterBase = waterGeo.attributes.position.array.slice();

  // Sparse frozen grass around the authored POI (one draw call).
  const bladeGeo = new THREE.PlaneGeometry(0.055, 0.22);
  bladeGeo.translate(0, 0.11, 0);
  const bladeMat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 1 });
  const COUNT = 3200;
  const grass = new THREE.InstancedMesh(bladeGeo, bladeMat, COUNT);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const green = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    let x, z, r;
    do {
      const a = Math.random() * Math.PI * 2;
      r = Math.sqrt(Math.random()) * (ISLAND_R - 1);
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    } while ((Math.abs(x) < 15 && z > -20 && z < 21) || (Math.abs(z - 2) < 7 && Math.abs(x) < 31));
    v.set(x, groundHeight(x, z), z);
    q.setFromAxisAngle(up, Math.random() * Math.PI);
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), rand(-0.25, 0.25));
    q.multiply(tilt);
    sc.setScalar(rand(0.55, 1.05));
    m.compose(v, q, sc);
    grass.setMatrixAt(i, m);
    grass.setColorAt(i, green.setHSL(rand(0.48, 0.58), rand(0.08, 0.22), rand(0.62, 0.82)));
  }
  scene.add(grass);

  // деревья: конусный ствол с ветками, многослойная крона, коллайдер
  const colliders = []; // {x, z, r} — сквозь них нельзя пройти
  const trees = [];
  const barkMap = makeNoiseTexture(192, '#4b3322', '#b07b47', 1700, 3);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5839, map: barkMap, roughness: 1 });
  const branchMat = new THREE.MeshStandardMaterial({ color: 0x65472f, map: barkMap, roughness: 1 });
  const leafGeo = new THREE.PlaneGeometry(0.34, 0.5);
  const leafMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: makeLeafTexture(), roughness: 0.9, metalness: 0,
    side: THREE.DoubleSide, transparent: true, alphaTest: 0.35,
  });

  function branchBetween(group, from, to, radius, material) {
    const delta = new THREE.Vector3().subVectors(to, from);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.58, radius, delta.length(), 7), material);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.clone().normalize());
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  }

  function makeTree(x, z, scale = 1, addCollider = true) {
    const t = new THREE.Group();
    const leafCentres = [];
    const h = rand(4.1, 5.6) * scale;
    const trunkGeo = new THREE.CylinderGeometry(0.13 * scale, 0.39 * scale, h, 12, 7);
    const p = trunkGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / h + 0.5;
      const wobble = 1 + Math.sin(y * 19 + i * 1.7) * 0.035;
      p.setX(i, p.getX(i) * wobble);
      p.setZ(i, p.getZ(i) * wobble);
    }
    trunkGeo.computeVertexNormals();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    t.add(trunk);

    // Radial branches and asymmetric leaf clusters create a natural silhouette.
    const branchCount = 7;
    for (let i = 0; i < branchCount; i++) {
      const a = (i / branchCount) * Math.PI * 2 + rand(-0.35, 0.35);
      const baseY = h * rand(0.48, 0.84);
      const length = rand(1.15, 2.05) * scale * (1.12 - baseY / h * 0.35);
      const from = new THREE.Vector3(0, baseY, 0);
      const tip = new THREE.Vector3(Math.cos(a) * length, baseY + rand(0.35, 0.85) * scale, Math.sin(a) * length);
      branchBetween(t, from, tip, 0.095 * scale, branchMat);
      const twigTip = tip.clone().add(new THREE.Vector3(Math.cos(a + rand(-0.5, 0.5)) * 0.55 * scale, rand(0.3, 0.7) * scale, Math.sin(a + rand(-0.5, 0.5)) * 0.55 * scale));
      branchBetween(t, tip.clone().lerp(from, 0.22), twigTip, 0.052 * scale, branchMat);

      leafCentres.push(tip, twigTip);
    }
    leafCentres.push(new THREE.Vector3(0, h + 0.38 * scale, 0));
    const leavesPerCluster = 18;
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, leafCentres.length * leavesPerCluster);
    const lm = new THREE.Matrix4();
    const lq = new THREE.Quaternion();
    const lp = new THREE.Vector3();
    const ls = new THREE.Vector3();
    const le = new THREE.Euler();
    const lc = new THREE.Color();
    let leafIndex = 0;
    for (const centre of leafCentres) {
      for (let j = 0; j < leavesPerCluster; j++) {
        lp.copy(centre).add(new THREE.Vector3(rand(-0.68, 0.68), rand(-0.42, 0.52), rand(-0.68, 0.68)).multiplyScalar(scale));
        le.set(rand(-Math.PI, Math.PI), rand(-Math.PI, Math.PI), rand(-Math.PI, Math.PI));
        lq.setFromEuler(le);
        const s = rand(0.75, 1.3) * scale;
        ls.set(s, s, s);
        lm.compose(lp, lq, ls);
        leaves.setMatrixAt(leafIndex, lm);
        leaves.setColorAt(leafIndex, lc.setHSL(rand(0.27, 0.34), rand(0.38, 0.62), rand(0.23, 0.42)));
        leafIndex++;
      }
    }
    leaves.instanceMatrix.needsUpdate = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    leaves.castShadow = true;
    leaves.receiveShadow = true;
    t.add(leaves);
    t.rotation.y = rand(0, Math.PI * 2);
    t.position.set(x, groundHeight(x, z), z);
    t.userData.windPhase = rand(0, Math.PI * 2);
    scene.add(t);
    trees.push(t);
    solid.push(trunk);
    if (addCollider) colliders.push({ x, z, r: 0.5 * scale });
    return t;
  }

  const pineNeedleMat = new THREE.MeshStandardMaterial({ color: 0x173f38, roughness: 0.92 });
  const pineNeedleLightMat = new THREE.MeshStandardMaterial({ color: 0x24584b, roughness: 0.9 });
  const pineSnowMat = new THREE.MeshStandardMaterial({ color: 0xdce8ed, roughness: 0.94 });
  const pineLayerGeo = new THREE.ConeGeometry(1, 1, 11, 2, true);
  function makePine(x, z, scale = 1, addCollider = true) {
    const t = new THREE.Group();
    const h = rand(5.8, 8.6) * scale;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.26 * scale, h, 9), trunkMat);
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    t.add(trunk);
    for (let i = 0; i < 6; i++) {
      const k = i / 5;
      const radius = (1.85 - k * 1.3) * scale;
      const layerH = (1.7 - k * 0.5) * scale;
      const y = h * (0.3 + k * 0.62);
      const needles = new THREE.Mesh(pineLayerGeo, i % 2 ? pineNeedleLightMat : pineNeedleMat);
      needles.scale.set(radius, layerH, radius);
      needles.position.y = y;
      needles.castShadow = true;
      needles.receiveShadow = true;
      t.add(needles);
      const snow = new THREE.Mesh(pineLayerGeo, pineSnowMat);
      snow.scale.set(radius * 1.03, layerH * 0.26, radius * 1.03);
      snow.position.y = y + layerH * 0.38;
      snow.castShadow = true;
      t.add(snow);
    }
    t.rotation.y = rand(0, Math.PI * 2);
    t.position.set(x, groundHeight(x, z), z);
    t.userData.windPhase = rand(0, Math.PI * 2);
    scene.add(t);
    trees.push(t);
    solid.push(trunk);
    if (addCollider) colliders.push({ x, z, r: 0.5 * scale });
    return t;
  }

  // Основной лес — полноценные GLB-модели Kenney (грузятся асинхронно),
  // коллайдеры стволов ставим сразу по размеченным местам.
  const pineSpots = [];
  for (let i = 0; i < 30; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(20, ISLAND_R - 2);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    pineSpots.push({ x, y: groundHeight(x, z), z, h: rand(5.4, 9.2) });
    colliders.push({ x, z, r: 0.4 });
  }
  // кусты
  const bushMat = new THREE.MeshStandardMaterial({ color: 0x587c70, roughness: 0.95, flatShading: true });
  for (let i = 0; i < 10; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(8, ISLAND_R - 2);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.35, 0.7), 1), bushMat);
    bush.position.set(Math.cos(a) * r, groundHeight(Math.cos(a) * r, Math.sin(a) * r) + 0.25, Math.sin(a) * r);
    bush.scale.y = 0.7;
    bush.castShadow = true;
    scene.add(bush);
  }

  // маленькие островки с деревьями (как на референсе)
  const isleMat = new THREE.MeshStandardMaterial({ color: 0xddebf1, roughness: 0.92 });
  const sandMat = new THREE.MeshStandardMaterial({ color: 0x77b8cf, roughness: 0.42, metalness: 0.08 });
  const isleParents = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + rand(-0.3, 0.3);
    const d = rand(60, 95);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const isle = new THREE.Group();
    const top = new THREE.Mesh(new THREE.CylinderGeometry(rand(3, 5), rand(4, 6.5), 1.2, 10), isleMat);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(rand(4, 6), rand(5, 8), 0.8, 10), sandMat);
    base.position.y = -0.9;
    isle.add(top, base);
    isle.position.set(x, WATER_Y + 0.5, z);
    scene.add(isle);
    isleParents.push(isle);
  }

  // большие камни-валуны: на них можно запрыгнуть (плоская вершина)
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7795a8, roughness: 0.78, flatShading: true });
  const rockTopMat = new THREE.MeshStandardMaterial({ color: 0xe7f0f4, roughness: 0.9, flatShading: true });
  climbRocks.length = 0;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + rand(-0.3, 0.3);
    const rr = rand(9, 30);
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    const radius = rand(1.1, 2.0);
    const top = rand(0.9, 1.25); // достижимо с прыжка (~1.3 м)
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.8, radius, top, 7), rockMat);
    rock.position.set(x, groundHeight(x, z) + top / 2, z);
    rock.rotation.y = rand(0, Math.PI);
    rock.castShadow = true;
    rock.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.55, radius * 0.8, 0.22, 7), rockTopMat);
    cap.position.y = top / 2 + 0.1;
    rock.add(cap);
    scene.add(rock);
    solid.push(rock);
    climbRocks.push({ x, z, r: radius, top: top + 0.2 });
  }
  // мелкие декоративные камни — модели Kenney (асинхронно)
  const stoneSpots = [];
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(10, 70);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    stoneSpots.push({ x, y: Math.max(groundHeight(x, z), WATER_Y), z, h: rand(0.25, 0.65) });
  }

  // ---------- Frosted industrial POI ----------
  const asphaltMap = tiledTexture('assets/textures/asphalt.png', 9, 18);
  const concreteMap = tiledTexture('assets/textures/concrete.png', 2.5);
  const paintedMetalMap = tiledTexture('assets/textures/painted-metal.png', 3, 1.5);
  const asphaltMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: asphaltMap, bumpMap: asphaltMap, bumpScale: 0.045, roughness: 0.76, metalness: 0.04 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xf1f4f6, map: concreteMap, bumpMap: concreteMap, bumpScale: 0.035, roughness: 0.78 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x75869a, map: paintedMetalMap, roughness: 0.4, metalness: 0.68 });
  const orangeMetalMat = new THREE.MeshStandardMaterial({ color: 0xd56a26, roughness: 0.46, metalness: 0.48 });
  const blueMetalMat = new THREE.MeshStandardMaterial({ color: 0xb5d1e4, map: paintedMetalMap, roughness: 0.42, metalness: 0.5 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x9b6a3c, roughness: 0.8 });
  const roadMarkMat = new THREE.MeshBasicMaterial({ color: 0xf5cd55 });
  const iceMat = new THREE.MeshPhysicalMaterial({
    color: 0x64c9ee, roughness: 0.18, metalness: 0.02,
    transparent: true, opacity: 0.88, transmission: 0.08, thickness: 1.5,
  });

  function addBox(size, position, material, parent = scene) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.copy(position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    solid.push(mesh);
    return mesh;
  }

  // Asphalt roads and an open combat yard establish strong authored lines.
  const roadA = new THREE.Mesh(new THREE.PlaneGeometry(25, 76), asphaltMat);
  roadA.rotation.x = -Math.PI / 2;
  roadA.position.set(0, 0.045, 0);
  roadA.receiveShadow = true;
  scene.add(roadA);
  const roadB = new THREE.Mesh(new THREE.PlaneGeometry(74, 14), asphaltMat);
  roadB.rotation.x = -Math.PI / 2;
  roadB.position.set(0, 0.052, 3);
  roadB.receiveShadow = true;
  scene.add(roadB);
  for (let z = -32; z <= 32; z += 7) addBox(new THREE.Vector3(0.16, 0.025, 3.5), new THREE.Vector3(0, 0.075, z), roadMarkMat);
  for (let x = -30; x <= 30; x += 8) addBox(new THREE.Vector3(4, 0.026, 0.14), new THREE.Vector3(x, 0.08, 3), roadMarkMat);
  for (const x of [-12.7, 12.7]) addBox(new THREE.Vector3(0.32, 0.26, 48), new THREE.Vector3(x, 0.12, -8), concreteMat);

  // Open warehouse on the right, matching the close foreground framing of the reference.
  // Эти боксы остаются невидимой коллизией; внешний вид ниже заменяется
  // полноценной GLB-моделью промышленного ангара.
  const warehouseSolidStart = solid.length;
  addBox(new THREE.Vector3(15, 0.3, 14), new THREE.Vector3(17, 0.15, 5), concreteMat);
  addBox(new THREE.Vector3(0.45, 5.3, 14), new THREE.Vector3(24.25, 2.65, 5), concreteMat);
  addBox(new THREE.Vector3(15, 5.3, 0.42), new THREE.Vector3(17, 2.65, -1.8), concreteMat);
  addBox(new THREE.Vector3(15, 5.3, 0.42), new THREE.Vector3(17, 2.65, 11.8), concreteMat);
  addBox(new THREE.Vector3(15.7, 0.42, 14.7), new THREE.Vector3(17, 5.35, 5), darkMetalMat);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x16232d, roughness: 0.5, metalness: 0.52 });
  addBox(new THREE.Vector3(0.08, 3.5, 5.2), new THREE.Vector3(24.02, 2.0, 5), doorMat);
  for (let y = 0.55; y < 4.9; y += 0.72) addBox(new THREE.Vector3(0.12, 0.055, 13.5), new THREE.Vector3(23.98, y, 5), darkMetalMat);
  for (const z of [0.2, 9.8]) {
    const windowMat = new THREE.MeshBasicMaterial({ color: 0x75d9ff, transparent: true, opacity: 0.82 });
    addBox(new THREE.Vector3(4.2, 1.2, 0.08), new THREE.Vector3(17, 3.55, z < 5 ? -1.56 : 11.56), windowMat);
  }
  for (const z of [-1.5, 5, 11.5]) {
    addBox(new THREE.Vector3(0.38, 5.4, 0.38), new THREE.Vector3(9.75, 2.7, z), orangeMetalMat);
    colliders.push({ x: 9.75, z, r: 0.38 });
  }
  // Roof edge and warning stripe make the foreground structure read at a glance.
  addBox(new THREE.Vector3(0.3, 0.5, 14.8), new THREE.Vector3(9.62, 5.08, 5), orangeMetalMat);
  for (let z = -1; z <= 11; z += 1.4) addBox(new THREE.Vector3(0.05, 0.16, 0.72), new THREE.Vector3(9.43, 0.48, z), roadMarkMat);
  for (const z of [-1, 3, 7, 11]) colliders.push({ x: 24.1, z, r: 0.72 });
  for (const x of [12, 17, 22]) {
    const lamp = new THREE.PointLight(0x9ee8ff, 1.5, 8, 2);
    lamp.position.set(x, 4.85, 5);
    scene.add(lamp);
    const fixture = addBox(new THREE.Vector3(1.2, 0.08, 0.22), new THREE.Vector3(x, 5.05, 5), new THREE.MeshBasicMaterial({ color: 0xbff5ff }));
    fixture.castShadow = false;
  }
  for (let i = warehouseSolidStart; i < solid.length; i++) solid[i].visible = false;

  function makeContainer(x, z, colorMat, rotation = 0) {
    const g = new THREE.Group();
    g.position.set(x, 1.25, z);
    g.rotation.y = rotation;
    const shell = addBox(new THREE.Vector3(5.8, 2.5, 2.35), new THREE.Vector3(), colorMat, g);
    for (let i = -4; i <= 4; i++) {
      const rib = addBox(new THREE.Vector3(0.055, 2.25, 2.39), new THREE.Vector3(i * 0.62, 0, 0), darkMetalMat, g);
      rib.castShadow = false;
    }
    scene.add(g);
    colliders.push({ x, z, r: 1.65 });
    return shell;
  }
  makeContainer(-14, -8.5, blueMetalMat, 0.08);
  makeContainer(-12, -12, orangeMetalMat, -0.05);
  makeContainer(18, 8, blueMetalMat, Math.PI / 2);

  // Player-built style wooden ramp with metal side rails.
  const ramp = new THREE.Group();
  ramp.position.set(5.8, 0.1, 8.2);
  ramp.rotation.x = -0.48;
  const rampDeck = addBox(new THREE.Vector3(3.6, 0.18, 8), new THREE.Vector3(0, 0, 0), woodMat, ramp);
  for (let z = -3.4; z <= 3.4; z += 0.85) addBox(new THREE.Vector3(3.7, 0.16, 0.1), new THREE.Vector3(0, 0.14, z), concreteMat, ramp);
  for (const x of [-1.75, 1.75]) addBox(new THREE.Vector3(0.12, 0.22, 8.2), new THREE.Vector3(x, 0.28, 0), darkMetalMat, ramp);
  scene.add(ramp);
  solid.push(rampDeck);
  colliders.push({ x: 5.8, z: 8.2, r: 1.15 });

  // Delivery truck, forklift and pipe stacks make the yard read as a real place.
  const truck = new THREE.Group();
  truck.position.set(-3.5, 0.15, -12.5);
  addBox(new THREE.Vector3(7.2, 0.35, 2.5), new THREE.Vector3(0, 1.15, 0), darkMetalMat, truck);
  addBox(new THREE.Vector3(4.7, 2.35, 2.4), new THREE.Vector3(-0.8, 2.35, 0), concreteMat, truck);
  addBox(new THREE.Vector3(1.9, 1.75, 2.35), new THREE.Vector3(2.65, 1.9, 0), orangeMetalMat, truck);
  const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.28, 14);
  for (const x of [-2.2, 0.1, 2.55]) for (const z of [-1.28, 1.28]) {
    const wheel = new THREE.Mesh(wheelGeo, darkMetalMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(x, 0.62, z);
    wheel.castShadow = true;
    truck.add(wheel);
  }
  scene.add(truck);
  colliders.push({ x: -3.5, z: -12.5, r: 2.2 });

  const forklift = new THREE.Group();
  forklift.position.set(3.4, 0.15, -4.8);
  addBox(new THREE.Vector3(2.2, 0.7, 1.5), new THREE.Vector3(0, 0.65, 0), orangeMetalMat, forklift);
  addBox(new THREE.Vector3(1.3, 1.7, 1.45), new THREE.Vector3(-0.25, 1.6, 0), orangeMetalMat, forklift);
  for (const z of [-0.55, 0.55]) addBox(new THREE.Vector3(2.5, 0.1, 0.12), new THREE.Vector3(2.1, 0.35, z), darkMetalMat, forklift);
  for (const z of [-0.72, 0.72]) addBox(new THREE.Vector3(0.16, 3.1, 0.16), new THREE.Vector3(0.95, 1.7, z), darkMetalMat, forklift);
  scene.add(forklift);
  colliders.push({ x: 3.4, z: -4.8, r: 1.05 });

  const pipeGeo = new THREE.CylinderGeometry(0.38, 0.38, 3.6, 18, 1, true);
  for (let i = 0; i < 6; i++) {
    const pipe = new THREE.Mesh(pipeGeo, darkMetalMat);
    pipe.rotation.z = Math.PI / 2;
    pipe.position.set(-8 + (i % 2) * 0.05, 0.48 + Math.floor(i / 2) * 0.68, -1.6 + (i % 2) * 0.82);
    pipe.castShadow = true;
    scene.add(pipe);
    solid.push(pipe);
  }

  // Large translucent ice formations create vertical layers around the POI.
  const iceGeo = new THREE.DodecahedronGeometry(1, 1);
  const iceSpots = [
    [-25, -4, 6.5, 5.4, 5.8], [-29, 8, 5.2, 4.2, 4.8],
    [-20, 17, 4.8, 3.8, 5.2], [24, -18, 5.4, 4.2, 4.8],
    [9, 29, 4.2, 3.4, 4.5], [-8, 31, 3.8, 3.1, 4.2],
  ];
  for (const [x, z, sx, sy, sz] of iceSpots) {
    const baseY = groundHeight(x, z);
    const ice = new THREE.Mesh(iceGeo, iceMat);
    ice.scale.set(sx, sy, sz);
    ice.position.set(x, baseY + sy * 0.68, z);
    ice.rotation.set(rand(-0.12, 0.12), rand(0, Math.PI), rand(-0.12, 0.12));
    ice.castShadow = true;
    ice.receiveShadow = true;
    scene.add(ice);
    solid.push(ice);
    const cap = new THREE.Mesh(iceGeo, pineSnowMat);
    cap.scale.set(sx * 0.86, sy * 0.22, sz * 0.86);
    cap.position.set(x, baseY + sy * 1.32, z);
    cap.rotation.copy(ice.rotation);
    cap.castShadow = true;
    scene.add(cap);
    solid.push(cap);
    colliders.push({ x, z, r: Math.min(sx, sz) * 0.62 });
  }

  // ---------- Author-made CC0 assets (Kenney) ----------
  // Процедурные блоки оставлены как основа коллизий, а читаемый силуэт локации
  // теперь формируют готовые GLB-модели зданий, труб, ёмкостей и деревьев.
  const assetRoot = new THREE.Group();
  assetRoot.name = 'authored-environment-assets';
  scene.add(assetRoot);
  const gltfLoader = new GLTFLoader(loadingManager);
  const authoredNeedleMap = makeNoiseTexture(256, '#315f54', '#9bb8ad', 2400, 5);

  function prepareAsset(root, spec) {
    root.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const sourceMaterials = Array.isArray(o.material) ? o.material : [o.material];
      const materials = sourceMaterials.map(source => {
        if (!source) return null;
        const material = source.clone();
        if ('envMapIntensity' in material) material.envMapIntensity = 0.55;
        if (spec.tree && material.color) {
          const hsl = {};
          material.color.getHSL(hsl);
          const foliage = hsl.h > 0.18 && hsl.h < 0.58 && hsl.s > 0.08;
          material.color.setHex(0xffffff);
          material.map = foliage ? authoredNeedleMap : barkMap;
          material.bumpMap = material.map;
          material.bumpScale = foliage ? 0.028 : 0.045;
          material.roughness = foliage ? 0.9 : 0.96;
          material.metalness = 0;
        }
        if (material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.anisotropy = 8;
        }
        material.needsUpdate = true;
        return material;
      }).filter(Boolean);
      o.material = Array.isArray(o.material) ? materials : materials[0];
      solid.push(o);
    });
  }

  function placeAsset(source, spec) {
    const model = source.clone(true);
    const originalBox = new THREE.Box3().setFromObject(model);
    const originalHeight = Math.max(0.001, originalBox.max.y - originalBox.min.y);
    const scale = spec.height / originalHeight;
    model.scale.setScalar(scale);
    model.rotation.y = spec.rotation || 0;
    model.position.set(spec.x, 0, spec.z);
    model.updateMatrixWorld(true);
    const placedBox = new THREE.Box3().setFromObject(model);
    model.position.y += groundHeight(spec.x, spec.z) - placedBox.min.y;
    model.updateMatrixWorld(true);
    model.userData.windPhase = rand(0, Math.PI * 2);
    prepareAsset(model, spec);
    assetRoot.add(model);
    if (spec.tree) trees.push(model);
    if (spec.radius) colliders.push({ x: spec.x, z: spec.z, r: spec.radius });
  }

  function loadAsset(file, placements) {
    gltfLoader.load(file, gltf => {
      for (const spec of placements) placeAsset(gltf.scene, spec);
    }, undefined, error => console.warn('Не удалось загрузить GLB окружения:', file, error));
  }

  const naturePath = 'assets/vendor/kenney-nature-kit/Models/GLTF format/';
  loadAsset(naturePath + 'tree_pineTallA_detailed.glb', [
    { x: -20, z: -10, height: 8.2, rotation: 1.5, radius: 0.5, tree: true },
    { x: 17, z: -14, height: 8.7, rotation: 2.8, radius: 0.52, tree: true },
    { x: -17, z: -18, height: 8.6, rotation: 0.9, radius: 0.52, tree: true },
    { x: 17, z: -19, height: 8.1, rotation: 2.4, radius: 0.5, tree: true },
    { x: -19, z: 16, height: 9.2, rotation: 1.8, radius: 0.55, tree: true },
    { x: 21, z: 18, height: 8.8, rotation: 0.2, radius: 0.53, tree: true },
    { x: -33, z: -18, height: 9.4, rotation: 0.4, radius: 0.55, tree: true },
    { x: -29, z: -25, height: 7.8, rotation: 2.1, radius: 0.48, tree: true },
    { x: -31, z: 17, height: 9.1, rotation: 1.2, radius: 0.55, tree: true },
    { x: 31, z: 24, height: 8.7, rotation: 2.8, radius: 0.52, tree: true },
    { x: 34, z: -13, height: 9.7, rotation: 0.8, radius: 0.56, tree: true },
    { x: 21, z: 32, height: 8.2, rotation: 1.7, radius: 0.5, tree: true },
  ]);
  loadAsset(naturePath + 'tree_pineRoundC.glb', [
    { x: -16, z: 25, height: 6.8, rotation: 2.6, radius: 0.47, tree: true },
    { x: 15, z: 25, height: 6.4, rotation: 0.5, radius: 0.45, tree: true },
    { x: -25, z: 8, height: 7.1, rotation: 1.4, radius: 0.48, tree: true },
    { x: 27, z: -8, height: 6.7, rotation: 2.1, radius: 0.46, tree: true },
    { x: -24, z: -31, height: 6.6, rotation: 0.2, radius: 0.46, tree: true },
    { x: -18, z: 31, height: 6.2, rotation: 1.1, radius: 0.44, tree: true },
    { x: 26, z: -28, height: 6.8, rotation: 2.5, radius: 0.47, tree: true },
    { x: 33, z: 9, height: 6.4, rotation: 0.7, radius: 0.45, tree: true },
    { x: 17, z: -33, height: 5.9, rotation: 2.9, radius: 0.43, tree: true },
    { x: -35, z: 4, height: 6.9, rotation: 1.9, radius: 0.48, tree: true },
  ]);
  loadAsset(naturePath + 'rock_largeB.glb', [
    { x: -22, z: 23, height: 2.6, rotation: 0.7, radius: 0.9 },
    { x: 28, z: 17, height: 2.1, rotation: 2.2, radius: 0.75 },
    { x: 20, z: -27, height: 2.8, rotation: 1.4, radius: 0.95 },
    { x: -31, z: -7, height: 2.3, rotation: 2.8, radius: 0.8 },
  ]);

  const industrialPath = 'assets/vendor/kenney-city-industrial/Models/GLB format/';
  // Главный ангар теперь является настоящей моделью, а не набором BoxGeometry.
  loadAsset(industrialPath + 'building-s.glb', [
    { x: 17, z: 5, height: 6.2, rotation: Math.PI / 2, radius: 5.4 },
    { x: -23, z: -15, height: 5.7, rotation: 0.15, radius: 4.5 },
  ]);
  // Небольшие ангары и дома образуют читаемые кварталы вокруг двора.
  loadAsset(industrialPath + 'building-j.glb', [
    { x: -23, z: 19, height: 5.1, rotation: 0.35, radius: 3.2 },
    { x: 24, z: 18, height: 5.4, rotation: -0.5, radius: 3.3 },
  ]);
  loadAsset(industrialPath + 'building-h.glb', [
    { x: -20, z: -24, height: 5.2, rotation: 1.15, radius: 3.1 },
    { x: 22, z: -24, height: 5.0, rotation: -1.0, radius: 3.0 },
  ]);
  loadAsset(industrialPath + 'building-k.glb', [
    { x: -24, z: 2, height: 6.1, rotation: Math.PI / 2, radius: 4.1 },
    { x: 24, z: -7, height: 5.8, rotation: -Math.PI / 2, radius: 4.0 },
  ]);
  loadAsset(industrialPath + 'building-b.glb', [
    { x: -27, z: -22, height: 8.4, rotation: 0.35, radius: 3.1 },
    { x: 28, z: 21, height: 7.7, rotation: -0.8, radius: 2.9 },
  ]);
  loadAsset(industrialPath + 'building-q.glb', [
    { x: -29, z: 15, height: 7.2, rotation: 1.1, radius: 2.8 },
    { x: 29, z: -20, height: 7.9, rotation: -1.2, radius: 3.0 },
  ]);
  loadAsset(industrialPath + 'building-l.glb', [
    { x: -18, z: -29, height: 6.8, rotation: 0.1, radius: 2.6 },
    { x: 19, z: 29, height: 6.5, rotation: Math.PI, radius: 2.5 },
  ]);
  loadAsset(industrialPath + 'detail-tank.glb', [
    { x: 6.8, z: -10.6, height: 3.4, rotation: 0.3, radius: 0.8 },
    { x: 8.7, z: -11.2, height: 2.7, rotation: -0.2, radius: 0.7 },
  ]);
  loadAsset(industrialPath + 'chimney-medium.glb', [
    { x: 22.4, z: -0.6, height: 5.8, rotation: 0, radius: 0.65 },
    { x: 20.9, z: -0.8, height: 4.4, rotation: 0, radius: 0.55 },
  ]);

  // Light snowfall adds depth without post-processing or external assets.
  const snowGeo = new THREE.BufferGeometry();
  const snowPositions = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    snowPositions[i * 3] = rand(-65, 65);
    snowPositions[i * 3 + 1] = rand(1, 34);
    snowPositions[i * 3 + 2] = rand(-65, 65);
  }
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.075, transparent: true, opacity: 0.82, depthWrite: false }));
  scene.add(snow);

  // горы вдали
  const mtnMat = new THREE.MeshStandardMaterial({ color: 0xa8bfce, roughness: 0.95, flatShading: true });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + rand(-0.2, 0.2);
    const d = rand(150, 210);
    const h = rand(28, 55);
    const mtn = new THREE.Mesh(new THREE.ConeGeometry(rand(22, 40), h, 6), mtnMat);
    mtn.position.set(Math.cos(a) * d, WATER_Y + h / 2 - rand(2, 8), Math.sin(a) * d);
    mtn.rotation.y = Math.random();
    scene.add(mtn);
  }

  // облака
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const clouds = [];
  for (let i = 0; i < 8; i++) {
    const c = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(rand(3, 6), 8, 6), cloudMat);
      puff.position.set(j * rand(3, 5) - 4, rand(-1, 1), rand(-2, 2));
      puff.scale.y = 0.55;
      c.add(puff);
    }
    c.position.set(rand(-150, 150), rand(35, 60), rand(-150, 150));
    scene.add(c);
    clouds.push(c);
  }

  scatterNature(scene, loadingManager, { pineSpots, isleParents, stoneSpots }, solid, trees)
    .catch(err => console.error('Не удалось загрузить природу Kenney:', err));

  return { water, waterBase, clouds, trees, snow, solid, sun, colliders, rocks: climbRocks, assetRoot };
}

// Анимация воды и облаков
export function updateWorld(env, t) {
  const pos = env.water.geometry.attributes.position;
  const base = env.waterBase;
  for (let i = 0; i < pos.count; i++) {
    const x = base[i * 3], z = base[i * 3 + 2];
    pos.setY(i, Math.sin(x * 0.25 + t * 1.2) * 0.07 + Math.cos(z * 0.2 + t * 0.9) * 0.07);
  }
  pos.needsUpdate = true;
  for (const c of env.clouds) {
    c.position.x += 0.6 * 0.016;
    if (c.position.x > 180) c.position.x = -180;
  }
  for (const tree of env.trees) {
    const sway = Math.sin(t * 0.65 + tree.userData.windPhase) * 0.008;
    tree.rotation.z = sway;
    tree.rotation.x = sway * 0.55;
  }
  env.snow.rotation.y = t * 0.012;
  env.snow.position.y = -((t * 0.55) % 4);
}
