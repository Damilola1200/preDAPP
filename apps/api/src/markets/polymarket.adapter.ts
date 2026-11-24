import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AggregatedMarket, BookLevel, MarketFeeSchedule, MarketOutcome, MarketSnapshot, MarketVenueAdapter, PriceHistory, PriceHistoryInterval, PricePoint } from './market.types';
import { QuoteSide, simulateMarketQuote } from './quote-simulator';

const GAMMA_URL = 'https://gamma-api.polymarket.com/events/keyset';
const CLOB_BOOKS_URL = 'https://clob.polymarket.com/books';
const HISTORY_URL = 'https://data-api.polymarket.com/v2/prices-history';
const MARKET_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';
const CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 12_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const MAX_BOOK_ASSETS = 500;
const MAX_CACHED_MARKETS = 10_000;
const MAX_MARKET_AGE_MS = 30 * 60_000;
type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null;
}
function parseArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
function stringValue(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function numberValue(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}
function booleanValue(value: unknown, fallback = false): boolean { return typeof value === 'boolean' ? value : fallback; }
function normalizeLevels(levels: unknown): BookLevel[] {
  if (!Array.isArray(levels)) return [];
  return levels.flatMap(level => {
    const item = record(level); const price = numberValue(item?.price); const size = numberValue(item?.size);
    return price !== null && price >= 0 && price <= 1 && size !== null && size > 0 ? [{ price, size }] : [];
  });
}

export function normalizePolymarketEvents(events: unknown[], observedAt = new Date().toISOString()): AggregatedMarket[] {
  const normalized: AggregatedMarket[] = [];
  for (const item of events) {
    const event = record(item);
    if (!event) continue;
    const eventId = stringValue(event.id);
    const eventSlug = stringValue(event.slug);
    const tags = Array.isArray(event.tags) ? event.tags.flatMap(tag => {
      const label = stringValue(record(tag)?.label); return label ? [label] : [];
    }) : [];
    const markets = Array.isArray(event.markets) ? event.markets : [];
    for (const entry of markets) {
      const market = record(entry);
      if (!market) continue;
      const id = stringValue(market.id);
      const question = stringValue(market.question);
      if (!id || !question) continue;
      const outcomes = parseArray(market.outcomes).map(value => stringValue(value));
      const prices = parseArray(market.outcomePrices).map(numberValue);
      const tokenIds = parseArray(market.clobTokenIds);
      const positionIds = parseArray(market.positionIds);
      const assets = market.version === 'v2' ? positionIds : tokenIds;
      const resolvedOutcomes: MarketOutcome[] = outcomes.flatMap((name, index) => name ? [{
        name,
        probability: prices[index] !== undefined && prices[index]! >= 0 && prices[index]! <= 1 ? prices[index]! : null,
        assetId: stringValue(assets[index]),
        bestBid: null,
        bestAsk: null,
        depth: null,
        bookObservedAt: null,
        bookLevelsObservedAt: null,
        bids: [],
        asks: [],
      }] : []);
      const slug = stringValue(market.slug) ?? eventSlug;
      const rawFeeSchedule = record(market.feeSchedule);
      const feeSchedule: MarketFeeSchedule | null = rawFeeSchedule
        && numberValue(rawFeeSchedule.rate) !== null && numberValue(rawFeeSchedule.exponent) !== null
        && typeof rawFeeSchedule.takerOnly === 'boolean' && numberValue(rawFeeSchedule.rebateRate) !== null
        ? { rate: numberValue(rawFeeSchedule.rate)!, exponent: numberValue(rawFeeSchedule.exponent)!, takerOnly: rawFeeSchedule.takerOnly, rebateRate: numberValue(rawFeeSchedule.rebateRate)! }
        : null;
      normalized.push({
        id, eventId, venue: 'polymarket', venueName: 'Polymarket',
        venueUrl: slug ? `https://polymarket.com/market/${encodeURIComponent(slug)}` : null,
        question, description: stringValue(market.description) ?? stringValue(event.description),
        category: stringValue(market.category) ?? stringValue(event.category), tags, outcomes: resolvedOutcomes,
        resolutionCriteria: stringValue(market.description) ?? stringValue(event.description),
        resolutionSource: stringValue(market.resolutionSource) ?? stringValue(event.resolutionSource),
        expiresAt: stringValue(market.endDate) ?? stringValue(event.endDate),
        active: booleanValue(market.active, booleanValue(event.active)),
        closed: booleanValue(market.closed, booleanValue(event.closed)),
        volume: numberValue(market.volume) ?? numberValue(market.volumeNum) ?? numberValue(event.volume),
        volume24h: numberValue(market.volume24hr) ?? numberValue(event.volume24hr),
        liquidity: numberValue(market.liquidity) ?? numberValue(market.liquidityClob) ?? numberValue(event.liquidity),
        feesEnabled: typeof market.feesEnabled === 'boolean' ? market.feesEnabled : null,
        feeSchedule,
        sourceUpdatedAt: stringValue(market.updatedAt) ?? stringValue(event.updatedAt), observedAt, dataSource: 'gamma',
      });
    }
  }
  return normalized;
}

@Injectable()
export class PolymarketAdapter implements OnModuleInit, OnModuleDestroy, MarketVenueAdapter {
  readonly venue = 'polymarket' as const;
  private readonly logger = new Logger(PolymarketAdapter.name);
  private markets: AggregatedMarket[] = [];
  private fetchedAt: string | null = null;
  private lastError: string | null = null;
  private nextCursor: string | null = null;
  private nextSyncAt = 0;
  private consecutiveFailures = 0;
  private syncing: Promise<void> | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private bookCache = new Map<string, { at: number; levelsAt: number; bid: number | null; ask: number | null; depth: number | null; bids: BookLevel[]; asks: BookLevel[] }>();
  private historyCache = new Map<string, { at: number; points: PricePoint[] }>();
  private socket?: WebSocket;
  private socketHeartbeat?: ReturnType<typeof setInterval>;
  private socketReconnect?: ReturnType<typeof setTimeout>;
  private streamAssets = new Set<string>();
  private streamEnabled = false;
  private lastStreamAt: string | null = null;
  private reconnectAttempts = 0;

  async onModuleInit() {
    void this.sync();
    this.timer = setInterval(() => void this.sync(), CACHE_TTL_MS);
    this.timer.unref?.();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.socketHeartbeat) clearInterval(this.socketHeartbeat);
    if (this.socketReconnect) clearTimeout(this.socketReconnect);
    this.socket?.close(); this.socket = undefined;
  }

  async list(filters: { query?: string; category?: string; venue?: string; includeClosed?: boolean } = {}): Promise<MarketSnapshot> {
    if (!this.fetchedAt || Date.now() - Date.parse(this.fetchedAt) > CACHE_TTL_MS) await this.sync();
    const q = filters.query?.trim().toLocaleLowerCase();
    const category = filters.category?.trim().toLocaleLowerCase();
    const venueMatches = !filters.venue || filters.venue.toLocaleLowerCase() === 'polymarket';
    const markets = this.markets.filter(m => venueMatches && Date.now() - Date.parse(m.observedAt) <= MAX_MARKET_AGE_MS && (filters.includeClosed || (m.active && !m.closed))
      && (!q || `${m.question} ${m.description ?? ''} ${m.tags.join(' ')}`.toLocaleLowerCase().includes(q))
      && (!category || m.category?.toLocaleLowerCase() === category || m.tags.some(t => t.toLocaleLowerCase() === category)))
      .sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1));
    const enhanced = await this.attachBooks(markets.slice(0, 100));
    const at = this.fetchedAt;
    return { venue: 'polymarket', venueName: 'Polymarket', sourceUrl: GAMMA_URL, fetchedAt: at ?? new Date().toISOString(), expiresAt: new Date((at ? Date.parse(at) : Date.now()) + CACHE_TTL_MS).toISOString(), stale: !at || Date.now() - Date.parse(at) > CACHE_TTL_MS, realtime: this.streamEnabled, lastStreamAt: this.lastStreamAt, error: this.lastError, markets: enhanced };
  }

  async get(id: string): Promise<AggregatedMarket | null> {
    if (!this.fetchedAt || Date.now() - Date.parse(this.fetchedAt) > CACHE_TTL_MS) await this.sync();
    const found = this.markets.find(m => m.id === id);
    if (!found) return null;
    return (await this.attachBooks([found]))[0] ?? null;
  }

  async quote(id: string, outcomeIndex: number, side: QuoteSide, shares: number) {
    if (!this.fetchedAt || Date.now() - Date.parse(this.fetchedAt) > CACHE_TTL_MS) await this.sync();
    const market = this.markets.find(item => item.id === id);
    if (!market || !market.outcomes[outcomeIndex]) return null;
    const fresh = (await this.attachBooks([market], true))[0];
    const outcome = fresh?.outcomes[outcomeIndex];
    if (!fresh || !outcome) return null;
    return simulateMarketQuote(fresh, outcome, side, shares);
  }

  async history(id: string, outcomeIndex: number, interval: PriceHistoryInterval = '1d'): Promise<PriceHistory | null> {
    if (!this.fetchedAt || Date.now() - Date.parse(this.fetchedAt) > CACHE_TTL_MS) await this.sync();
    const market = this.markets.find(m => m.id === id); const outcome = market?.outcomes[outcomeIndex];
    if (!market || !outcome?.assetId) return null;
    const key = `${outcome.assetId}:${interval}`; const current = this.historyCache.get(key);
    if (current && Date.now() - current.at < 300_000) return { venue: 'polymarket', marketId: id, assetId: outcome.assetId, interval, sourceUrl: HISTORY_URL, fetchedAt: new Date(current.at).toISOString(), points: current.points, error: null };
    const url = new URL(HISTORY_URL); url.searchParams.set('token_id', outcome.assetId); url.searchParams.set('interval', interval);
    try {
      const response = await this.requestJson(url.toString());
      const container = record(response); const rawPoints = Array.isArray(response) ? response : Array.isArray(container?.data) ? container!.data as unknown[] : [];
      const points: PricePoint[] = rawPoints.flatMap(raw => {
        const point = record(raw); const time = numberValue(point?.timestamp); const price = numberValue(point?.price);
        if (time === null || price === null || price < 0 || price > 1) return [];
        const millis = time < 100_000_000_000 ? time * 1000 : time;
        return [{ timestamp: new Date(millis).toISOString(), price, resolutionSeconds: numberValue(point?.resolutionSeconds) ?? numberValue(point?.resolution_seconds) }];
      });
      this.historyCache.set(key, { at: Date.now(), points });
      return { venue: 'polymarket', marketId: id, assetId: outcome.assetId, interval, sourceUrl: HISTORY_URL, fetchedAt: new Date().toISOString(), points, error: null };
    } catch (error) {
      return { venue: 'polymarket', marketId: id, assetId: outcome.assetId, interval, sourceUrl: HISTORY_URL, fetchedAt: new Date().toISOString(), points: current?.points ?? [], error: error instanceof Error ? error.message.slice(0, 300) : 'Price history could not be loaded.' };
    }
  }

  private async sync() {
    if (this.syncing) return this.syncing;
    if (Date.now() < this.nextSyncAt) return;
    this.syncing = this.syncPages().finally(() => { this.syncing = null; });
    return this.syncing;
  }
  private async syncPages() {
    try {
      const events: unknown[] = [];
      let cursor = this.nextCursor;
      for (let page = 0; page < MAX_PAGES; page++) {
        const url = new URL(GAMMA_URL);
        url.searchParams.set('closed', 'false'); url.searchParams.set('limit', String(PAGE_SIZE));
        url.searchParams.append('version', 'v1'); url.searchParams.append('version', 'v2');
        if (cursor) url.searchParams.set('after_cursor', cursor);
        const body = record(await this.requestJson(url.toString()));
        if (!body || !Array.isArray(body.events)) throw new Error('Polymarket response did not contain an events array.');
        events.push(...body.events);
        cursor = stringValue(body.next_cursor);
        if (!cursor || body.events.length === 0) break;
      }
      const fresh = normalizePolymarketEvents(events);
      const merged = new Map(this.markets.map(m => [m.id, m]));
      for (const market of fresh) merged.set(market.id, market);
      const oldest = Date.now() - MAX_MARKET_AGE_MS;
      this.markets = [...merged.values()].filter(m => Date.parse(m.observedAt) >= oldest)
        .sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt)).slice(0, MAX_CACHED_MARKETS);
      this.fetchedAt = new Date().toISOString();
      this.lastError = null;
      this.nextCursor = cursor;
      this.consecutiveFailures = 0;
      this.nextSyncAt = Date.now() + CACHE_TTL_MS;
      this.updateStreamSubscriptions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Polymarket API error.';
      this.lastError = message.slice(0, 300);
      this.consecutiveFailures++;
      this.nextSyncAt = Date.now() + Math.min(CACHE_TTL_MS, 5_000 * (2 ** Math.min(this.consecutiveFailures - 1, 4)));
      this.logger.warn(`Polymarket sync failed: ${this.lastError}`);
    }
  }

  private async attachBooks(markets: AggregatedMarket[], forceRefresh = false): Promise<AggregatedMarket[]> {
    const requests = markets.flatMap(m => m.outcomes.flatMap((outcome, i) => outcome.assetId
      && (forceRefresh || !this.bookCache.has(outcome.assetId) || Date.now() - this.bookCache.get(outcome.assetId)!.at > CACHE_TTL_MS)
      ? [{ marketId: m.id, index: i, assetId: outcome.assetId }] : []));
    for (let start = 0; start < requests.length; start += MAX_BOOK_ASSETS) {
      const batch = requests.slice(start, start + MAX_BOOK_ASSETS);
      try {
        const body: unknown = await this.requestJson(CLOB_BOOKS_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(batch.map(x => ({ token_id: x.assetId }))) });
        if (!Array.isArray(body)) continue;
        const byAsset = new Map<string, { bid: number | null; ask: number | null; depth: number | null; bids: BookLevel[]; asks: BookLevel[] }>();
        for (const entry of body) {
          const book = record(entry); const asset = stringValue(book?.asset_id);
          if (!asset) continue;
          const bids = Array.isArray(book?.bids) ? book.bids : []; const asks = Array.isArray(book?.asks) ? book.asks : [];
          const bidLevels = normalizeLevels(bids).sort((a, b) => b.price - a.price);
          const askLevels = normalizeLevels(asks).sort((a, b) => a.price - b.price);
          const depth = [...bids, ...asks].reduce((sum, x) => sum + (numberValue(record(x)?.size) ?? 0), 0);
          byAsset.set(asset, { bid: bidLevels[0]?.price ?? null, ask: askLevels[0]?.price ?? null, depth, bids: bidLevels, asks: askLevels });
        }
        for (const request of batch) { const book = byAsset.get(request.assetId); if (book) { const at = Date.now(); this.bookCache.set(request.assetId, { ...book, at, levelsAt: at }); } }
      } catch (error) {
        this.logger.warn(`Polymarket order book read failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
    return markets.map(m => ({ ...m, outcomes: m.outcomes.map(outcome => {
      const cached = outcome.assetId ? this.bookCache.get(outcome.assetId) : undefined;
      if (!cached || Date.now() - cached.at > CACHE_TTL_MS) return outcome;
      return { ...outcome, bestBid: cached.bid, bestAsk: cached.ask, depth: cached.depth, bids: cached.bids, asks: cached.asks,
        bookObservedAt: new Date(cached.at).toISOString(), bookLevelsObservedAt: new Date(cached.levelsAt).toISOString() };
    }) }));
  }

  private updateStreamSubscriptions() {
    const assets = [...new Set([...this.markets].sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1)).flatMap(m => m.outcomes.flatMap(o => o.assetId ? [o.assetId] : [])))].slice(0, 200);
    const next = new Set(assets);
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) { this.connectStream(); return; }
    const added = assets.filter(asset => !this.streamAssets.has(asset));
    const removed = [...this.streamAssets].filter(asset => !next.has(asset));
    if (removed.length) this.socket.send(JSON.stringify({ assets_ids: removed, operation: 'unsubscribe' }));
    if (added.length) this.socket.send(JSON.stringify({ assets_ids: added, operation: 'subscribe' }));
    this.streamAssets = next;
  }

  private connectStream() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) return;
    if (typeof globalThis.WebSocket !== 'function') {
      this.streamEnabled = false;
      this.logger.warn('Runtime WebSocket is unavailable; using scheduled REST polling.');
      return;
    }
    const socket = new WebSocket(MARKET_WS_URL); this.socket = socket;
    socket.addEventListener('open', () => {
      if (this.socket !== socket) return;
      this.reconnectAttempts = 0;
      const assets = [...new Set([...this.markets].sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1)).flatMap(m => m.outcomes.flatMap(o => o.assetId ? [o.assetId] : [])))].slice(0, 200);
      this.streamAssets = new Set(assets);
      socket.send(JSON.stringify({ assets_ids: assets, type: 'market', custom_feature_enabled: true }));
      this.streamEnabled = assets.length > 0;
      this.socketHeartbeat = setInterval(() => { if (socket.readyState === WebSocket.OPEN) socket.send('PING'); }, 10_000);
      this.socketHeartbeat.unref?.();
    });
    socket.addEventListener('message', event => this.consumeStreamMessage((event as MessageEvent).data));
    socket.addEventListener('error', () => socket.close());
    socket.addEventListener('close', () => {
      if (this.socket !== socket) return;
      this.socket = undefined; this.streamEnabled = false; this.streamAssets.clear();
      if (this.socketHeartbeat) clearInterval(this.socketHeartbeat); this.socketHeartbeat = undefined;
      this.reconnectAttempts++;
      const wait = Math.min(60_000, 1_000 * (2 ** Math.min(this.reconnectAttempts, 6)));
      this.socketReconnect = setTimeout(() => this.connectStream(), wait); this.socketReconnect.unref?.();
    });
  }

  private consumeStreamMessage(data: unknown) {
    const text = typeof data === 'string' ? data : data instanceof ArrayBuffer ? new TextDecoder().decode(data) : String(data);
    if (text === 'PONG' || text === 'pong') return;
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return; }
    const messages = Array.isArray(parsed) ? parsed : [parsed];
    for (const raw of messages) {
      const event = record(raw); if (!event) continue;
      const type = stringValue(event.event_type) ?? stringValue(event.type);
      const update = (asset: string | null, bid: number | null, ask: number | null, depth: number | null = null) => {
        if (!asset) return;
        const previous = this.bookCache.get(asset);
        this.bookCache.set(asset, { at: Date.now(), levelsAt: previous?.levelsAt ?? 0,
          bid: bid ?? previous?.bid ?? null, ask: ask ?? previous?.ask ?? null, depth: depth ?? previous?.depth ?? null,
          bids: previous?.bids ?? [], asks: previous?.asks ?? [] });
        this.lastStreamAt = new Date().toISOString();
      };
      if (type === 'book') {
        const asset = stringValue(event.asset_id) ?? stringValue(record(event.payload)?.assetId) ?? stringValue(record(event.payload)?.asset_id);
        const bids = Array.isArray(event.bids) ? event.bids : Array.isArray(record(event.payload)?.bids) ? record(event.payload)!.bids as unknown[] : [];
        const asks = Array.isArray(event.asks) ? event.asks : Array.isArray(record(event.payload)?.asks) ? record(event.payload)!.asks as unknown[] : [];
        const bidPrices = bids.map(x => numberValue(record(x)?.price)).filter((x): x is number => x !== null);
        const askPrices = asks.map(x => numberValue(record(x)?.price)).filter((x): x is number => x !== null);
        const bidLevels = normalizeLevels(bids).sort((a, b) => b.price - a.price); const askLevels = normalizeLevels(asks).sort((a, b) => a.price - b.price);
        const depth = [...bidLevels, ...askLevels].reduce((sum, x) => sum + x.size, 0);
        if (asset) { const at = Date.now(); this.bookCache.set(asset, { at, levelsAt: at, bid: bidLevels[0]?.price ?? null, ask: askLevels[0]?.price ?? null, depth, bids: bidLevels, asks: askLevels }); this.lastStreamAt = new Date().toISOString(); }
      } else if (type === 'best_bid_ask') {
        const payload = record(event.payload) ?? event;
        update(stringValue(payload.asset_id) ?? stringValue(payload.assetId), numberValue(payload.best_bid ?? payload.bestBid), numberValue(payload.best_ask ?? payload.bestAsk));
      } else if (type === 'price_change') {
        const changes = Array.isArray(event.price_changes) ? event.price_changes : Array.isArray(record(event.payload)?.priceChanges) ? record(event.payload)!.priceChanges as unknown[] : [];
        for (const rawChange of changes) {
          const change = record(rawChange); if (!change) continue;
          update(stringValue(change.asset_id) ?? stringValue(change.assetId), numberValue(change.best_bid ?? change.bestBid), numberValue(change.best_ask ?? change.bestAsk));
        }
      }
    }
  }

  private async requestJson(url: string, init?: RequestInit): Promise<unknown> {
    let last: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(url, { ...init, signal: controller.signal, headers: { accept: 'application/json', ...init?.headers } });
        if (response.status === 429 || response.status >= 500) throw new Error(`Polymarket HTTP ${response.status}`);
        if (!response.ok) throw new Error(`Polymarket HTTP ${response.status}`);
        return await response.json();
      } catch (error) {
        last = error;
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 300 * (2 ** attempt)));
      } finally { clearTimeout(timer); }
    }
    throw last instanceof Error ? last : new Error('Polymarket request failed.');
  }
}
