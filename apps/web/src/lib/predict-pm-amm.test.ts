import { describe, expect, it } from "vitest";
import type { MarketAccount } from "@pm-amm/sdk";
import { predictMarketMetrics, predictUsdcBuyQuote } from "./predict-pm-amm";

const scale = 2n ** 48n;
const bn = (value: number | bigint) => ({ toNumber: () => Number(value), toString: () => String(value) });
function account(overrides: Partial<MarketAccount> = {}): MarketAccount {
 return {
   endTs: bn(1_900_000_000), lastAccrualTs: bn(1_800_000_000), lZero: bn(10n * scale),
   reserveYes: bn(5n * scale), reserveNo: bn(5n * scale), resolved: false, winningSide: 0,
   marketId: bn(1), ...({} as MarketAccount), ...overrides,
 } as MarketAccount;
}

describe("PREDICT pm-AMM analytics and quote guard", () => {
 it("rescales reserves to the current dynamic-liquidity state", () => {
   const metrics = predictMarketMetrics(account(), 1_850_000_000);
   expect(metrics.priceYes).toBeCloseTo(0.5, 4);
   expect(metrics.remainingSecs).toBe(50_000_000);
   expect(metrics.lEff).toBeGreaterThan(0);
   expect(metrics.liquidityValue).toBeGreaterThan(0);
   expect(metrics.isOpen).toBe(true);
 });
 it("applies the official 2% USDC-leg fee and capped minimum output", () => {
   const quote = predictUsdcBuyQuote(account(), "yes", 10, 100, 1_850_000_000);
   expect(quote?.direction).toBe("usdcToYes");
   expect(quote?.feeUsdc).toBeCloseTo(0.2, 6);
   expect(quote?.minimumOutputRaw).toBeGreaterThan(0);
   expect(quote!.minimumOutputRaw / 1_000_000).toBeLessThan(quote!.estimate.output);
 });
 it("fails closed for stale/invalid risk inputs and expired markets", () => {
   expect(predictUsdcBuyQuote(account(), "no", 0, 100, 1_850_000_000)).toBeNull();
   expect(predictUsdcBuyQuote(account(), "no", 10, 301, 1_850_000_000)).toBeNull();
   expect(predictUsdcBuyQuote(account({ endTs: bn(1_800_000_000) }), "yes", 1, 100, 1_850_000_000)).toBeNull();
 });
});
