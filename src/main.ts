import { SynthAudioEngine } from './engine/audioEngine';
import {
  detectFairValueGap,
  evaluateCandleAgainstGaps,
  evaluateEntryPrecision,
  LEVEL_CONFIGS,
  STARTING_DOLLARS,
} from './engine/fvgEngine';
import { PriceActionGenerator } from './engine/priceGenerator';
import { ChartScene } from './scene/chartScene';
import { LeaderboardService } from './services/leaderboardService';
import { FairValueGap, LevelConfig } from './types/market';
import { HudController } from './ui/hudController';

const DEMO_SEEN_KEY = 'imbalance_gow2_demo_seen_v1';
const PLAYER_NAME_KEY = 'imbalance_gow2_player_name_v1';

class ImbalanceGodOfWarGame {
  private generator = new PriceActionGenerator();
  private audio = new SynthAudioEngine();
  private hud = new HudController();
  private leaderboard = new LeaderboardService();
  private chart: ChartScene;

  private activeGaps: FairValueGap[] = [];
  private isRunning = false;
  private isDemoMode = false;
  private demoRemainingSec = 60;
  private hasSeenDemoBefore = false;

  private playerName = 'KRATOS';
  private dollars = STARTING_DOLLARS;
  private peakDollars = STARTING_DOLLARS;
  private streak = 0;
  private maxStreak = 0;
  private shields = 3;
  private levelIndex = 0;
  private tickAccumulatorMs = 0;
  private lastFrameTime = performance.now();

