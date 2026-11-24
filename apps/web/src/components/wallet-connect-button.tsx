"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

export function WalletConnectButton() {
 const { connected, connecting, publicKey, disconnect } = useWallet();
 const { setVisible } = useWalletModal();
 const label = connecting ? "Connecting…" : connected && publicKey ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}` : "Connect wallet";
 return <button className="connect" onClick={() => connected ? void disconnect() : setVisible(true)} disabled={connecting} title={connected ? "Disconnect Solana wallet" : "Connect an external Solana wallet"}>{label}</button>;
}

