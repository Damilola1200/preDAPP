"use client";
import { useState } from "react";
export function MarketSearch() {
 const [query, setQuery] = useState("");
 function update(value: string) { setQuery(value); window.dispatchEvent(new CustomEvent("market-search", { detail: value })); }
 return <input className="search" aria-label="Search markets" placeholder="⌕  Search markets..." value={query} onChange={event => update(event.target.value)} />;
}