  constructor() {
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.chart = new ChartScene(canvas, (gap, clickedPrice) => {
      this.placeOrderOnGap(gap, clickedPrice);
    });

    this.hasSeenDemoBefore = localStorage.getItem(DEMO_SEEN_KEY) === 'true';
    const savedName = localStorage.getItem(PLAYER_NAME_KEY);
    if (savedName) {
      this.playerName = savedName;
      const input = document.getElementById(
        'player-name-input'
      ) as HTMLInputElement;
      if (input) input.value = savedName;
    }

    this.bindControls();
    this.bootstrapPreviewScene();
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

  private bindControls(): void {
    const playBtn = document.getElementById('play-btn')!;
    playBtn.addEventListener('click', () => {
      this.readPlayerName();
      // First-time players automatically experience the 1-minute manual demo first;
      // returning players jump straight into live trading.
      if (!this.hasSeenDemoBefore) {
        this.startSession(true);
      } else {
        this.startSession(false);
      }
    });

    const watchDemoBtn = document.getElementById('watch-demo-btn')!;
    watchDemoBtn.addEventListener('click', () => {
      this.readPlayerName();
      this.startSession(true);
    });

    const skipDemoBtn = document.getElementById('skip-demo-btn')!;
    skipDemoBtn.addEventListener('click', () => {
      if (this.isDemoMode) {
        this.finishDemoAndEnterLive();
      }
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

  private startSession(demoMode: boolean): void {
    this.isDemoMode = demoMode;
    this.demoRemainingSec = 60;

    this.dollars = STARTING_DOLLARS;
    this.peakDollars = STARTING_DOLLARS;
    this.streak = 0;
    this.maxStreak = 0;
    this.shields = 3;
    this.levelIndex = 0;
    this.activeGaps = [];
    this.tickAccumulatorMs = 0;

    this.generator.reset();
    this.chart.clearAll();
    this.chart.applyLevelTheme(this.getCurrentLevel());
    this.chart.syncCandles(this.generator.getCandles());

    this.audio.playWarDrum();
    this.hud.hideOverlay();
    this.hud.setDemoModeUI(demoMode, this.hasSeenDemoBefore, 60);
    this.hud.updateStats(
      this.dollars,
      this.streak,
      this.shields,
      this.getCurrentLevel(),
      STARTING_DOLLARS
    );

    if (demoMode) {
      this.hud.updateDemoPrompt(
        'STEP 1 OF 3 · WATCH FOR DISPLACEMENT',
        '3 rapid candles create a glowing Fair Value Gap (FVG) bridge. Watch the chart print!'
      );
    } else {
      this.hud.showCallout(
        'REALM I · COLOSSUS OF RHODES',
        'Strike inside glowing FVG bridges to earn Dollars!'
      );
    }

    this.isRunning = true;
  }

  private finishDemoAndEnterLive(): void {
    this.hasSeenDemoBefore = true;
    localStorage.setItem(DEMO_SEEN_KEY, 'true');
    this.startSession(false);
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
    this.audio.playBladeStrike(isSniper);

    if (this.isDemoMode) {
      this.hud.updateDemoPrompt(
        'STEP 3 OF 3 · ORDER LOCKED! WATCH THE BOUNCE',
        'Price will now retrace into your FVG zone and bounce—unleashing Olympus Dollar Orbs!'
      );
    }

    this.hud.showCallout(
      isSniper ? '⚔️ 50% CE SNIPER STRIKE ARMED' : 'LIMIT ORDER ARMED',
      `Target ${precision.rrMultiplier.toFixed(1)}x R:R · Awaiting retracement`
    );
    this.refreshQuickSnipeState();
  }

  private refreshQuickSnipeState(): void {
    const hasOpenGap = this.activeGaps.some((g) => g.status === 'OPEN');
    this.hud.setQuickSnipeAvailable(this.isRunning && hasOpenGap);
  }

  private stepMarketTick(): void {
    const level = this.getCurrentLevel();
    const newCandle = this.generator.nextCandle(level, this.isDemoMode);
    const candles = this.generator.getCandles();

    if (newCandle.isLiquiditySweep && !this.isDemoMode) {
      this.hud.showCallout(
        '⚡ LIQUIDITY SWEPT',
        'Stops hunted — prepare for displacement!'
      );
    }

    // 1. Evaluate open FVGs against the newly closed candle
    const { outcomes, nextStreak } = evaluateCandleAgainstGaps(
      newCandle,
      this.activeGaps,
      this.streak
    );
    this.streak = nextStreak;
    this.maxStreak = Math.max(this.maxStreak, this.streak);

    for (const outcome of outcomes) {
      const gap = this.activeGaps.find((g) => g.id === outcome.fvgId);
      const isSniper = outcome.fillQuality === 'SNIPER_CE';

      if (gap) {
        this.chart.triggerGapFeedback(gap, outcome.won, isSniper);
      }

      const screenPos = this.chart.worldToScreen(outcome.worldX, outcome.worldY);
      this.hud.spawnDollarPopup(screenPos.x, screenPos.y, outcome.dollarDelta);

      if (outcome.won) {
        this.dollars += outcome.dollarDelta;
        this.peakDollars = Math.max(this.peakDollars, this.dollars);
        if (isSniper) {
          this.chart.animations.triggerHitstop(0.25);
        }
        this.audio.playMitigationWin(this.streak, isSniper);

        if (this.isDemoMode) {
          this.hud.updateDemoPrompt(
            '🏆 VICTORY! YOU COLLECTED DOLLAR ORBS!',
            'Keep tapping glowing FVG zones until the timer ends—or click Skip Demo below anytime!'
          );
        }
      } else {
        this.dollars = Math.max(0, this.dollars + outcome.dollarDelta);
        this.shields -= 1;
        this.audio.playStopOutFlip();
      }

      this.hud.showOutcome(outcome);
    }

    // 2. Detect new 3-candle Fair Value Gap
    if (candles.length >= 3) {
      const c1 = candles[candles.length - 3];
      const c2 = candles[candles.length - 2];
      const c3 = candles[candles.length - 1];
      const detected = detectFairValueGap(c1, c2, c3);
      if (detected) {
        this.activeGaps.push(detected);
        this.generator.notifyCreatedGap(detected);
        this.audio.playFvgSpawn(detected.direction === 'BULLISH');

        if (this.isDemoMode) {
          this.hud.updateDemoPrompt(
            'STEP 2 OF 3 · TAP THE GLOWING FVG BRIDGE NOW!',
            'Tap the gold 50% line inside the FVG (or press STRIKE 50% CE at bottom-right)!'
          );
        }
      }
    }

    if (this.activeGaps.length > 16) {
      this.activeGaps.shift();
    }

    // 3. Realm / Theme Ascension Check
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

    // 4. Sync 3D visuals & HUD
    this.chart.syncCandles(candles);
    this.chart.syncFairValueGaps(this.activeGaps);
    this.hud.updateStats(
      this.dollars,
      this.streak,
      this.shields,
      this.getCurrentLevel(),
      this.getPrevTarget()
    );
    this.refreshQuickSnipeState();

    // 5. Check Drawdown Session End (live mode only)
    if (!this.isDemoMode && (this.shields <= 0 || this.dollars <= 0)) {
      this.endLiveSession();
    }
  }

  private async endLiveSession(): Promise<void> {
    this.isRunning = false;
    this.hud.setQuickSnipeAvailable(false);
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

      this.tickAccumulatorMs += scaledDt * 1000;
      const baseInterval = this.getCurrentLevel().candleIntervalMs;
      // Slightly slower pacing during the 1-minute manual training demo
      const interval = this.isDemoMode ? baseInterval * 1.25 : baseInterval;

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
  new ImbalanceGodOfWarGame();
});
