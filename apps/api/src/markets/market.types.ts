export type VenueId = 'polymarket';

export interface MarketOutcome {
  name: string;
  probability: number | null;
  assetId: string | null;
  bestBid: number | null;
  bestAsk: number | null;
  depth: number | null;
  bookObservedAt: string | null;
}

export interface AggregatedMarket {
  id: string;
  eventId: string | null;
  venue: VenueId;
  venueName: string;
  venueUrl: string | null;
  question: string;
  description: string | null;
  category: string | null;
  tags: string[];
  outcomes: MarketOutcome[];
  resolutionCriteria: string | null;
  resolutionSource: string | null;
  expiresAt: string | null;
  active: boolean;
  closed: boolean;
  volume: number | null;
  volume24h: number | null;
  liquidity: number | null;
  sourceUpdatedAt: string | null;
  observedAt: string;
  dataSource: 'gamma';
}

export interface MarketSnapshot {
  venue: VenueId;
  venueName: string;
  sourceUrl: string;
  fetchedAt: string;
  expiresAt: string;
  stale: boolean;
  realtime: boolean;
  lastStreamAt: string | null;
  error: string | null;
  markets: AggregatedMarket[];
}

export interface PricePoint { timestamp: string; price: number; resolutionSeconds: number | null; }
export interface PriceHistory { venue: VenueId; marketId: string; assetId: string; interval: string; sourceUrl: string; fetchedAt: string; points: PricePoint[]; error: string | null; }
export type PriceHistoryInterval = '1d' | '1w' | '1m' | 'max';

/** Common read-only contract for venue adapters; execution is intentionally outside Step 2. */
export interface MarketVenueAdapter {
  readonly venue: VenueId;
  list(filters?: { query?: string; category?: string; venue?: string; includeClosed?: boolean }): Promise<MarketSnapshot>;
  get(id: string): Promise<AggregatedMarket | null>;
  history(id: string, outcomeIndex: number, interval?: PriceHistoryInterval): Promise<PriceHistory | null>;
}
