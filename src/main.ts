import { SynthAudioEngine } from './engine/audioEngine';
import {
  detectFairValueGap,
  LEVEL_CONFIGS,
  STARTING_DOLLARS,
} from './engine/fvgEngine';
import { PriceActionGenerator } from './engine/priceGenerator';
import {
  CANDLE_SPACING_X,
  ChartScene,
  priceToWorldY,
} from './scene/chartScene';
import { LeaderboardService } from './services/leaderboardService';
import { FairValueGap, LevelConfig, WorldObject } from './types/market';
import { HudController } from './ui/hudController';

const DEMO_SEEN_KEY = 'imbalance_gow2_demo_seen_v3';
const PLAYER_NAME_KEY = 'imbalance_gow2_player_name_v3';

class ImbalanceSpartanRunner {
  private generator = new PriceActionGenerator();
  private audio = new SynthAudioEngine();
  private hud = new HudController();
  private leaderboard = new LeaderboardService();
  private chart: ChartScene;

  private activeGaps: FairValueGap[] = [];
  private worldObjects: WorldObject[] = [];
  private highestSpawnedCandleIdx = 0;

  private isRunning = false;
  private isDemoMode = false;
  private demoRemainingSec = 60;
  private hasSeenDemoBefore = false;

  // Spartan Physics & Combat State
  private runnerX = 4 * CANDLE_SPACING_X;
  private runnerY = 0;
  private velocityY = 0;
  private isGrounded = true;
  private jumpsRemaining = 2;
  private slashActiveTimer = 0;

  // Economy & Progression
  private playerName = 'KRATOS';
  private dollars = STARTING_DOLLARS;
  private peakDollars = STARTING_DOLLARS;
  private streak = 0;
  private maxStreak = 0;
  private shields = 3;
  private rageMeter = 0;
  private rageActiveTimer = 0;
  private levelIndex = 0;
  private elapsedTime = 0;
  private lastFrameTime = performance.now();

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.chart = new ChartScene(canvas);

    this.hasSeenDemoBefore = localStorage.getItem(DEMO_SEEN_KEY) === 'true';
    const savedName = localStorage.getItem(PLAYER_NAME_KEY);
    if (savedName) {
      this.playerName = savedName;
      const input = document.getElementById(
        'player-name-input'
      ) as HTMLInputElement;
      if (input) input.value = savedName;
    }

