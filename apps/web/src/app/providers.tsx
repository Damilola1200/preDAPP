"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
export function Providers({ children }: { children: React.ReactNode }) {
 const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
 const [wallets] = useState(() => []);
 // Use the server-side read-only RPC proxy. Provider credentials stay in the API environment.
 return <ConnectionProvider endpoint={`${apiUrl}/api/v1/solana/rpc`}><WalletProvider wallets={wallets} autoConnect={false}><WalletModalProvider><QueryClientProvider client={client}>{children}</QueryClientProvider></WalletModalProvider></WalletProvider></ConnectionProvider>;
}
