"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { mockMarkets } from "@/lib/mock-markets";

type Outcome = { name: string; probability: number | null; bestBid: number | null; bestAsk: number | null; depth: number | null; bookObservedAt: string | null };
type Market = { id: string; venue: string; venueName: string; venueUrl: string | null; question: string; description: string | null; observedAt: string;
  category: string | null; tags: string[]; outcomes: Outcome[]; active: boolean; closed: boolean; volume: number | null; volume24h: number | null; liquidity: number | null };
type Snapshot = { venue: string; venueName: string; sourceUrl: string; fetchedAt: string; stale: boolean; realtime: boolean; lastStreamAt: string | null; error: string | null; markets: Market[] };
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const useMock = process.env.NEXT_PUBLIC_DATA_MODE === "mock";
const formatMoney = (value: number | null) => value === null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: value > 1_000_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
const formatProbability = (value: number | null) => value === null ? "—" : `${(value * 100).toFixed(1)}%`;

export function MarketList({ compact = true }: { compact?: boolean }) {
 const [query, setQuery] = useState(""); const [category, setCategory] = useState("all");
 useEffect(() => { const handle = (event: Event) => setQuery((event as CustomEvent<string>).detail); window.addEventListener("market-search", handle); return () => window.removeEventListener("market-search", handle); }, []);
 const live = useQuery({ queryKey: ["markets", "polymarket"], enabled: !useMock, queryFn: async (): Promise<Snapshot> => {
   const response = await fetch(`${apiUrl}/api/v1/markets`);
   if (!response.ok) throw new Error(`Market API returned HTTP ${response.status}`);
   return response.json();
 }, refetchInterval: 60_000, staleTime: 30_000 });
 const realMarkets = live.data?.markets ?? [];
 const categories = useMemo(() => [...new Set(realMarkets.flatMap(m => m.category ? [m.category] : m.tags))].sort(), [realMarkets]);
 const filtered = realMarkets.filter(m => `${m.question} ${m.description ?? ""} ${m.tags.join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
   && (category === "all" || m.category === category || m.tags.includes(category)));
 if (useMock) {
   const demo = mockMarkets.filter(m => `${m.title} ${m.meta}`.toLowerCase().includes(query.toLowerCase()));
   if (!demo.length) return <div className="empty-row">No demo markets match “{query}”. Try another search.</div>;
   return <><div className="source-line"><span className="source-badge mock">MOCK · ISOLATED DEMO</span></div>{demo.map(m=><article className="market" key={m.title}><div className="market-top"><span className="category">{m.icon}</span><div><div className="market-title">{m.title}</div><div className="market-meta">{m.meta}</div></div></div><div className="market-row"><span className="volume">{m.volume}</span><div className="outcomes"><span className="outcome">Yes&nbsp; {m.yes}</span><span className="outcome no">No&nbsp; {m.no}</span></div></div></article>)}</>;
 }
 if (live.isPending) return <div className="empty-row">Loading Polymarket public market data…</div>;
 if (live.isError) return <div className="empty-row"><span className="source-badge error">LIVE DATA UNAVAILABLE</span><p>Could not load the market API. Check the API service and refresh.</p><button className="retry-button" onClick={() => void live.refetch()}>Retry</button></div>;
 const snapshot = live.data;
 return <>
   <div className="source-line"><span className="source-badge live">LIVE · {snapshot.venueName.toUpperCase()}</span><span className="freshness">Updated {new Date(snapshot.fetchedAt).toLocaleTimeString()} {snapshot.stale ? "· stale" : "· current"}</span><span className="freshness">{snapshot.realtime ? `WebSocket · ${snapshot.lastStreamAt ? new Date(snapshot.lastStreamAt).toLocaleTimeString() : "subscribed"}` : "Scheduled REST updates"}</span>{snapshot.error && <span className="market-warning">Refresh failed; showing cached data</span>}</div>
   {!compact && <div className="market-filters"><label>Venue <select value="polymarket" disabled aria-label="Venue"><option value="polymarket">Polymarket</option></select></label><label>Category <select value={category} onChange={event => setCategory(event.target.value)}><option value="all">All categories</option>{categories.map(value => <option key={value} value={value}>{value}</option>)}</select></label><span>{filtered.length} markets · search by question or resolution text</span></div>}
   {filtered.length === 0 ? <div className="empty-row">{snapshot.markets.length === 0 ? "The live venue returned no open markets." : `No live markets match “${query}”.`}</div> : filtered.slice(0, compact ? 8 : 100).map(m => <article className="market" key={`${m.venue}:${m.id}`}>
     <div className="market-top"><span className="category">{m.tags[0]?.slice(0, 1).toUpperCase() ?? "◈"}</span><div className="market-copy"><Link className="market-title market-anchor" href={`/markets/${m.venue}/${encodeURIComponent(m.id)}`}>{m.question}</Link><div className="market-meta">{m.category ?? (m.tags.slice(0, 2).join(" · ") || "Uncategorized")} · {m.outcomes.length} outcomes · Seen {new Date(m.observedAt).toLocaleTimeString()} · <a href={m.venueUrl ?? "https://polymarket.com"} target="_blank" rel="noreferrer">Original: {m.venueName} ↗</a></div></div></div>
     <div className="market-row"><span className="volume">Volume {formatMoney(m.volume)} · 24h {formatMoney(m.volume24h)} · Liquidity {formatMoney(m.liquidity)}</span><div className="outcomes">{m.outcomes.slice(0, 2).map(o => <span className={`outcome ${o.name.toLowerCase() === "no" ? "no" : ""}`} key={o.name}>{o.name}&nbsp; {formatProbability(o.probability)}</span>)}</div></div>
   </article>)}
 </>;
}
