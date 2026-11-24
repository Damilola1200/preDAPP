"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { SolanaRpcStatus } from "@/components/solana-rpc-status";
import { WalletConnectButton } from "@/components/wallet-connect-button";

type RpcHealth = { network: string; configured: boolean; http: string; websocket: string };
const api = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
export function PortfolioPage() {
 const { connected, publicKey } = useWallet();
 const health = useQuery({ queryKey: ["solana-rpc-health"], queryFn: async () => { const response = await fetch(`${api}/api/v1/solana/rpc/health`); if (!response.ok) throw new Error("RPC health unavailable."); return response.json() as Promise<RpcHealth>; }, refetchInterval: 30_000, retry: false });
 const balance = useQuery({ queryKey: ["solana-balance", publicKey?.toBase58()], enabled: connected && Boolean(publicKey) && Boolean(health.data?.configured), queryFn: async () => {
   const response = await fetch(`${api}/api/v1/solana/rpc`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [publicKey!.toBase58(), { commitment: "confirmed" }] }) });
   const payload = await response.json(); if (!response.ok || payload.error) throw new Error("Could not read the Devnet wallet balance."); return Number(payload.result.value) / 1_000_000_000;
 }, refetchInterval: 30_000 });
 return <main className="main"><p className="eyebrow">UNIFIED PORTFOLIO</p><h1 className="title">Portfolio</h1><p className="sub">Wallet connectivity and read-only Solana account status. Prediction-market positions require a supported execution venue.</p>
   <div className="portfolio-grid"><section className="panel portfolio-panel"><div className="panel-head"><div><h2 className="panel-title">Connected Solana wallet</h2><div className="panel-note">External wallet · Read-only portfolio view</div></div><WalletConnectButton /></div>
     {connected && publicKey ? <div className="portfolio-wallet"><span>{publicKey.toBase58()}</span><div className="detail-stats"><div><span>Cluster</span><b>{health.data?.network ?? "Checking"}</b></div><div><span>SOL balance</span><b>{balance.isPending ? "Checking…" : balance.isError ? "Unavailable" : `${balance.data!.toFixed(5)} SOL`}</b></div></div>{balance.isError && <p className="market-warning">{balance.error.message}</p>}</div> : <div className="empty-row">Connect a Solana wallet to view its public address.</div>}
   </section><section className="panel portfolio-panel"><div className="panel-head"><div><h2 className="panel-title">Prediction-market positions</h2><div className="panel-note">Verified venue records only</div></div><span className="source-badge mock">NO EXECUTION VENUE</span></div><div className="empty-row">No prediction-market execution integration is currently enabled, so there are no verified positions, P&amp;L, or order history to reconcile. A connected Solana wallet does not imply a market position.</div></section></div>
   <section className="panel portfolio-panel"><div className="panel-head"><div><h2 className="panel-title">Solana RPC status</h2><div className="panel-note">Provider URLs remain server-side</div></div></div><div className="rpc-status-wrap"><SolanaRpcStatus /></div></section>
 </main>;
}

