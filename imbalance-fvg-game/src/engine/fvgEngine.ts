import {
  Candle,
  FairValueGap,
  FillQuality,
  LevelConfig,
  TradeOutcome,
} from '../types/market';

export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: 1,
    name: '4H Swing',
    sessionLabel: 'LVL 1 · 4H SWING',
    themeAccent: '#00f5a0',
    fogColor: 0x060913,
    gridColor: 0x162447,
    candleIntervalMs: 1150,
    volatility: 1.0,
    sweepProbability: 0.15,
    orderBlockProbability: 0.2,
    newsSpikeProbability: 0.0,
    targetScore: 600,
    description: 'Clean institutional displacement & hydraulic retracements.',
  },
  {
    level: 2,
    name: 'London Open',
    sessionLabel: 'LVL 2 · LONDON OPEN',
    themeAccent: '#38bdf8',
    fogColor: 0x050d1a,
    gridColor: 0x163859,
    candleIntervalMs: 980,
    volatility: 1.25,
    sweepProbability: 0.45,
    orderBlockProbability: 0.3,
    newsSpikeProbability: 0.08,
    targetScore: 1500,
    description: 'Equal highs & lows get swept right before displacement.',
  },
  {
    level: 3,
    name: 'NY Overlap',
    sessionLabel: 'LVL 3 · NY OVERLAP',
    themeAccent: '#fbbf24',
    fogColor: 0x0d0a16,
    gridColor: 0x3b2a54,
    candleIntervalMs: 840,
    volatility: 1.45,
    sweepProbability: 0.5,
    orderBlockProbability: 0.55,
    newsSpikeProbability: 0.15,
    targetScore: 2800,
    description: 'Order Block + FVG confluence zones multiply payouts.',
  },
  {
    level: 4,
    name: 'FOMC / CPI News',
    sessionLabel: 'LVL 4 · FOMC / CPI NEWS',
    themeAccent: '#f43f5e',
    fogColor: 0x14070e,
    gridColor: 0x4c1729,
    candleIntervalMs: 720,
    volatility: 1.75,
    sweepProbability: 0.6,
    orderBlockProbability: 0.5,
    newsSpikeProbability: 0.35,
    targetScore: 4500,
    description: 'High-impact news spikes & violent Inverse FVG flips.',
  },
  {
    level: 5,
    name: '5s Scalper Overdrive',
    sessionLabel: 'LVL 5 · 5S SCALPER OVERDRIVE',
    themeAccent: '#c084fc',
    fogColor: 0x090517,
    gridColor: 0x351b63,
    candleIntervalMs: 600,
    volatility: 2.0,
    sweepProbability: 0.65,
    orderBlockProbability: 0.6,
    newsSpikeProbability: 0.4,
    targetScore: 999999,
    description: 'Maximum tick velocity. Chain sniper fills to raise synth pitch.',
  },
];

const MIN_GAP_HEIGHT = 0.65;

/**
 * Detects an ICT / Smart Money Concepts 3-candle Fair Value Gap (FVG):
 * - Bullish FVG (BISI): Candle 3 low > Candle 1 high after a bullish displacement Candle 2.
 * - Bearish FVG (SIBI): Candle 3 high < Candle 1 low after a bearish displacement Candle 2.
 */
export function detectFairValueGap(
  c1: Candle,
  c2: Candle,
  c3: Candle
): FairValueGap | null {
  const c2Body = Math.abs(c2.close - c2.open);
  if (c2Body < 1.1) return null;

  // Bullish Fair Value Gap (Buy-Side Imbalance, Sell-Side Inefficiency)
  if (c2.close > c2.open && c3.low > c1.high) {
    const bottom = c1.high;
    const top = c3.low;
    const height = top - bottom;
    if (height < MIN_GAP_HEIGHT) return null;

    return {
      id: `fvg-bull-${c3.index}-${Math.round(performance.now())}`,
      direction: 'BULLISH',
      createdAtIndex: c3.index,
      top,
      bottom,
      ceMidpoint: (top + bottom) * 0.5,
      status: 'OPEN',
      hasOrderBlockConfluence: Boolean(c1.hasOrderBlock),
      orderEntryPrice: null,
      stopLossPrice: null,
      fillQuality: null,
      rrMultiplier: 1.5,
      createdTimestamp: performance.now(),
    };
  }

  // Bearish Fair Value Gap (Sell-Side Imbalance, Buy-Side Inefficiency)
  if (c2.close < c2.open && c3.high < c1.low) {
    const top = c1.low;
    const bottom = c3.high;
    const height = top - bottom;
    if (height < MIN_GAP_HEIGHT) return null;

    return {
      id: `fvg-bear-${c3.index}-${Math.round(performance.now())}`,
      direction: 'BEARISH',
      createdAtIndex: c3.index,
      top,
      bottom,
      ceMidpoint: (top + bottom) * 0.5,
      status: 'OPEN',
      hasOrderBlockConfluence: Boolean(c1.hasOrderBlock),
      orderEntryPrice: null,
      stopLossPrice: null,
      fillQuality: null,
      rrMultiplier: 1.5,
      createdTimestamp: performance.now(),
    };
  }

  return null;
}

/**
 * Evaluates player limit-order placement inside an FVG relative to
 * Consequent Encroachment (50% equilibrium midpoint).
 */
