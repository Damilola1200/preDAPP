"use client";
import { MarketList } from "@/components/market-list";
import { useState } from "react";

export function MarketsPage() {
 const [query, setQuery] = useState("");
 return <main className="main"><p className="eyebrow">MARKET DISCOVERY</p><h1 className="title">Markets</h1><p className="sub">Browse open markets from connected venues. Venue origin and data freshness stay visible.</p>
   <div className="panel market-discovery"><div className="discovery-toolbar"><input className="discovery-search" value={query} onChange={event => { const value = event.target.value; setQuery(value); window.dispatchEvent(new CustomEvent("market-search", { detail: value })); }} placeholder="Search live markets…" aria-label="Search markets" /><span className="source-badge live">VENUE FILTER · POLYMARKET</span></div><MarketList compact={false} /></div>
 </main>;
}
