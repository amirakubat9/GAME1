import * as THREE from 'three';

interface Shockwave {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
}

interface ParticleBurst {
  points: THREE.Points;
  velocities: Float32Array;
  age: number;
  maxAge: number;
}

/**
 * Handles trader "juice" animations:
 * - Hitstop time-dilation on 50% CE Sniper Fills
 * - Spring camera trauma / shake on News Spikes & Stop-Outs
 * - Expanding 3D shockwave rings & glass-shatter particle bursts
 */
export class AnimationController {
  private scene: THREE.Scene;
  private shockwaves: Shockwave[] = [];
  private bursts: ParticleBurst[] = [];

  private hitstopTimer = 0;
  private cameraShake = 0;
  private zoomPunch = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public triggerHitstop(durationSec = 0.24): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, durationSec);
    this.zoomPunch = 1.6;
  }

  public triggerCameraShake(intensity = 0.55): void {
    this.cameraShake = Math.min(1.4, this.cameraShake + intensity);
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
    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 5.5);

    const mag = this.cameraShake * this.cameraShake * 0.45;
    return {
      shakeX: (Math.random() - 0.5) * mag,
      shakeY: (Math.random() - 0.5) * mag,
      zoomOffset: -this.zoomPunch,
    };
  }

  public spawnShockwave(position: THREE.Vector3, colorHex: number): void {
    const geom = new THREE.RingGeometry(0.25, 0.45, 36);
    const mat = new THREE.MeshBasicMaterial({
      color: colorHex,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.95,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(position);
    this.scene.add(mesh);

    this.shockwaves.push({
      mesh,
      age: 0,
      maxAge: 0.65,
    });
  }

  public spawnParticles(
    position: THREE.Vector3,
    colorHex: number,
    count = 28
  ): void {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;

      const angle = Math.random() * Math.PI * 2;
      const speed = 1.8 + Math.random() * 4.5;
      velocities[i * 3] = Math.cos(angle) * speed;
      velocities[i * 3 + 1] = Math.sin(angle) * speed + 1.2;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 3.5;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.22,
      transparent: true,
      opacity: 1,
    });

    const points = new THREE.Points(geom, mat);
    this.scene.add(points);

    this.bursts.push({
      points,
      velocities,
      age: 0,
      maxAge: 0.75,
    });
  }

  public update(dt: number): void {
    // Update expanding shockwaves
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
        sw.mesh.scale.set(scale, scale, 1);
        (sw.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      }
    }

    // Update particle bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.age += dt;
      const t = b.age / b.maxAge;
      if (t >= 1) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        (b.points.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
      } else {
        const attr = b.points.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const count = arr.length / 3;
        for (let j = 0; j < count; j++) {
          arr[j * 3] += b.velocities[j * 3] * dt;
          arr[j * 3 + 1] += b.velocities[j * 3 + 1] * dt;
          arr[j * 3 + 2] += b.velocities[j * 3 + 2] * dt;
          b.velocities[j * 3 + 1] -= 7.5 * dt; // gravity
        }
        attr.needsUpdate = true;
        (b.points.material as THREE.PointsMaterial).opacity = 1 - t;
      }
    }
  }
}
