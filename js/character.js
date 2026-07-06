// Персонажи-люди (mixamo-скелет) с общей библиотекой анимаций.
// Любая mixamo-модель получает весь набор движений и эмоций автоматически —
// чтобы добавить персонажа, достаточно дописать запись в CHARACTERS (url + rotY).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { buildGunMesh } from './weapons.js';
import { renderIcon } from './icons.js';
import { EliminationEffect } from './elimination.js';

const CDN = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r160/examples/models/gltf/';

export const CHARACTERS = {
  fiftyCent: {
    name: '50 Cent',
    url: 'fbx/50centbloodonthesand_-_50cent.glb',
    type: 'gltf',
    rotY: 0,
    bot: false,
    // У рига 50 Cent оси костей из Unreal/UE3 и не совпадают с Mixamo,
    // поэтому клипы не переносятся напрямую. Вместо этого скрытый
    // mixamo-скелет проигрывает клипы, а кости этой модели каждый кадр
    // повторяют НАПРАВЛЕНИЯ его сегментов — это не зависит от осей рига.
    liveRetarget: true,
    // C1_GunBone_R_075 у этого рига висит в 13 см от ладони — оружие
    // сажаем прямо на кость кисти (fallback в load), рукоять в кулак.
    rigMap: {
      C1_Pelvis_01: 'mixamorigHips',
      C1_Spine_02: 'mixamorigSpine', C1_Spine1_03: 'mixamorigSpine1', C1_Spine2_00: 'mixamorigSpine2',
      C1_Clavicle_L_044: 'mixamorigLeftShoulder', C1_UpperArm_L_045: 'mixamorigLeftArm',
      C1_Forearm_L_046: 'mixamorigLeftForeArm', C1_Hand_L_047: 'mixamorigLeftHand',
      ThumbBone01_L_049: 'mixamorigLeftHandThumb1', ThumbBone02_L_050: 'mixamorigLeftHandThumb2', ThumbBone03_L_051: 'mixamorigLeftHandThumb3',
      IndexFinger01_L_052: 'mixamorigLeftHandIndex1', IndexFinger02_L_053: 'mixamorigLeftHandIndex2', IndexFinger03_L_054: 'mixamorigLeftHandIndex3',
      MiddleFinger01_L_055: 'mixamorigLeftHandMiddle1', MiddleFinger02_L_056: 'mixamorigLeftHandMiddle2', MiddleFinger03_L_057: 'mixamorigLeftHandMiddle3',
      RingFinger01_L_058: 'mixamorigLeftHandRing1', RingFinger02_L_059: 'mixamorigLeftHandRing2', RingFinger03_L_060: 'mixamorigLeftHandRing3',
      littleFinger01_L_061: 'mixamorigLeftHandPinky1', littleFinger02_L_062: 'mixamorigLeftHandPinky2', littleFinger03_L_063: 'mixamorigLeftHandPinky3',
      C1_Clavicle_R_071: 'mixamorigRightShoulder', C1_UpperArm_R_072: 'mixamorigRightArm',
      C1_Forearm_R_073: 'mixamorigRightForeArm', C1_Hand_R_074: 'mixamorigRightHand',
      ThumbBone01_R_076: 'mixamorigRightHandThumb1', ThumbBone02_R_077: 'mixamorigRightHandThumb2', ThumbBone03_R_078: 'mixamorigRightHandThumb3',
      IndexFinger01_R_079: 'mixamorigRightHandIndex1', IndexFinger02_R_080: 'mixamorigRightHandIndex2', IndexFinger03_R_081: 'mixamorigRightHandIndex3',
      MiddleFinger01_R_082: 'mixamorigRightHandMiddle1', MiddleFinger02_R_083: 'mixamorigRightHandMiddle2', MiddleFinger03_R_084: 'mixamorigRightHandMiddle3',
      RingFinger01_R_085: 'mixamorigRightHandRing1', RingFinger02_R_086: 'mixamorigRightHandRing2', RingFinger03_R_087: 'mixamorigRightHandRing3',
      littleFinger01_R_088: 'mixamorigRightHandPinky1', littleFinger02_R_089: 'mixamorigRightHandPinky2', littleFinger03_R_090: 'mixamorigRightHandPinky3',
      C1_Thigh_L_0102: 'mixamorigLeftUpLeg', C1_Calf_L_0103: 'mixamorigLeftLeg',
      C1_Foot_L_0104: 'mixamorigLeftFoot', C1_Toe_L_0105: 'mixamorigLeftToeBase',
      C1_Thigh_R_0108: 'mixamorigRightUpLeg', C1_Calf_R_0109: 'mixamorigRightLeg',
      C1_Foot_R_0110: 'mixamorigRightFoot', C1_Toe_R_0111: 'mixamorigRightToeBase',
    },
  },
  importedFbx: {
    name: 'Импортированный персонаж',
    url: 'fbx/Black_Man.glb',
    type: 'gltf',
    rotY: Math.PI / 2,
    bot: false,
    retarget: true,
    limbConstraints: true,
    rigMap: {
      Man_15: 'mixamorigHips',
      Man_16: 'mixamorigSpine', Man_17: 'mixamorigSpine1', Man_18: 'mixamorigSpine2',
      Man_20: 'mixamorigRightShoulder', Man_21: 'mixamorigRightArm',
      Man_22: 'mixamorigRightForeArm', Man_23: 'mixamorigRightHand',
      Man_24: 'mixamorigRightHandThumb1', Man_28: 'mixamorigRightHandIndex1',
      Man_32: 'mixamorigRightHandMiddle1', Man_36: 'mixamorigRightHandRing1',
      Man_40: 'mixamorigRightHandPinky1',
      Man_44: 'mixamorigLeftShoulder', Man_45: 'mixamorigLeftArm',
      Man_46: 'mixamorigLeftForeArm', Man_47: 'mixamorigLeftHand',
      Man_48: 'mixamorigLeftHandThumb1', Man_52: 'mixamorigLeftHandIndex1',
      Man_56: 'mixamorigLeftHandMiddle1', Man_60: 'mixamorigLeftHandRing1',
      Man_64: 'mixamorigLeftHandPinky1',
      Man_70: 'mixamorigRightUpLeg', Man_71: 'mixamorigRightLeg',
      Man_72: 'mixamorigRightFoot', Man_73: 'mixamorigRightToeBase',
      Man_75: 'mixamorigLeftUpLeg', Man_76: 'mixamorigLeftLeg',
      Man_77: 'mixamorigLeftFoot', Man_78: 'mixamorigLeftToeBase',
    },
    materialColors: {
      hair: 0x241a16, shoes: 0x1b2028, shirt: 0x263b54,
      pants: 0x4c596d, eyeball: 0xe8edf2, 'black man': 0x7b513d,
    },
  },
  soldier: {
    name: 'Солдат',
    url: CDN + 'Soldier.glb',
    rotY: Math.PI,
  },
  ranger: {
    name: 'Лесной рейнджер',
    url: CDN + 'Soldier.glb',
    rotY: Math.PI,
    tint: 0x5f8150,
  },
  michelle: {
    name: 'Мишель',
    url: CDN + 'Michelle.glb',
    rotY: 0, // модель Michelle смотрит в противоположную от Soldier сторону
    // осветление кожи: перекраска коричневых тонов атласа в светлый тон
    recolor: [{ hMin: 3, hMax: 44, sMin: 0.16, vMin: 0.12, vMax: 0.96, target: 0xffe4d0, strength: 0.96 }],
  },
  shadow: {
    name: 'Ночной агент',
    url: CDN + 'Michelle.glb',
    rotY: 0,
    tint: 0x4b567d,
  },
};

