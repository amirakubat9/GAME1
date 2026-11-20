import {
  Candle,
  FairValueGap,
  FillQuality,
  LevelConfig,
  TradeOutcome,
} from '../types/market';

export const STARTING_DOLLARS = 10000;

/**
 * 5 God of War II Mythic Realms — each realm shifts the 3D arena lighting,
 * marble pillar tint, brazier fire color, candle speed, and market volatility.
 */
export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    level: 1,
    name: 'Colossus of Rhodes',
    sessionLabel: 'REALM I · COLOSSUS OF RHODES',
    themeAccent: '#fbbf24',
    fogColor: 0x160e07,
    gridColor: 0x5c3a18,
    pillarColor: 0xb89668,
    brazierColor: 0xff8c1a,
    candleIntervalMs: 1120,
    volatility: 1.0,
    sweepProbability: 0.15,
    orderBlockProbability: 0.25,
    newsSpikeProbability: 0.0,
    targetBalance: 13500,
    description: 'Sunlit bronze pillars & clean institutional 4H swing FVGs.',
  },
  {
    level: 2,
    name: 'Steeds of Time',
    sessionLabel: 'REALM II · STEEDS OF TIME',
    themeAccent: '#38bdf8',
    fogColor: 0x071322,
    gridColor: 0x1a476e,
    pillarColor: 0x7b96b0,
    brazierColor: 0x38bdf8,
    candleIntervalMs: 960,
    volatility: 1.25,
    sweepProbability: 0.45,
    orderBlockProbability: 0.35,
    newsSpikeProbability: 0.08,
    targetBalance: 18500,
    description: 'Aegean storm mist — equal highs/lows swept before displacement.',
  },
  {
    level: 3,
    name: 'Island of Creation',
    sessionLabel: 'REALM III · ISLAND OF CREATION',
    themeAccent: '#f97316',
    fogColor: 0x1c0b06,
    gridColor: 0x6b2814,
    pillarColor: 0x8c6249,
    brazierColor: 0xff5500,
    candleIntervalMs: 820,
    volatility: 1.45,
    sweepProbability: 0.5,
    orderBlockProbability: 0.55,
    newsSpikeProbability: 0.15,
    targetBalance: 26000,
    description: 'Molten temple gold — Order Block + FVG confluence pays 1.5x.',
  },
  {
    level: 4,
    name: 'Abyss of Hades',
    sessionLabel: 'REALM IV · ABYSS OF HADES',
    themeAccent: '#f43f5e',
    fogColor: 0x1d0509,
    gridColor: 0x691422,
    pillarColor: 0x593a3e,
    brazierColor: 0xff1e38,
    candleIntervalMs: 700,
    volatility: 1.75,
    sweepProbability: 0.6,
    orderBlockProbability: 0.5,
    newsSpikeProbability: 0.35,
    targetBalance: 38000,
    description: 'Underworld hellfire — violent news spikes & rapid IFVG flips.',
  },
  {
    level: 5,
    name: 'Throne of Olympus',
    sessionLabel: 'REALM V · THRONE OF OLYMPUS',
    themeAccent: '#c084fc',
    fogColor: 0x110724,
    gridColor: 0x4b2285,
    pillarColor: 0xd8c39e,
    brazierColor: 0xd946ef,
    candleIntervalMs: 590,
    volatility: 2.0,
    sweepProbability: 0.65,
    orderBlockProbability: 0.65,
    newsSpikeProbability: 0.4,
    targetBalance: 9999999,
    description: 'Divine overdrive — chain 50% CE strikes for massive dollar payouts.',
  },
];

const MIN_GAP_HEIGHT = 0.65;

export function detectFairValueGap(
  c1: Candle,
  c2: Candle,
  c3: Candle
): FairValueGap | null {
  const c2Body = Math.abs(c2.close - c2.open);
  if (c2Body < 1.1) return null;

  // Bullish FVG (BISI)
  if (c2.close > c2.open && c3.low > c1.high) {
    const bottom = c1.high;
    const top = c3.low;
    if (top - bottom < MIN_GAP_HEIGHT) return null;

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

  // Bearish FVG (SIBI)
  if (c2.close < c2.open && c3.high < c1.low) {
    const top = c1.low;
    const bottom = c3.high;
    if (top - bottom < MIN_GAP_HEIGHT) return null;

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

  if (normalizedDistanceFromCE <= 0.25) {
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
          dollarDelta: -500,
          fillQuality: gap.fillQuality,
          rrMultiplier: gap.rrMultiplier,
          streak,
          headline: 'STOPPED OUT · -$500',
          subtext: 'Gap violated & flipped into an Inverse FVG',
          worldX: candle.index * 1.15,
          worldY: (gap.ceMidpoint - 100) * 0.85,
        });
      }
      continue;
    }

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
        const baseDollarRisk = 500;
        const dollarWin = Math.round(
          baseDollarRisk * gap.rrMultiplier * streakBonus * obBonus
        );

        const headline =
          gap.fillQuality === 'SNIPER_CE'
            ? `⚔️ 50% CE SNIPER STRIKE! +$${dollarWin.toLocaleString()}`
            : gap.fillQuality === 'PRECISION'
            ? `PRECISION BOUNCE! +$${dollarWin.toLocaleString()}`
            : `FVG MITIGATED! +$${dollarWin.toLocaleString()}`;

        const subtext = `${gap.rrMultiplier.toFixed(1)}x R:R · ${streak}x Rage Streak${
          gap.hasOrderBlockConfluence ? ' · OB Confluence (1.5x)' : ''
        }`;

        outcomes.push({
          fvgId: gap.id,
          won: true,
          dollarDelta: dollarWin,
          fillQuality: gap.fillQuality,
          rrMultiplier: gap.rrMultiplier,
          streak,
          headline,
          subtext,
          worldX: candle.index * 1.15,
          worldY: (gap.ceMidpoint - 100) * 0.85,
        });
      } else if (touchedEntry && !rejectedAway) {
        gap.status = 'INVALIDATED_IFVG';
        gap.mitigatedAtIndex = candle.index;
        streak = 0;
        outcomes.push({
          fvgId: gap.id,
          won: false,
          dollarDelta: -500,
          fillQuality: gap.fillQuality,
          rrMultiplier: gap.rrMultiplier,
          streak,
          headline: 'WICKED OUT · -$500',
          subtext: 'Price failed to reject away from FVG',
          worldX: candle.index * 1.15,
          worldY: (gap.ceMidpoint - 100) * 0.85,
        });
      }
    }
  }

  return { outcomes, nextStreak: streak };
}
