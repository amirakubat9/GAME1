import * as THREE from 'three';
import { Candle, FairValueGap, LevelConfig } from '../types/market';
import { AnimationController } from './animationController';

interface CandleVisual {
  group: THREE.Group;
  spawnProgress: number;
}

interface FvgVisual {
  gap: FairValueGap;
  group: THREE.Group;
  zoneMesh: THREE.Mesh;
  ceLineMesh: THREE.Mesh;
  entryLineMesh: THREE.Mesh;
  flipRotation: number;
}

const CANDLE_SPACING_X = 1.15;
const PRICE_CENTER = 100;
const PRICE_SCALE_Y = 0.85;

export function priceToWorldY(price: number): number {
  return (price - PRICE_CENTER) * PRICE_SCALE_Y;
}

export function worldYToPrice(y: number): number {
  return y / PRICE_SCALE_Y + PRICE_CENTER;
}

/**
 * 3D Greco-Roman Olympus Arena + Candlestick & Fair Value Gap Chart
 */
export class ChartScene {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly animations: AnimationController;

  private gridHelper: THREE.GridHelper;
  private templeGroup: THREE.Group;
  private pillarMaterial: THREE.MeshStandardMaterial;
  private brazierMaterial: THREE.MeshBasicMaterial;
  private rimLight: THREE.PointLight;

  private candleVisuals = new Map<number, CandleVisual>();
  private fvgVisuals = new Map<string, FvgVisual>();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();

  private latestCandleIndex = 0;
  private targetCameraX = 0;
  private targetCameraY = 0;

  private onGapSelected: (gap: FairValueGap, clickedPrice: number) => void;

  constructor(
    canvas: HTMLCanvasElement,
    onGapSelected: (gap: FairValueGap, clickedPrice: number) => void
  ) {
    this.onGapSelected = onGapSelected;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x160e07, 0.022);

