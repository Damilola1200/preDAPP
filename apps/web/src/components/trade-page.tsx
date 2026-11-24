"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

type Outcome = { name: string; probability: number | null; bids: { price: number; size: number }[]; asks: { price: number; size: number }[]; bookLevelsObservedAt: string | null };
type Market = { id: string; question: string; venueName: string; outcomes: Outcome[] };
type Snapshot = { markets: Market[] };
type Quote = { outcome: string; side: "BUY" | "SELL"; requestedShares: number; filledShares: number; remainingShares: number; complete: boolean; status: string; stale: boolean; asOf: string | null; bestPrice: number | null; averagePrice: number | null; slippagePerShare: number | null; slippagePercent: number | null; grossVenueAmount: number; feeStatus: string; estimatedVenueFee: number | null; estimatedVenueTotal: number | null; networkCost: number | null; allInComplete: boolean; executable: boolean; notice: string };
const api = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const money = (value: number | null) => value === null ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value);

export function TradePage() {
 const [marketId, setMarketId] = useState(""); const [outcomeIndex, setOutcomeIndex] = useState(0); const [side, setSide] = useState<"BUY" | "SELL">("BUY"); const [shares, setShares] = useState("10");
 const marketsQuery = useQuery({ queryKey: ["trade-markets", "polymarket"], queryFn: async () => { const response = await fetch(`${api}/api/v1/markets?venue=polymarket`); if (!response.ok) throw new Error("Live market data is unavailable."); return response.json() as Promise<Snapshot>; }, staleTime: 15_000, refetchInterval: 30_000 });
 const markets = marketsQuery.data?.markets ?? [];
 const selectedMarket = useMemo(() => markets.find(m => m.id === marketId) ?? markets[0], [markets, marketId]);
 const selectedIndex = selectedMarket ? Math.min(outcomeIndex, Math.max(0, selectedMarket.outcomes.length - 1)) : 0;
 const selectedOutcome = selectedMarket?.outcomes[selectedIndex];
 const quoteMutation = useMutation({ mutationFn: async () => {
   if (!selectedMarket) throw new Error("Select a live market first.");
   const response = await fetch(`${api}/api/v1/markets/polymarket/${encodeURIComponent(selectedMarket.id)}/quote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ outcomeIndex: selectedIndex, side, shares: Number(shares) }) });
   const result = await response.json(); if (!response.ok) throw new Error(result.message ?? `Quote request failed (${response.status}).`); return result as Quote;
 } });

 return <main className="main"><p className="eyebrow">READ-ONLY EXECUTION PLANNING</p><h1 className="title">Trade</h1><p className="sub">Simulate a size against a fresh Polymarket order book. This page cannot submit or cancel orders.</p>
   <div className="trade-warning"><b>Simulation only</b><span>No supported execution adapter is configured. Mainnet execution and real-money trading are disabled.</span></div>
   <section className="panel trade-panel"><div className="trade-grid"><label>Market<select value={selectedMarket?.id ?? ""} onChange={event => { setMarketId(event.target.value); setOutcomeIndex(0); quoteMutation.reset(); }}>{markets.map(m => <option key={m.id} value={m.id}>{m.question}</option>)}</select></label><label>Outcome<select value={selectedIndex} onChange={event => { setOutcomeIndex(Number(event.target.value)); quoteMutation.reset(); }}>{selectedMarket?.outcomes.map((o, index) => <option key={`${o.name}:${index}`} value={index}>{o.name}</option>)}</select></label><label>Side<select value={side} onChange={event => { setSide(event.target.value as "BUY" | "SELL"); quoteMutation.reset(); }}><option value="BUY">Buy (consume asks)</option><option value="SELL">Sell (consume bids)</option></select></label><label>Shares<input type="number" min="0.000001" max="100000" step="any" value={shares} onChange={event => { setShares(event.target.value); quoteMutation.reset(); }} /></label></div>
     {marketsQuery.isPending && <div className="empty-row">Loading live markets…</div>}{marketsQuery.isError && <div className="empty-row source-badge error">{marketsQuery.error.message}</div>}{selectedOutcome && <div className="trade-book-note">{selectedMarket?.venueName} · Top price {side === "BUY" ? selectedOutcome.asks[0]?.price ?? "Unavailable" : selectedOutcome.bids[0]?.price ?? "Unavailable"} · Depth observed {selectedOutcome.bookLevelsObservedAt ? new Date(selectedOutcome.bookLevelsObservedAt).toLocaleTimeString() : "unavailable"}</div>}
     <button className="simulate-button" disabled={!selectedMarket || !selectedOutcome || quoteMutation.isPending || !Number.isFinite(Number(shares)) || Number(shares) <= 0} onClick={() => quoteMutation.mutate()}>{quoteMutation.isPending ? "Simulating…" : "Simulate quote"}</button>
   </section>
   {quoteMutation.isError && <section className="panel quote-result"><span className="source-badge error">QUOTE UNAVAILABLE</span><p>{quoteMutation.error.message}</p></section>}
   {quoteMutation.data && <section className="panel quote-result"><div className="panel-head"><div><h2 className="panel-title">Execution preview</h2><div className="panel-note">Polymarket · {quoteMutation.data.status.toUpperCase()} · {quoteMutation.data.stale ? "Stale order book" : "Fresh order book"}</div></div><span className="source-badge mock">SIMULATED</span></div>
     <div className="quote-metrics"><div><span>Requested / filled</span><b>{quoteMutation.data.requestedShares} / {quoteMutation.data.filledShares} shares</b></div><div><span>Average price</span><b>{quoteMutation.data.averagePrice === null ? "Unavailable" : `${(quoteMutation.data.averagePrice * 100).toFixed(2)}¢`}</b></div><div><span>Gross venue amount</span><b>{money(quoteMutation.data.grossVenueAmount)}</b></div><div><span>Estimated venue fee</span><b>{quoteMutation.data.feeStatus === "unknown" ? "Unknown" : money(quoteMutation.data.estimatedVenueFee)}</b></div><div><span>Estimated venue total</span><b>{money(quoteMutation.data.estimatedVenueTotal)}</b></div><div><span>Slippage vs. top price</span><b>{quoteMutation.data.slippagePercent === null ? "Unavailable" : `${(quoteMutation.data.slippagePercent * 100).toFixed(3)}%`}</b></div><div><span>Network cost</span><b>Unavailable</b></div><div><span>Venue</span><b>Polymarket only</b></div></div>
     {!quoteMutation.data.complete && <p className="detail-copy">Insufficient displayed depth for the full requested size. Remaining shares: {quoteMutation.data.remainingShares}.</p>}
     <p className="detail-copy">{quoteMutation.data.notice} All-in cost is incomplete because network/execution costs are unavailable. This quote is not guaranteed.</p>
   </section>}
 </main>;
}

