import { expectedDailyLvr, i80f48ToNumber, poolValue, priceFromReserves } from '@pm-amm/sdk/math';
import type { MarketAccount } from '@pm-amm/sdk';

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

/** Calculate minOutput only from an unsigned transaction simulation result, never from model math. */
export function minimumOutputFromSimulation(outputRaw: number, slippageBps: number) {
  if (!Number.isSafeInteger(outputRaw) || outputRaw <= 0 || !Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 300) return null;
  const minimum = Math.floor(outputRaw * (1 - slippageBps / 10_000));
  return Number.isSafeInteger(minimum) && minimum > 0 ? minimum : null;
}
