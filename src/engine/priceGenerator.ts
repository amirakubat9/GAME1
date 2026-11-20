import { Candle, LevelConfig, MarketDirection } from '../types/market';

type CyclePhase =
  | 'DRIFT'
  | 'SWEEP'
  | 'IMPULSE_1'
  | 'IMPULSE_2'
  | 'IMPULSE_3'
  | 'CONSOLIDATE';

export class PriceActionGenerator {
  private candles: Candle[] = [];
  private phase: CyclePhase = 'DRIFT';
  private phaseStep = 0;
  private cycleDirection: MarketDirection = 'BULLISH';
  private anchorC1High = 0;
  private anchorC1Low = 0;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.candles = [];
    this.phase = 'DRIFT';
    this.phaseStep = 0;
    this.cycleDirection = 'BULLISH';

    let price = 100;
    for (let i = 0; i < 14; i++) {
      const delta = (Math.random() - 0.5) * 1.1;
      const open = price;
      const close = price + delta;
      const high = Math.max(open, close) + 0.35;
      const low = Math.min(open, close) - 0.35;
      this.candles.push({
        index: i,
        open,
        high,
        low,
        close,
        timestamp: performance.now(),
      });
      price = close;
    }
  }

  public getCandles(): Candle[] {
    return this.candles;
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
    let hasOrderBlock = false;

    switch (this.phase) {
      case 'DRIFT': {
        const pullToCenter = (100 - open) * 0.18;
        close = open + pullToCenter + (Math.random() - 0.5) * 1.1 * vol;
        high = Math.max(open, close) + 0.35 * vol;
        low = Math.min(open, close) - 0.35 * vol;

        this.phaseStep++;
        if (this.phaseStep >= 2) {
          this.phaseStep = 0;
          if (open > 107) this.cycleDirection = 'BEARISH';
          else if (open < 93) this.cycleDirection = 'BULLISH';
          else this.cycleDirection = Math.random() > 0.5 ? 'BULLISH' : 'BEARISH';
          this.phase = Math.random() < 0.45 ? 'SWEEP' : 'IMPULSE_1';
        }
        break;
      }

      case 'SWEEP': {
        isLiquiditySweep = true;
        if (this.cycleDirection === 'BULLISH') {
          low = prev.low - 1.2 * vol;
          close = open + 0.3 * vol;
          high = close + 0.3 * vol;
        } else {
          high = prev.high + 1.2 * vol;
          close = open - 0.3 * vol;
          low = close - 0.3 * vol;
        }
        this.phase = 'IMPULSE_1';
        break;
      }

      case 'IMPULSE_1': {
        hasOrderBlock = true;
        if (this.cycleDirection === 'BULLISH') {
          close = open + 0.6 * vol;
          high = close + 0.3 * vol;
          low = open - 0.35 * vol;
        } else {
          close = open - 0.6 * vol;
          low = close - 0.3 * vol;
          high = open + 0.35 * vol;
        }
        this.anchorC1High = high;
        this.anchorC1Low = low;
        this.phase = 'IMPULSE_2';
        break;
      }

      case 'IMPULSE_2': {
        const burst = 2.6 * vol;
        if (this.cycleDirection === 'BULLISH') {
          close = open + burst;
          high = close + 0.25 * vol;
          low = open - 0.1 * vol;
        } else {
          close = open - burst;
          low = close - 0.25 * vol;
          high = open + 0.1 * vol;
        }
        this.phase = 'IMPULSE_3';
        break;
      }

      case 'IMPULSE_3': {
        if (this.cycleDirection === 'BULLISH') {
          low = Math.max(open - 0.2 * vol, this.anchorC1High + 1.15 * vol);
          close = low + 0.9 * vol;
          high = close + 0.35 * vol;
        } else {
          high = Math.min(open + 0.2 * vol, this.anchorC1Low - 1.15 * vol);
          close = high - 0.9 * vol;
          low = close - 0.35 * vol;
        }
        this.phase = 'CONSOLIDATE';
        break;
      }

      case 'CONSOLIDATE': {
        close = open + (100 - open) * 0.22;
        high = Math.max(open, close) + 0.35 * vol;
        low = Math.min(open, close) - 0.35 * vol;
        this.phaseStep++;
        if (this.phaseStep >= 3) {
          this.phaseStep = 0;
          this.phase = 'DRIFT';
        }
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
      hasOrderBlock,
    };

    this.candles.push(candle);
    if (this.candles.length > 75) {
      this.candles.shift();
    }

    return candle;
  }
}
