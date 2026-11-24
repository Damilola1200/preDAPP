import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PmAmmClient, decodeName, i80f48ToNumber, poolValue, priceFromReserves, type MarketAccount } from '@pm-amm/sdk';
import { Connection, PublicKey } from '@solana/web3.js';
import { AggregatedMarket, MarketOutcome, MarketSnapshot, PriceHistory, PriceHistoryInterval } from './market.types';

// Verified from https://predict-pm-amm.dev/hackathon.md. This adapter intentionally targets Devnet only.
export const PREDICT_PROGRAM_ID = 'GV1FMGHRYBjQLaghE5fnGuYCuCcpdt3GD5xEX3TwN16y';
export const PREDICT_DEVNET_COLLATERAL_MINT = '3WQ8hCqTNwjrh8WzE2XyoZoUrd1miPcwWfMkmFPUMEWZ';
const REFRESH_MS = 30_000;
const MAX_MARKETS = 250;
const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

export function normalizePredictMarket(publicKey: string, account: MarketAccount, observedAt = new Date()): AggregatedMarket {
  const nowSecs = Math.floor(observedAt.getTime() / 1000);
  const endTs = account.endTs.toNumber();
  const lastAccrualTs = account.lastAccrualTs.toNumber();
  const lZero = i80f48ToNumber(account.lZero);
  const lEff = lZero * Math.sqrt(Math.max(endTs - nowSecs, 1));
  const lLast = lZero * Math.sqrt(Math.max(endTs - lastAccrualTs, 1));
  const ratio = lLast > 0 ? lEff / lLast : 1;
  const reserveYes = i80f48ToNumber(account.reserveYes) * ratio;
  const reserveNo = i80f48ToNumber(account.reserveNo) * ratio;
  const curvePrice = lEff > 0 ? priceFromReserves(reserveYes, reserveNo, lEff) : null;
  const probability = account.resolved
    ? account.winningSide === 1 ? 1 : account.winningSide === 2 ? 0 : null
    : endTs > nowSecs ? curvePrice : null;
  const liquidity = curvePrice !== null && lEff > 0 ? poolValue(curvePrice, lEff) : null;
  const name = decodeName(account.name).trim() || `PREDICT market ${account.marketId.toString()}`;
  const yes: MarketOutcome = { name: 'Yes', probability, assetId: account.yesMint.toBase58(), bestBid: null, bestAsk: null, depth: null, bookObservedAt: null, bookLevelsObservedAt: null, bids: [], asks: [] };
  const no: MarketOutcome = { name: 'No', probability: probability === null ? null : 1 - probability, assetId: account.noMint.toBase58(), bestBid: null, bestAsk: null, depth: null, bookObservedAt: null, bookLevelsObservedAt: null, bids: [], asks: [] };
  const closed = account.resolved || endTs <= nowSecs;
  return {
    id: publicKey, eventId: null, venue: 'predict', venueName: 'PREDICT PM-AMM',
    venueUrl: `https://solscan.io/account/${encodeURIComponent(publicKey)}?cluster=devnet`,
    question: name, description: 'On-chain PREDICT binary market. Resolution criteria and source are not encoded in the market account.',
    category: 'Solana', tags: ['Solana', 'PREDICT', 'pm-AMM'], outcomes: [yes, no],
    resolutionCriteria: null, resolutionSource: null, expiresAt: new Date(endTs * 1000).toISOString(),
    active: !closed, closed, volume: null, volume24h: null,
    liquidity: Number.isFinite(liquidity) ? liquidity : null, feesEnabled: true, feeSchedule: null,
    sourceUpdatedAt: null, observedAt: observedAt.toISOString(), dataSource: 'predict',
  };
}

@Injectable()
export class PredictPmAmmAdapter {
  readonly venue = 'predict' as const;
  private markets: AggregatedMarket[] = [];
  private fetchedAt: string | null = null;
  private error: string | null = null;
  private client: PmAmmClient | null = null;
  private endpoint: string | null = null;
  private refreshing: Promise<void> | null = null;
  private retryAt = 0;
  private consecutiveFailures = 0;

  constructor(private readonly config: ConfigService) {}

