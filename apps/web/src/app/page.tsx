import { MarketList } from "@/components/market-list";
import { mockOpportunities } from "@/lib/mock-markets";

function Chart() {
  return <div className="chart-wrap">
    <div className="chart-key"><span><i className="key-dot" />Bitcoin</span><span><i className="key-dot purple" />Ethereum</span></div>
    <svg className="chart-svg" viewBox="0 0 500 120" preserveAspectRatio="none" role="img" aria-label="Illustrative probability trend chart">
      <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#38bd91" stopOpacity=".16" /><stop offset="1" stopColor="#38bd91" stopOpacity="0" /></linearGradient></defs>
      <path d="M0 92 C25 87 35 98 57 78 S93 82 112 68 S146 78 164 57 S190 68 211 52 S247 63 270 39 S302 50 322 35 S359 53 382 29 S415 40 435 22 S470 29 500 12 L500 120 L0 120Z" fill="url(#fill)" />
      <path d="M0 92 C25 87 35 98 57 78 S93 82 112 68 S146 78 164 57 S190 68 211 52 S247 63 270 39 S302 50 322 35 S359 53 382 29 S415 40 435 22 S470 29 500 12" fill="none" stroke="#28ad80" strokeWidth="2.5" />
      <path d="M0 105 C28 97 43 109 63 91 S96 101 118 83 S148 92 172 77 S201 84 225 67 S251 76 276 60 S303 71 329 54 S361 69 389 48 S417 57 443 41 S476 52 500 35" fill="none" stroke="#8581df" strokeWidth="2" strokeDasharray="4 4" />
      <line x1="0" y1="110" x2="500" y2="110" stroke="#edf0f2" />
    </svg>
    <div className="chart-labels"><span>Nov 18</span><span>Nov 20</span><span>Nov 22</span><span>Nov 24</span></div>
  </div>;
}

function Metric({ label, value, foot, positive = false }: { label: string; value: string; foot: string; positive?: boolean }) {
  return <article className="card metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className={`metric-foot ${positive ? "positive" : ""}`}>{foot}</div></article>;
}

export default function Home() {
  return <main className="main">
        <div className="page-heading"><div><p className="eyebrow">TUESDAY, NOVEMBER 24, 2026</p><h1 className="title">Good morning, trader</h1><p className="sub">A clearer view of what the world thinks will happen.</p></div><span className="demo-tag"><i className="dot" /> SUMMARY DEMO METRICS</span></div>
        <section className="cards" aria-label="Market summary">
          <Metric label="Markets tracked" value="1,284" foot="Across 6 categories" />
          <Metric label="24h volume" value="$8.42M" foot="↑ 12.8% vs. yesterday" positive />
          <Metric label="Open interest" value="$24.6M" foot="Across connected venues" />
          <Metric label="Opportunities" value="12" foot="3 with high confidence" positive />
        </section>
        <section className="content-grid">
          <div className="panel"><div className="panel-head"><div><h2 className="panel-title">Trending markets</h2><div className="panel-note">What people are predicting right now</div></div><a className="text-link" href="/markets">Explore all →</a></div><MarketList /><div className="footer-note">{process.env.NEXT_PUBLIC_DATA_MODE === "mock" ? "Illustrative mock data · No live venue connection" : "Read-only Polymarket data · One venue configured · Not tradeable here"}</div></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            <div className="panel"><div className="panel-head"><div><h2 className="panel-title">Market momentum</h2><div className="panel-note">Illustrative probability · 7 days</div></div><span className="text-link">7D⌄</span></div><Chart /><div className="footer-note">Synthetic chart for layout preview</div></div>
            <div className="panel"><div className="panel-head"><div><h2 className="panel-title">Cross-venue spreads</h2><div className="panel-note">Potential differences to review</div></div><a className="text-link" href="/arbitrage-opportunities">View all →</a></div>
              {mockOpportunities.map(opportunity => <article className="opportunity" key={opportunity.title}><div className="opp-row"><span className="opp-name">{opportunity.title}</span><span className="spread">{opportunity.spread}</span></div><div className="venue-pair">{opportunity.venues}</div><div className="opp-foot"><span>{opportunity.depth}</span><span className="confidence">{opportunity.confidence}</span></div></article>)}
              <div className="footer-note">Statistical mock comparisons · Not executable opportunities</div>
            </div>
          </div>
        </section>
  </main>;
}