// Перекраска текстуры-атласа: пиксели в заданном HSV-диапазоне тонируются к target
// с сохранением светотени. Так делаются «скины» без правки модели.
// Для полной замены картинки персонажа укажи в CHARACTERS `skinMap: 'url.png'`.
const recolorCache = new Map();
function recolorTexture(texture, rules, cacheKey) {
  if (recolorCache.has(cacheKey)) return recolorCache.get(cacheKey);
  const img = texture.image;
  if (!img || !img.width) return texture;
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  const c = new THREE.Color();
  const hsv = {};
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i] / 255, g = px[i + 1] / 255, b = px[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const v = max, s = max === 0 ? 0 : (max - min) / max;
    let h = 0;
    if (max !== min) {
      if (max === r) h = ((g - b) / (max - min)) % 6;
      else if (max === g) h = (b - r) / (max - min) + 2;
      else h = (r - g) / (max - min) + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    for (const rule of rules) {
      if (h < rule.hMin || h > rule.hMax || s < rule.sMin || v < rule.vMin || v > rule.vMax) continue;
      c.setHex(rule.target);
      // светотень исходника сохраняется через относительную яркость
      const lum = 0.52 + v * 0.72;
      const k = rule.strength;
      px[i] = Math.min(255, px[i] * (1 - k) + c.r * 255 * lum * k);
      px[i + 1] = Math.min(255, px[i + 1] * (1 - k) + c.g * 255 * lum * k);
      px[i + 2] = Math.min(255, px[i + 2] * (1 - k) + c.b * 255 * lum * k);
      break;
    }
  }
  ctx.putImageData(data, 0, 0);
  const out = new THREE.CanvasTexture(canvas);
  out.colorSpace = texture.colorSpace;
  out.flipY = texture.flipY;
  out.wrapS = texture.wrapS;
  out.wrapT = texture.wrapT;
  recolorCache.set(cacheKey, out);
  return out;
}

// Библиотека клипов: имя состояния → { файл, имя клипа в файле }
const ANIM_SOURCES = {
  idle: { url: CDN + 'Soldier.glb', clip: 'Idle' },
  walk: { url: CDN + 'Soldier.glb', clip: 'Walk' },
  run: { url: CDN + 'Soldier.glb', clip: 'Run' },
  dance: { url: CDN + 'Michelle.glb', clip: 'SambaDance' },
};

// Эмоции: клиповые и процедурные (доступны всем персонажам)
export const EMOTES = [
  { label: '💃 Танец', clip: 'dance' },
  { label: '🌀 Кружение', proc: 'spin' },
  { label: '🙇 Поклон', proc: 'bow' },
  { label: '🎉 Прыжки', proc: 'hop' },
];

const TARGET_HEIGHT = 1.75;

// FBX часто записывает Mixamo-кости как mixamorig:Hips или mixamorig_Hips,
// а GLB-анимации обращаются к mixamorigHips. Имена можно безопасно привести
// к одному виду: skinning хранит ссылки на сами Bone, а не на строки имён.
function canonicalizeRigNames(model) {
  model.traverse(o => {
    if (!o.isBone) return;
    const match = o.name.match(/mixamorig[\s:_|.-]*(.+)$/i);
    if (match) o.name = 'mixamorig' + match[1].replace(/[\s:_|.-]/g, '');
  });
}

function applyRigMap(model, rigMap) {
  if (!rigMap) return;
  for (const [sourceName, targetName] of Object.entries(rigMap)) {
    const bone = model.getObjectByName(sourceName);
    if (bone) bone.name = targetName;
  }
}

function firstSkinnedMesh(root) {
  let found = null;
  root.traverse(o => { if (!found && o.isSkinnedMesh) found = o; });
  return found;
}

function retargetClipForModel(model, entry, lib) {
  const sourceScene = SkeletonUtils.clone(lib.rigScenes.get(entry.url));
  if (!sourceScene) return null;
  sourceScene.traverse(o => { if (o.isSkinnedMesh) o.skeleton.pose(); });
  sourceScene.updateMatrixWorld(true);
  model.updateMatrixWorld(true);

  const targetBones = [];
  model.traverse(o => {
    if (o.isBone && o.name.startsWith('mixamorig') && sourceScene.getObjectByName(o.name)) targetBones.push(o);
  });
  if (!targetBones.length) return null;
  const depth = bone => {
    let value = 0, parent = bone.parent;
    while (parent) { value++; parent = parent.parent; }
    return value;
  };
  targetBones.sort((a, b) => depth(a) - depth(b));

  const sourceBind = new Map();
  const targetBind = new Map();
  const parentBind = new Map();
  for (const bone of targetBones) {
    sourceBind.set(bone.name, sourceScene.getObjectByName(bone.name).getWorldQuaternion(new THREE.Quaternion()));
    targetBind.set(bone, bone.getWorldQuaternion(new THREE.Quaternion()));
    parentBind.set(bone, bone.parent.getWorldQuaternion(new THREE.Quaternion()));
  }

  const fps = 30;
  const frameCount = Math.max(2, Math.ceil(entry.clip.duration * fps) + 1);
  const times = new Float32Array(frameCount);
  const values = new Map(targetBones.map(bone => [bone, new Float32Array(frameCount * 4)]));
  const mixer = new THREE.AnimationMixer(sourceScene);
  const action = mixer.clipAction(entry.clip);
  action.play();
  const sourceCurrent = new THREE.Quaternion();
  const delta = new THREE.Quaternion();
  const desired = new THREE.Quaternion();
  const local = new THREE.Quaternion();
  const desiredWorld = new Map();

  for (let frame = 0; frame < frameCount; frame++) {
    const time = Math.min(entry.clip.duration, frame / fps);
    times[frame] = time;
    mixer.setTime(time);
    sourceScene.updateMatrixWorld(true);
    desiredWorld.clear();
    for (const bone of targetBones) {
      const sourceBone = sourceScene.getObjectByName(bone.name);
      sourceBone.getWorldQuaternion(sourceCurrent);
      delta.copy(sourceCurrent).multiply(sourceBind.get(bone.name).clone().invert());
      desired.copy(delta).multiply(targetBind.get(bone)).normalize();
      desiredWorld.set(bone, desired.clone());
      const parentWorld = desiredWorld.get(bone.parent) || parentBind.get(bone);
      local.copy(parentWorld).invert().multiply(desired).normalize();
      local.toArray(values.get(bone), frame * 4);
    }
  }
  action.stop();
  const tracks = targetBones.map(bone => new THREE.QuaternionKeyframeTrack(
    `${bone.name}.quaternion`, times, values.get(bone)
  ));
  return new THREE.AnimationClip(entry.clip.name, entry.clip.duration, tracks);
}

// Оружие держится у кисти, но ориентировано по взгляду персонажа:
// поза руки в каждой анимации разная, а так ствол всегда смотрит вперёд —
// работает для любого персонажа без подгонки под скелет.
const _handPos = new THREE.Vector3();
const _middlePos = new THREE.Vector3();
const _indexPos = new THREE.Vector3();
const _pinkyPos = new THREE.Vector3();
const _palmForward = new THREE.Vector3();
const _palmAcross = new THREE.Vector3();
const _palmUp = new THREE.Vector3();
const _palmGripLocal = new THREE.Vector3();
const _leftFootPos = new THREE.Vector3();
const _rightFootPos = new THREE.Vector3();
const _leftFootTarget = new THREE.Vector3();
const _rightFootTarget = new THREE.Vector3();
const _gripOffset = new THREE.Vector3();
const _gunGripTarget = new THREE.Vector3();
const _worldTarget = new THREE.Vector3();
const _worldPole = new THREE.Vector3();
const _bonePos = new THREE.Vector3();
const _childPos = new THREE.Vector3();
const _elbowPos = new THREE.Vector3();
const _elbowTarget = new THREE.Vector3();
const _armDirection = new THREE.Vector3();
const _poleDirection = new THREE.Vector3();
const _currentDir = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _deltaQuat = new THREE.Quaternion();
const _worldQuat = new THREE.Quaternion();
const _parentQuat = new THREE.Quaternion();
const _handQuat = new THREE.Quaternion();
const _groupQuat = new THREE.Quaternion();
const _desiredQuat = new THREE.Quaternion();
const _aimQuat = new THREE.Quaternion();
const _palmWorldQuat = new THREE.Quaternion();
const _palmLocalQuat = new THREE.Quaternion();
const _holdEuler = new THREE.Euler();
const _palmMatrix = new THREE.Matrix4();

// «Оружие ведёт»: ствол смотрит вперёд по взгляду персонажа (с тангажем),
// рукоять кладётся в ладонь, а руки IK-ятся к оружию — как в TPS.
export function holdGunAtHand(gun, hand, group, pitch = 0.12) {
  if (!gun) return;
  if (!hand) {
    gun.position.set(0.25, 1.15, 0.2);
    gun.rotation.set(0, Math.PI, 0);
    return;
  }
  _aimQuat.setFromEuler(_holdEuler.set(pitch, Math.PI, 0));
  gun.quaternion.copy(_aimQuat);
  hand.getWorldPosition(_handPos);
  group.worldToLocal(_handPos);
  _gripOffset.set(0, -0.10, 0.08).multiply(gun.scale).applyQuaternion(gun.quaternion);
  gun.position.copy(_handPos).sub(_gripOffset);
}

