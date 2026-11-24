import { AggregatedMarket, MarketOutcome } from './market.types';
import { simulateMarketQuote } from './quote-simulator';

const baseMarket: AggregatedMarket = {
  id: 'm1', eventId: 'e1', venue: 'polymarket', venueName: 'Polymarket', venueUrl: null,
  question: 'Will it happen?', description: null, category: null, tags: [], outcomes: [],
  resolutionCriteria: null, resolutionSource: null, expiresAt: null, active: true, closed: false,
  volume: null, volume24h: null, liquidity: null, feesEnabled: true,
  feeSchedule: { rate: 0.05, exponent: 1, takerOnly: true, rebateRate: 0.25 },
  sourceUpdatedAt: null, observedAt: new Date().toISOString(), dataSource: 'gamma',
};
const outcome: MarketOutcome = {
  name: 'Yes', probability: 0.4, assetId: 'asset', bestBid: 0.39, bestAsk: 0.4, depth: 100,
  bookObservedAt: new Date(10_000).toISOString(), bookLevelsObservedAt: new Date(10_000).toISOString(),
  bids: [{ price: 0.39, size: 10 }], asks: [{ price: 0.4, size: 2 }, { price: 0.5, size: 3 }],
};

describe('simulateMarketQuote', () => {
  it('walks multiple ask levels, estimates the documented fee schedule, and marks network cost incomplete', () => {
    const quote = simulateMarketQuote(baseMarket, outcome, 'BUY', 4, 10_500);
    expect(quote).toMatchObject({ status: 'estimated', complete: true, filledShares: 4, grossVenueAmount: 1.8,
      estimatedVenueFee: 0.049, estimatedVenueTotal: 1.849, bestPrice: 0.4, averagePrice: 0.45,
      slippagePerShare: 0.05, stale: false, allInComplete: false, executable: false });
    expect(quote.networkCost).toBeNull();
  });
  it('marks insufficient depth as partial and never calls it executable', () => {
    const quote = simulateMarketQuote(baseMarket, outcome, 'SELL', 20, 10_500);
    expect(quote).toMatchObject({ status: 'partial', filledShares: 10, remainingShares: 10, complete: false, executable: false });
  });
  it('does not fabricate a fee when a fee-enabled market omits its schedule', () => {
    const quote = simulateMarketQuote({ ...baseMarket, feeSchedule: null }, outcome, 'BUY', 1, 10_500);
    expect(quote).toMatchObject({ feeStatus: 'unknown', estimatedVenueFee: null, estimatedVenueTotal: null });
  });
  it('flags stale book levels and treats explicitly fee-free markets as zero venue fee', () => {
    const quote = simulateMarketQuote({ ...baseMarket, feesEnabled: false, feeSchedule: null }, outcome, 'BUY', 1, 30_000);
    expect(quote).toMatchObject({ status: 'stale', stale: true, feeStatus: 'none', estimatedVenueFee: 0 });
  });
});

