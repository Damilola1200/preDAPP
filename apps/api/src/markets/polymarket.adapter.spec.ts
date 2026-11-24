import { normalizePolymarketEvents } from './polymarket.adapter';
import { PolymarketAdapter } from './polymarket.adapter';

describe('normalizePolymarketEvents', () => {
  it('normalizes documented Gamma event and market fields including v1 assets', () => {
    const normalized = normalizePolymarketEvents([{
      id: 'evt-1', slug: 'event-slug', title: 'Question?', description: 'Resolution text',
      tags: [{ label: 'Science' }], markets: [{ id: 'm-1', question: 'Will it happen?', slug: 'market-slug',
        outcomes: '["Yes", "No"]', outcomePrices: '["0.63", "0.37"]',
        clobTokenIds: '["asset-yes", "asset-no"]', version: 'v1', endDate: '2030-01-01T00:00:00Z',
        resolutionSource: 'Official results', volume: '1234.5', volume24hr: '10', liquidity: '200', active: true, closed: false }],
    }]);
    expect(normalized).toHaveLength(1);
    const market = normalized[0]!;
    expect(market).toMatchObject({ id: 'm-1', eventId: 'evt-1', venue: 'polymarket', category: null,
      tags: ['Science'], volume: 1234.5, volume24h: 10, liquidity: 200, closed: false,
      resolutionCriteria: 'Resolution text', resolutionSource: 'Official results', feesEnabled: null, feeSchedule: null });
    expect(market.outcomes).toEqual([
      { name: 'Yes', probability: 0.63, assetId: 'asset-yes', bestBid: null, bestAsk: null, depth: null, bookObservedAt: null, bookLevelsObservedAt: null, bids: [], asks: [] },
      { name: 'No', probability: 0.37, assetId: 'asset-no', bestBid: null, bestAsk: null, depth: null, bookObservedAt: null, bookLevelsObservedAt: null, bids: [], asks: [] },
    ]);
    expect(market.venueUrl).toContain('polymarket.com/market/market-slug');
  });

  it('uses the v2 position IDs, rejects malformed entries, and preserves unknown prices', () => {
    const items = normalizePolymarketEvents([{ markets: [null, { id: 'm-2', question: 'Question', version: 'v2',
      outcomes: ['Above'], outcomePrices: ['bad'], positionIds: ['position-1'], active: true }] }]);
    expect(items).toHaveLength(1);
    expect(items[0]!.outcomes[0]!).toMatchObject({ assetId: 'position-1', probability: null, bookObservedAt: null, bookLevelsObservedAt: null, bids: [], asks: [] });
    expect(items[0]!.expiresAt).toBeNull();
  });

  it('applies public WebSocket book and top-of-book updates to the cache', () => {
    const adapter = new PolymarketAdapter();
    const internals = adapter as unknown as { consumeStreamMessage: (message: string) => void; bookCache: Map<string, unknown> };
    internals.consumeStreamMessage(JSON.stringify([
      { event_type: 'book', asset_id: 'asset-live', bids: [{ price: '0.41', size: '12' }], asks: [{ price: '0.44', size: '10' }] },
      { event_type: 'best_bid_ask', asset_id: 'asset-live', best_bid: '0.42', best_ask: '0.43' },
    ]));
    expect(internals.bookCache.get('asset-live')).toMatchObject({ bid: 0.42, ask: 0.43 });
  });
});
