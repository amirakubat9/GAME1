import * as THREE from 'three';

/**
 * 3D Spartan Warrior Avatar with Crimson Cape, Gold Crest Helmet,
 * and Dual Glowing Blades of Chaos!
 */
export class SpartanAvatar {
  public readonly root = new THREE.Group();
  private bodyGroup = new THREE.Group();
  private leftLeg: THREE.Mesh;
  private rightLeg: THREE.Mesh;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private cape: THREE.Mesh;
  private slashAura: THREE.Mesh;
  private rageAura: THREE.Mesh;

  private runCycle = 0;
  private slashAnimTimer = 0;

  constructor() {
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd9a077,
      roughness: 0.45,
    });
    const crimsonMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      emissive: 0x450a0a,
      roughness: 0.5,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0x78350f,
      metalness: 0.65,
      roughness: 0.25,
    });
    const bladeMat = new THREE.MeshBasicMaterial({
      color: 0xff6b00,
    });

    // Torso
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.92, 0.44),
      skinMat
    );
    torso.position.y = 1.25;
    this.bodyGroup.add(torso);

    // Spartan Belt & Skirt
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(0.78, 0.28, 0.48),
      crimsonMat
    );
    belt.position.y = 0.78;
    this.bodyGroup.add(belt);

    // Helmet + Red Crest Plume
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.52, 0.54, 0.52),
      goldMat
    );
    head.position.y = 2.02;
    this.bodyGroup.add(head);

    const crest = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.34, 0.68),
      crimsonMat
    );
    crest.position.set(0, 2.38, -0.04);
    this.bodyGroup.add(crest);

    // Flowing Spartan Cape
    this.cape = new THREE.Mesh(
      new THREE.BoxGeometry(0.68, 1.15, 0.08),
      crimsonMat
    );
    this.cape.position.set(-0.28, 1.15, -0.26);
    this.cape.rotation.z = 0.28;
    this.bodyGroup.add(this.cape);

    // Legs
    const legGeom = new THREE.BoxGeometry(0.24, 0.72, 0.26);
    this.leftLeg = new THREE.Mesh(legGeom, skinMat);
    this.leftLeg.position.set(0.15, 0.36, 0.14);
    this.bodyGroup.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeom, skinMat);
    this.rightLeg.position.set(-0.15, 0.36, -0.14);
    this.bodyGroup.add(this.rightLeg);

    // Left & Right Arms holding glowing Blades of Chaos
    this.leftArm = this.buildBladeArm(skinMat, bladeMat);
    this.leftArm.position.set(0.18, 1.48, 0.36);
    this.bodyGroup.add(this.leftArm);

    this.rightArm = this.buildBladeArm(skinMat, bladeMat);
    this.rightArm.position.set(0.18, 1.48, -0.36);
    this.bodyGroup.add(this.rightArm);

    this.root.add(this.bodyGroup);

    // 360-degree Fiery Cyclone Slash Ring
    const slashGeom = new THREE.RingGeometry(1.35, 2.25, 32);
    const slashMat = new THREE.MeshBasicMaterial({
      color: 0xff7b00,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    this.slashAura = new THREE.Mesh(slashGeom, slashMat);
    this.slashAura.position.set(0.4, 1.2, 0);
    this.root.add(this.slashAura);

    // Spartan Rage Golden Aura Sphere
    const rageGeom = new THREE.SphereGeometry(1.45, 18, 18);
    const rageMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      wireframe: true,
      transparent: true,
      opacity: 0,
    });
    this.rageAura = new THREE.Mesh(rageGeom, rageMat);
    this.rageAura.position.set(0, 1.25, 0);
    this.root.add(this.rageAura);
  }

  private buildBladeArm(
    skinMat: THREE.Material,
    bladeMat: THREE.Material
  ): THREE.Group {
    const group = new THREE.Group();
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.22, 0.22),
      skinMat
    );
    arm.position.x = 0.24;
    group.add(arm);

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.26, 0.06),
      bladeMat
    );
    blade.position.set(0.75, 0.08, 0);
    blade.rotation.z = 0.25;
    group.add(blade);

    return group;
  }

  public triggerSlash(): void {
    this.slashAnimTimer = 0.34;
  }

  public update(dt: number, isGrounded: boolean, isRageActive: boolean): void {
    this.runCycle += dt * 15;

    if (isGrounded) {
      this.leftLeg.rotation.z = Math.sin(this.runCycle) * 0.75;
      this.rightLeg.rotation.z = -Math.sin(this.runCycle) * 0.75;
      this.bodyGroup.position.y = Math.abs(Math.cos(this.runCycle)) * 0.14;
      this.bodyGroup.rotation.z = -0.12; // Forward sprint lean
    } else {
      // Mid-air heroic leap pose
      this.leftLeg.rotation.z = 0.55;
      this.rightLeg.rotation.z = -0.45;
      this.bodyGroup.rotation.z = -0.22;
    }

    // Cape billowing
    this.cape.rotation.z = 0.32 + Math.sin(this.runCycle * 1.3) * 0.14;

    // Blade slash cyclone animation
    const slashMat = this.slashAura.material as THREE.MeshBasicMaterial;
    if (this.slashAnimTimer > 0) {
      this.slashAnimTimer = Math.max(0, this.slashAnimTimer - dt);
      const t = 1 - this.slashAnimTimer / 0.34;
      this.slashAura.rotation.z += dt * 22;
      this.slashAura.scale.setScalar(0.85 + t * 0.75);
      slashMat.opacity = (1 - t) * 0.92;
      this.leftArm.rotation.y = Math.sin(t * Math.PI * 2) * 1.4;
      this.rightArm.rotation.y = -Math.sin(t * Math.PI * 2) * 1.4;
    } else {
      slashMat.opacity = 0;
      this.leftArm.rotation.y = Math.cos(this.runCycle) * 0.35;
      this.rightArm.rotation.y = -Math.cos(this.runCycle) * 0.35;
    }

    // Spartan Rage wireframe aura
    const rageMat = this.rageAura.material as THREE.MeshBasicMaterial;
    if (isRageActive) {
      rageMat.opacity = 0.42;
      this.rageAura.rotation.y += dt * 4.5;
      this.rageAura.rotation.x += dt * 2.5;
    } else {
      rageMat.opacity = 0;
    }
  }
}
