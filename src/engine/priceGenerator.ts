import { Candle, FairValueGap, LevelConfig, MarketDirection } from '../types/market';

type CyclePhase =
  | 'DRIFT'
  | 'SWEEP'
  | 'IMPULSE_1'
  | 'IMPULSE_2'
  | 'IMPULSE_3'
  | 'WAIT_BUFFER'
  | 'RETRACE_TAP'
  | 'EXPANSION';

/**
 * Generates realistic institutional price action cycles:
 * Accumulation Drift -> Liquidity Sweep -> 3-Candle Displacement (forming an FVG)
 * -> Retracement into the FVG -> Rejection Bounce (or News Blow-Through).
 */
export class PriceActionGenerator {
  private candles: Candle[] = [];
  private phase: CyclePhase = 'DRIFT';
  private phaseStep = 0;
  private cycleDirection: MarketDirection = 'BULLISH';
  private anchorC1High = 0;
  private anchorC1Low = 0;
  private activeTargetGap: FairValueGap | null = null;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.candles = [];
    this.phase = 'DRIFT';
    this.phaseStep = 0;
    this.cycleDirection = 'BULLISH';
    this.activeTargetGap = null;

    let price = 100;
    for (let i = 0; i < 10; i++) {
      const delta = (Math.random() - 0.5) * 1.4;
      const open = price;
      const close = price + delta;
      const high = Math.max(open, close) + 0.3 + Math.random() * 0.5;
      const low = Math.min(open, close) - 0.3 - Math.random() * 0.5;
      this.candles.push({
        index: i,
        open,
        high,
        low,
        close,
        timestamp: performance.now() - (10 - i) * 1000,
      });
      price = close;
    }
  }

  public getCandles(): Candle[] {
    return this.candles;
  }

  public notifyCreatedGap(gap: FairValueGap): void {
    this.activeTargetGap = gap;
  }

  public nextCandle(level: LevelConfig): Candle {
    const prev = this.candles[this.candles.length - 1];
    const index = prev.index + 1;
    const vol = level.volatility;
    const open = prev.close;

    let close = open;
    let high = open;
    let low = open;
    let isLiquiditySweep = false;
    let isNewsSpike = false;
    let hasOrderBlock = false;

    switch (this.phase) {
      case 'DRIFT': {
        // Mean-reverting consolidation toward 100
        const pullToCenter = (100 - open) * 0.14;
        const step = pullToCenter + (Math.random() - 0.5) * 1.3 * vol;
        close = open + step;
        high = Math.max(open, close) + (0.25 + Math.random() * 0.45) * vol;
        low = Math.min(open, close) - (0.25 + Math.random() * 0.45) * vol;

        this.phaseStep++;
        if (this.phaseStep >= 2) {
          this.phaseStep = 0;
          // Choose next impulse direction away from extremes
          if (open > 112) this.cycleDirection = 'BEARISH';
          else if (open < 88) this.cycleDirection = 'BULLISH';
          else this.cycleDirection = Math.random() > 0.5 ? 'BULLISH' : 'BEARISH';

          this.phase =
            Math.random() < level.sweepProbability ? 'SWEEP' : 'IMPULSE_1';
        }
        break;
      }

      case 'SWEEP': {
        // Liquidity grab in the opposite direction before reversal
        isLiquiditySweep = true;
        if (this.cycleDirection === 'BULLISH') {
          const sweepLow = prev.low - (1.1 + Math.random() * 0.9) * vol;
          low = sweepLow;
          close = open + (0.2 + Math.random() * 0.4) * vol;
          high = close + 0.3 * vol;
        } else {
          const sweepHigh = prev.high + (1.1 + Math.random() * 0.9) * vol;
          high = sweepHigh;
          close = open - (0.2 + Math.random() * 0.4) * vol;
          low = close - 0.3 * vol;
        }
        this.phase = 'IMPULSE_1';
        break;
      }

      case 'IMPULSE_1': {
        // Candle 1 of 3-candle FVG pattern (often forms an Order Block)
        hasOrderBlock = Math.random() < level.orderBlockProbability;
        if (this.cycleDirection === 'BULLISH') {
          close = open + (0.5 + Math.random() * 0.6) * vol;
          high = close + 0.35 * vol;
          low = open - 0.4 * vol;
        } else {
          close = open - (0.5 + Math.random() * 0.6) * vol;
          low = close - 0.35 * vol;
          high = open + 0.4 * vol;
        }
        this.anchorC1High = high;
        this.anchorC1Low = low;
        this.phase = 'IMPULSE_2';
        break;
      }

      case 'IMPULSE_2': {
        // Candle 2: Massive displacement candle that rips open the FVG
        isNewsSpike = Math.random() < level.newsSpikeProbability;
        const burst = (isNewsSpike ? 3.8 : 2.7 + Math.random() * 0.9) * vol;
        if (this.cycleDirection === 'BULLISH') {
          close = open + burst;
          high = close + 0.3 * vol;
          low = open - 0.15 * vol;
        } else {
          close = open - burst;
          low = close - 0.3 * vol;
          high = open + 0.15 * vol;
        }
        this.phase = 'IMPULSE_3';
        break;
      }

      case 'IMPULSE_3': {
        // Candle 3: Leaves a clean wick gap from Candle 1
        if (this.cycleDirection === 'BULLISH') {
          const minLow = this.anchorC1High + 1.15 * vol;
          low = Math.max(open - 0.35 * vol, minLow);
          close = Math.max(open + 0.7 * vol, low + 0.8 * vol);
          high = close + 0.4 * vol;
        } else {
          const maxHigh = this.anchorC1Low - 1.15 * vol;
          high = Math.min(open + 0.35 * vol, maxHigh);
          close = Math.min(open - 0.7 * vol, high - 0.8 * vol);
          low = close - 0.4 * vol;
        }
        this.phase = 'WAIT_BUFFER';
        break;
      }

      case 'WAIT_BUFFER': {
        // Gives the player 1-2 beats to spot the glowing FVG and tap their entry
        if (this.cycleDirection === 'BULLISH') {
          close = open + (0.2 + Math.random() * 0.4) * vol;
          high = close + 0.35 * vol;
          low = open - 0.25 * vol;
        } else {
          close = open - (0.2 + Math.random() * 0.4) * vol;
          low = close - 0.35 * vol;
          high = open + 0.25 * vol;
        }
        this.phaseStep++;
        if (this.phaseStep >= 2) {
          this.phaseStep = 0;
          this.phase = 'RETRACE_TAP';
        }
        break;
      }

      case 'RETRACE_TAP': {
        // Price retraces straight into the FVG (either bouncing at CE or blowing through)
        const gap = this.activeTargetGap;
        const blowThroughChance = 0.22 + level.newsSpikeProbability * 0.35;
        const willBlowThrough = Math.random() < blowThroughChance;

        if (gap && gap.status !== 'MITIGATED' && gap.status !== 'INVALIDATED_IFVG') {
          const targetTap =
            gap.orderEntryPrice !== null ? gap.orderEntryPrice : gap.ceMidpoint;

          if (gap.direction === 'BULLISH') {
            if (willBlowThrough) {
              low = gap.bottom - 0.9 * vol;
              close = gap.bottom - 0.45 * vol;
              high = open + 0.2 * vol;
            } else {
              low = Math.min(targetTap - 0.12, gap.ceMidpoint);
              low = Math.max(low, gap.bottom + 0.08);
              close = gap.top + 0.65 * vol;
              high = close + 0.45 * vol;
            }
          } else {
            if (willBlowThrough) {
              high = gap.top + 0.9 * vol;
              close = gap.top + 0.45 * vol;
              low = open - 0.2 * vol;
            } else {
              high = Math.max(targetTap + 0.12, gap.ceMidpoint);
              high = Math.min(high, gap.top - 0.08);
              close = gap.bottom - 0.65 * vol;
              low = close - 0.45 * vol;
            }
          }
        } else {
          close = open + (Math.random() - 0.5) * 1.5 * vol;
          high = Math.max(open, close) + 0.4 * vol;
          low = Math.min(open, close) - 0.4 * vol;
        }

        this.activeTargetGap = null;
        this.phase = 'EXPANSION';
        break;
      }

      case 'EXPANSION': {
        if (this.cycleDirection === 'BULLISH') {
          close = open + (0.8 + Math.random() * 0.7) * vol;
          high = close + 0.4 * vol;
          low = open - 0.2 * vol;
        } else {
          close = open - (0.8 + Math.random() * 0.7) * vol;
          low = close - 0.4 * vol;
          high = open + 0.2 * vol;
        }
        this.phase = 'DRIFT';
        break;
      }
    }

    const candle: Candle = {
      index,
      open,
      high,
      low,
      close,
      timestamp: performance.now(),
      isLiquiditySweep,
      isNewsSpike,
      hasOrderBlock,
    };

    this.candles.push(candle);
    if (this.candles.length > 60) {
      this.candles.shift();
    }

    return candle;
  }
}