// Для игрока оружие является ведущим объектом: его прицел всегда стабилен,
// а обе руки решаются к точным grip-точкам. Это убирает обратную связь, когда
// плохой кадр анимации кисти уводит всю пушку в сторону от тела.
function holdGunAtTarget(gun, gripTarget, pitch = 0.12) {
  _aimQuat.setFromEuler(_holdEuler.set(pitch, Math.PI, 0));
  gun.quaternion.copy(_aimQuat);
  _gripOffset.set(0, -0.10, 0.08).multiply(gun.scale).applyQuaternion(gun.quaternion);
  gun.position.copy(gripTarget).sub(_gripOffset);
}

// Кисть ведёт оружие в обычной стойке: направление ствола вычисляется по
// пальцам, поэтому опущенная рука действительно опускает и пушку. При входе
// в прицел трансформация плавно смешивается со стабильной aim-позой.
function holdGunFromPalm(gun, hand, middle, index, pinky, group, aimGrip, pitch, aimWeight) {
  if (!middle) {
    holdGunAtHand(gun, hand, group, pitch);
    return;
  }
  hand.getWorldPosition(_handPos);
  middle.getWorldPosition(_middlePos);
  _palmForward.subVectors(_middlePos, _handPos).normalize();

  if (index && pinky) {
    index.getWorldPosition(_indexPos);
    pinky.getWorldPosition(_pinkyPos);
    _palmAcross.subVectors(_indexPos, _pinkyPos);
  } else {
    hand.getWorldQuaternion(_handQuat);
    _palmAcross.set(1, 0, 0).applyQuaternion(_handQuat);
  }
  _palmAcross.addScaledVector(_palmForward, -_palmAcross.dot(_palmForward)).normalize();
  _palmUp.crossVectors(_palmForward.clone().negate(), _palmAcross).normalize();
  _palmMatrix.makeBasis(_palmAcross, _palmUp, _palmForward.clone().negate());
  _palmWorldQuat.setFromRotationMatrix(_palmMatrix);
  group.getWorldQuaternion(_groupQuat).invert();
  _palmLocalQuat.copy(_groupQuat).multiply(_palmWorldQuat);

  _aimQuat.setFromEuler(_holdEuler.set(pitch, Math.PI, 0));
  gun.quaternion.copy(_palmLocalQuat).slerp(_aimQuat, aimWeight);

  // Центр ладони находится немного впереди кости запястья.
  _handPos.addScaledVector(_palmForward, 0.055);
  group.worldToLocal(_palmGripLocal.copy(_handPos));
  _palmGripLocal.lerp(aimGrip, aimWeight);
  _gripOffset.set(0, -0.10, 0.08).multiply(gun.scale).applyQuaternion(gun.quaternion);
  gun.position.copy(_palmGripLocal).sub(_gripOffset);
}

// Socket совпадает именно с центром рукояти, а не с origin всей модели пушки.
function seatGunGripAtSocket(gun) {
  const grip = gun?.getObjectByName('gripAnchor');
  if (!grip) return;
  _gripOffset.copy(grip.position).multiply(gun.scale).applyQuaternion(gun.quaternion);
  gun.position.copy(_gripOffset).multiplyScalar(-1);
}

// Поворачиваем саму кисть так, чтобы оружие, жёстко сидящее в socket-кости,
// пришло к нужной мировой ориентации. После выхода из прицела live-retarget
// снова задаёт кисти абсолютную позу, поэтому скрутка не накапливается.
function orientHandForGun(gun, hand, group, pitch, yaw, roll, weight) {
  if (!gun || !hand || weight <= 0) return;
  gun.updateWorldMatrix(true, true);
  gun.getWorldQuaternion(_worldQuat);
  group.getWorldQuaternion(_groupQuat);
  _aimQuat.setFromEuler(_holdEuler.set(pitch, yaw, roll)).premultiply(_groupQuat);
  _deltaQuat.copy(_aimQuat).multiply(_worldQuat.invert());
  hand.getWorldQuaternion(_handQuat);
  _desiredQuat.copy(_deltaQuat).multiply(_handQuat).normalize();
  if (hand.parent) hand.parent.getWorldQuaternion(_parentQuat).invert();
  else _parentQuat.identity();
  _desiredQuat.premultiply(_parentQuat);
  hand.quaternion.slerp(_desiredQuat, weight);
  hand.updateWorldMatrix(false, true);
}

// Aim a bone by its child direction; this does not depend on Mixamo's local axes.
function pointBoneAt(bone, target, weight) {
  if (!bone || !bone.children.length || weight <= 0) return;
  bone.updateWorldMatrix(true, true);
  const child = bone.children.find(c => c.isBone) || bone.children[0];
  bone.getWorldPosition(_bonePos);
  child.getWorldPosition(_childPos);
  _currentDir.subVectors(_childPos, _bonePos).normalize();
  _targetDir.subVectors(target, _bonePos).normalize();
  if (_currentDir.lengthSq() < 0.5 || _targetDir.lengthSq() < 0.5) return;
  _deltaQuat.setFromUnitVectors(_currentDir, _targetDir);
  bone.getWorldQuaternion(_worldQuat);
  _deltaQuat.multiply(_worldQuat);
  if (bone.parent) bone.parent.getWorldQuaternion(_parentQuat).invert();
  else _parentQuat.identity();
  _deltaQuat.premultiply(_parentQuat);
  bone.quaternion.slerp(_deltaQuat, weight);
  bone.updateWorldMatrix(false, true);
}

// Аналитический двухкостный IK с pole-target. В отличие от простого CCD он
// фиксирует локти снизу/снаружи и не даёт рукам выворачиваться «крыльями».
function solveArmIK(upperArm, foreArm, hand, target, pole, weight) {
  if (!upperArm || !foreArm || !hand || weight <= 0) return;
  upperArm.updateWorldMatrix(true, true);
  upperArm.getWorldPosition(_bonePos);
  foreArm.getWorldPosition(_elbowPos);
  hand.getWorldPosition(_childPos);
  const upperLength = _bonePos.distanceTo(_elbowPos);
  const lowerLength = _elbowPos.distanceTo(_childPos);
  _armDirection.subVectors(target, _bonePos);
  const targetDistance = THREE.MathUtils.clamp(
    _armDirection.length(), Math.abs(upperLength - lowerLength) + 0.001, upperLength + lowerLength - 0.001);
  _armDirection.normalize();
  _poleDirection.subVectors(pole, _bonePos)
    .addScaledVector(_armDirection, -_poleDirection.dot(_armDirection));
  if (_poleDirection.lengthSq() < 0.0001) _poleDirection.set(0, -1, 0);
  _poleDirection.normalize();
  const along = (upperLength * upperLength - lowerLength * lowerLength + targetDistance * targetDistance) / (2 * targetDistance);
  const away = Math.sqrt(Math.max(0, upperLength * upperLength - along * along));
  _elbowTarget.copy(_bonePos).addScaledVector(_armDirection, along).addScaledVector(_poleDirection, away);

  pointBoneAt(upperArm, _elbowTarget, weight);
  pointBoneAt(foreArm, target, weight);
  // Второй проход компенсирует изменение мировой матрицы предплечья.
  pointBoneAt(upperArm, _elbowTarget, weight * 0.55);
  pointBoneAt(foreArm, target, weight * 0.72);
}

