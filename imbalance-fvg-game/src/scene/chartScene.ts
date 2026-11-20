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
 * Renders the 3D institutional candlestick chart, glowing Fair Value Gap bridges,
 * 50% Consequent Encroachment (CE) equilibrium lines, and touch/mouse raycasting.
 */
export class ChartScene {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly animations: AnimationController;

  private gridHelper: THREE.GridHelper;
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
    this.scene.fog = new THREE.FogExp2(0x060913, 0.022);

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

    // Three-point institutional lighting
    const ambient = new THREE.AmbientLight(0x9fb8ff, 0.85);
    this.scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
    keyLight.position.set(8, 18, 16);
    this.scene.add(keyLight);

    const rimLight = new THREE.PointLight(0x00f5a0, 2.2, 45);
    rimLight.position.set(0, 8, 8);
    this.scene.add(rimLight);

    // Perspective market floor grid
    this.gridHelper = new THREE.GridHelper(160, 80, 0x223b70, 0x111d38);
    this.gridHelper.position.y = -11;
    this.scene.add(this.gridHelper);

    this.animations = new AnimationController(this.scene);

    window.addEventListener('resize', this.handleResize);
    canvas.addEventListener('pointerdown', this.handlePointerDown);
  }

  public applyLevelTheme(level: LevelConfig): void {
    this.scene.fog = new THREE.FogExp2(level.fogColor, 0.022);
    this.renderer.setClearColor(level.fogColor, 1);
    this.scene.remove(this.gridHelper);
    this.gridHelper = new THREE.GridHelper(
      160,
      80,
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
          this.animations.triggerCameraShake(0.65);
        }
      }
    }

    // Prune old candles far behind camera
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
    }
  }

  private buildCandleMesh(candle: Candle): THREE.Group {
    const group = new THREE.Group();
    const isBull = candle.close >= candle.open;
    const color = candle.isNewsSpike
      ? 0xfbbf24
      : isBull
      ? 0x00f5a0
      : 0xf43f5e;

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
      emissiveIntensity: candle.isNewsSpike ? 0.55 : 0.28,
      roughness: 0.22,
      metalness: 0.15,
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

    // Highlight Liquidity Sweep ring at wick extreme
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
    const baseColor = isBull ? 0x00f5a0 : 0x38bdf8;

    const topY = priceToWorldY(gap.top);
    const bottomY = priceToWorldY(gap.bottom);
    const ceY = priceToWorldY(gap.ceMidpoint);
    const height = Math.max(topY - bottomY, 0.25);
    const centerY = (topY + bottomY) * 0.5;
    const width = 9.5;

    // Translucent interactive FVG zone box
    const zoneGeom = new THREE.BoxGeometry(width, height, 0.35);
    const zoneMat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      emissive: baseColor,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.34,
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

    // 50% Consequent Encroachment (CE) equilibrium beam
    const ceGeom = new THREE.BoxGeometry(width, 0.07, 0.44);
    const ceMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
    });
    const ceLineMesh = new THREE.Mesh(ceGeom, ceMat);
    ceLineMesh.position.set(zoneMesh.position.x, ceY, 0.05);
    group.add(ceLineMesh);

    // Player Limit Order line (hidden until placed)
    const entryGeom = new THREE.BoxGeometry(width + 0.3, 0.11, 0.52);
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
      mat.opacity = 0.52;
      mat.emissiveIntensity = 0.6;
    } else if (gap.status === 'MITIGATED') {
      mat.color.setHex(0xfbbf24);
      mat.emissive.setHex(0xfbbf24);
      mat.opacity = 0.16;
      mat.emissiveIntensity = 0.25;
    } else if (gap.status === 'INVALIDATED_IFVG') {
      mat.color.setHex(0xf43f5e);
      mat.emissive.setHex(0xf43f5e);
      mat.opacity = 0.42;
      mat.emissiveIntensity = 0.65;
    }
  }

  public triggerGapFeedback(gap: FairValueGap, won: boolean): void {
    const visual = this.fvgVisuals.get(gap.id);
    if (!visual) return;

    const pos = visual.zoneMesh.position.clone();
    pos.z = 0.5;
    const color = won ? 0x00f5a0 : 0xf43f5e;
    this.animations.spawnShockwave(pos, color);
    this.animations.spawnParticles(pos, color, won ? 32 : 24);

    if (!won) {
      this.animations.triggerCameraShake(0.8);
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
    // Animate hydraulic candle growth
    for (const cv of this.candleVisuals.values()) {
      if (cv.spawnProgress < 1) {
        cv.spawnProgress = Math.min(1, cv.spawnProgress + dt * 5.2);
        // Overshoot easeOutBack
        const t = cv.spawnProgress - 1;
        const scale = 1 + 2.2 * t * t * t + 1.2 * t * t;
        cv.group.scale.set(scale, scale, scale);
      }
    }

    // Animate IFVG 180-degree barrel-roll polarity flip
    for (const fv of this.fvgVisuals.values()) {
      if (fv.flipRotation > 0) {
        const step = Math.min(fv.flipRotation, dt * 9.5);
        fv.zoneMesh.rotation.x += step;
        fv.flipRotation -= step;
      }
    }

    this.animations.update(dt);

    // Smooth camera follow + shake / zoom punch
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
