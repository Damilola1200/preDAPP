import { AggregatedMarket } from './market.types';
import { buildOpportunityReport } from './opportunity-engine';

function market(venue: 'polymarket' | 'predict', id: string, probability: number, overrides: Partial<AggregatedMarket> = {}): AggregatedMarket {
  return {
    id, eventId: null, venue, venueName: venue, venueUrl: null, question: 'Will Bitcoin close above $100,000 on Dec 31 2030?',
    description: 'Resolves against official exchange closing price.', category: 'Crypto', tags: [],
    outcomes: [
      { name: 'Yes', probability, assetId: null, bestBid: null, bestAsk: null, depth: null, bookObservedAt: null, bookLevelsObservedAt: null, bids: [], asks: [] },
      { name: 'No', probability: 1 - probability, assetId: null, bestBid: null, bestAsk: null, depth: null, bookObservedAt: null, bookLevelsObservedAt: null, bids: [], asks: [] },
    ],
    resolutionCriteria: 'Resolves against official exchange closing price.', resolutionSource: 'Official exchange closing price',
    expiresAt: '2030-12-31T23:59:00Z', active: true, closed: false, volume: null, volume24h: null, liquidity: 500,
    feesEnabled: false, feeSchedule: null, sourceUpdatedAt: null, observedAt: new Date().toISOString(), dataSource: venue === 'predict' ? 'predict' : 'gamma',
    ...overrides,
  };
}

describe('buildOpportunityReport', () => {
  it('labels equivalent price gaps statistical and never executable', () => {
    const report = buildOpportunityReport([market('polymarket', 'p', 0.35)], [market('predict', 's', 0.6)]);
    expect(report.counts).toMatchObject({ statistical: 1, potentialExecutable: 0, verifiedExecutable: 0 });
    expect(report.opportunities[0]).toMatchObject({ classification: 'exact-equivalent', status: 'statistical', executable: false, probabilityDifference: 0.25 });
  });
  it('suppresses lookalike markets when settlement criteria are missing', () => {
    const report = buildOpportunityReport([market('polymarket', 'p', 0.35)], [market('predict', 's', 0.6, { resolutionCriteria: null, resolutionSource: null })]);
    expect(report.counts.statistical).toBe(0);
    expect(report.suppressed[0]).toMatchObject({ classification: 'similar-but-different', status: 'suppressed', executable: false });
  });
  it('does not produce a gap below the 2 percentage point threshold', () => {
    const report = buildOpportunityReport([market('polymarket', 'p', 0.50)], [market('predict', 's', 0.51)]);
    expect(report.counts.statistical).toBe(0);
  });
});