    this.bindControls(canvas);
    this.bootstrapPreview();
    this.refreshLeaderboardUI();
    requestAnimationFrame(this.loop);
  }

  private getCurrentLevel(): LevelConfig {
    return LEVEL_CONFIGS[Math.min(this.levelIndex, LEVEL_CONFIGS.length - 1)];
  }

  private getPrevTarget(): number {
    if (this.levelIndex === 0) return STARTING_DOLLARS;
    return LEVEL_CONFIGS[this.levelIndex - 1].targetBalance;
  }

  private readPlayerName(): string {
    const input = document.getElementById(
      'player-name-input'
    ) as HTMLInputElement;
    const cleaned = (input?.value || 'KRATOS')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '')
      .slice(0, 14);
    this.playerName = cleaned || 'KRATOS';
    localStorage.setItem(PLAYER_NAME_KEY, this.playerName);
    return this.playerName;
  }

  private async refreshLeaderboardUI(): Promise<void> {
    const scores = await this.leaderboard.fetchTopScores();
    this.hud.renderLeaderboard(
      scores,
      this.playerName,
      this.leaderboard.isCloudEnabled()
    );
  }

  private bindControls(canvas: HTMLCanvasElement): void {
    document.getElementById('play-btn')!.addEventListener('click', () => {
      this.readPlayerName();
      this.startSession(!this.hasSeenDemoBefore);
    });

    document.getElementById('watch-demo-btn')!.addEventListener('click', () => {
      this.readPlayerName();
      this.startSession(true);
    });

    document.getElementById('skip-demo-btn')!.addEventListener('click', () => {
      if (this.isDemoMode) {
        this.finishDemoAndEnterLive();
      }
    });

    document.getElementById('mute-btn')!.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      document.getElementById('mute-btn')!.textContent = this.audio.muted
        ? '🔇'
        : '🔊';
    });

    document.getElementById('jump-btn')!.addEventListener('click', () => {
      this.performJump();
    });

    document.getElementById('slash-btn')!.addEventListener('click', () => {
      this.performBladeSlash();
    });

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (!this.isRunning) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        this.performJump();
      } else if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
        e.preventDefault();
        this.performBladeSlash();
      }
    });

    // Touch swipe up to jump, tap canvas to Blade Slash
    let touchStartY = 0;
    canvas.addEventListener('pointerdown', (e) => {
      if (!this.isRunning) return;
      touchStartY = e.clientY;
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!this.isRunning) return;
      const dy = touchStartY - e.clientY;
      if (dy > 32) {
        this.performJump();
      } else {
        this.performBladeSlash();
      }
    });
  }

  private bootstrapPreview(): void {
    this.chart.applyLevelTheme(this.getCurrentLevel());
    this.chart.syncCandles(this.generator.getCandles());
    this.chart.spartan.root.position.set(this.runnerX, 0.5, 0);
  }

  private startSession(demoMode: boolean): void {
    this.isDemoMode = demoMode;
    this.demoRemainingSec = 60;

    this.dollars = STARTING_DOLLARS;
    this.peakDollars = STARTING_DOLLARS;
    this.streak = 0;
    this.maxStreak = 0;
    this.shields = 3;
    this.rageMeter = 0;
    this.rageActiveTimer = 0;
    this.levelIndex = 0;

    this.activeGaps = [];
    this.worldObjects = [];
    this.generator.reset();
    this.chart.clearAll();
    this.chart.applyLevelTheme(this.getCurrentLevel());

    const initialCandles = this.generator.getCandles();
    this.highestSpawnedCandleIdx =
      initialCandles[initialCandles.length - 1].index;
    this.runnerX = 5 * CANDLE_SPACING_X;
    this.runnerY = 2.0;
    this.velocityY = 0;
    this.isGrounded = false;
    this.jumpsRemaining = 2;

    this.chart.syncCandles(initialCandles);
    this.audio.playWarDrum();
    this.hud.hideOverlay();
    this.hud.setDemoModeUI(demoMode, this.hasSeenDemoBefore, 60);

    if (demoMode) {
      this.hud.updateDemoPrompt(
        'STEP 1 · JUMP FOR GOLD ORBS & OVER SPIKES!',
        'Tap JUMP (or swipe up / W) to leap over red Hades Traps and grab floating Dollar Orbs!'
      );
    } else {
      this.hud.showCallout(
        'REALM I · COLOSSUS OF RHODES',
        'Jump traps, grab Gold Orbs & Slash inside FVG Bridges!'
      );
    }

    this.isRunning = true;
  }

  private finishDemoAndEnterLive(): void {
    this.hasSeenDemoBefore = true;
    localStorage.setItem(DEMO_SEEN_KEY, 'true');
    this.startSession(false);
  }

  private performJump(): void {
    if (!this.isRunning || this.jumpsRemaining <= 0) return;
    this.velocityY = this.jumpsRemaining === 2 ? 12.8 : 11.2;
    this.isGrounded = false;
    this.jumpsRemaining -= 1;
    this.audio.playJump();
  }

  private performBladeSlash(): void {
    if (!this.isRunning) return;
    this.slashActiveTimer = 0.36;
    this.chart.spartan.triggerSlash();
    this.audio.playBladeSlash();

    const spartanPos = this.chart.spartan.root.position.clone();
    spartanPos.y += 1.1;
    this.chart.animations.spawnShockwave(spartanPos, 0xff7b00);

    const rageMult = this.rageActiveTimer > 0 ? 2 : 1;

    // 1. Check if Spartan is inside or adjacent to a glowing Fair Value Gap Bridge!
    for (const gap of this.activeGaps) {
      if (gap.status !== 'OPEN') continue;
      const startX = gap.createdAtIndex * CANDLE_SPACING_X - 1.2;
      const endX = startX + 6.4;

      if (this.runnerX >= startX && this.runnerX <= endX) {
        gap.status = 'EXECUTED';
        this.streak += 1;
        this.maxStreak = Math.max(this.maxStreak, this.streak);
        this.rageMeter = Math.min(100, this.rageMeter + 34);

        const ceY = priceToWorldY(gap.ceMidpoint);
        const nearCE = Math.abs(this.runnerY + 1.0 - ceY) < 1.65;
        const basePay = nearCE ? 1500 : 850;
        const obBonus = gap.hasOrderBlockConfluence ? 1.5 : 1.0;
        const payout = Math.round(
          basePay * obBonus * (1 + (this.streak - 1) * 0.2) * rageMult
        );

        this.dollars += payout;
        this.peakDollars = Math.max(this.peakDollars, this.dollars);

        this.chart.animations.triggerHitstop(0.18);
        this.chart.animations.spawnShockwave(spartanPos, 0xffd166);
        this.chart.animations.spawnOlympusOrbs(spartanPos, 28, false);
        this.audio.playFvgExecution(this.streak);

        const scr = this.chart.worldToScreen(this.runnerX, this.runnerY + 2.2);
        this.hud.spawnDollarPopup(scr.x, scr.y, payout);
        this.hud.showCallout(
          nearCE
            ? `⚔️ 50% CE BLADE EXECUTION! +$${payout.toLocaleString()}`
            : `FVG BRIDGE SLASHED! +$${payout.toLocaleString()}`,
          `${this.streak}x Combo · Rage +34%`
        );

        if (this.isDemoMode) {
          this.hud.updateDemoPrompt(
            '🏆 PERFECT FVG EXECUTION!',
            'You slashed inside the glowing Fair Value Gap! Keep playing or tap SKIP DEMO below anytime!'
          );
        }
      }
    }

    // 2. Smash nearby Treasure Chests & Hades Spike Traps with Blades of Chaos!
    for (const obj of this.worldObjects) {
      if (obj.collectedOrBroken) continue;
      const dist = Math.hypot(
        obj.worldX - this.runnerX,
        obj.worldY - (this.runnerY + 1.1)
      );

      if (dist <= 3.1) {
        if (obj.kind === 'ORDER_BLOCK_CHEST') {
          obj.collectedOrBroken = true;
          const payout = obj.valueDollars * rageMult;
          this.dollars += payout;
          this.peakDollars = Math.max(this.peakDollars, this.dollars);
          this.rageMeter = Math.min(100, this.rageMeter + 25);

          this.chart.animations.spawnObjectShatter(
            spartanPos,
            0xffd166,
            16
          );
          this.chart.animations.spawnOlympusOrbs(spartanPos, 24, false);
          this.audio.playFvgExecution(this.streak + 1);

          const scr = this.chart.worldToScreen(obj.worldX, obj.worldY + 1);
          this.hud.spawnDollarPopup(scr.x, scr.y, payout);
          this.hud.showCallout(
            `📦 ORDER BLOCK CHEST SMASHED! +$${payout.toLocaleString()}`,
            'Institutional Relic Claimed!'
          );
        } else if (obj.kind === 'HADES_SPIKE_TRAP') {
          obj.collectedOrBroken = true;
          const bonus = 400 * rageMult;
          this.dollars += bonus;
          this.peakDollars = Math.max(this.peakDollars, this.dollars);
          this.rageMeter = Math.min(100, this.rageMeter + 18);

          this.chart.animations.spawnObjectShatter(
            spartanPos,
            0xf43f5e,
            18
          );
          this.audio.playOrbPickup(this.streak + 2);

          const scr = this.chart.worldToScreen(obj.worldX, obj.worldY + 1);
          this.hud.spawnDollarPopup(scr.x, scr.y, bonus);
          this.hud.showCallout(
            `💥 HADES TRAP SHATTERED! +$${bonus}`,
            'Parried with Blades of Chaos!'
          );
        }
      }
    }
  }

  private spawnWorldContentAhead(): void {
    const level = this.getCurrentLevel();
    const targetCandleIdx = Math.floor(this.runnerX / CANDLE_SPACING_X) + 22;

    while (this.highestSpawnedCandleIdx < targetCandleIdx) {
      const candle = this.generator.nextCandle(level);
      this.highestSpawnedCandleIdx = candle.index;
      const candles = this.generator.getCandles();

      const worldX = candle.index * CANDLE_SPACING_X;
      const topY = priceToWorldY(Math.max(candle.open, candle.close));

      // Check 3-candle FVG creation
      let spawnedFvg = false;
      if (candles.length >= 3) {
        const c1 = candles[candles.length - 3];
        const c2 = candles[candles.length - 2];
        const c3 = candles[candles.length - 1];
        const fvg = detectFairValueGap(c1, c2, c3);
        if (fvg) {
          this.activeGaps.push(fvg);
          spawnedFvg = true;

          // Place an Order Block Treasure Chest inside the FVG bridge!
          this.worldObjects.push({
            id: `chest-${candle.index}`,
            kind: 'ORDER_BLOCK_CHEST',
            worldX: worldX + 1.8,
            worldY: priceToWorldY(fvg.ceMidpoint),
            valueDollars: 2000,
            collectedOrBroken: false,
          });

          if (this.isDemoMode) {
            this.hud.updateDemoPrompt(
              'STEP 2 · GLOWING FVG BRIDGE & CHEST AHEAD!',
              'Tap BLADE SLASH (or tap screen / SPACE) as your Spartan runs through the glowing bridge!'
            );
          }
        }
      }

      // Spawn interactive 3D Gold Dollar Orbs & Hades Traps along the track
      if (!spawnedFvg && candle.index > 14) {
        if (candle.index % 3 === 0) {
          // Arc of 3 Gold Dollar Orbs to jump for
          for (let k = 0; k < 3; k++) {
            this.worldObjects.push({
              id: `orb-${candle.index}-${k}`,
              kind: 'DOLLAR_ORB',
              worldX: worldX + k * 0.85,
              worldY: topY + 1.2 + Math.sin((k / 2) * Math.PI) * 1.4,
              valueDollars: 250,
              collectedOrBroken: false,
            });
          }
        } else if (
          !this.isDemoMode &&
          candle.index % 7 === 0
        ) {
          // Spinning Hades Spike Trap on the candle surface
          this.worldObjects.push({
            id: `trap-${candle.index}`,
            kind: 'HADES_SPIKE_TRAP',
            worldX,
            worldY: topY + 0.75,
            valueDollars: 0,
            collectedOrBroken: false,
          });
        }
      }
    }

    // Prune far-behind gaps & objects
    const cutoffX = this.runnerX - 18;
    this.activeGaps = this.activeGaps.filter(
      (g) => g.createdAtIndex * CANDLE_SPACING_X > cutoffX
    );
    this.worldObjects = this.worldObjects.filter(
      (o) => !o.collectedOrBroken && o.worldX > cutoffX
    );
  }

  private getGroundHeightAt(worldX: number): number {
    const candles = this.generator.getCandles();
    const approxIdx = Math.round(worldX / CANDLE_SPACING_X);
    const candle = candles.find((c) => c.index === approxIdx);
    if (!candle) return -3.0;
    return priceToWorldY(Math.max(candle.open, candle.close));
  }

  private updateSimulation(dt: number): void {
    const level = this.getCurrentLevel();

    // Activate Spartan Rage Mode automatically when meter hits 100%
    if (this.rageMeter >= 100 && this.rageActiveTimer <= 0) {
      this.rageActiveTimer = 7.5;
      this.rageMeter = 0;
      this.audio.playRealmAscension();
      this.hud.showCallout(
        '🔥 SPARTAN RAGE UNLEASHED!',
        '2X DOLLAR PAYOUTS · INVINCIBLE · ORB MAGNET!'
      );
    }

    if (this.rageActiveTimer > 0) {
      this.rageActiveTimer = Math.max(0, this.rageActiveTimer - dt);
    }
    if (this.slashActiveTimer > 0) {
      this.slashActiveTimer = Math.max(0, this.slashActiveTimer - dt);
    }

    // 1. Forward Spartan Sprint
    const speed = this.isDemoMode ? level.runSpeed * 0.85 : level.runSpeed;
    this.runnerX += speed * dt;

    // 2. Gravity & Candle Platform Grounding
    this.velocityY -= 29.0 * dt;
    this.runnerY += this.velocityY * dt;

    const groundY = this.getGroundHeightAt(this.runnerX);
    if (this.runnerY <= groundY && this.velocityY <= 0) {
      this.runnerY = groundY;
      this.velocityY = 0;
      this.isGrounded = true;
      this.jumpsRemaining = 2;
    } else {
      this.isGrounded = false;
    }

    // Safety floor so Spartan never falls infinitely off-screen
    if (this.runnerY < -8.5) {
      this.runnerY = groundY + 1.5;
      this.velocityY = 0;
      this.jumpsRemaining = 2;
    }

    this.chart.spartan.root.position.set(this.runnerX, this.runnerY, 0);
    this.chart.spartan.update(
      dt,
      this.isGrounded,
      this.rageActiveTimer > 0
    );

    // 3. Object Collisions (Gold Orbs, Chests, Hades Traps)
    const isRage = this.rageActiveTimer > 0;
    const rageMult = isRage ? 2 : 1;
    const magnetRange = isRage ? 6.5 : 1.75;

    for (const obj of this.worldObjects) {
      if (obj.collectedOrBroken) continue;

      const dx = obj.worldX - this.runnerX;
      const dy = obj.worldY - (this.runnerY + 1.0);
      const dist = Math.hypot(dx, dy);

      if (obj.kind === 'DOLLAR_ORB') {
        // Pull orb gently when close or in Spartan Rage
        if (dist < magnetRange && dist > 0.2) {
          obj.worldX -= (dx / dist) * 14 * dt;
          obj.worldY -= (dy / dist) * 14 * dt;
        }
        if (dist < 1.35) {
          obj.collectedOrBroken = true;
          const gain = obj.valueDollars * rageMult;
          this.dollars += gain;
          this.peakDollars = Math.max(this.peakDollars, this.dollars);
          this.rageMeter = Math.min(100, this.rageMeter + 6);
          this.audio.playOrbPickup(this.streak);

          const scr = this.chart.worldToScreen(obj.worldX, obj.worldY + 0.8);
          this.hud.spawnDollarPopup(scr.x, scr.y, gain);
        }
      } else if (obj.kind === 'ORDER_BLOCK_CHEST') {
        if (dist < 1.5 && (this.slashActiveTimer > 0 || isRage)) {
          this.performBladeSlash();
        }
      } else if (obj.kind === 'HADES_SPIKE_TRAP') {
        if (dist < 1.15) {
          obj.collectedOrBroken = true;
          if (this.slashActiveTimer > 0 || isRage) {
            // Smashed through trap cleanly!
            const bonus = 400 * rageMult;
            this.dollars += bonus;
            this.chart.animations.spawnObjectShatter(
              new THREE.Vector3(obj.worldX, obj.worldY, 0),
              0xf43f5e,
              16
            );
            this.audio.playOrbPickup(this.streak + 1);
          } else {
            // Hit trap without jumping or slashing
            this.shields -= 1;
            this.streak = 0;
            this.dollars = Math.max(0, this.dollars - 750);
            this.chart.animations.triggerCameraShake(0.95);
            this.chart.animations.spawnOlympusOrbs(
              new THREE.Vector3(obj.worldX, obj.worldY, 0),
              18,
              true
            );
            this.audio.playDamageHit();

            const scr = this.chart.worldToScreen(obj.worldX, obj.worldY + 1);
            this.hud.spawnDollarPopup(scr.x, scr.y, -750);
            this.hud.showCallout(
              '💀 HADES TRAP HIT! -$750',
              'Jump over or Blade-Slash traps!',
              true
            );
          }
        }
      }
    }

    // 4. Realm Theme Ascension
    if (
      !this.isDemoMode &&
      this.levelIndex < LEVEL_CONFIGS.length - 1 &&
      this.dollars >= level.targetBalance
    ) {
      this.levelIndex += 1;
      const nextLevel = this.getCurrentLevel();
      this.chart.applyLevelTheme(nextLevel);
      this.audio.playRealmAscension();
      this.hud.showCallout(
        `ASCENDED · ${nextLevel.sessionLabel}`,
        nextLevel.description
      );
    }

    // 5. Spawn ahead & Sync 3D Scene + HUD
    this.spawnWorldContentAhead();
    this.chart.syncCandles(this.generator.getCandles());
    this.chart.syncFairValueGaps(this.activeGaps);
    this.chart.syncWorldObjects(this.worldObjects, this.elapsedTime);

    this.hud.updateStats(
      this.dollars,
      this.streak,
      this.shields,
      this.rageActiveTimer > 0
        ? (this.rageActiveTimer / 7.5) * 100
        : this.rageMeter,
      this.rageActiveTimer > 0,
      this.getCurrentLevel(),
      this.getPrevTarget()
    );

    if (!this.isDemoMode && (this.shields <= 0 || this.dollars <= 0)) {
      this.endLiveSession();
    }
  }

  private async endLiveSession(): Promise<void> {
    this.isRunning = false;
    const currentRealm = this.getCurrentLevel().name.toUpperCase();
    this.hud.showSessionEndOverlay(
      this.peakDollars,
      this.maxStreak,
      currentRealm
    );

    const updated = await this.leaderboard.submitScore({
      player_name: this.playerName,
      peak_dollars: this.peakDollars,
      best_streak: this.maxStreak,
      realm_reached: `REALM ${this.levelIndex + 1} · ${currentRealm}`,
    });
    this.hud.renderLeaderboard(
      updated,
      this.playerName,
      this.leaderboard.isCloudEnabled()
    );
  }

  private loop = (now: number): void => {
    const rawDt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const timeScale = this.chart.animations.getTimeScale(rawDt);
    const scaledDt = rawDt * timeScale;
    this.elapsedTime += scaledDt;

    if (this.isRunning) {
      if (this.isDemoMode) {
        this.demoRemainingSec -= rawDt;
        this.hud.setDemoModeUI(
          true,
          this.hasSeenDemoBefore,
          this.demoRemainingSec
        );
        if (this.demoRemainingSec <= 0) {
          this.finishDemoAndEnterLive();
          return;
        }
      }

      this.updateSimulation(scaledDt);
    }

    this.chart.updateCameraAndRender(scaledDt, this.runnerX, this.runnerY);
    requestAnimationFrame(this.loop);
  };
}

import * as THREE from 'three';

window.addEventListener('DOMContentLoaded', () => {
  new ImbalanceSpartanRunner();
});
