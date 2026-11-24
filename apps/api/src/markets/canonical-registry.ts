import { AggregatedMarket } from './market.types';

export type MatchClass = 'exact-equivalent' | 'probable-equivalent' | 'similar-but-different' | 'non-equivalent';
export interface MarketMatch { classification: MatchClass; confidence: number; reasons: string[]; }

function normalize(text: string | null | undefined): string {
  return (text ?? '').normalize('NFKD').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
function tokenSimilarity(a: string | null | undefined, b: string | null | undefined): number {
  const left = new Set(normalize(a).split(' ').filter(x => x.length > 2));
  const right = new Set(normalize(b).split(' ').filter(x => x.length > 2));
  if (!left.size || !right.size) return 0;
  let common = 0; for (const token of left) if (right.has(token)) common++;
  return common / new Set([...left, ...right]).size;
}
function dateValue(date: string | null) { return date ? Date.parse(date) : Number.NaN; }
function terms(text: string | null | undefined, pattern: RegExp) { return [...(normalize(text).matchAll(pattern))].map(match => match[0]).sort(); }

/** Conservative registry comparison; lexical similarity alone can never produce equivalence. */
export function compareMarkets(a: AggregatedMarket, b: AggregatedMarket): MarketMatch {
  const reasons: string[] = [];
  const descScore = tokenSimilarity(a.question, b.question);
  const criteriaScore = tokenSimilarity(a.resolutionCriteria, b.resolutionCriteria);
  const criteriaKnown = Boolean(normalize(a.resolutionCriteria) && normalize(b.resolutionCriteria));
  const outcomeA = a.outcomes.map(x => normalize(x.name)).sort();
  const outcomeB = b.outcomes.map(x => normalize(x.name)).sort();
  const outcomesKnown = outcomeA.length > 0 && outcomeB.length > 0;
  const outcomesEqual = outcomesKnown && JSON.stringify(outcomeA) === JSON.stringify(outcomeB);
  const timeA = dateValue(a.expiresAt); const timeB = dateValue(b.expiresAt);
  const expiryKnown = Number.isFinite(timeA) && Number.isFinite(timeB);
  const expiryEqual = expiryKnown && Math.abs(timeA - timeB) < 60_000;
  const sourceA = normalize(a.resolutionSource); const sourceB = normalize(b.resolutionSource);
  const sourceKnown = Boolean(sourceA && sourceB);
  const sourceEqual = sourceKnown && sourceA === sourceB;
  const quantitativeTextA = `${a.question} ${a.resolutionCriteria ?? ''}`;
  const quantitativeTextB = `${b.question} ${b.resolutionCriteria ?? ''}`;
  const numericTermsEqual = JSON.stringify(terms(quantitativeTextA, /\b\d[\d,]*(?:\.\d+)?\b/g)) === JSON.stringify(terms(quantitativeTextB, /\b\d[\d,]*(?:\.\d+)?\b/g));
  const currencyTermsEqual = JSON.stringify(terms(quantitativeTextA, /\b(?:usd|us dollars?|dollars?|eur|euros?|gbp|pounds?|btc|bitcoin|eth|ethereum)\b/g)) === JSON.stringify(terms(quantitativeTextB, /\b(?:usd|us dollars?|dollars?|eur|euros?|gbp|pounds?|btc|bitcoin|eth|ethereum)\b/g));
  if (!outcomesKnown) reasons.push('Outcome definitions are incomplete.');
  else if (!outcomesEqual) reasons.push('Outcome definitions differ.');
  if (!criteriaKnown) reasons.push('Resolution criteria are incomplete.');
  else if (criteriaScore < 0.85) reasons.push('Resolution criteria differ.');
  if (!expiryKnown) reasons.push('Expiration time is missing.');
  else if (!expiryEqual) reasons.push('Expiration times differ.');
  if (!sourceKnown) reasons.push('Settlement source is unverified.');
  else if (!sourceEqual) reasons.push('Settlement sources differ.');
  if (!numericTermsEqual) reasons.push('Numeric thresholds differ.');
  if (!currencyTermsEqual) reasons.push('Currency or asset terms differ.');
  const complete = outcomesKnown && criteriaKnown && expiryKnown && sourceKnown;
  const noConflict = (outcomesEqual || !outcomesKnown) && (criteriaScore >= 0.85 || !criteriaKnown)
    && (expiryEqual || !expiryKnown) && (sourceEqual || !sourceKnown) && numericTermsEqual && currencyTermsEqual;
  if (complete && outcomesEqual && normalize(a.resolutionCriteria) === normalize(b.resolutionCriteria) && expiryEqual && sourceEqual && numericTermsEqual && currencyTermsEqual && descScore >= 0.8) {
    return { classification: 'exact-equivalent', confidence: 1, reasons: ['Outcomes, criteria, expiration, settlement source, and question align.'] };
  }
  if (noConflict && sourceKnown && sourceEqual && descScore >= 0.55 && criteriaScore >= 0.7 && outcomesEqual && expiryEqual) {
    return { classification: 'probable-equivalent', confidence: Math.min(0.94, 0.55 + 0.2 * descScore + 0.19 * criteriaScore), reasons: ['Core outcome and expiration align; manual review is required.', ...reasons] };
  }
  if (descScore >= 0.25 || criteriaScore >= 0.25) return { classification: 'similar-but-different', confidence: Math.max(descScore, criteriaScore), reasons: reasons.length ? reasons : ['Text is similar, but full equivalence is not established.'] };
  return { classification: 'non-equivalent', confidence: 0, reasons: reasons.length ? reasons : ['No meaningful match found.'] };
}
