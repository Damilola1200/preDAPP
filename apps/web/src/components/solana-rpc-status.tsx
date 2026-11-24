"use client";
import { useQuery } from "@tanstack/react-query";
import { apiBaseUrl } from "@/lib/api-url";

type RpcStatus = { network: "devnet" | "mainnet"; configured: boolean; executionEnabled: false; http: string; websocket: string; checkedAt?: string };
const api = apiBaseUrl;
export function SolanaRpcStatus() {
 const status = useQuery({ queryKey: ["solana-rpc-health"], queryFn: async () => { const response = await fetch(`${api}/api/v1/solana/rpc/health`); if (!response.ok) throw new Error("RPC health check unavailable"); return response.json() as Promise<RpcStatus>; }, refetchInterval: 30_000, retry: false });
 if (status.isError) return <div className="rpc-status error">Solana RPC status unavailable</div>;
 if (status.isPending) return <div className="rpc-status">Checking Solana RPC…</div>;
 const result = status.data;
 return <div className={`rpc-status ${result.configured && result.http === "healthy" && result.websocket === "healthy" ? "ready" : "pending"}`}>
   Solana · {result.network === "devnet" ? "Devnet" : "Mainnet read-only"} · {result.configured ? `HTTP ${result.http} / WS ${result.websocket}` : "RPC endpoints not configured"}
 </div>;
}

