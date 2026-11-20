export type MarketDirection = 'BULLISH' | 'BEARISH';

export type FvgStatus =
  | 'OPEN'
  | 'ORDER_PLACED'
  | 'MITIGATED'
  | 'INVALIDATED_IFVG';

export type FillQuality = 'SNIPER_CE' | 'PRECISION' | 'EDGE';

export interface Candle {
  index: number;
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
  isLiquiditySweep?: boolean;
  isNewsSpike?: boolean;
  hasOrderBlock?: boolean;
}

export interface FairValueGap {
  id: string;
  direction: MarketDirection;
  createdAtIndex: number;
  top: number;
  bottom: number;
  ceMidpoint: number;
  status: FvgStatus;
  hasOrderBlockConfluence: boolean;
  orderEntryPrice: number | null;
  stopLossPrice: number | null;
  fillQuality: FillQuality | null;
  rrMultiplier: number;
  createdTimestamp: number;
  mitigatedAtIndex?: number;
}

export interface LevelConfig {
  level: number;
  name: string;
  sessionLabel: string;
  themeAccent: string;
  fogColor: number;
  gridColor: number;
  candleIntervalMs: number;
  volatility: number;
  sweepProbability: number;
  orderBlockProbability: number;
  newsSpikeProbability: number;
  targetScore: number;
  description: string;
}

export interface TradeOutcome {
  fvgId: string;
  won: boolean;
  pointsDelta: number;
  fillQuality: FillQuality | null;
  rrMultiplier: number;
  streak: number;
  headline: string;
  subtext: string;
}
