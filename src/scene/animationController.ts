import * as THREE from 'three';

interface Shockwave {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
}

interface ShatterShard {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  spin: THREE.Vector3;
  age: number;
  maxAge: number;
}

interface OlympusOrbParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
}

export class AnimationController {
  private scene: THREE.Scene;
  private shockwaves: Shockwave[] = [];
  private shards: ShatterShard[] = [];
  private orbs: OlympusOrbParticle[] = [];

  private hitstopTimer = 0;
  private cameraShake = 0;
  private zoomPunch = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public triggerHitstop(durationSec = 0.2): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, durationSec);
    this.zoomPunch = 1.9;
  }

  public triggerCameraShake(intensity = 0.65): void {
    this.cameraShake = Math.min(1.5, this.cameraShake + intensity);
  }

  public getTimeScale(rawDt: number): number {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - rawDt);
      return 0.2;
    }
    return 1.0;
  }

  public getCameraOffsets(dt: number): {
    shakeX: number;
    shakeY: number;
    zoomOffset: number;
  } {
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.6);
    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 5.2);

    const mag = this.cameraShake * this.cameraShake * 0.45;
    return {
      shakeX: (Math.random() - 0.5) * mag,
      shakeY: (Math.random() - 0.5) * mag,
      zoomOffset: -this.zoomPunch,
    };
  }

  public spawnShockwave(position: THREE.Vector3, colorHex: number): void {
    const geom = new THREE.RingGeometry(0.35, 0.65, 32);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);
    this.scene.add(mesh);
    this.shockwaves.push({ mesh, age: 0, maxAge: 0.62 });
  }

  /**
   * Shatters broken Hades traps or Order Block Chests into 3D flying fragments!
   */
  public spawnObjectShatter(
    position: THREE.Vector3,
    colorHex: number,
    count = 14
  ): void {
    const geom = new THREE.OctahedronGeometry(0.24, 0);
    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(position);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 5.5;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.5 + Math.random() * 5.0,
        (Math.random() - 0.5) * 4.5
      );
      const spin = new THREE.Vector3(
        Math.random() * 12,
        Math.random() * 12,
        Math.random() * 12
      );

      this.scene.add(mesh);
      this.shards.push({ mesh, velocity, spin, age: 0, maxAge: 0.85 });
    }
  }

  public spawnOlympusOrbs(
    position: THREE.Vector3,
    count = 24,
    isLoss = false
  ): void {
    const orbGeom = new THREE.SphereGeometry(0.16, 10, 10);
    for (let i = 0; i < count; i++) {
      const color = isLoss ? 0xdc2626 : i % 3 === 0 ? 0xff3b30 : 0xffd166;
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(orbGeom, mat);
      mesh.position.copy(position);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 4.5;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        3.0 + Math.random() * 4.5,
        (Math.random() - 0.5) * 3.0
      );

      this.scene.add(mesh);
      this.orbs.push({ mesh, velocity, age: 0, maxAge: 0.95 });
    }
  }

  public update(dt: number): void {
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.age += dt;
      const t = sw.age / sw.maxAge;
      if (t >= 1) {
        this.scene.remove(sw.mesh);
        sw.mesh.geometry.dispose();
        (sw.mesh.material as THREE.Material).dispose();
        this.shockwaves.splice(i, 1);
      } else {
        const scale = 1 + t * 7.5;
        sw.mesh.scale.setScalar(scale);
        (sw.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      }
    }

    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      sh.age += dt;
      const t = sh.age / sh.maxAge;
      if (t >= 1) {
        this.scene.remove(sh.mesh);
        (sh.mesh.material as THREE.Material).dispose();
        this.shards.splice(i, 1);
      } else {
        sh.mesh.position.addScaledVector(sh.velocity, dt);
        sh.velocity.y -= 13.5 * dt;
        sh.mesh.rotation.x += sh.spin.x * dt;
        sh.mesh.rotation.y += sh.spin.y * dt;
        (sh.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      }
    }

    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const orb = this.orbs[i];
      orb.age += dt;
      const t = orb.age / orb.maxAge;
      if (t >= 1) {
        this.scene.remove(orb.mesh);
        (orb.mesh.material as THREE.Material).dispose();
        this.orbs.splice(i, 1);
      } else {
        orb.mesh.position.addScaledVector(orb.velocity, dt);
        if (t > 0.3) {
          orb.velocity.y += 14.0 * dt;
          orb.velocity.x += 5.0 * dt;
        }
        (orb.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t * 0.85;
      }
    }
  }
}