// ---------- Живой ретаргет ----------
// Скрытый mixamo-скелет (Soldier) проигрывает клипы, а кости целевой модели
// каждый кадр доворачиваются так, чтобы их сегменты повторяли направления
// сегментов драйвера. Работает с любым ригом: UE3, Unity, кастомным.
// Руки переносим по направлениям сегментов (устойчиво к разнице T/A-поз)
// Ретаргетим ТОЛЬКО руки (от плеча) и ноги. Позвоночник, шею и ключицы НЕ
// трогаем — иначе чужая осанка гнёт торс вперёд, сжимает его и сводит плечи
// к центру («обрезанные плечи»). Корпус остаётся в родной прямой bind-позе,
// конечности от неё анимируются — визуально персонаж стоит как надо.
const RETARGET_DIR_CHAIN = [
  ['mixamorigLeftArm', 'mixamorigLeftForeArm'],
  ['mixamorigLeftForeArm', 'mixamorigLeftHand'],
  ['mixamorigRightArm', 'mixamorigRightForeArm'],
  ['mixamorigRightForeArm', 'mixamorigRightHand'],
  ['mixamorigLeftUpLeg', 'mixamorigLeftLeg'],
  ['mixamorigLeftLeg', 'mixamorigLeftFoot'],
  ['mixamorigLeftFoot', 'mixamorigLeftToeBase'],
  ['mixamorigRightUpLeg', 'mixamorigRightLeg'],
  ['mixamorigRightLeg', 'mixamorigRightFoot'],
  ['mixamorigRightFoot', 'mixamorigRightToeBase'],
];
// Корпус, ноги, ступни и кисти — полная ориентация (дельта от rest-позы):
// иначе теряется «крутка» вокруг оси и ботинки/ладони выворачивает.
const RETARGET_DELTA_BONES = [
  // Ступни сохраняют родной roll и направляются к toe-кости; абсолютная
  // дельта нужна только кистям, чтобы после прицела не копилась скрутка.
  'mixamorigLeftHand', 'mixamorigRightHand',
];

const _dirWorld = new THREE.Vector3();
const _hipsBasisX = new THREE.Vector3();
const _hipsBasisY = new THREE.Vector3();
const _hipsBasisZ = new THREE.Vector3();
const _hipsMatrix = new THREE.Matrix4();
const _retargetDelta = new THREE.Quaternion();

function hipsBasisQuat(hips, spine, leftUpLeg, rightUpLeg, out) {
  hips.getWorldPosition(_bonePos);
  spine.getWorldPosition(_childPos);
  _hipsBasisY.subVectors(_childPos, _bonePos).normalize();
  leftUpLeg.getWorldPosition(_bonePos);
  rightUpLeg.getWorldPosition(_childPos);
  _hipsBasisX.subVectors(_bonePos, _childPos).normalize(); // лево → в +X
  _hipsBasisZ.crossVectors(_hipsBasisX, _hipsBasisY).normalize();
  _hipsBasisX.crossVectors(_hipsBasisY, _hipsBasisZ).normalize();
  _hipsMatrix.makeBasis(_hipsBasisX, _hipsBasisY, _hipsBasisZ);
  return out.setFromRotationMatrix(_hipsMatrix);
}

class LiveRetargetDriver {
  constructor(model, group, lib) {
    this.model = model;
    this.group = group;
    this.driver = SkeletonUtils.clone(lib.rigScenes.get(ANIM_SOURCES.idle.url));
    this.driver.visible = false;
    // модель Soldier смотрит в -Z; поза цели целиком копирует драйвера,
    // поэтому лицом по движению драйвер разворачивается здесь, а не rotY модели
    this.driver.rotation.y = Math.PI;
    group.add(this.driver);
    this.mixer = new THREE.AnimationMixer(this.driver);
    this.actions = {};
    for (const state of Object.keys(lib.clips)) {
      const clip = clipForRig(state, ANIM_SOURCES.idle.url);
      if (clip) this.actions[state] = this.mixer.clipAction(clip);
    }

    // пары костей: цель ← драйвер (по совпадающим mixamo-именам)
    this.pairs = [];
    for (const [boneName, childName] of RETARGET_DIR_CHAIN) {
      const t = model.getObjectByName(boneName);
      const tc = model.getObjectByName(childName);
      const d = this.driver.getObjectByName(boneName);
      const dc = this.driver.getObjectByName(childName);
      if (t && tc && d && dc) this.pairs.push({
        t, tc, d, dc,
        restLocal: t.quaternion.clone(),
        leg: /UpLeg|Leg|Foot/.test(boneName),
        // Корпус/шея: переносим только ИЗМЕНЕНИЕ направления от rest-позы —
        // иначе цель наследует чужую осанку (наклон вперёд, вытянутая шея).
        spine: /Spine|Neck|Head/.test(boneName),
      });
    }
    this.hipsT = model.getObjectByName('mixamorigHips');
    this.hipsD = this.driver.getObjectByName('mixamorigHips');
    this.spineT = model.getObjectByName('mixamorigSpine');
    this.spineD = this.driver.getObjectByName('mixamorigSpine');
    this.lLegT = model.getObjectByName('mixamorigLeftUpLeg');
    this.rLegT = model.getObjectByName('mixamorigRightUpLeg');
    this.lLegD = this.driver.getObjectByName('mixamorigLeftUpLeg');
    this.rLegD = this.driver.getObjectByName('mixamorigRightUpLeg');

    // rest-состояние: кисти/ступни получают ДЕЛЬТУ поворота драйвера в
    // мировом пространстве. Спину НЕ трогаем дельтой — у неё локальные оси
    // рига другие, любая дельта в них скручивает корпус (голова наизнанку).
    model.updateWorldMatrix(true, true);
    this.driver.updateWorldMatrix(true, true);
    this.deltaPairs = [];
    for (const boneName of RETARGET_DELTA_BONES) {
      const t = model.getObjectByName(boneName);
      const d = this.driver.getObjectByName(boneName);
      if (!t || !d) continue;
      this.deltaPairs.push({
        t,
        d,
        terminal: boneName.endsWith('Hand') || boneName.endsWith('Foot'),
        targetRestWorld: t.getWorldQuaternion(new THREE.Quaternion()),
        driverRestWorldInv: d.getWorldQuaternion(new THREE.Quaternion()).invert(),
      });
    }
    const depth = bone => {
      let value = 0;
      for (let parent = bone.parent; parent; parent = parent.parent) value++;
      return value;
    };
    this.deltaPairs.sort((a, b) => depth(a.t) - depth(b.t));
    this.driverHipsRestBasisInv = hipsBasisQuat(
      this.hipsD, this.spineD, this.lLegD, this.rLegD, new THREE.Quaternion()).invert();
    this.hipsTargetRestWorld = this.hipsT.getWorldQuaternion(new THREE.Quaternion());
    this.hipsRestLocalQuat = this.hipsT.quaternion.clone();
    this.hipsRestLocalPos = this.hipsT.position.clone();
  }

  play(state, fade = 0.25) {
    const action = this.actions[state];
    if (!action) return false;
    if (this.currentAction === action) { this.state = state; return true; }
    action.reset();
    action.play();
    if (this.currentAction) action.crossFadeFrom(this.currentAction, fade, false);
    this.currentAction = action;
    this.state = state;
    return true;
  }

  update(dt) {
    this.mixer.update(dt);
    this.driver.updateWorldMatrix(true, true);
    for (const pair of this.pairs) pair.t.quaternion.copy(pair.restLocal);
    this.model.updateWorldMatrix(true, true);

    // 1) таз: ориентация через общий базис (позвоночник + линия бёдер)
    // У этого UE3-рига базис таза сильно отличается от Mixamo. Оставляем
    // собственную ориентацию таза, а движение переносим на дочерние кости.
    this.hipsT.quaternion.copy(this.hipsRestLocalQuat);
    // вертикальный боб таза переносим в масштабе ригов
    this.hipsT.position.copy(this.hipsRestLocalPos);
    this.model.updateWorldMatrix(true, true);

    // 2) конечности: сегмент цели наводится на направление сегмента драйвера
    for (const pair of this.deltaPairs) {
      if (!pair.terminal) this.#applyOrientationDelta(pair);
    }

    for (const { t, tc, d, dc, leg, spine } of this.pairs) {
      if (leg && this.state === 'idle') continue;
      d.getWorldPosition(_bonePos);
      dc.getWorldPosition(_childPos);
      _dirWorld.subVectors(_childPos, _bonePos);
      if (_dirWorld.lengthSq() < 1e-8) continue;
      // Разворот драйвера нужен для его forward, но зеркалит Left/Right.
      // Возвращаем боковую компоненту в базисе персонажа, сохраняя forward.
      this.group.getWorldQuaternion(_groupQuat);
      _parentQuat.copy(_groupQuat).invert();
      _dirWorld.applyQuaternion(_parentQuat);
      _dirWorld.x *= -1;
      _dirWorld.applyQuaternion(_groupQuat);
      t.getWorldPosition(_bonePos);
      _worldTarget.copy(_bonePos).add(_dirWorld);
      // Спину тянем к направлению анимации лишь слегка — так корпус держит
      // свою прямую осанку и не скручивается, но живёт при беге/приседе.
      pointBoneSegmentAt(t, tc, _worldTarget, spine ? 0.28 : 1);
    }

    for (const pair of this.deltaPairs) {
      if (pair.terminal) this.#applyOrientationDelta(pair);
    }
  }

