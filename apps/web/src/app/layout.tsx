import type { Metadata } from "next";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/app-shell";
export const metadata: Metadata = { title: "Northstar — Prediction Markets", description: "A unified view of prediction markets. Demo data only." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body><Providers><AppShell>{children}</AppShell></Providers></body></html>; }
