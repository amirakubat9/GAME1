import { Candle, FairValueGap, LevelConfig } from '../types/market';

export const STARTING_DOLLARS = 10000;

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
    runSpeed: 7.4,
    volatility: 1.0,
    targetBalance: 14500,
    description: 'Sunlit bronze pillars, Golden Orbs & clean FVG bridges.',
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
    runSpeed: 8.6,
    volatility: 1.25,
    targetBalance: 20500,
    description: 'Aegean storm mist — faster sprint speed & Order Block Chests.',
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
    runSpeed: 9.8,
    volatility: 1.45,
    targetBalance: 28000,
    description: 'Molten temple forge — double Hades traps & 2x chest payouts.',
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
    runSpeed: 11.0,
    volatility: 1.7,
    targetBalance: 39000,
    description: 'Underworld crimson inferno — high-speed aerial orb chains.',
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
    runSpeed: 12.2,
    volatility: 1.95,
    targetBalance: 9999999,
    description: 'Divine overdrive — maximum velocity & legendary dollar rewards.',
  },
];

export function detectFairValueGap(
  c1: Candle,
  c2: Candle,
  c3: Candle
): FairValueGap | null {
  const c2Body = Math.abs(c2.close - c2.open);
  if (c2Body < 1.0) return null;

  if (c2.close > c2.open && c3.low > c1.high) {
    const bottom = c1.high;
    const top = c3.low;
    if (top - bottom < 0.55) return null;

    return {
      id: `fvg-bull-${c3.index}`,
      direction: 'BULLISH',
      createdAtIndex: c3.index,
      top,
      bottom,
      ceMidpoint: (top + bottom) * 0.5,
      status: 'OPEN',
      hasOrderBlockConfluence: Boolean(c1.hasOrderBlock),
    };
  }

  if (c2.close < c2.open && c3.high < c1.low) {
    const top = c1.low;
    const bottom = c3.high;
    if (top - bottom < 0.55) return null;

    return {
      id: `fvg-bear-${c3.index}`,
      direction: 'BEARISH',
      createdAtIndex: c3.index,
      top,
      bottom,
      ceMidpoint: (top + bottom) * 0.5,
      status: 'OPEN',
      hasOrderBlockConfluence: Boolean(c1.hasOrderBlock),
    };
  }

  return null;
}
