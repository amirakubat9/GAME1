import { SynthAudioEngine } from './engine/audioEngine';
import {
  detectFairValueGap,
  evaluateCandleAgainstGaps,
  evaluateEntryPrecision,
  LEVEL_CONFIGS,
} from './engine/fvgEngine';
import { PriceActionGenerator } from './engine/priceGenerator';
import { ChartScene } from './scene/chartScene';
import { FairValueGap, LevelConfig } from './types/market';
import { HudController } from './ui/hudController';

class ImbalanceGame {
  private generator = new PriceActionGenerator();
  private audio = new SynthAudioEngine();
  private hud = new HudController();
  private chart: ChartScene;

  private activeGaps: FairValueGap[] = [];
  private isRunning = false;
  private score = 0;
  private streak = 0;
  private maxStreak = 0;
  private lives = 3;
  private levelIndex = 0;
  private tickAccumulatorMs = 0;
  private lastFrameTime = performance.now();

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.chart = new ChartScene(canvas, (gap, clickedPrice) => {
      this.placeOrderOnGap(gap, clickedPrice);
    });

    this.bindControls();
    this.bootstrapPreviewScene();
    requestAnimationFrame(this.loop);
  }

  private getCurrentLevel(): LevelConfig {
    return LEVEL_CONFIGS[Math.min(this.levelIndex, LEVEL_CONFIGS.length - 1)];
  }

  private getPrevTarget(): number {
    if (this.levelIndex === 0) return 0;
    return LEVEL_CONFIGS[this.levelIndex - 1].targetScore;
  }

  private bindControls(): void {
    const startBtn = document.getElementById('start-btn')!;
    startBtn.addEventListener('click', () => {
      this.startNewSession();
    });

    const muteBtn = document.getElementById('mute-btn')!;
    muteBtn.addEventListener('click', () => {
      this.audio.muted = !this.audio.muted;
      muteBtn.textContent = this.audio.muted ? '🔇' : '🔊';
    });

    const quickSnipeBtn = document.getElementById('quick-snipe-btn')!;
    quickSnipeBtn.addEventListener('click', () => {
      if (!this.isRunning) return;
      const openGap = [...this.activeGaps]
        .reverse()
        .find((g) => g.status === 'OPEN');
      if (openGap) {
        this.placeOrderOnGap(openGap, openGap.ceMidpoint);
      }
    });
  }

  private bootstrapPreviewScene(): void {
    this.chart.applyLevelTheme(this.getCurrentLevel());
    this.chart.syncCandles(this.generator.getCandles());
  }

  private startNewSession(): void {
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.lives = 3;
    this.levelIndex = 0;
    this.activeGaps = [];
    this.tickAccumulatorMs = 0;

    this.generator.reset();
    this.chart.clearAll();
    this.chart.applyLevelTheme(this.getCurrentLevel());
    this.chart.syncCandles(this.generator.getCandles());

    this.hud.hideOverlay();
    this.hud.updateStats(
      this.score,
      this.streak,
      this.lives,
      this.getCurrentLevel(),
      0
    );
    this.hud.showCallout(
      'SESSION LIVE · 4H SWING',
      'Tap glowing FVG bridges to arm limit orders'
    );
    this.isRunning = true;
  }

  private placeOrderOnGap(gap: FairValueGap, rawPrice: number): void {
    if (!this.isRunning) return;
    if (gap.status !== 'OPEN' && gap.status !== 'ORDER_PLACED') return;

    const precision = evaluateEntryPrecision(gap, rawPrice);
    gap.status = 'ORDER_PLACED';
    gap.orderEntryPrice = precision.clampedPrice;
    gap.stopLossPrice = precision.stopLossPrice;
    gap.fillQuality = precision.fillQuality;
    gap.rrMultiplier = precision.rrMultiplier;

    const isSniper = precision.fillQuality === 'SNIPER_CE';
    this.audio.playOrderLocked(isSniper);

    this.hud.showCallout(
      isSniper ? '🎯 50% CE SNIPER ORDER ARMED' : 'LIMIT ORDER ARMED',
      `Target R:R ${precision.rrMultiplier.toFixed(1)}x · Waiting for retracement`
    );
    this.refreshQuickSnipeState();
  }

  private refreshQuickSnipeState(): void {
    const hasOpenGap = this.activeGaps.some((g) => g.status === 'OPEN');
    this.hud.setQuickSnipeAvailable(this.isRunning && hasOpenGap);
  }

  private stepMarketTick(): void {
    const level = this.getCurrentLevel();
    const newCandle = this.generator.nextCandle(level);
    const candles = this.generator.getCandles();

    if (newCandle.isLiquiditySweep) {
      this.hud.showCallout(
        '⚡ LIQUIDITY SWEPT',
        'Stops hunted — watch for immediate displacement!'
      );
    }

    // 1. Evaluate existing FVGs against the newly printed candle
    const { outcomes, nextStreak } = evaluateCandleAgainstGaps(
      newCandle,
      this.activeGaps,
      this.streak
    );
    this.streak = nextStreak;
    this.maxStreak = Math.max(this.maxStreak, this.streak);

    for (const outcome of outcomes) {
      const gap = this.activeGaps.find((g) => g.id === outcome.fvgId);
      if (gap) {
        this.chart.triggerGapFeedback(gap, outcome.won);
      }

      if (outcome.won) {
        this.score += outcome.pointsDelta;
        const isSniper = outcome.fillQuality === 'SNIPER_CE';
        if (isSniper) {
          this.chart.animations.triggerHitstop(0.25);
        }
        this.audio.playMitigationWin(this.streak, isSniper);
      } else {
        this.score = Math.max(0, this.score + outcome.pointsDelta);
        this.lives -= 1;
        this.audio.playStopOutFlip();
      }

      this.hud.showOutcome(outcome);
    }

    // 2. Check if the last 3 candles created a fresh Fair Value Gap
    if (candles.length >= 3) {
      const c1 = candles[candles.length - 3];
      const c2 = candles[candles.length - 2];
      const c3 = candles[candles.length - 1];
      const detected = detectFairValueGap(c1, c2, c3);
      if (detected) {
        this.activeGaps.push(detected);
        this.generator.notifyCreatedGap(detected);
        this.audio.playFvgSpawn(detected.direction === 'BULLISH');
      }
    }

    // Keep memory lean
    if (this.activeGaps.length > 16) {
      this.activeGaps.shift();
    }

    // 3. Level progression check
    if (
      this.levelIndex < LEVEL_CONFIGS.length - 1 &&
      this.score >= level.targetScore
    ) {
      this.levelIndex += 1;
      const nextLevel = this.getCurrentLevel();
      this.chart.applyLevelTheme(nextLevel);
      this.audio.playLevelUp();
      this.hud.showCallout(
        `PROMOTED · ${nextLevel.sessionLabel}`,
        nextLevel.description
      );
    }

    // 4. Sync 3D visuals & HUD
    this.chart.syncCandles(candles);
    this.chart.syncFairValueGaps(this.activeGaps);
    this.hud.updateStats(
      this.score,
      this.streak,
      this.lives,
      this.getCurrentLevel(),
      this.getPrevTarget()
    );
    this.refreshQuickSnipeState();

    // 5. Check Drawdown Game Over
    if (this.lives <= 0) {
      this.isRunning = false;
      this.hud.setQuickSnipeAvailable(false);
      this.hud.showStopOutOverlay(this.score, this.maxStreak);
    }
  }

  private loop = (now: number): void => {
    const rawDt = Math.min(0.05, (now - this.lastFrameTime) / 1000);
    this.lastFrameTime = now;

    const timeScale = this.chart.animations.getTimeScale(rawDt);
    const scaledDt = rawDt * timeScale;

    if (this.isRunning) {
      this.tickAccumulatorMs += scaledDt * 1000;
      const interval = this.getCurrentLevel().candleIntervalMs;
      if (this.tickAccumulatorMs >= interval) {
        this.tickAccumulatorMs = 0;
        this.stepMarketTick();
      }
    }

    this.chart.render(scaledDt);
    requestAnimationFrame(this.loop);
  };
}

window.addEventListener('DOMContentLoaded', () => {
  new ImbalanceGame();
});
