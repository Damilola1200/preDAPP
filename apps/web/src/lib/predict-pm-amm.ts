import { estimateSwapOutput, expectedDailyLvr, i80f48ToNumber, poolValue, priceFromReserves } from '@pm-amm/sdk/math';
import type { MarketAccount, SwapDirection } from '@pm-amm/sdk';

export interface PredictMarketMetrics {
  priceYes: number | null;
  liquidityValue: number | null;
  lEff: number;
  lZero: number;
  reserveYes: number;
  reserveNo: number;
  remainingSecs: number;
  expectedDailyLvr: number | null;
  isOpen: boolean;
}

/** Rescale stored reserves to now using the official PREDICT integration guide formula. */
export function predictMarketMetrics(account: MarketAccount, nowSecs = Math.floor(Date.now() / 1000)): PredictMarketMetrics {
  const endTs = account.endTs.toNumber();
  const lastAccrualTs = account.lastAccrualTs.toNumber();
  const remainingSecs = Math.max(0, endTs - nowSecs);
  const lZero = i80f48ToNumber(account.lZero);
  const lEff = lZero * Math.sqrt(Math.max(remainingSecs, 1));
  const lLast = lZero * Math.sqrt(Math.max(endTs - lastAccrualTs, 1));
  const rescale = lLast > 0 ? lEff / lLast : 1;
  const reserveYes = i80f48ToNumber(account.reserveYes) * rescale;
  const reserveNo = i80f48ToNumber(account.reserveNo) * rescale;
  const isOpen = !account.resolved && remainingSecs > 0 && lEff > 0;
  const priceYes = account.resolved ? account.winningSide === 1 ? 1 : account.winningSide === 2 ? 0 : null
    : isOpen ? priceFromReserves(reserveYes, reserveNo, lEff) : null;
  const liquidityValue = priceYes !== null && lEff > 0 ? poolValue(priceYes, lEff) : null;
  return { priceYes, liquidityValue, lEff, lZero, reserveYes, reserveNo, remainingSecs,
    expectedDailyLvr: priceYes !== null && isOpen ? expectedDailyLvr(priceYes, lEff, remainingSecs) : null, isOpen };
}

/** PREDICT SDK math estimate for USDC buys; fees and slippage are displayed, then enforced by on-chain minOutput. */
export function predictUsdcBuyQuote(account: MarketAccount, side: 'yes' | 'no', amountUsdc: number, slippageBps: number, nowSecs = Math.floor(Date.now() / 1000)) {
  if (!Number.isFinite(amountUsdc) || amountUsdc <= 0 || !Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 300) return null;
  const metrics = predictMarketMetrics(account, nowSecs);
  if (!metrics.isOpen) return null;
  const feeUsdc = amountUsdc * 0.02;
  const estimate = estimateSwapOutput(metrics.reserveYes, metrics.reserveNo, metrics.lEff, amountUsdc - feeUsdc, side);
  if (!Number.isFinite(estimate.output) || estimate.output <= 0) return null;
  const minimumOutputRaw = Math.floor(estimate.output * (1 - slippageBps / 10_000) * 1_000_000);
  if (!Number.isSafeInteger(minimumOutputRaw) || minimumOutputRaw <= 0) return null;
  const direction: SwapDirection = side === 'yes' ? 'usdcToYes' : 'usdcToNo';
  return { direction, estimate, feeUsdc, minimumOutputRaw, metrics };
}
