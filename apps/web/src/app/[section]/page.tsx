import Link from "next/link";
import { notFound } from "next/navigation";
const sections: Record<string, { title: string; description: string }> = {
 markets: { title: "Markets", description: "Unified market discovery will be added in Step 2." },
 trade: { title: "Trade", description: "Quote simulation and supported execution are planned for Step 3." },
 "arbitrage-opportunities": { title: "Arbitrage Opportunities", description: "Validated cross-venue comparisons are planned for Step 4." },
 portfolio: { title: "Portfolio", description: "Reconciled positions and portfolio accounting are planned for Step 3." },
 analytics: { title: "Analytics", description: "Validated market and execution analytics are planned for later stages." },
 liquidity: { title: "Liquidity", description: "Liquidity pools and provider analytics are planned for Step 4." },
 "developers-api": { title: "Developers / API", description: "API documentation is available at /api/docs when the backend is running." },
 settings: { title: "Settings", description: "Account preferences will be added as authentication is established." },
};
export function generateStaticParams() { return Object.keys(sections).map(section => ({ section })); }
export default async function SectionPage({ params }: { params: Promise<{ section: string }> }) {
 const { section } = await params; const content = sections[section]; if (!content) notFound();
 return <main className="main"><p className="eyebrow">WORKSPACE</p><h1 className="title">{content.title}</h1><section className="panel" style={{marginTop:24,padding:24}}><span className="demo-tag">FOUNDATION PLACEHOLDER</span><p className="sub" style={{marginTop:16}}>{content.description}</p><Link className="text-link" href="/">← Back to Explore</Link></section></main>;
}
