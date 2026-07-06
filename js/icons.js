// Оффскрин-рендер 3D-иконок: скины оружия в хотбаре, кадры эмоций в круге
import * as THREE from 'three';

let renderer = null, scene, cam;

function ensure() {
  if (renderer) return;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(96, 96);
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x556677, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 2.2);
  d.position.set(2, 3, 4);
  scene.add(d);
  const d2 = new THREE.DirectionalLight(0xffffff, 1.0);
  d2.position.set(-3, 2, -2);
  scene.add(d2);
}

// Рендерит объект в data-URL (объект временно добавляется в служебную сцену)
export function renderIcon(obj, { yaw = Math.PI / 4, pitch = 0.3, fill = 0.85, bbox = null } = {}) {
  ensure();
  scene.add(obj);
  obj.updateMatrixWorld(true);
  const box = bbox || new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3());
  const radius = Math.max(s.x, s.y, s.z) * 0.5 / fill;
  const dist = radius / Math.tan(cam.fov * Math.PI / 360);
  cam.position.set(
    c.x + Math.sin(yaw) * dist * Math.cos(pitch),
    c.y + dist * Math.sin(pitch),
    c.z + Math.cos(yaw) * dist * Math.cos(pitch)
  );
  cam.lookAt(c);
  renderer.render(scene, cam);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(obj);
  return url;
}
