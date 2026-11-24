"use client";
import { useEffect, useState } from "react";
import { mockMarkets } from "@/lib/mock-markets";
export function MarketList() {
 const [query, setQuery] = useState("");
 useEffect(() => { const handle = (event: Event) => setQuery((event as CustomEvent<string>).detail); window.addEventListener("market-search", handle); return () => window.removeEventListener("market-search", handle); }, []);
 const filtered = mockMarkets.filter(m => `${m.title} ${m.meta}`.toLowerCase().includes(query.toLowerCase()));
 if (filtered.length === 0) return <div className="empty-row">No demo markets match “{query}”. Try another search.</div>;
 return <>{filtered.map(m=><article className="market" key={m.title}><div className="market-top"><span className="category">{m.icon}</span><div><div className="market-title">{m.title}</div><div className="market-meta">{m.meta}</div></div></div><div className="market-row"><span className="volume">{m.volume}</span><div className="outcomes"><span className="outcome">Yes&nbsp; {m.yes}</span><span className="outcome no">No&nbsp; {m.no}</span></div></div></article>)}</>;
}
