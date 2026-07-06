import * as THREE from 'three';

// A short holographic beam, expanding rings and rising blue shards.
export class EliminationEffect {
  constructor(scene, position) {
    this.scene = scene;
    this.life = 1.35;
    this.duration = this.life;
    this.root = new THREE.Group();
    this.root.position.copy(position);

    const blue = 0x38bdf8;
    this.beamMat = new THREE.MeshBasicMaterial({
      color: blue, transparent: true, opacity: 0.5, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.32, 3.2, 16, 1, true), this.beamMat);
    this.beam.position.y = 1.6;
    this.root.add(this.beam);

    this.rings = [];
    for (let i = 0; i < 3; i++) {
      const material = this.beamMat.clone();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.035, 8, 32), material);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08 + i * 0.42;
      ring.userData.delay = i * 0.11;
      this.root.add(ring);
      this.rings.push(ring);
    }

    const shardGeo = new THREE.TetrahedronGeometry(0.055, 0);
    this.shards = [];
    for (let i = 0; i < 26; i++) {
      const material = this.beamMat.clone();
      material.opacity = 0.9;
      const mesh = new THREE.Mesh(shardGeo, material);
      const a = Math.random() * Math.PI * 2;
      const r = 0.08 + Math.random() * 0.32;
      mesh.position.set(Math.cos(a) * r, Math.random() * 1.7, Math.sin(a) * r);
      mesh.scale.setScalar(0.7 + Math.random() * 1.5);
      this.root.add(mesh);
      this.shards.push({
        mesh,
        velocity: new THREE.Vector3(Math.cos(a) * (0.35 + Math.random()), 0.7 + Math.random() * 1.5, Math.sin(a) * (0.35 + Math.random())),
        spin: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      });
    }

    this.light = new THREE.PointLight(blue, 3, 7, 2);
    this.light.position.y = 1.1;
    this.root.add(this.light);
    scene.add(this.root);
  }

  update(dt) {
    if (this.life <= 0) return false;
    this.life -= dt;
    const elapsed = this.duration - this.life;
    const fade = THREE.MathUtils.smoothstep(Math.max(this.life, 0), 0, 0.85);
    this.beamMat.opacity = 0.56 * fade;
    this.beam.scale.x = this.beam.scale.z = 0.7 + elapsed * 0.65;
    this.light.intensity = 3 * fade;

    for (const ring of this.rings) {
      const p = Math.max(0, elapsed - ring.userData.delay);
      const scale = 0.25 + p * 3.1;
      ring.scale.setScalar(scale);
      ring.material.opacity = Math.max(0, 0.8 - p * 0.85);
    }
    for (const shard of this.shards) {
      shard.mesh.position.addScaledVector(shard.velocity, dt);
      shard.velocity.y += 0.5 * dt;
      shard.mesh.rotation.x += shard.spin.x * dt;
      shard.mesh.rotation.y += shard.spin.y * dt;
      shard.mesh.rotation.z += shard.spin.z * dt;
      shard.mesh.material.opacity = Math.max(0, fade * 0.95);
    }

    if (this.life <= 0) {
      this.root.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      this.scene.remove(this.root);
      return false;
    }
    return true;
  }
}