export function evaluateEntryPrecision(
  gap: FairValueGap,
  rawEntryPrice: number
): {
  clampedPrice: number;
  fillQuality: FillQuality;
  rrMultiplier: number;
  stopLossPrice: number;
} {
  const clampedPrice = Math.min(gap.top, Math.max(gap.bottom, rawEntryPrice));
  const halfHeight = Math.max((gap.top - gap.bottom) * 0.5, 0.001);
  const normalizedDistanceFromCE =
    Math.abs(clampedPrice - gap.ceMidpoint) / halfHeight;

  let fillQuality: FillQuality = 'EDGE';
  let rrMultiplier = 1.4;

  if (normalizedDistanceFromCE <= 0.24) {
    fillQuality = 'SNIPER_CE';
    rrMultiplier = 3.0;
  } else if (normalizedDistanceFromCE <= 0.62) {
    fillQuality = 'PRECISION';
    rrMultiplier = 2.0;
  }

  const stopBuffer = halfHeight * 0.35;
  const stopLossPrice =
    gap.direction === 'BULLISH'
      ? gap.bottom - stopBuffer
      : gap.top + stopBuffer;

  return {
    clampedPrice,
    fillQuality,
    rrMultiplier,
    stopLossPrice,
  };
}

/**
 * Evaluates every newly closed candle against open / armed Fair Value Gaps
 * to detect clean mitigations (bounces) or invalidations (IFVG polarity flips).
 */
export function evaluateCandleAgainstGaps(
  candle: Candle,
  gaps: FairValueGap[],
  currentStreak: number
): { outcomes: TradeOutcome[]; nextStreak: number } {
  const outcomes: TradeOutcome[] = [];
  let streak = currentStreak;

  for (const gap of gaps) {
    if (
      gap.status === 'MITIGATED' ||
      gap.status === 'INVALIDATED_IFVG' ||
      candle.index <= gap.createdAtIndex
    ) {
      continue;
    }

    const isBullish = gap.direction === 'BULLISH';

    // 1. Check Invalidation (price slices completely past distal edge)
    const invalidated = isBullish
      ? candle.close < gap.bottom ||
        (gap.stopLossPrice !== null && candle.low < gap.stopLossPrice)
      : candle.close > gap.top ||
        (gap.stopLossPrice !== null && candle.high > gap.stopLossPrice);

    if (invalidated) {
      const hadOrder = gap.status === 'ORDER_PLACED';
      gap.status = 'INVALIDATED_IFVG';
      gap.mitigatedAtIndex = candle.index;

      if (hadOrder) {
        streak = 0;
        outcomes.push({
          fvgId: gap.id,
          won: false,
          pointsDelta: -100,
          fillQuality: gap.fillQuality,
          rrMultiplier: gap.rrMultiplier,
          streak,
          headline: 'STOPPED OUT · IFVG FLIP!',
          subtext: 'Disrespect of FVG inverted zone polarity',
        });
      }
      continue;
    }

    // 2. Check Mitigation / Bounce if player armed a limit order inside the gap
    if (gap.status === 'ORDER_PLACED' && gap.orderEntryPrice !== null) {
      const touchedEntry = isBullish
        ? candle.low <= gap.orderEntryPrice
        : candle.high >= gap.orderEntryPrice;

      const rejectedAway = isBullish
        ? candle.close >= gap.orderEntryPrice
        : candle.close <= gap.orderEntryPrice;

      if (touchedEntry && rejectedAway) {
        gap.status = 'MITIGATED';
        gap.mitigatedAtIndex = candle.index;
        streak += 1;

        const obBonus = gap.hasOrderBlockConfluence ? 1.5 : 1.0;
        const streakBonus = 1 + (streak - 1) * 0.25;
        const points = Math.round(
          100 * gap.rrMultiplier * streakBonus * obBonus
        );

        const headline =
          gap.fillQuality === 'SNIPER_CE'
            ? `SNIPER 50% CE FILL! +${points}`
            : gap.fillQuality === 'PRECISION'
            ? `PRECISION MITIGATION! +${points}`
            : `FVG BOUNCE! +${points}`;

        const subtext = `${gap.rrMultiplier.toFixed(1)}x R:R · ${streak}x Streak${
          gap.hasOrderBlockConfluence ? ' · OB Confluence (1.5x)' : ''
        }`;

        outcomes.push({
          fvgId: gap.id,
          won: true,
          pointsDelta: points,
          fillQuality: gap.fillQuality,
          rrMultiplier: gap.rrMultiplier,
          streak,
          headline,
          subtext,
        });
      } else if (touchedEntry && !rejectedAway) {
        // Wicked through entry and closed deep in gap without bouncing cleanly
        gap.status = 'INVALIDATED_IFVG';
        gap.mitigatedAtIndex = candle.index;
        streak = 0;
        outcomes.push({
          fvgId: gap.id,
          won: false,
          pointsDelta: -75,
          fillQuality: gap.fillQuality,
          rrMultiplier: gap.rrMultiplier,
          streak,
          headline: 'WICKED OUT · NO REJECTION',
          subtext: 'Price failed to displace away from FVG',
        });
      }
    }
  }

  return { outcomes, nextStreak: streak };
}
