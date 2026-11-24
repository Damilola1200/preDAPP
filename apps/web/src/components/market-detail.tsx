"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";
import { MarketList } from "@/components/market-list";
import { apiBaseUrl } from "@/lib/api-url";

type Detail = { id: string; venue: string; venueName: string; venueUrl: string | null; question: string; description: string | null; resolutionCriteria: string | null; resolutionSource: string | null; expiresAt: string | null; active: boolean; closed: boolean; volume: number | null; volume24h: number | null; liquidity: number | null; observedAt: string; outcomes: { name: string; probability: number | null; bestBid: number | null; bestAsk: number | null; depth: number | null; bookObservedAt: string | null }[] };
type History = { fetchedAt: string; points: { timestamp: string; price: number; resolutionSeconds: number | null }[]; error: string | null };
const base = apiBaseUrl;
const money = (x: number | null) => x === null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 2 }).format(x);
export function MarketDetail() {
 const params = useParams<{ venue: string; id: string }>();
 const [outcomeIndex, setOutcomeIndex] = useState(0); const [interval, setInterval] = useState("1d");
 const venue = params.venue; const id = decodeURIComponent(params.id);
 const query = useQuery({ queryKey: ["market", venue, id], queryFn: async () => { const response = await fetch(`${base}/api/v1/markets/${encodeURIComponent(venue)}/${encodeURIComponent(id)}`); if (!response.ok) throw new Error(`Market lookup failed (${response.status}).`); return response.json() as Promise<Detail>; }, refetchInterval: 60_000 });
 if (query.isPending) return <main className="main"><div className="empty-row">Loading live market detail…</div></main>;
 if (query.isError) return <main className="main"><div className="panel detail-panel"><span className="source-badge error">LIVE DATA UNAVAILABLE</span><p>{query.error.message}</p><button className="retry-button" onClick={() => void query.refetch()}>Retry</button></div></main>;
 const market = query.data;
 const history = useQuery({ queryKey: ["market-history", venue, id, outcomeIndex, interval], queryFn: async () => { const response = await fetch(`${base}/api/v1/markets/${encodeURIComponent(venue)}/${encodeURIComponent(id)}/history?outcome=${outcomeIndex}&interval=${interval}`); if (!response.ok) throw new Error(`Price history unavailable (${response.status}).`); return response.json() as Promise<History>; }, refetchInterval: 300_000, enabled: outcomeIndex < market.outcomes.length });
 return <main className="main"><Link className="text-link" href="/markets">← All markets</Link><div className="detail-heading"><div><p className="eyebrow">{market.venueName.toUpperCase()} · PUBLIC MARKET DATA</p><h1 className="title">{market.question}</h1><p className="sub">Observed {new Date(market.observedAt).toLocaleString()} · {market.active && !market.closed ? "Open" : "Closed or inactive"}</p></div><span className="source-badge live">LIVE · {market.venueName.toUpperCase()}</span></div>
   <section className="panel detail-panel"><div className="detail-stats"><div><span>Volume</span><b>{money(market.volume)}</b></div><div><span>24h volume</span><b>{money(market.volume24h)}</b></div><div><span>Liquidity</span><b>{money(market.liquidity)}</b></div><div><span>Expiration</span><b>{market.expiresAt ? new Date(market.expiresAt).toLocaleString() : "Not provided"}</b></div></div>
     <h2 className="panel-title detail-subhead">Outcomes and public order book</h2><p className="detail-copy">Outcome prices are probability proxies. They are not guaranteed execution prices.</p>{market.outcomes.map(outcome => <div className="detail-outcome" key={outcome.name}><b>{outcome.name}</b><span>Outcome price {outcome.probability === null ? "Unavailable" : `${(outcome.probability * 100).toFixed(2)}%`}</span><span>Bid {outcome.bestBid ?? "—"}</span><span>Ask {outcome.bestAsk ?? "—"}</span><span>Book depth {outcome.depth ?? "Unavailable"}</span><span>Book updated {outcome.bookObservedAt ? new Date(outcome.bookObservedAt).toLocaleTimeString() : "Unavailable"}</span></div>)}
     <div className="history-heading"><h2 className="panel-title detail-subhead">Historical probability</h2><div className="history-controls"><label>Outcome <select value={outcomeIndex} onChange={event => setOutcomeIndex(Number(event.target.value))}>{market.outcomes.map((o, index) => <option value={index} key={o.name}>{o.name}</option>)}</select></label><label>Window <select value={interval} onChange={event => setInterval(event.target.value)}><option value="1d">1 day</option><option value="1w">1 week</option><option value="1m">1 month</option><option value="max">All available</option></select></label></div></div>
     {history.isPending ? <div className="empty-row">Loading venue price history…</div> : history.isError ? <div className="empty-row">Historical price data is currently unavailable.</div> : history.data.points.length < 2 ? <div className="empty-row">The venue has not returned enough history points to draw a chart.</div> : <PriceChart history={history.data} />}
     <h2 className="panel-title detail-subhead">Resolution information</h2><p className="detail-copy">{market.resolutionCriteria ?? "Resolution criteria are not provided by the source."}</p><p className="detail-copy"><b>Resolution source:</b> {market.resolutionSource ?? "Not specified by the source"}</p>{market.venueUrl && <a className="text-link" href={market.venueUrl} target="_blank" rel="noreferrer">Open original market on {market.venueName} ↗</a>}
   </section>
 </main>;
}

function PriceChart({ history }: { history: History }) {
 const points = history.points; const min = Math.min(...points.map(x => x.price)); const max = Math.max(...points.map(x => x.price)); const spread = max - min || 0.01;
 const polyline = points.map((point, index) => `${(index / (points.length - 1)) * 100},${95 - ((point.price - min) / spread) * 85}`).join(" ");
 return <div className="historical-chart"><div className="history-scale"><span>{(max * 100).toFixed(1)}%</span><span>{(min * 100).toFixed(1)}%</span></div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Historical venue probability chart"><polyline points={polyline} fill="none" stroke="#28ad80" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg><div className="history-time"><span>{new Date(points[0]!.timestamp).toLocaleString()}</span><span>{new Date(points.at(-1)!.timestamp).toLocaleString()}</span></div><div className="footer-note">Venue history · {points.length} observations · refreshed {new Date(history.fetchedAt).toLocaleTimeString()}</div></div>;
}
