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
  pillarColor: number;
  brazierColor: number;
  candleIntervalMs: number;
  volatility: number;
  sweepProbability: number;
  orderBlockProbability: number;
  newsSpikeProbability: number;
  targetBalance: number;
  description: string;
}

export interface TradeOutcome {
  fvgId: string;
  won: boolean;
  dollarDelta: number;
  fillQuality: FillQuality | null;
  rrMultiplier: number;
  streak: number;
  headline: string;
  subtext: string;
  worldX: number;
  worldY: number;
}

export interface LeaderboardEntry {
  id?: string;
  player_name: string;
  peak_dollars: number;
  best_streak: number;
  realm_reached: string;
  created_at?: string;
}
