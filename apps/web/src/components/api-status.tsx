"use client";
import { useQuery } from "@tanstack/react-query";
import { apiBaseUrl } from "@/lib/api-url";
export function ApiStatus() {
 const { isPending, isError, data } = useQuery({ queryKey: ["api-health"], queryFn: async () => { const response = await fetch(`${apiBaseUrl}/api/v1/health`); if (!response.ok) throw new Error("API unavailable"); return response.json() as Promise<{status:string}>; }, retry: 1, refetchInterval: 30_000 });
 return <div className="nav-link" style={{fontSize:11,color:"#aeb8c5"}} title={isError ? "API is not reachable" : "API health"}><span className="nav-icon">●</span> API {isPending ? "checking" : isError ? "offline" : data?.status}</div>;
}
