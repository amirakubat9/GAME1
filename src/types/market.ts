export type MarketDirection = 'BULLISH' | 'BEARISH';

export type FvgStatus = 'OPEN' | 'EXECUTED' | 'INVALIDATED_IFVG';

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
}

export type WorldObjectKind =
  | 'DOLLAR_ORB'
  | 'ORDER_BLOCK_CHEST'
  | 'HADES_SPIKE_TRAP';

export interface WorldObject {
  id: string;
  kind: WorldObjectKind;
  worldX: number;
  worldY: number;
  valueDollars: number;
  collectedOrBroken: boolean;
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
  runSpeed: number;
  volatility: number;
  targetBalance: number;
  description: string;
}

export interface LeaderboardEntry {
  id?: string;
  player_name: string;
  peak_dollars: number;
  best_streak: number;
  realm_reached: string;
  created_at?: string;
}