    this.camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      180
    );
    this.camera.position.set(0, 2, 22);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const ambient = new THREE.AmbientLight(0xffddb3, 0.9);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 1.45);
    keyLight.position.set(8, 18, 16);
    this.scene.add(keyLight);

    this.rimLight = new THREE.PointLight(0xff8c1a, 2.8, 55);
    this.rimLight.position.set(0, 7, 7);
    this.scene.add(this.rimLight);

    this.gridHelper = new THREE.GridHelper(180, 90, 0x5c3a18, 0x160e07);
    this.gridHelper.position.y = -11;
    this.scene.add(this.gridHelper);

    // Build Greco-Roman Marble Columns & Burning Fire Braziers
    this.pillarMaterial = new THREE.MeshStandardMaterial({
      color: 0xb89668,
      roughness: 0.55,
      metalness: 0.25,
    });
    this.brazierMaterial = new THREE.MeshBasicMaterial({
      color: 0xff8c1a,
    });
    this.templeGroup = new THREE.Group();
    this.buildTempleColonnade();
    this.scene.add(this.templeGroup);

    this.animations = new AnimationController(this.scene);

    window.addEventListener('resize', this.handleResize);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
  }

  private buildTempleColonnade(): void {
    const colGeom = new THREE.CylinderGeometry(0.65, 0.8, 24, 14);
    const capGeom = new THREE.BoxGeometry(2.1, 0.7, 2.1);
    const flameGeom = new THREE.OctahedronGeometry(0.55, 1);

    for (let i = -5; i <= 5; i++) {
      const x = i * 14;
      const pillar = new THREE.Mesh(colGeom, this.pillarMaterial);
      pillar.position.set(x, 1, -7.5);
      this.templeGroup.add(pillar);

      const topCap = new THREE.Mesh(capGeom, this.pillarMaterial);
      topCap.position.set(x, 13, -7.5);
      this.templeGroup.add(topCap);

      const baseCap = new THREE.Mesh(capGeom, this.pillarMaterial);
      baseCap.position.set(x, -10.6, -7.5);
      this.templeGroup.add(baseCap);

      // Foreground burning brazier bowl + flame
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.35, 0.8, 12),
        this.pillarMaterial
      );
      bowl.position.set(x + 7, -10.5, -3.8);
      this.templeGroup.add(bowl);

      const flame = new THREE.Mesh(flameGeom, this.brazierMaterial);
      flame.position.set(x + 7, -9.6, -3.8);
      this.templeGroup.add(flame);
    }
  }

  public applyLevelTheme(level: LevelConfig): void {
    this.scene.fog = new THREE.FogExp2(level.fogColor, 0.022);
    this.renderer.setClearColor(level.fogColor, 1);
    this.pillarMaterial.color.setHex(level.pillarColor);
    this.brazierMaterial.color.setHex(level.brazierColor);
    this.rimLight.color.setHex(level.brazierColor);

    this.scene.remove(this.gridHelper);
    this.gridHelper = new THREE.GridHelper(
      180,
      90,
      level.gridColor,
      level.fogColor
    );
    this.gridHelper.position.y = -11;
    this.scene.add(this.gridHelper);
  }

  public clearAll(): void {
    for (const cv of this.candleVisuals.values()) {
      this.scene.remove(cv.group);
    }
    this.candleVisuals.clear();

    for (const fv of this.fvgVisuals.values()) {
      this.scene.remove(fv.group);
    }
    this.fvgVisuals.clear();
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
    const activeIds = new Set<number>();

    for (const candle of candles) {
      activeIds.add(candle.index);
      this.latestCandleIndex = Math.max(this.latestCandleIndex, candle.index);

      if (!this.candleVisuals.has(candle.index)) {
        const group = this.buildCandleMesh(candle);
        group.position.x = candle.index * CANDLE_SPACING_X;
        this.scene.add(group);
        this.candleVisuals.set(candle.index, {
          group,
          spawnProgress: 0,
        });

        if (candle.isNewsSpike) {
          this.animations.triggerCameraShake(0.7);
        }
      }
    }

    for (const [idx, cv] of this.candleVisuals.entries()) {
      if (!activeIds.has(idx)) {
        this.scene.remove(cv.group);
        this.candleVisuals.delete(idx);
      }
    }

    const latest = candles[candles.length - 1];
    if (latest) {
      this.targetCameraX = latest.index * CANDLE_SPACING_X - 2.5;
      this.targetCameraY = priceToWorldY(latest.close) * 0.55;
      this.gridHelper.position.x = this.targetCameraX;
      // Keep temple colonnade endlessly wrapping around camera
      this.templeGroup.position.x = Math.floor(this.targetCameraX / 14) * 14;
    }
  }

  private buildCandleMesh(candle: Candle): THREE.Group {
    const group = new THREE.Group();
    const isBull = candle.close >= candle.open;
    const color = candle.isNewsSpike
      ? 0xffd166
      : isBull
      ? 0x10b981
      : 0xe11d48;

    const openY = priceToWorldY(candle.open);
    const closeY = priceToWorldY(candle.close);
    const highY = priceToWorldY(candle.high);
    const lowY = priceToWorldY(candle.low);

    const bodyHeight = Math.max(Math.abs(closeY - openY), 0.16);
    const bodyCenterY = (openY + closeY) * 0.5;

    const bodyGeom = new THREE.BoxGeometry(0.64, bodyHeight, 0.64);
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: candle.isNewsSpike ? 0.6 : 0.3,
      roughness: 0.22,
      metalness: 0.18,
    });
    const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
    bodyMesh.position.y = bodyCenterY;
    group.add(bodyMesh);

    const wickHeight = Math.max(highY - lowY, 0.2);
    const wickCenterY = (highY + lowY) * 0.5;
    const wickGeom = new THREE.CylinderGeometry(0.06, 0.06, wickHeight, 8);
    const wickMat = new THREE.MeshBasicMaterial({ color });
    const wickMesh = new THREE.Mesh(wickGeom, wickMat);
    wickMesh.position.y = wickCenterY;
    group.add(wickMesh);

    if (candle.isLiquiditySweep) {
      const sweepGeom = new THREE.RingGeometry(0.28, 0.44, 20);
      const sweepMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(sweepGeom, sweepMat);
      ring.position.y = isBull ? lowY : highY;
      group.add(ring);
    }

    return group;
  }

  public syncFairValueGaps(gaps: FairValueGap[]): void {
    const validIds = new Set<string>();

    for (const gap of gaps) {
      if (this.latestCandleIndex - gap.createdAtIndex > 28) continue;
      validIds.add(gap.id);

      let visual = this.fvgVisuals.get(gap.id);
      if (!visual) {
        visual = this.buildFvgMesh(gap);
        this.scene.add(visual.group);
        this.fvgVisuals.set(gap.id, visual);
      }

      this.updateFvgMesh(visual);
    }

    for (const [id, fv] of this.fvgVisuals.entries()) {
      if (!validIds.has(id)) {
        this.scene.remove(fv.group);
        this.fvgVisuals.delete(id);
      }
    }
  }

  private buildFvgMesh(gap: FairValueGap): FvgVisual {
    const group = new THREE.Group();
    const isBull = gap.direction === 'BULLISH';
    const baseColor = isBull ? 0x10b981 : 0x38bdf8;

    const topY = priceToWorldY(gap.top);
    const bottomY = priceToWorldY(gap.bottom);
    const ceY = priceToWorldY(gap.ceMidpoint);
    const height = Math.max(topY - bottomY, 0.25);
    const centerY = (topY + bottomY) * 0.5;
    const width = 9.5;

    const zoneGeom = new THREE.BoxGeometry(width, height, 0.35);
    const zoneMat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      emissive: baseColor,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.36,
      roughness: 0.15,
    });
    const zoneMesh = new THREE.Mesh(zoneGeom, zoneMat);
    zoneMesh.position.set(
      (gap.createdAtIndex - 1) * CANDLE_SPACING_X + width * 0.5,
      centerY,
      -0.15
    );
    zoneMesh.userData = { fvgId: gap.id };
    group.add(zoneMesh);

    const ceGeom = new THREE.BoxGeometry(width, 0.08, 0.45);
    const ceMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
    });
    const ceLineMesh = new THREE.Mesh(ceGeom, ceMat);
    ceLineMesh.position.set(zoneMesh.position.x, ceY, 0.05);
    group.add(ceLineMesh);

    const entryGeom = new THREE.BoxGeometry(width + 0.35, 0.12, 0.54);
    const entryMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    const entryLineMesh = new THREE.Mesh(entryGeom, entryMat);
    entryLineMesh.position.set(zoneMesh.position.x, ceY, 0.12);
    entryLineMesh.visible = false;
    group.add(entryLineMesh);

    return {
      gap,
      group,
      zoneMesh,
      ceLineMesh,
      entryLineMesh,
      flipRotation: 0,
    };
  }

  private updateFvgMesh(visual: FvgVisual): void {
    const { gap, zoneMesh, entryLineMesh } = visual;
    const mat = zoneMesh.material as THREE.MeshPhysicalMaterial;

    if (gap.status === 'ORDER_PLACED' && gap.orderEntryPrice !== null) {
      entryLineMesh.visible = true;
      entryLineMesh.position.y = priceToWorldY(gap.orderEntryPrice);
      mat.opacity = 0.55;
      mat.emissiveIntensity = 0.65;
    } else if (gap.status === 'MITIGATED') {
      mat.color.setHex(0xffd166);
      mat.emissive.setHex(0xffd166);
      mat.opacity = 0.18;
      mat.emissiveIntensity = 0.3;
    } else if (gap.status === 'INVALIDATED_IFVG') {
      mat.color.setHex(0xe11d48);
      mat.emissive.setHex(0xe11d48);
      mat.opacity = 0.44;
      mat.emissiveIntensity = 0.7;
    }
  }

  public triggerGapFeedback(
    gap: FairValueGap,
    won: boolean,
    isSniper = false
  ): void {
    const visual = this.fvgVisuals.get(gap.id);
    if (!visual) return;

    const pos = visual.zoneMesh.position.clone();
    pos.z = 0.5;

    if (won) {
      this.animations.spawnShockwave(pos, 0xffd166);
      this.animations.spawnBladeSlash(pos, isSniper);
      this.animations.spawnOlympusOrbs(pos, isSniper ? 36 : 22, false);
      if (isSniper) {
        this.animations.spawnVictoryBeam(pos);
      }
    } else {
      this.animations.spawnShockwave(pos, 0xe11d48);
      this.animations.spawnOlympusOrbs(pos, 18, true);
      this.animations.triggerCameraShake(0.85);
      visual.flipRotation = Math.PI;
    }
  }

  private handlePointerDown = (event: PointerEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);

    const targets: THREE.Object3D[] = [];
    for (const fv of this.fvgVisuals.values()) {
      if (fv.gap.status === 'OPEN' || fv.gap.status === 'ORDER_PLACED') {
        targets.push(fv.zoneMesh);
      }
    }

    const hits = this.raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      const hit = hits[0];
      const fvgId = hit.object.userData.fvgId as string;
      const visual = this.fvgVisuals.get(fvgId);
      if (visual) {
        const clickedPrice = worldYToPrice(hit.point.y);
        this.onGapSelected(visual.gap, clickedPrice);
      }
    }
  };

  public render(dt: number): void {
    for (const cv of this.candleVisuals.values()) {
      if (cv.spawnProgress < 1) {
        cv.spawnProgress = Math.min(1, cv.spawnProgress + dt * 5.2);
        const t = cv.spawnProgress - 1;
        const scale = 1 + 2.2 * t * t * t + 1.2 * t * t;
        cv.group.scale.set(scale, scale, scale);
      }
    }

    for (const fv of this.fvgVisuals.values()) {
      if (fv.flipRotation > 0) {
        const step = Math.min(fv.flipRotation, dt * 9.5);
        fv.zoneMesh.rotation.x += step;
        fv.flipRotation -= step;
      }
    }

    this.animations.update(dt);

    const { shakeX, shakeY, zoomOffset } = this.animations.getCameraOffsets(dt);
    this.camera.position.x +=
      (this.targetCameraX - this.camera.position.x) * Math.min(1, dt * 4.5) +
      shakeX;
    this.camera.position.y +=
      (this.targetCameraY + 1.5 - this.camera.position.y) *
        Math.min(1, dt * 4.5) +
      shakeY;
    this.camera.position.z = 21.5 + zoomOffset;

    this.camera.lookAt(
      this.camera.position.x + 2.2,
      this.camera.position.y - 1.2,
      0
    );

    this.renderer.render(this.scene, this.camera);
  }

  private handleResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  };
}
