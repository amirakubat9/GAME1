import * as THREE from 'three';

interface Shockwave {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
}

interface BladeSlash {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
  spinSpeed: number;
}

interface OlympusOrb {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
}

interface VictoryBeam {
  mesh: THREE.Mesh;
  age: number;
  maxAge: number;
}

/**
 * God of War II Winning Juice & Combat Animation Controller:
 * - Sweeping fiery Blades of Chaos crescent slashes across mitigated FVGs
 * - Fountains of glowing Red & Gold Olympus Orbs spiraling skyward
 * - Vertical Golden Pillar of Light on Sniper 50% CE wins
 * - 0.25s Hitstop slow-motion + camera zoom-punch & earthquake trauma
 */
export class AnimationController {
  private scene: THREE.Scene;
  private shockwaves: Shockwave[] = [];
  private slashes: BladeSlash[] = [];
  private orbs: OlympusOrb[] = [];
  private beams: VictoryBeam[] = [];

  private hitstopTimer = 0;
  private cameraShake = 0;
  private zoomPunch = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public triggerHitstop(durationSec = 0.25): void {
    this.hitstopTimer = Math.max(this.hitstopTimer, durationSec);
    this.zoomPunch = 2.1;
  }

  public triggerCameraShake(intensity = 0.6): void {
    this.cameraShake = Math.min(1.5, this.cameraShake + intensity);
  }

  public getTimeScale(rawDt: number): number {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - rawDt);
      return 0.18;
    }
    return 1.0;
  }

  public getCameraOffsets(dt: number): {
    shakeX: number;
    shakeY: number;
    zoomOffset: number;
  } {
    this.cameraShake = Math.max(0, this.cameraShake - dt * 2.5);
    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 5.0);

    const mag = this.cameraShake * this.cameraShake * 0.48;
    return {
      shakeX: (Math.random() - 0.5) * mag,
      shakeY: (Math.random() - 0.5) * mag,
      zoomOffset: -this.zoomPunch,
    };
  }

  public spawnShockwave(position: THREE.Vector3, colorHex: number): void {
    const geom = new THREE.RingGeometry(0.3, 0.55, 36);
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
      maxAge: 0.7,
    });
  }

  /**
   * Sweeping fiery Blades of Chaos crescent slash animation
   */
  public spawnBladeSlash(position: THREE.Vector3, isDoubleCross = false): void {
    const angles = isDoubleCross ? [-0.65, 0.65] : [-0.45];

    for (const tilt of angles) {
      const geom = new THREE.RingGeometry(1.4, 2.05, 32, 1, -Math.PI * 0.35, Math.PI * 0.7);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xff6b00,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(position);
      mesh.position.z += 0.6;
      mesh.rotation.z = tilt;
      this.scene.add(mesh);

      this.slashes.push({
        mesh,
        age: 0,
        maxAge: 0.45,
        spinSpeed: tilt >= 0 ? 7.5 : -7.5,
      });
    }
  }

  /**
   * Classic God of War Red & Gold Orbs erupting from a winning trade
   */
  public spawnOlympusOrbs(
    position: THREE.Vector3,
    count = 26,
    isLoss = false
  ): void {
    const orbGeom = new THREE.SphereGeometry(0.16, 10, 10);

    for (let i = 0; i < count; i++) {
      const isGold = !isLoss && i % 3 !== 0;
      const color = isLoss ? 0xdc2626 : isGold ? 0xffd166 : 0xff3b30;

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
        isLoss ? 1.5 + Math.random() * 2 : 3.2 + Math.random() * 4.5,
        (Math.random() - 0.5) * 3.0
      );

      this.scene.add(mesh);
      this.orbs.push({
        mesh,
        velocity,
        age: 0,
        maxAge: 1.05,
      });
    }
  }

  public spawnVictoryBeam(position: THREE.Vector3): void {
    const geom = new THREE.CylinderGeometry(0.45, 0.9, 26, 16, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set(position.x, position.y + 4, position.z - 0.3);
    this.scene.add(mesh);

    this.beams.push({
      mesh,
      age: 0,
      maxAge: 0.75,
    });
  }

  public update(dt: number): void {
    // Shockwaves
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
        const scale = 1 + t * 8.0;
        sw.mesh.scale.set(scale, scale, 1);
        (sw.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      }
    }

    // Blades of Chaos slashes
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const sl = this.slashes[i];
      sl.age += dt;
      const t = sl.age / sl.maxAge;
      if (t >= 1) {
        this.scene.remove(sl.mesh);
        sl.mesh.geometry.dispose();
        (sl.mesh.material as THREE.Material).dispose();
        this.slashes.splice(i, 1);
      } else {
        sl.mesh.rotation.z += sl.spinSpeed * dt;
        const scale = 0.8 + t * 1.4;
        sl.mesh.scale.set(scale, scale, 1);
        (sl.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      }
    }

    // Olympus Orbs
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
        // After initial fountain burst, pull orbs upward toward the Dollar Balance HUD
        if (t > 0.35) {
          orb.velocity.y += 14.0 * dt;
          orb.velocity.x += 4.5 * dt;
        } else {
          orb.velocity.y -= 4.0 * dt;
        }
        (orb.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t * 0.85;
      }
    }

    // Victory Beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.age += dt;
      const t = b.age / b.maxAge;
      if (t >= 1) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.beams.splice(i, 1);
      } else {
        b.mesh.scale.set(1 - t * 0.5, 1, 1 - t * 0.5);
        (b.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t);
      }
    }
  }
}
