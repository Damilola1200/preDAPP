import { AggregatedMarket } from './market.types';
import { compareMarkets } from './canonical-registry';

const market = (overrides: Partial<AggregatedMarket> = {}): AggregatedMarket => ({
  id: 'a', eventId: 'evt', venue: 'polymarket', venueName: 'Polymarket', venueUrl: null,
  question: 'Will Bitcoin close above 100000 USD on December 31 2030?', description: 'Resolution criteria: Official exchange close.',
  category: 'Crypto', tags: [], outcomes: [{ name: 'Yes', probability: 0.4, assetId: null, bestBid: null, bestAsk: null, depth: null, bookObservedAt: null, bookLevelsObservedAt: null, bids: [], asks: [] },
    { name: 'No', probability: 0.6, assetId: null, bestBid: null, bestAsk: null, depth: null, bookObservedAt: null, bookLevelsObservedAt: null, bids: [], asks: [] }],
  resolutionCriteria: 'Official exchange close for Bitcoin above 100000 USD on December 31 2030.',
  resolutionSource: 'Exchange closing price', expiresAt: '2030-12-31T23:59:00Z', active: true, closed: false,
  volume: null, volume24h: null, liquidity: null, feesEnabled: null, feeSchedule: null, sourceUpdatedAt: null, observedAt: new Date().toISOString(), dataSource: 'gamma', ...overrides,
});

describe('compareMarkets', () => {
  it('only calls markets exact when outcome, criteria, expiry, settlement and question align', () => {
    expect(compareMarkets(market(), market({ id: 'b' })).classification).toBe('exact-equivalent');
  });
  it('refuses equivalence when expiration differs despite a similar question', () => {
    const result = compareMarkets(market(), market({ id: 'b', expiresAt: '2031-01-01T00:00:00Z' }));
    expect(result.classification).toBe('similar-but-different');
    expect(result.reasons).toContain('Expiration times differ.');
  });
  it('does not infer equivalence when settlement or criteria are absent', () => {
    const result = compareMarkets(market(), market({ id: 'b', resolutionSource: null, resolutionCriteria: null }));
    expect(result.classification).toBe('similar-but-different');
    expect(result.reasons).toContain('Settlement source is unverified.');
  });
  it('rejects changed numeric thresholds even when most of the description matches', () => {
    const result = compareMarkets(market(), market({ id: 'b', question: 'Will Bitcoin close above 110000 USD on December 31 2030?' }));
    expect(result.classification).toBe('similar-but-different');
    expect(result.reasons).toContain('Numeric thresholds differ.');
  });
  it('returns non-equivalent for unrelated events', () => {
    expect(compareMarkets(market(), market({ id: 'b', question: 'Will rain fall tomorrow?', resolutionCriteria: 'Weather forecast', outcomes: [] })).classification).toBe('non-equivalent');
  });
});
