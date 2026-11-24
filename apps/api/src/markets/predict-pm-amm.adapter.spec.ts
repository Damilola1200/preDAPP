jest.mock('@pm-amm/sdk', () => ({
  PmAmmClient: class {},
  decodeName: (bytes: number[]) => Buffer.from(bytes).toString('utf8').replace(/\0+$/, ''),
  i80f48ToNumber: (value: { toString(): string }) => Number(value.toString()) / (2 ** 48),
  poolValue: (_price: number, lEff: number) => lEff,
  priceFromReserves: (yes: number, no: number) => yes === no ? 0.5 : yes > no ? 0.75 : 0.25,
}));
jest.mock('@solana/web3.js', () => ({
  Connection: class {},
  PublicKey: class { constructor(private readonly value = '11111111111111111111111111111111') {} toBase58() { return this.value; } },
}));
import { PublicKey } from '@solana/web3.js';
import type { MarketAccount } from '@pm-amm/sdk';
import { normalizePredictMarket } from './predict-pm-amm.adapter';

const scale = 2n ** 48n;
class FixedNumber { constructor(private readonly value: number | string | bigint) {} toNumber() { return Number(this.value); } toString() { return String(this.value); } }
const key = new PublicKey('11111111111111111111111111111111');
function account(overrides: Partial<MarketAccount> = {}): MarketAccount {
  return {
    authority: key as never, marketId: new FixedNumber(7) as never, collateralMint: key as never, yesMint: key as never, noMint: key as never, vault: key as never,
    startTs: new FixedNumber(1_800_000_000) as never, endTs: new FixedNumber(1_900_000_000) as never, lZero: new FixedNumber(10n * scale) as never,
    reserveYes: new FixedNumber(5n * scale) as never, reserveNo: new FixedNumber(5n * scale) as never, lastAccrualTs: new FixedNumber(1_800_000_000) as never,
    cumYesPerShare: new FixedNumber(0) as never, cumNoPerShare: new FixedNumber(0) as never, totalYesDistributed: new FixedNumber(0) as never, totalNoDistributed: new FixedNumber(0) as never,
    totalLpShares: new FixedNumber(0) as never, resolved: false, winningSide: 0, bump: 0, name: Array.from(Buffer.from('Test market')), initialPriceBps: 5000,
    group: key as never, unclaimedExcessYes: new FixedNumber(0) as never, unclaimedExcessNo: new FixedNumber(0) as never, ...overrides,
  };
}

describe('normalizePredictMarket', () => {
  it('normalizes public on-chain fields and does not invent resolution terms or history', () => {
    const market = normalizePredictMarket(key.toBase58(), account(), new Date(1_850_000_000_000));
    expect(market).toMatchObject({ venue: 'predict', dataSource: 'predict', question: 'Test market', resolutionCriteria: null, resolutionSource: null, feesEnabled: true });
    expect(market.outcomes.map(outcome => outcome.probability)).toEqual([0.5, 0.5]);
    expect(market.liquidity).toBeGreaterThan(0);
  });
  it('shows resolved markets at their protocol winning side', () => {
    const market = normalizePredictMarket(key.toBase58(), account({ resolved: true, winningSide: 2 }), new Date(1_850_000_000_000));
    expect(market.outcomes.map(outcome => outcome.probability)).toEqual([0, 1]);
    expect(market.closed).toBe(true);
  });
  it('does not present expired unresolved markets with a live probability', () => {
    const market = normalizePredictMarket(key.toBase58(), account({ endTs: new FixedNumber(1_800_000_100) as never }), new Date(1_850_000_000_000));
    expect(market.outcomes.map(outcome => outcome.probability)).toEqual([null, null]);
    expect(market.active).toBe(false);
  });
});
