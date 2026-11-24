import { describe, expect, it } from "vitest";
import type { MarketAccount } from "@pm-amm/sdk";
import { minimumOutputFromSimulation, predictMarketMetrics } from "./predict-pm-amm";

const scale = 2n ** 48n;
const bn = (value: number | bigint) => ({ toNumber: () => Number(value), toString: () => String(value) });
function account(overrides: Partial<MarketAccount> = {}): MarketAccount {
 const fixture = {
   endTs: bn(1_900_000_000), lastAccrualTs: bn(1_800_000_000), lZero: bn(10n * scale),
   reserveYes: bn(5n * scale), reserveNo: bn(5n * scale), resolved: false, winningSide: 0,
   marketId: bn(1),
 } as unknown as MarketAccount;
 return Object.assign(fixture, overrides);
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
 it("applies the capped minimum output to an exact simulation result", () => {
   expect(minimumOutputFromSimulation(1_000_000, 100)).toBe(990_000);
   expect(minimumOutputFromSimulation(1_000_000, 300)).toBe(970_000);
 });
 it("fails closed for invalid simulation output, slippage, and expired markets", () => {
   expect(minimumOutputFromSimulation(0, 100)).toBeNull();
   expect(minimumOutputFromSimulation(Number.MAX_SAFE_INTEGER + 1, 100)).toBeNull();
   expect(minimumOutputFromSimulation(1_000_000, 301)).toBeNull();
   expect(predictMarketMetrics(account({ endTs: bn(1_800_000_000) }), 1_850_000_000).isOpen).toBe(false);
 });
});
