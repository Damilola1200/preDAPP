import { AggregatedMarket, MarketSnapshot } from './market.types';
import { compareMarkets, MarketMatch } from './canonical-registry';

export type OpportunityStatus = 'statistical' | 'potential-executable' | 'verified-executable' | 'suppressed';
export interface OpportunityCandidate {
  left: { venue: string; marketId: string; question: string; probability: number | null; liquidity: number | null };
  right: { venue: string; marketId: string; question: string; probability: number | null; liquidity: number | null };
  classification: MarketMatch['classification'];
  confidence: number;
  probabilityDifference: number | null;
  status: OpportunityStatus;
  executable: false;
  reasons: string[];
}

function selectedProbability(market: AggregatedMarket): number | null {
  const yes = market.outcomes.find(outcome => outcome.name.toLocaleLowerCase() === 'yes') ?? market.outcomes[0];
  return yes?.probability ?? null;
}

/** Statistical discrepancies are surfaced only for probable/exact pairs; executable status stays off until two real execution routes exist. */
export function buildOpportunityReport(leftMarkets: AggregatedMarket[], rightMarkets: AggregatedMarket[], sources: MarketSnapshot[] = []) {
  const candidates: OpportunityCandidate[] = [];
  for (const left of leftMarkets) for (const right of rightMarkets) {
    if (left.venue === right.venue) continue;
    const match = compareMarkets(left, right);
    if (match.classification === 'non-equivalent') continue;
    const leftProbability = selectedProbability(left);
    const rightProbability = selectedProbability(right);
    const probabilityDifference = leftProbability === null || rightProbability === null ? null : Math.abs(leftProbability - rightProbability);
    const enoughDiscrepancy = probabilityDifference !== null && probabilityDifference >= 0.02;
    const statisticallyComparable = ['exact-equivalent', 'probable-equivalent'].includes(match.classification);
    const status: OpportunityStatus = statisticallyComparable && enoughDiscrepancy ? 'statistical' : 'suppressed';
    const reasons = [...match.reasons];
    if (!enoughDiscrepancy) reasons.push(probabilityDifference === null ? 'Comparable probabilities are unavailable.' : 'Probability difference is below the 2 percentage point display threshold.');
    if (status === 'statistical') reasons.push('This is a statistical comparison only; venue fees, live executable quotes, settlement risk, and atomicity are not verified.');
    candidates.push({
      left: { venue: left.venueName, marketId: left.id, question: left.question, probability: leftProbability, liquidity: left.liquidity },
      right: { venue: right.venueName, marketId: right.id, question: right.question, probability: rightProbability, liquidity: right.liquidity },
      classification: match.classification, confidence: match.confidence, probabilityDifference, status, executable: false, reasons,
    });
  }
  const opportunities = candidates.filter(candidate => candidate.status === 'statistical').slice(0, 100);
  const suppressed = candidates.filter(candidate => candidate.status === 'suppressed').slice(0, 100);
  return {
    generatedAt: new Date().toISOString(),
    opportunities,
    suppressed,
    counts: { statistical: opportunities.length, potentialExecutable: 0, verifiedExecutable: 0, suppressed: candidates.filter(candidate => candidate.status === 'suppressed').length },
    executableOpportunitiesEnabled: false,
    sources: sources.map(({ venue, venueName, fetchedAt, stale, error }) => ({ venue, venueName, fetchedAt, stale, error })),
    notice: 'No opportunity is a guaranteed profit. Executable opportunities are disabled until equivalent settlement rules, live two-sided quotes, fees, liquidity, supported execution, and reconciliation are validated.',
  };
}