  #applyOrientationDelta(pair) {
    pair.d.getWorldQuaternion(_worldQuat);
    // Мировая дельта поворота драйвера от покоя, наложенная на покой цели.
    _retargetDelta.copy(_worldQuat).multiply(pair.driverRestWorldInv);
    _desiredQuat.copy(_retargetDelta).multiply(pair.targetRestWorld).normalize();
    if (pair.t.parent) pair.t.parent.getWorldQuaternion(_parentQuat).invert();
    else _parentQuat.identity();
    pair.t.quaternion.copy(_parentQuat).multiply(_desiredQuat).normalize();
    pair.t.updateWorldMatrix(false, true);
  }
}

// Наводит сегмент кости (bone → явный child) на точку target
function pointBoneSegmentAt(bone, child, target, weight) {
  bone.getWorldPosition(_bonePos);
  child.getWorldPosition(_childPos);
  _currentDir.subVectors(_childPos, _bonePos).normalize();
  _targetDir.subVectors(target, _bonePos).normalize();
  if (_currentDir.lengthSq() < 0.5 || _targetDir.lengthSq() < 0.5) return;
  _deltaQuat.setFromUnitVectors(_currentDir, _targetDir);
  bone.getWorldQuaternion(_worldQuat);
  _deltaQuat.multiply(_worldQuat);
  if (bone.parent) bone.parent.getWorldQuaternion(_parentQuat).invert();
  else _parentQuat.identity();
  _deltaQuat.premultiply(_parentQuat);
  bone.quaternion.slerp(_deltaQuat, weight);
  bone.updateWorldMatrix(false, true);
}

// ---------- Библиотека анимаций ----------
let animLib = null; // { clips: {state: clip}, hipsY: число (высота таза исходного рига) }

export async function loadAnimLibrary(manager) {
  if (animLib) return animLib;
  const loader = new GLTFLoader(manager);
  const byUrl = new Map();
  for (const { url } of Object.values(ANIM_SOURCES)) {
    if (!byUrl.has(url)) byUrl.set(url, loader.loadAsync(url));
  }
  const loaded = new Map();
  for (const [url, p] of byUrl) loaded.set(url, await p);

  const clips = {};
  for (const [state, src] of Object.entries(ANIM_SOURCES)) {
    const gltf = loaded.get(src.url);
    const clip = THREE.AnimationClip.findByName(gltf.animations, src.clip);
    if (clip) {
      clips[state] = { clip, url: src.url };
    }
  }
  animLib = { clips, rigScenes: new Map([...loaded].map(([url, gltf]) => [url, gltf.scene])) };
  return animLib;
}

// Локальные вращения костей у mixamo-ригов совместимы, а вот корневая кость
// (таз) у разных ригов задана в разных системах — чужим ригам клип отдаётся
// вообще без треков таза (позу таза держит rest-поза собственного рига).
const strippedCache = new Map();
export function clipForRig(state, rigUrl) {
  const entry = animLib.clips[state];
  if (!entry) return null;
  if (entry.url === rigUrl) return entry.clip;
  const cacheKey = state;
  if (!strippedCache.has(cacheKey)) {
    const c = entry.clip.clone();
    c.tracks = c.tracks.filter(t => !t.name.includes('Hips.'));
    strippedCache.set(cacheKey, c);
  }
  return strippedCache.get(cacheKey);
}

// Масштаб модели: по мировой высоте кости головы (Box3 у ригов врёт)
export function normalizeScale(model) {
  model.updateMatrixWorld(true);
  const head = model.getObjectByName('mixamorigHead');
  if (head) {
    const y = head.getWorldPosition(new THREE.Vector3()).y;
    if (y > 0.01) model.scale.multiplyScalar((TARGET_HEIGHT * 0.92) / y);
    return;
  }
  const box = new THREE.Box3().setFromObject(model);
  const height = box.max.y - box.min.y;
  if (height > 0.01) model.scale.multiplyScalar(TARGET_HEIGHT / height);
}

export class Character {
  constructor(scene, manager) {
    this.scene = scene;
    this.manager = manager;
    this.loader = new GLTFLoader(manager);
    this.fbxLoader = new FBXLoader(manager);
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.current = null;
    this.currentName = '';
    this.gun = null;
    this.weaponKey = null;
    this.hand = null;
    this.leftHand = null;
    this.rightMiddle = null;
    this.rightIndex = null;
    this.rightPinky = null;
    this.rightArm = null;
    this.leftArm = null;
    this.rightForeArm = null;
    this.leftForeArm = null;
    this.hips = null;
    this.leftUpLeg = null;
    this.rightUpLeg = null;
    this.leftLeg = null;
    this.rightLeg = null;
    this.leftFoot = null;
    this.rightFoot = null;
    this.leftFootBase = new THREE.Vector3();
    this.rightFootBase = new THREE.Vector3();
    this.proceduralBind = new Map();
    this.footGroundY = 0;
    this.gltfScene = null; // для клонов (иконки эмоций)
    this.modelBaseScale = new THREE.Vector3(1, 1, 1);
    // процедурные состояния
    this.procEmote = null;
    this.procT = 0;
    this.pose = 'stand'; // stand | crouch | slide
    this.poseLean = 0;   // сглаженный наклон
    this.poseDrop = 0;   // сглаженное приседание
    this.aimWeight = 0;
    this.aimTarget = 0;
    this.aimPitch = 0;
    this.crouchWeight = 0;
    this.eliminating = false;
    this.eliminationEffect = null;
    this.weaponRecoil = 0;
    this.reloadActive = false;
    this.reloadProgress = 0;
    this.reloadWeight = 0;
    this.magazine = null;
    this.magazineRestPosition = new THREE.Vector3();
    this.slideFrozen = false;
    this.locomotionT = 0;
    // Смещения позы снимаются перед следующим кадром, иначе у ригов без
    // анимации таза присед накапливается и персонаж проваливается под карту.
    this.poseOffsets = { leftUp: 0, rightUp: 0, leftLeg: 0, rightLeg: 0, hipsY: 0 };
    this.emoteIconCache = {};
  }

