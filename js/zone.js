// Сужающаяся зона («шторм»): фазы ожидания и сужения, урон за пределами
import * as THREE from 'three';

const PHASES = [
  { wait: 25, shrink: 18, r: 27, dps: 2 },
  { wait: 18, shrink: 14, r: 18, dps: 4 },
  { wait: 14, shrink: 12, r: 11, dps: 7 },
  { wait: 10, shrink: 10, r: 5, dps: 12 },
  { wait: 8,  shrink: 8,  r: 1, dps: 20 },
];

export class Zone {
  constructor(scene, startR = 40) {
    this.r = startR;
    this.fromR = startR;
    this.phaseIdx = 0;
    this.state = 'wait'; // wait | shrink | done
    this.t = PHASES[0].wait;
    this.dps = 1;

    const geo = new THREE.CylinderGeometry(1, 1, 40, 72, 1, true);
    this.wall = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: 0x46b5ff, transparent: true, opacity: 0.22,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    this.wall.position.y = 10;
    scene.add(this.wall);
    this.wall.scale.set(this.r, 1, this.r);
  }

  update(dt) {
    const phase = PHASES[this.phaseIdx];
    if (this.state !== 'done') this.t -= dt;

    if (this.state === 'wait' && this.t <= 0) {
      this.state = 'shrink';
      this.t = phase.shrink;
      this.fromR = this.r;
    } else if (this.state === 'shrink') {
      const k = Math.max(0, this.t / phase.shrink);
      this.r = phase.r + (this.fromR - phase.r) * k;
      this.dps = phase.dps;
      if (this.t <= 0) {
        this.r = phase.r;
        if (this.phaseIdx < PHASES.length - 1) {
          this.phaseIdx++;
          this.state = 'wait';
          this.t = PHASES[this.phaseIdx].wait;
        } else {
          this.state = 'done';
        }
      }
    }

    this.wall.scale.set(this.r, 1, this.r);
    // лёгкая пульсация стены
    this.wall.material.opacity = 0.2 + Math.sin(performance.now() / 300) * 0.04;
  }

  contains(pos) {
    return Math.hypot(pos.x, pos.z) <= this.r;
  }

  get statusText() {
    const mm = Math.floor(Math.max(0, this.t) / 60);
    const ss = String(Math.floor(Math.max(0, this.t) % 60)).padStart(2, '0');
    if (this.state === 'wait') return `Зона сузится через ${mm}:${ss}`;
    if (this.state === 'shrink') return `&#9888; Зона сужается! ${mm}:${ss}`;
    return 'Финальная зона';
  }
}
