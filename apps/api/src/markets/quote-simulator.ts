import { AggregatedMarket, MarketOutcome } from './market.types';

export type QuoteSide = 'BUY' | 'SELL';
const clean = (value: number | null) => value === null ? null : Number(value.toFixed(10));

/** Pure, read-only depth walk. Venue totals are estimates; unknown network cost keeps all-in marked incomplete. */
export function simulateMarketQuote(market: AggregatedMarket, outcome: MarketOutcome, side: QuoteSide, shares: number, now = Date.now()) {
  const levels = side === 'BUY' ? [...outcome.asks].sort((a, b) => a.price - b.price) : [...outcome.bids].sort((a, b) => b.price - a.price);
  const bestPrice = levels[0]?.price ?? null;
  let remaining = shares; let filled = 0; let gross = 0; let feeTotal = 0;
  const feeKnown = market.feesEnabled === false || (market.feesEnabled === true && market.feeSchedule !== null);
  for (const level of levels) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, level.size);
    remaining -= quantity; filled += quantity; gross += quantity * level.price;
    if (market.feesEnabled === true && market.feeSchedule) {
      const curve = Math.pow(level.price * (1 - level.price), market.feeSchedule.exponent);
      feeTotal += quantity * market.feeSchedule.rate * curve;
    }
  }
  const complete = remaining < 1e-9;
  const averagePrice = filled > 0 ? gross / filled : null;
  const slippagePerShare = averagePrice !== null && bestPrice !== null ? side === 'BUY' ? averagePrice - bestPrice : bestPrice - averagePrice : null;
  const levelsObserved = outcome.bookLevelsObservedAt ? Date.parse(outcome.bookLevelsObservedAt) : NaN;
  const ageMs = Number.isFinite(levelsObserved) ? Math.max(0, now - levelsObserved) : null;
  const stale = ageMs === null || ageMs > 15_000;
  const status = !levels.length ? 'unavailable' : stale ? 'stale' : complete ? 'estimated' : 'partial';
  const estimatedVenueFee = feeKnown ? (market.feesEnabled === false ? 0 : feeTotal) : null;
  return {
    venue: market.venue, marketId: market.id, outcome: outcome.name, side, requestedShares: shares,
    filledShares: clean(filled), remainingShares: clean(Math.max(0, remaining)), complete, status, stale, ageMs,
    asOf: outcome.bookLevelsObservedAt, bestPrice: clean(bestPrice), averagePrice: clean(averagePrice),
    slippagePerShare: clean(slippagePerShare), slippagePercent: averagePrice && slippagePerShare !== null ? clean(slippagePerShare / averagePrice) : null,
    grossVenueAmount: clean(gross), feeStatus: market.feesEnabled === false ? 'none' : feeKnown ? 'estimated' : 'unknown',
    estimatedVenueFee: clean(estimatedVenueFee), estimatedVenueTotal: feeKnown ? clean(side === 'BUY' ? gross + feeTotal : gross - feeTotal) : null,
    networkCost: null, allInComplete: false, executable: false,
    notice: 'Simulated from a public order-book snapshot. No order was submitted. Network and execution costs are not included.',
  };
}