  async load(key) {
    const cfg = CHARACTERS[key];
    const modelPromise = cfg.type === 'fbx'
      ? this.fbxLoader.loadAsync(cfg.url).then(scene => ({ scene, animations: scene.animations || [] }))
      : this.loader.loadAsync(cfg.url);
    const [asset, lib] = await Promise.all([modelPromise, loadAnimLibrary(this.manager)]);

    if (this.model) {
      this.group.remove(this.model);
      this.mixer.stopAllAction();
    }
    this.cfg = cfg;
    this.key = key;
    this.gltfScene = asset.scene;
    this.model = SkeletonUtils.clone(asset.scene);
    applyRigMap(this.model, cfg.rigMap);
    canonicalizeRigNames(this.model);
    this.model.rotation.y = cfg.rotY || 0;
    this.model.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.frustumCulled = false;
        o.material = o.material.clone();
        if (cfg.skinMap) {
          o.material.map = new THREE.TextureLoader().load(cfg.skinMap, t => {
            t.colorSpace = THREE.SRGBColorSpace;
            t.flipY = false; // GLTF-модели используют неперевёрнутые UV
          });
        } else if (cfg.recolor && o.material.map) {
          o.material.map = recolorTexture(o.material.map, cfg.recolor, key + ':' + (o.material.name || o.name));
        }
        if (cfg.tint && o.material.color) o.material.color.lerp(new THREE.Color(cfg.tint), 0.42);
        if (cfg.materialColors && o.material.color) {
          const materialName = (o.material.name || '').toLowerCase();
          for (const [needle, color] of Object.entries(cfg.materialColors)) {
            if (materialName.includes(needle)) { o.material.color.setHex(color); break; }
          }
          o.material.roughness = Math.max(0.62, o.material.roughness ?? 0.8);
          o.material.metalness = 0;
        }
      }
    });
    normalizeScale(this.model);
    this.modelBaseScale.copy(this.model.scale);
    this.group.add(this.model);

    // анимации из общей библиотеки — mixamo-клипы подходят всем персонажам
    // (чужим ригам — без трека позиции таза, иначе проваливаются под пол)
    this.mixer = new THREE.AnimationMixer(this.model);
    this.actions = {};
    this.live = null;
    for (const state of Object.keys(lib.clips)) {
      if (cfg.liveRetarget) continue; // движение придёт от скелета-драйвера
      const entry = lib.clips[state];
      const clip = cfg.retarget
        ? retargetClipForModel(this.model, entry, lib)
        : clipForRig(state, cfg.url);
      if (clip) this.actions[state] = this.mixer.clipAction(clip);
    }
    this.model.updateMatrixWorld(true);
    this.current = null;
    this.currentName = '';
    this.procEmote = null;
    this.emoteIconCache = {};

    this.hand = this.model.getObjectByName('mixamorigRightHand');
    this.leftHand = this.model.getObjectByName('mixamorigLeftHand');
    this.rightMiddle = this.model.getObjectByName('mixamorigRightHandMiddle1');
    this.rightIndex = this.model.getObjectByName('mixamorigRightHandIndex1');
    this.rightPinky = this.model.getObjectByName('mixamorigRightHandPinky1');
    this.rightArm = this.model.getObjectByName('mixamorigRightArm');
    this.leftArm = this.model.getObjectByName('mixamorigLeftArm');
    this.rightForeArm = this.model.getObjectByName('mixamorigRightForeArm');
    this.leftForeArm = this.model.getObjectByName('mixamorigLeftForeArm');
    this.hips = this.model.getObjectByName('mixamorigHips');
    this.leftUpLeg = this.model.getObjectByName('mixamorigLeftUpLeg');
    this.rightUpLeg = this.model.getObjectByName('mixamorigRightUpLeg');
    this.leftLeg = this.model.getObjectByName('mixamorigLeftLeg');
    this.rightLeg = this.model.getObjectByName('mixamorigRightLeg');
    this.leftFoot = this.model.getObjectByName('mixamorigLeftFoot');
    this.rightFoot = this.model.getObjectByName('mixamorigRightFoot');
    this.weaponBone = (cfg.weaponSocket && this.model.getObjectByName(cfg.weaponSocket))
      || (cfg.liveRetarget ? this.model.getObjectByName('mixamorigRightHand') : null);
    this.proceduralBind.clear();
    if (cfg.proceduralLocomotion) {
      for (const bone of [
        this.rightArm, this.rightForeArm, this.hand,
        this.leftArm, this.leftForeArm, this.leftHand,
        this.rightUpLeg, this.rightLeg, this.rightFoot,
        this.leftUpLeg, this.leftLeg, this.leftFoot,
      ]) {
        if (bone) this.proceduralBind.set(bone, bone.quaternion.clone());
      }
    }
    this.poseOffsets = { leftUp: 0, rightUp: 0, leftLeg: 0, rightLeg: 0, hipsY: 0 };
    if (cfg.liveRetarget) {
      this.live = new LiveRetargetDriver(this.model, this.group, lib);
      this.live.play('idle');
      this.live.update(0.01); // применить позу idle до калибровки оружия
    }
    this.play('idle');
    this.mixer.update(0.001); // применить позу idle сразу — для калибровки хвата оружия
    this.model.updateWorldMatrix(true, true);
    this.setWeapon(this.weaponKey);
    if (this.leftFoot && this.rightFoot) {
      this.leftFoot.getWorldPosition(_leftFootPos);
      this.rightFoot.getWorldPosition(_rightFootPos);
      this.group.worldToLocal(_leftFootPos);
      this.group.worldToLocal(_rightFootPos);
      this.leftFootBase.copy(_leftFootPos);
      this.rightFootBase.copy(_rightFootPos);
      this.footGroundY = Math.min(_leftFootPos.y, _rightFootPos.y);
    }
  }

  get emoteList() { return EMOTES.map(e => e.label); }

  setWeapon(key) {
    if (this.gun) { this.gun.removeFromParent(); this.gun = null; }
    this.weaponKey = key;
    if (!key) return;
    this.gun = buildGunMesh(key);
    if (this.weaponBone) {
      // жёсткий socket: пушка живёт в оружейной кости рига и ездит с рукой
      this.model.updateWorldMatrix(true, true);
      const ws = new THREE.Vector3();
      this.weaponBone.getWorldScale(ws);
      this.gun.scale.multiplyScalar(1 / (ws.x || 1));
      // калибровка в текущей (idle) позе: ствол — вперёд по взгляду
      this.weaponBone.getWorldQuaternion(_worldQuat).invert();
      this.group.getWorldQuaternion(_groupQuat);
      _desiredQuat.setFromEuler(_holdEuler.set(0.1, Math.PI, 0)).premultiply(_groupQuat);
      this.gun.quaternion.copy(_worldQuat).multiply(_desiredQuat);
      this.gunRestLocal = this.gun.quaternion.clone();
      seatGunGripAtSocket(this.gun);
      this.weaponBone.add(this.gun);
      this.gunInSocket = true;
    } else {
      this.group.add(this.gun);
      this.gunInSocket = false;
    }
    this.magazine = this.gun.getObjectByName('magazine');
    if (this.magazine) this.magazineRestPosition.copy(this.magazine.position);
    this.reloadActive = false;
    this.reloadProgress = 0;
    this.reloadWeight = 0;
  }

  getMuzzleWorld(out) {
    const m = this.gun && this.gun.getObjectByName('muzzle');
    if (m) return m.getWorldPosition(out);
    out.copy(this.group.position);
    out.y += 1.3;
    return out;
  }

  play(state, { once = false, fade = 0.25 } = {}) {
    if (this.cfg?.proceduralLocomotion && (state === 'idle' || state === 'walk' || state === 'run')) {
      this.currentName = state;
      return true;
    }
    if (this.live) {
      if (!this.live.play(state, fade)) return false;
      this.currentName = state;
      return true;
    }
    const action = this.actions[state];
    if (!action) return false;
    if (this.currentName === state && !once) return true;
    this.#run(action, once, fade);
    this.currentName = state;
    return true;
  }

  #run(action, once, fade) {
    action.reset();
    action.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat);
    action.clampWhenFinished = once;
    if (this.current && this.current !== action) {
      action.crossFadeFrom(this.current, fade, false);
    }
    action.play();
    this.current = action;
  }

  emote(label) {
    const e = EMOTES.find(x => x.label === label);
    if (!e) return;
    if (e.clip && this.actions[e.clip]) {
      this.procEmote = null;
      this.#run(this.actions[e.clip], false, 0.25);
    } else {
      this.procEmote = e.proc;
      this.procT = 0;
      this.play('idle');
    }
    this.currentName = 'emote';
  }

  stopEmote() {
    this.procEmote = null;
    if (this.model) {
      this.model.rotation.set(0, this.cfg.rotY || 0, 0);
      this.model.position.y = 0;
    }
    if (this.currentName === 'emote') this.play('idle');
  }

  get emoting() { return this.currentName === 'emote'; }

  // Кадр эмоции для круга выбора (рендерится один раз и кэшируется)
  getEmoteIcon(label) {
    if (this.emoteIconCache[label]) return this.emoteIconCache[label];
    const e = EMOTES.find(x => x.label === label);
    if (!e || !this.gltfScene) return null;
    const clone = SkeletonUtils.clone(this.gltfScene);
    normalizeScale(clone);
    if (e.clip && animLib && animLib.clips[e.clip]) {
      const mixer = new THREE.AnimationMixer(clone);
      mixer.clipAction(clipForRig(e.clip, this.cfg.url)).play();
      mixer.update(1.1); // выразительный кадр из середины клипа
    } else if (e.proc === 'spin') {
      clone.rotation.y = 2.3;
    } else if (e.proc === 'bow') {
      clone.rotation.x = 0.7;
    } else if (e.proc === 'hop') {
      clone.position.y = 0.25;
      clone.rotation.z = 0.15;
    }
    const bbox = new THREE.Box3(new THREE.Vector3(-0.6, 0, -0.6), new THREE.Vector3(0.6, 1.8, 0.6));
    const url = renderIcon(clone, { yaw: Math.PI, pitch: 0.05, fill: 0.95, bbox });
    this.emoteIconCache[label] = url;
    return url;
  }

  setPose(pose) { this.pose = pose; }

  setAiming(active, pitch = 0) {
    this.aimTarget = active ? 1 : 0;
    this.aimPitch = pitch;
  }

  setReloading(active, progress = 0) {
    this.reloadActive = !!active;
    this.reloadProgress = THREE.MathUtils.clamp(progress, 0, 1);
  }

  kickWeapon(amount = 0.12) { this.weaponRecoil = Math.max(this.weaponRecoil, amount); }

  setSlideFrozen(active) {
    if (active && !this.slideFrozen) {
      this.play('idle', { fade: 0 });
      this.mixer?.update(0.001);
      this.live?.update(0.001);
    }
    this.slideFrozen = active;
  }

  eliminate() {
    if (this.eliminating || !this.model) return;
    this.eliminating = true;
    this.mixer?.stopAllAction();
    this.eliminationEffect = new EliminationEffect(this.scene, this.group.position.clone());
    if (this.gun) this.gun.visible = false;
    this.model.traverse(o => {
      if (!o.isMesh) return;
      o.material.transparent = true;
      o.material.depthWrite = false;
      if (o.material.emissive) o.material.emissive.setHex(0x1477a8);
    });
  }

  update(dt) {
    // Возвращаем кости в состояние, которое было после анимации прошлого кадра.
    // Особенно важно при подкате: mixer заморожен, поэтому без этого ноги и таз
    // получали бы одно и то же смещение 60 раз в секунду.
    const applied = this.poseOffsets;
    if (this.leftUpLeg) this.leftUpLeg.rotation.x -= applied.leftUp;
    if (this.rightUpLeg) this.rightUpLeg.rotation.x -= applied.rightUp;
    if (this.leftLeg) this.leftLeg.rotation.x -= applied.leftLeg;
    if (this.rightLeg) this.rightLeg.rotation.x -= applied.rightLeg;
    if (this.hips) this.hips.position.y -= applied.hipsY;
    applied.leftUp = applied.rightUp = applied.leftLeg = applied.rightLeg = applied.hipsY = 0;

    if (this.mixer && !this.slideFrozen) this.mixer.update(dt);
    if (this.live && !this.slideFrozen) {
      // Убираем позные смещения прошлого кадра до абсолютного live-retarget.
      // Иначе наклон/присед становится частью следующего решения скелета.
      this.model.position.y = 0;
      this.model.rotation.set(0, this.cfg.rotY || 0, 0);
      this.model.updateWorldMatrix(true, true);
      this.live.update(dt);
    }
    if (this.cfg?.proceduralLocomotion) {
      this.model.position.y = 0;
      this.model.rotation.set(0, this.cfg.rotY || 0, 0);
      for (const [bone, quaternion] of this.proceduralBind) bone.quaternion.copy(quaternion);
      this.model.updateWorldMatrix(true, true);
    }

    if (this.eliminating) {
      const k = this.eliminationEffect ? Math.max(0, this.eliminationEffect.life / this.eliminationEffect.duration) : 0;
      if (this.model) {
        this.model.scale.copy(this.modelBaseScale).multiplyScalar(Math.max(0.04, k));
        this.model.position.y = (1 - k) * 1.15;
        this.model.traverse(o => { if (o.isMesh) o.material.opacity = k; });
      }
      if (this.eliminationEffect && !this.eliminationEffect.update(dt)) this.eliminationEffect = null;
      if (!this.eliminationEffect && this.model) this.model.visible = false;
      return;
    }

    // процедурные эмоции
    if (this.procEmote && this.model) {
      this.procT += dt;
      const t = this.procT;
      const base = this.cfg.rotY || 0;
      if (this.procEmote === 'spin') {
        this.model.rotation.y = base + t * 6;
      } else if (this.procEmote === 'bow') {
        this.model.rotation.x = Math.abs(Math.sin(t * 2.2)) * 0.7;
      } else if (this.procEmote === 'hop') {
        this.model.position.y = Math.abs(Math.sin(t * 6)) * 0.35;
        this.model.rotation.y = base + Math.sin(t * 3) * 0.5;
      }
    }

    // присед / подкат: сглаженный наклон и опускание модели
    if (this.model && !this.procEmote && this.cfg.proceduralLocomotion) {
      const locomoting = this.currentName === 'walk' || this.currentName === 'run';
      this.locomotionT += dt * (this.currentName === 'run' ? 9 : locomoting ? 6 : 2.2);
      const phase = Math.sin(this.locomotionT);
      const swing = locomoting ? phase * (this.currentName === 'run' ? 0.13 : 0.08) : 0;
      const relaxedWeight = 1 - this.aimWeight;

      // Без оружейного прицела руки остаются по сторонам корпуса и не
      // проходят сквозь грудь. Их bind-ориентация восстанавливается выше.
      if (this.gun && relaxedWeight > 0.01) {
        _worldTarget.set(-0.3, 0.9 + Math.abs(swing) * 0.08, 0.04 + swing);
        this.group.localToWorld(_worldTarget);
        _worldPole.set(-0.48, 1.0, 0.14 + swing * 0.35);
        this.group.localToWorld(_worldPole);
        solveArmIK(this.rightArm, this.rightForeArm, this.hand, _worldTarget, _worldPole, 0.84 * relaxedWeight);

        _worldTarget.set(0.3, 0.92 + Math.abs(swing) * 0.06, 0.04 - swing);
        this.group.localToWorld(_worldTarget);
        _worldPole.set(0.48, 1.0, 0.14 - swing * 0.35);
        this.group.localToWorld(_worldPole);
        solveArmIK(this.leftArm, this.leftForeArm, this.leftHand, _worldTarget, _worldPole, 0.76 * relaxedWeight);
      }

      if (locomoting && this.pose === 'stand' && this.leftFoot && this.rightFoot) {
        const stride = this.currentName === 'run' ? 0.28 : 0.18;
        const lift = this.currentName === 'run' ? 0.14 : 0.09;
        _leftFootTarget.copy(this.leftFootBase);
        _leftFootTarget.z += phase * stride;
        _leftFootTarget.y += Math.max(0, phase) * lift;
        _rightFootTarget.copy(this.rightFootBase);
        _rightFootTarget.z -= phase * stride;
        _rightFootTarget.y += Math.max(0, -phase) * lift;
        this.group.localToWorld(_leftFootTarget);
        this.group.localToWorld(_rightFootTarget);
        _worldPole.set(-0.2, 0.52, 0.44);
        this.group.localToWorld(_worldPole);
        solveArmIK(this.rightUpLeg, this.rightLeg, this.rightFoot, _rightFootTarget, _worldPole, 0.9);
        _worldPole.set(0.2, 0.52, 0.44);
        this.group.localToWorld(_worldPole);
        solveArmIK(this.leftUpLeg, this.leftLeg, this.leftFoot, _leftFootTarget, _worldPole, 0.9);
      }
    }

    const targetDrop = this.pose === 'crouch' ? 0.4 : this.pose === 'slide' ? 0.55 : 0;
    const targetLean = this.pose === 'slide' ? -0.65 : this.pose === 'crouch' ? 0.08 : 0;
    this.poseDrop += (targetDrop - this.poseDrop) * Math.min(1, dt * 10);
    this.poseLean += (targetLean - this.poseLean) * Math.min(1, dt * 10);
    const crouchTarget = this.pose === 'crouch' ? 1 : this.pose === 'slide' ? 0.7 : 0;
    this.crouchWeight += (crouchTarget - this.crouchWeight) * Math.min(1, dt * 12);
    this.aimWeight += (this.aimTarget - this.aimWeight) * Math.min(1, dt * 12);
    if (this.model && !this.procEmote) {
      const bend = this.crouchWeight;
      if (this.cfg.liveRetarget || this.cfg.proceduralLocomotion) {
        // Опускаем корпус, ступни остаются на земле двухкостным IK;
        // pole-цель у самой земли впереди — колени сгибаются вперёд-вниз.
        // The pelvis drops while both feet remain planted.  Keeping the knee
        // poles around knee height produces a squat; poles near the floor made
        // the imported rig collapse onto its knees and look like a face-plant.
        this.model.position.y = -0.13 * bend;
        this.model.rotation.x = this.poseLean;
        if (bend > 0.001 && this.leftFoot && this.rightFoot) {
          this.model.updateWorldMatrix(true, true);
          _leftFootTarget.copy(this.leftFootBase);
          _rightFootTarget.copy(this.rightFootBase);
          this.group.localToWorld(_leftFootTarget);
          this.group.localToWorld(_rightFootTarget);
          _worldPole.set(-0.22, 0.62, 0.34);
          this.group.localToWorld(_worldPole);
          solveArmIK(this.rightUpLeg, this.rightLeg, this.rightFoot, _rightFootTarget, _worldPole, 0.96 * bend);
          _worldPole.set(0.22, 0.62, 0.34);
          this.group.localToWorld(_worldPole);
          solveArmIK(this.leftUpLeg, this.leftLeg, this.leftFoot, _leftFootTarget, _worldPole, 0.96 * bend);
        }
      } else {
        applied.leftUp = applied.rightUp = -0.58 * bend;
        applied.leftLeg = applied.rightLeg = 0.88 * bend;
        applied.hipsY = -10 * bend;
        if (this.leftUpLeg) this.leftUpLeg.rotation.x += applied.leftUp;
        if (this.rightUpLeg) this.rightUpLeg.rotation.x += applied.rightUp;
        if (this.leftLeg) this.leftLeg.rotation.x += applied.leftLeg;
        if (this.rightLeg) this.rightLeg.rotation.x += applied.rightLeg;
        if (this.hips) this.hips.position.y += applied.hipsY;
        this.model.position.y = 0;
        this.model.rotation.x = this.poseLean;
      }

      // После сгиба колен возвращаем нижнюю ступню на исходный уровень земли.
      // Это не даёт персонажу «подпрыгивать» вверх во время приседа.
      if (!this.cfg.liveRetarget && !this.cfg.proceduralLocomotion && this.leftFoot && this.rightFoot) {
        this.model.updateWorldMatrix(true, true);
        this.leftFoot.getWorldPosition(_leftFootPos);
        this.rightFoot.getWorldPosition(_rightFootPos);
        this.group.worldToLocal(_leftFootPos);
        this.group.worldToLocal(_rightFootPos);
        const currentFootY = Math.min(_leftFootPos.y, _rightFootPos.y);
        this.model.position.y += this.footGroundY - currentFootY;
        this.model.updateWorldMatrix(true, true);
      }
    }

    // Оружие в socket-кости: жёстко в руке всегда, руки полностью от клипов.
    // При прицеле рука с пушкой IK-ится вперёд, а ствол доводится точно.
    this.reloadWeight += ((this.reloadActive ? 1 : 0) - this.reloadWeight) * Math.min(1, dt * 16);

    if (this.gun && this.gunInSocket && this.model && !this.procEmote && !this.eliminating) {
      const k = this.aimWeight;
      const isPistol = this.weaponKey === 'pistol';
      this.gun.quaternion.copy(this.gunRestLocal);
      if (this.magazine) {
        this.magazine.position.copy(this.magazineRestPosition);
        this.magazine.visible = true;
      }

      if (this.reloadWeight > 0.01) {
        const t = this.reloadProgress;
        const poseW = Math.sin(Math.PI * THREE.MathUtils.clamp(t, 0, 1)) * this.reloadWeight;
        _gunGripTarget.set(
          isPistol ? -0.3 : -0.26,
          (isPistol ? 0.78 : 0.86) - this.crouchWeight * 0.18,
          isPistol ? 0.12 : 0.2
        );
        this.group.localToWorld(_gunGripTarget);
        _worldPole.set(-0.5, 0.78 - this.crouchWeight * 0.16, 0.28);
        this.group.localToWorld(_worldPole);
        solveArmIK(this.rightArm, this.rightForeArm, this.hand, _gunGripTarget, _worldPole, poseW * 0.96);
        orientHandForGun(this.gun, this.hand, this.group, isPistol ? 0.78 : 0.5, Math.PI, -0.42, poseW);
        seatGunGripAtSocket(this.gun);
        this.gun.updateWorldMatrix(true, true);

        const reachW = Math.sin(Math.PI * THREE.MathUtils.clamp((t - 0.08) / 0.8, 0, 1)) * this.reloadWeight;
        if (reachW > 0.01 && this.leftArm) {
          if (this.magazine) this.magazine.getWorldPosition(_worldTarget);
          else this.gun.getObjectByName('gripAnchor')?.getWorldPosition(_worldTarget);
          _worldPole.set(0.44, 0.8 - this.crouchWeight * 0.16, 0.3);
          this.group.localToWorld(_worldPole);
          solveArmIK(this.leftArm, this.leftForeArm, this.leftHand, _worldTarget, _worldPole, reachW * 0.94);
        }

        if (this.magazine) {
          let eject = 0;
          if (t < 0.46) eject = THREE.MathUtils.smoothstep(t, 0.2, 0.46);
          else if (t < 0.64) { eject = 1; this.magazine.visible = false; }
          else eject = 1 - THREE.MathUtils.smoothstep(t, 0.64, 0.84);
          this.magazine.position.y -= eject * (isPistol ? 0.14 : 0.2);
        }
        return;
      }
      if (k > 0.01 && this.rightArm) {
        _gunGripTarget.set(
          -0.18,
          1.12 + 0.12 * k - Math.sin(this.aimPitch) * 0.3 * k - this.crouchWeight * 0.22,
          0.34 + 0.14 * k
        );
        this.group.localToWorld(_gunGripTarget);
        _worldPole.set(-0.5, 0.95 - this.crouchWeight * 0.2, 0.15);
        this.group.localToWorld(_worldPole);
        solveArmIK(this.rightArm, this.rightForeArm, this.hand, _gunGripTarget, _worldPole, k * 0.9);
      }
      // ориентация: ствол всегда стабильно вперёд (позиция едет с кистью),
      // при прицеле — тангаж камеры
      // В обычной стойке оружие остаётся продолжением кисти. Только при
      // прицеливании поворачиваем саму кисть к направлению камеры.
      orientHandForGun(this.gun, this.hand, this.group, this.aimPitch, Math.PI, 0, k);
      seatGunGripAtSocket(this.gun);
      this.gun.updateWorldMatrix(true, true);
      // левая рука берёт цевьё только при прицеле — в беге руки машут свободно
      const supportW = k * (isPistol ? 0.8 : 0.92);
      if (supportW > 0.02 && this.leftArm) {
        const support = this.gun.getObjectByName('supportGrip');
        if (support) support.getWorldPosition(_worldTarget);
        else this.gun.localToWorld(_worldTarget.set(0, 0, isPistol ? -0.09 : -0.19));
        _worldPole.set(0.46, 0.92 - this.crouchWeight * 0.2, 0.24);
        this.group.localToWorld(_worldPole);
        solveArmIK(this.leftArm, this.leftForeArm, this.leftHand, _worldTarget, _worldPole, supportW);
      }
      if (this.weaponRecoil > 0.001) {
        this.gun.rotateX(this.weaponRecoil);
        this.weaponRecoil *= Math.exp(-dt * 17);
      }
      seatGunGripAtSocket(this.gun);
    } else if (this.gun && this.hand && this.model && !this.procEmote && !this.eliminating) {
      const k = this.aimWeight;
      const isPistol = this.weaponKey === 'pistol';
      // правая кисть: от «наизготовку у пояса» к «у плеча» при прицеле
      _gunGripTarget.set(
        isPistol ? -0.14 : -0.17,
        (isPistol ? 1.1 : 1.04) + k * 0.18 - this.crouchWeight * 0.22,
        (isPistol ? 0.34 : 0.32) + k * 0.14
      );
      const pitch = this.aimPitch * k + 0.1 * (1 - k);
      holdGunFromPalm(
        this.gun, this.hand, this.rightMiddle, this.rightIndex, this.rightPinky,
        this.group, _gunGripTarget, pitch, k
      );
      this.gun.localToWorld(_worldTarget.set(0, -0.10, 0.08));
      _worldPole.set(isPistol ? -0.38 : -0.48, 0.9 - this.crouchWeight * 0.2, 0.18 + k * 0.2);
      this.group.localToWorld(_worldPole);
      solveArmIK(this.rightArm, this.rightForeArm, this.hand, _worldTarget, _worldPole, k * 0.96);
      // левая рука тянется к цевью
      this.gun.localToWorld(_worldTarget.set(0, isPistol ? -0.025 : 0.02, isPistol ? -0.09 : -0.19));
      _worldPole.set(isPistol ? 0.36 : 0.46, 0.9 - this.crouchWeight * 0.2, 0.2 + k * 0.22);
      this.group.localToWorld(_worldPole);
      const supportWeight = isPistol ? k * 0.82 : 0.28 + k * 0.68;
      solveArmIK(this.leftArm, this.leftForeArm, this.leftHand, _worldTarget, _worldPole, supportWeight);
      // отдача
      if (this.weaponRecoil > 0.001) {
        this.gun.rotateX(this.weaponRecoil);
        this.weaponRecoil *= Math.exp(-dt * 17);
      }
    }
  }
}
