import * as THREE from 'three';
import {
  Candle,
  FairValueGap,
  LevelConfig,
  WorldObject,
} from '../types/market';
import { AnimationController } from './animationController';
import { SpartanAvatar } from './spartanAvatar';

export const CANDLE_SPACING_X = 1.45;
const PRICE_CENTER = 100;
const PRICE_SCALE_Y = 0.72;

export function priceToWorldY(price: number): number {
  return (price - PRICE_CENTER) * PRICE_SCALE_Y;
}

export class ChartScene {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly animations: AnimationController;
  public readonly spartan: SpartanAvatar;

  private gridHelper: THREE.GridHelper;
  private templeGroup: THREE.Group;
  private pillarMaterial: THREE.MeshStandardMaterial;
  private brazierMaterial: THREE.MeshBasicMaterial;
  private rimLight: THREE.PointLight;

  private candleMeshes = new Map<number, THREE.Group>();
  private fvgMeshes = new Map<string, THREE.Group>();
  private objectMeshes = new Map<string, THREE.Group>();

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x160e07, 0.02);

    this.camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      190
    );
    this.camera.position.set(0, 3.5, 19.5);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const ambient = new THREE.AmbientLight(0xffddb3, 0.95);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.5);
    keyLight.position.set(8, 20, 16);
    this.scene.add(keyLight);

    this.rimLight = new THREE.PointLight(0xff8c1a, 3.0, 60);
    this.rimLight.position.set(0, 7, 7);
    this.scene.add(this.rimLight);

    this.gridHelper = new THREE.GridHelper(200, 100, 0x5c3a18, 0x160e07);
    this.gridHelper.position.y = -9.5;
    this.scene.add(this.gridHelper);

    this.pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0xb89668,
      roughness: 0.5,
      metalness: 0.25,
    });
    this.brazierMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8c1a,
    });
    this.templeGroup = new THREE.Group();
    this.buildTempleColonnade();
    this.scene.add(this.templeGroup);

    this.spartan = new SpartanAvatar();
    this.scene.add(this.spartan.root);

    this.animations = new AnimationController(this.scene);
    window.addEventListener('resize', this.handleResize);
  }

  private buildTempleColonnade(): void {
    const colGeom = new THREE.CylinderGeometry(0.7, 0.85, 24, 14);
    const capGeom = new THREE.BoxGeometry(2.2, 0.7, 2.2);
    const flameGeom = new THREE.OctahedronGeometry(0.6, 1);

    for (let i = -5; i <= 5; i++) {
      const x = i * 16;
      const pillar = new THREE.Mesh(colGeom, this.pillarMaterial);
      pillar.position.set(x, 1.5, -7.5);
      this.templeGroup.add(pillar);

      const topCap = new THREE.Mesh(capGeom, this.pillarMaterial);
      topCap.position.set(x, 13.5, -7.5);
      this.templeGroup.add(topCap);

      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.8, 0.4, 0.85, 12),
        this.pillarMaterial
      );
      bowl.position.set(x + 8, -9.0, -3.5);
      this.templeGroup.add(bowl);

      const flame = new THREE.Mesh(flameGeom, this.brazierMaterial);
      flame.position.set(x + 8, -8.0, -3.5);
      this.templeGroup.add(flame);
    }
  }

  public applyLevelTheme(level: LevelConfig): void {
    this.scene.fog = new THREE.FogExp2(level.fogColor, 0.02);
    this.renderer.setClearColor(level.fogColor, 1);
    this.pillarMaterial.color.setHex(level.pillarColor);
    this.brazierMaterial.color.setHex(level.brazierColor);
    this.rimLight.color.setHex(level.brazierColor);

    this.scene.remove(this.gridHelper);
    this.gridHelper = new THREE.GridHelper(
      200,
      100,
      level.gridColor,
      level.fogColor
    );
    this.gridHelper.position.y = -9.5;
    this.scene.add(this.gridHelper);
  }

  public clearAll(): void {
    for (const m of this.candleMeshes.values()) this.scene.remove(m);
    this.candleMeshes.clear();

    for (const m of this.fvgMeshes.values()) this.scene.remove(m);
    this.fvgMeshes.clear();

    for (const m of this.objectMeshes.values()) this.scene.remove(m);
    this.objectMeshes.clear();
  }

  public worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const vec = new THREE.Vector3(worldX, worldY, 0);
    vec.project(this.camera);
    return {
      x: (vec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-vec.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  public syncCandles(candles: Candle[]): void {
    const active = new Set<number>();

    for (const candle of candles) {
      active.add(candle.index);
      if (!this.candleMeshes.has(candle.index)) {
        const group = this.buildCandleMesh(candle);
        group.position.x = candle.index * CANDLE_SPACING_X;
        this.scene.add(group);
        this.candleMeshes.set(candle.index, group);
      }
    }

    for (const [idx, mesh] of this.candleMeshes.entries()) {
      if (!active.has(idx)) {
        this.scene.remove(mesh);
        this.candleMeshes.delete(idx);
      }
    }
  }

  private buildCandleMesh(candle: Candle): THREE.Group {
    const group = new THREE.Group();
    const isBull = candle.close >= candle.open;
    const color = isBull ? 0x10b981 : 0xe11d48;

    const openY = priceToWorldY(candle.open);
    const closeY = priceToWorldY(candle.close);
    const highY = priceToWorldY(candle.high);
    const lowY = priceToWorldY(candle.low);

    const bodyHeight = Math.max(Math.abs(closeY - openY), 0.25);
    const bodyCenterY = (openY + closeY) * 0.5;

    // Flat top platform so the Spartan visibly runs on top of candles!
    const bodyGeom = new THREE.BoxGeometry(1.05, bodyHeight, 1.35);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      roughness: 0.25,
      metalness: 0.2,
    });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    bodyMesh.position.y = bodyCenterY;
    group.add(bodyMesh);

    const wickHeight = Math.max(highY - lowY, 0.25);
    const wickMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, wickHeight, 8),
      new THREE.MeshBasicMaterial({ color })
    );
    wickMesh.position.y = (highY + lowY) * 0.5;
    group.add(wickMesh);

    return group;
  }

  public syncFairValueGaps(gaps: FairValueGap[]): void {
    const active = new Set<string>();

    for (const gap of gaps) {
      active.add(gap.id);
      let group = this.fvgMeshes.get(gap.id);
      if (!group) {
        group = this.buildFvgBridge(gap);
        this.scene.add(group);
        this.fvgMeshes.set(gap.id, group);
      }

      const zoneMesh = group.children[0] as THREE.Mesh;
      const mat = zoneMesh.material as THREE.MeshPhysicalMaterial;
      if (gap.status === 'EXECUTED') {
        mat.color.setHex(0xffd166);
        mat.emissive.setHex(0xffd166);
        mat.opacity = 0.25;
      }
    }

    for (const [id, mesh] of this.fvgMeshes.entries()) {
      if (!active.has(id)) {
        this.scene.remove(mesh);
        this.fvgMeshes.delete(id);
      }
    }
  }

  private buildFvgBridge(gap: FairValueGap): THREE.Group {
    const group = new THREE.Group();
    const isBull = gap.direction === 'BULLISH';
    const color = isBull ? 0x10b981 : 0x38bdf8;

    const topY = priceToWorldY(gap.top);
    const bottomY = priceToWorldY(gap.bottom);
    const ceY = priceToWorldY(gap.ceMidpoint);
    const height = Math.max(topY - bottomY, 0.55);
    const centerY = (topY + bottomY) * 0.5;
    const width = 5.4;
    const centerX = gap.createdAtIndex * CANDLE_SPACING_X + 1.8;

    const zoneMesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 1.5),
      new THREE.MeshPhysicalMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.42,
        transparent: true,
        opacity: 0.4,
      })
    );
    zoneMesh.position.set(centerX, centerY, 0);
    group.add(zoneMesh);

    // 50% CE Gold Beam
    const ceBeam = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.2, 0.14, 1.65),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    ceBeam.position.set(centerX, ceY, 0);
    group.add(ceBeam);

    return group;
  }

  public syncWorldObjects(objects: WorldObject[], timeSec: number): void {
    const active = new Set<string>();

    for (const obj of objects) {
      if (obj.collectedOrBroken) continue;
      active.add(obj.id);

      let group = this.objectMeshes.get(obj.id);
      if (!group) {
        group = this.buildObjectMesh(obj);
        this.scene.add(group);
        this.objectMeshes.set(obj.id, group);
      }

      group.position.set(obj.worldX, obj.worldY, 0);
      if (obj.kind === 'DOLLAR_ORB') {
        group.rotation.y = timeSec * 3.5;
        group.position.y = obj.worldY + Math.sin(timeSec * 5 + obj.worldX) * 0.16;
      } else if (obj.kind === 'ORDER_BLOCK_CHEST') {
        group.rotation.y = Math.sin(timeSec * 2) * 0.25;
      } else if (obj.kind === 'HADES_SPIKE_TRAP') {
        group.rotation.z = timeSec * 4.5;
      }
    }

    for (const [id, mesh] of this.objectMeshes.entries()) {
      if (!active.has(id)) {
        this.scene.remove(mesh);
        this.objectMeshes.delete(id);
      }
    }
  }

  private buildObjectMesh(obj: WorldObject): THREE.Group {
    const group = new THREE.Group();

    if (obj.kind === 'DOLLAR_ORB') {
      // Glowing Gold Dollar Coin / Orb with Outer Halo Ring
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.36, 1),
        new THREE.MeshBasicMaterial({ color: 0xffd166 })
      );
      group.add(core);

      const halo = new THREE.Mesh(
        new THREE.RingGeometry(0.45, 0.56, 20),
        new THREE.MeshBasicMaterial({
          color: 0xff9f1c,
          side: THREE.DoubleSide,
        })
      );
      group.add(halo);
    } else if (obj.kind === 'ORDER_BLOCK_CHEST') {
      // Ornate Golden-Crimson Spartan Treasure Chest
      const box = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.88, 0.95),
        new THREE.MeshStandardMaterial({
          color: 0x991b1b,
          emissive: 0x450a0a,
          roughness: 0.3,
        })
      );
      group.add(box);

      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(1.24, 0.22, 1.04),
        new THREE.MeshBasicMaterial({ color: 0xffd166 })
      );
      trim.position.y = 0.22;
      group.add(trim);
    } else if (obj.kind === 'HADES_SPIKE_TRAP') {
      // Spinning Crimson Hades Saw-Blade / Spike Hazard
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.72, 0),
        new THREE.MeshBasicMaterial({ color: 0xf43f5e })
      );
      group.add(star);

      const inner = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.72, 0),
        new THREE.MeshBasicMaterial({ color: 0xff8fa3 })
      );
      inner.rotation.z = Math.PI / 4;
      group.add(inner);
    }

    return group;
  }

  public updateCameraAndRender(
    dt: number,
    runnerX: number,
    runnerY: number
  ): void {
    this.animations.update(dt);
    const { shakeX, shakeY, zoomOffset } = this.animations.getCameraOffsets(dt);

    const desiredX = runnerX + 4.2;
    const desiredY = runnerY + 1.8;

    this.camera.position.x +=
      (desiredX - this.camera.position.x) * Math.min(1, dt * 8) + shakeX;
    this.camera.position.y +=
      (desiredY - this.camera.position.y) * Math.min(1, dt * 5.5) + shakeY;
    this.camera.position.z = 18.8 + zoomOffset;

    this.gridHelper.position.x = this.camera.position.x;
    this.templeGroup.position.x = Math.floor(this.camera.position.x / 16) * 16;

    this.camera.lookAt(runnerX + 4.6, runnerY + 0.8, 0);
    this.renderer.render(this.scene, this.camera);
  }

  private handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
