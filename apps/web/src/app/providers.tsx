"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { clusterApiUrl } from "@solana/web3.js";
export function Providers({ children }: { children: React.ReactNode }) {
 const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
 const [wallets] = useState(() => []);
 return <ConnectionProvider endpoint={clusterApiUrl("devnet")}><WalletProvider wallets={wallets} autoConnect={false}><WalletModalProvider><QueryClientProvider client={client}>{children}</QueryClientProvider></WalletModalProvider></WalletProvider></ConnectionProvider>;
}