  async list(filters: { query?: string; category?: string; venue?: string; includeClosed?: boolean } = {}): Promise<MarketSnapshot> {
    if (filters.venue && filters.venue !== 'predict') return this.emptySnapshot();
    await this.refreshIfNeeded();
    const query = filters.query?.trim().toLocaleLowerCase();
    const category = filters.category?.trim().toLocaleLowerCase();
    const markets = this.markets.filter(m => (filters.includeClosed || (m.active && !m.closed))
      && (!query || `${m.question} ${m.description ?? ''} ${m.tags.join(' ')}`.toLocaleLowerCase().includes(query))
      && (!category || m.category?.toLocaleLowerCase() === category || m.tags.some(tag => tag.toLocaleLowerCase() === category)));
    const at = this.fetchedAt ?? new Date().toISOString();
    return { venue: 'predict', venueName: 'PREDICT PM-AMM', sourceUrl: 'https://predict-pm-amm.dev/', fetchedAt: at,
      expiresAt: new Date(Date.parse(at) + REFRESH_MS).toISOString(), stale: !this.fetchedAt || Date.now() - Date.parse(at) > REFRESH_MS,
      realtime: false, lastStreamAt: null, error: this.error, markets };
  }

  async get(id: string): Promise<AggregatedMarket | null> {
    await this.refreshIfNeeded();
    return this.markets.find(market => market.id === id) ?? null;
  }

  async history(_id: string, _outcomeIndex: number, _interval?: PriceHistoryInterval): Promise<PriceHistory | null> { return null; }

  private async refreshIfNeeded() {
    if (this.fetchedAt && Date.now() - Date.parse(this.fetchedAt) < REFRESH_MS) return;
    if (Date.now() < this.retryAt) return;
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.refresh();
    try { await this.refreshing; }
    finally { this.refreshing = null; }
  }

  private async refresh() {
    if (this.config.get<string>('SOLANA_NETWORK', 'devnet') !== 'devnet') {
      this.error = 'PREDICT integration is restricted to Devnet during this stage.';
      this.retryAt = Date.now() + REFRESH_MS;
      return;
    }
    const endpoint = this.config.get<string>('SOLANA_RPC_URL');
    if (!endpoint) { this.error = 'Solana RPC endpoint is not configured.'; this.retryAt = Date.now() + REFRESH_MS; return; }
    try {
      if (!this.client || this.endpoint !== endpoint) {
        const connection = new Connection(endpoint, 'confirmed');
        this.client = PmAmmClient.readOnly(connection, new PublicKey(PREDICT_PROGRAM_ID), new PublicKey(PREDICT_DEVNET_COLLATERAL_MINT), { commitment: 'confirmed' });
        this.endpoint = endpoint;
      }
      if (await this.client.connection.getGenesisHash() !== DEVNET_GENESIS_HASH) {
        this.error = 'Configured Solana RPC endpoint does not match the verified Devnet cluster.';
        this.consecutiveFailures += 1;
        this.retryAt = Date.now() + Math.min(60_000, 5_000 * (2 ** Math.min(this.consecutiveFailures - 1, 4)));
        return;
      }
      const rows = (await this.client.fetchAllMarkets(443)).filter(row => row.account.collateralMint.equals(new PublicKey(PREDICT_DEVNET_COLLATERAL_MINT)));
      const observedAt = new Date();
      this.markets = rows.slice(0, MAX_MARKETS).map(row => normalizePredictMarket(row.publicKey.toBase58(), row.account, observedAt));
      this.fetchedAt = observedAt.toISOString();
      this.retryAt = 0;
      this.consecutiveFailures = 0;
      this.error = rows.length > MAX_MARKETS ? `Showing the first ${MAX_MARKETS} of ${rows.length} Devnet markets.` : null;
    } catch {
      // RPC errors may contain a private provider URL. Keep details in server logs only.
      this.error = 'PREDICT Devnet market data is temporarily unavailable.';
      this.consecutiveFailures += 1;
      this.retryAt = Date.now() + Math.min(60_000, 5_000 * (2 ** Math.min(this.consecutiveFailures - 1, 4)));
    }
  }

  private emptySnapshot(): MarketSnapshot {
    return { venue: 'predict', venueName: 'PREDICT PM-AMM', sourceUrl: 'https://predict-pm-amm.dev/', fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + REFRESH_MS).toISOString(), stale: true, realtime: false, lastStreamAt: null, error: null, markets: [] };
  }
}
