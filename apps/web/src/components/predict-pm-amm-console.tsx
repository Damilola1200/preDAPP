"use client";
import { AnchorProvider } from "@anchor-lang/core";
import { decodeName, i80f48ToNumber, PmAmmClient, solscanTxUrl, type MarketAccount } from "@pm-amm/sdk";
import { PublicKey } from "@solana/web3.js";
import { ComputeBudgetProgram, Transaction } from "@solana/web3.js";
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddress } from "@solana/spl-token";
import { PROTOCOL_DAO, SWAP_FEE_BPS, type SwapDirection } from "@pm-amm/sdk";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { PREDICT_DEVNET_COLLATERAL_MINT, PREDICT_PROGRAM_ID } from "@/lib/predict-constants";
import { minimumOutputFromSimulation, predictMarketMetrics } from "@/lib/predict-pm-amm";
import { apiBaseUrl } from "@/lib/api-url";
import { WalletConnectButton } from "@/components/wallet-connect-button";

type Mode = "trade" | "liquidity" | "analytics";
type AccountRow = { publicKey: PublicKey; account: MarketAccount };
type RpcHealth = { network: "devnet" | "mainnet"; configured: boolean; http: string; websocket: string; devnetVerified?: boolean; transactionRelayEnabled?: boolean };
type RiskQuote = { market: string; side: "yes" | "no"; amount: number; slippageBps: number; minimumOutputRaw: number; expectedOutput: number; feeUsdc: number; createdAt: number };

function tokenAmount(data: Uint8Array | string[]) {
 const bytes = data instanceof Uint8Array ? data : Uint8Array.from(atob(data[0] ?? ""), character => character.charCodeAt(0));
 if (bytes.byteLength < 72) throw new Error("Simulated token account data was incomplete.");
 return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(64, true);
}

async function simulateBuyOutput(client: PmAmmClient, connection: ReturnType<typeof useConnection>["connection"], market: AccountRow, side: "yes" | "no", amountRaw: number, payer: PublicKey) {
 const marketKey = market.publicKey;
 const usdcAta = await getAssociatedTokenAddress(collateralMint, payer);
 const yesAta = await getAssociatedTokenAddress(market.account.yesMint, payer);
 const noAta = await getAssociatedTokenAddress(market.account.noMint, payer);
 const creator = market.account.authority;
 const creatorAta = await getAssociatedTokenAddress(collateralMint, creator, true);
 const daoAta = await getAssociatedTokenAddress(collateralMint, PROTOCOL_DAO, true);
 const accounts = [usdcAta, yesAta, noAta, creatorAta, daoAta];
 const infos = await Promise.all(accounts.map(address => connection.getAccountInfo(address)));
 const preInfo = side === "yes" ? infos[1] : infos[2];
 const pre = preInfo ? tokenAmount(preInfo.data) : 0n;
 const plannedAtas = new Set<string>();
 const ataIxs = accounts.flatMap((address, index) => {
   const key = address.toBase58();
   if (infos[index] || plannedAtas.has(key)) return [];
   plannedAtas.add(key);
   const owner = index === 3 ? creator : index === 4 ? PROTOCOL_DAO : payer;
   return [createAssociatedTokenAccountInstruction(payer, address, owner, collateralMint)];
 });
 const direction: SwapDirection = side === "yes" ? "usdcToYes" : "usdcToNo";
 const swapIx = await client.ix.swap({ signer: payer, market: marketKey, direction, amountIn: amountRaw, minOutput: 0, creatorAuthority: creator, collateralMint });
 const tx = new Transaction().add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }), ...ataIxs, swapIx);
 tx.feePayer = payer;
 const simulation = await connection.simulateTransaction(tx, undefined, [side === "yes" ? yesAta : noAta]);
 if (simulation.value.err) throw new Error(simulation.value.logs?.slice(-3).join(" ") || "Devnet could not simulate this swap.");
 const resultAccount = simulation.value.accounts?.[0];
 if (!resultAccount) throw new Error("Devnet did not return the simulated outcome token balance.");
 const post = tokenAmount(resultAccount.data);
 if (post < pre) throw new Error("Devnet simulation returned an invalid outcome token balance.");
 const output = post - pre;
 if (output <= 0n || output > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Devnet did not produce a safe, positive swap quote.");
 return Number(output);
}

const api = apiBaseUrl;
const programId = new PublicKey(PREDICT_PROGRAM_ID);
const collateralMint = new PublicKey(PREDICT_DEVNET_COLLATERAL_MINT);
const usd = (n: number | null | undefined) => n == null || !Number.isFinite(n) ? "Unavailable" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n);
const percent = (n: number | null | undefined) => n == null || !Number.isFinite(n) ? "Unavailable" : `${(n * 100).toFixed(2)}%`;

export function PredictPmAmmConsole({ mode }: { mode: Mode }) {
 const { connection } = useConnection();
 const anchorWallet = useAnchorWallet();
 const [marketAddress, setMarketAddress] = useState("");
 const [buySide, setBuySide] = useState<"yes" | "no">("yes");
 const [buyAmount, setBuyAmount] = useState("2");
 const [maxSpend, setMaxSpend] = useState("10");
 const [slippageBps, setSlippageBps] = useState("100");
 const [createName, setCreateName] = useState("");
 const [createDays, setCreateDays] = useState("1");
 const [createPrice, setCreatePrice] = useState("5000");
 const [createDeposit, setCreateDeposit] = useState("5");
 const [depositAmount, setDepositAmount] = useState("2");
 const [quote, setQuote] = useState<RiskQuote | null>(null);
 const [sampleHistory, setSampleHistory] = useState<{ at: number; p: number }[]>([]);
 const [paused, setPaused] = useState(true);
 const [pending, setPending] = useState(false);
 const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
 const [signature, setSignature] = useState<string | null>(null);
 const [clockNow, setClockNow] = useState(Date.now());

 const rpc = useQuery({ queryKey: ["solana-rpc-health"], queryFn: async () => { const response = await fetch(`${api}/api/v1/solana/rpc/health`); if (!response.ok) throw new Error("Solana RPC health unavailable."); return response.json() as Promise<RpcHealth>; }, refetchInterval: 30_000, retry: false });
 const networkReady = Boolean(rpc.data?.configured && rpc.data.network === "devnet" && rpc.data.devnetVerified);
 const canRelay = Boolean(networkReady && rpc.data?.transactionRelayEnabled && anchorWallet && !paused);
 const client = useMemo(() => {
   if (!networkReady) return null;
   if (anchorWallet) {
     const provider = new AnchorProvider(connection, anchorWallet, { commitment: "confirmed", preflightCommitment: "confirmed" });
     return PmAmmClient.fromProvider(provider, programId, collateralMint, { commitment: "confirmed" });
   }
   return PmAmmClient.readOnly(connection, programId, collateralMint, { commitment: "confirmed" });
 }, [connection, anchorWallet, networkReady]);
 const markets = useQuery({ queryKey: ["predict-pm-amm-markets", rpc.data?.network], enabled: Boolean(client), queryFn: async () => client!.fetchAllMarkets(443), refetchInterval: () => typeof document !== "undefined" && document.hidden ? false : 30_000, staleTime: 20_000, retry: 1 });
 const marketRows = markets.data ?? [];
 const selected = marketRows.find(row => row.publicKey.toBase58() === marketAddress) ?? marketRows[0];
 const selectedId = selected?.publicKey.toBase58() ?? "";
 const metrics = selected ? predictMarketMetrics(selected.account) : null;
 const lp = useQuery({ queryKey: ["predict-lp-position", selectedId, anchorWallet?.publicKey.toBase58()], enabled: Boolean(client && selected && anchorWallet), queryFn: async () => client!.fetchLpPosition(selected!.publicKey, anchorWallet!.publicKey), staleTime: 15_000, refetchInterval: 30_000 });
 const accountName = (account: MarketAccount) => decodeName(account.name).trim() || `PREDICT #${account.marketId.toString()}`;
 const limits = { maxSpend: Number(maxSpend), amount: Number(buyAmount), slip: Number(slippageBps) };
 const amountValid = Number.isFinite(limits.amount) && limits.amount > 0 && limits.amount <= limits.maxSpend && limits.amount <= 100;
 const maxSpendValid = Number.isFinite(limits.maxSpend) && limits.maxSpend >= 0.1 && limits.maxSpend <= 100;
 const quoteCurrent = Boolean(quote && quote.market === selectedId && quote.side === buySide && quote.amount === limits.amount && quote.slippageBps === limits.slip && clockNow - quote.createdAt <= 15_000);

 useEffect(() => { setPaused(window.localStorage.getItem("predict-devnet-paused") !== "false"); }, []);
 useEffect(() => { const timer = window.setInterval(() => setClockNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
 useEffect(() => {
   if (mode !== "analytics" || metrics?.priceYes == null) return;
   setSampleHistory(previous => {
     const now = Date.now(); const last = previous[previous.length - 1];
     if (last && now - last.at < 25_000) return previous;
     return [...previous, { at: now, p: metrics.priceYes! }].slice(-60);
   });
 }, [mode, metrics?.priceYes, markets.dataUpdatedAt]);
 useEffect(() => { setQuote(null); }, [selectedId, buySide, buyAmount, slippageBps]);

 async function transact(label: string, action: () => Promise<string>) {
   if (!canRelay) { setNotice({ kind: "error", text: "Devnet transaction relay is disabled. Verify the Devnet RPC, enable SOLANA_DEVNET_TRANSACTIONS, and unpause the risk control." }); return; }
   setPending(true); setNotice({ kind: "info", text: `${label}: check the transaction details and approve or reject it in your connected wallet.` }); setSignature(null);
   try {
     const sig = await action(); setSignature(sig); setNotice({ kind: "success", text: `${label} confirmed by Solana Devnet.` });
     await Promise.all([markets.refetch(), lp.refetch()]);
   } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : `${label} failed.` }); }
   finally { setPending(false); }
 }

 async function prepareQuote() {
   if (!client || !selected || !amountValid || !maxSpendValid || limits.slip > 300 || !metrics?.isOpen) return;
   setNotice({ kind: "info", text: "Refreshing the on-chain market state for a short-lived Devnet estimate…" });
   try {
     const fresh = await client.fetchMarket(selected.publicKey);
     if (!fresh) throw new Error("The selected market is no longer available.");
     const amountRaw = Math.floor(limits.amount * 1_000_000);
     const expectedOutputRaw = await simulateBuyOutput(client, connection, { publicKey: selected.publicKey, account: fresh }, buySide, amountRaw, anchorWallet!.publicKey);
     const minimumOutputRaw = minimumOutputFromSimulation(expectedOutputRaw, limits.slip);
     if (minimumOutputRaw === null) throw new Error("A safe minimum output could not be calculated for this market state.");
     setQuote({ market: selectedId, side: buySide, amount: limits.amount, slippageBps: limits.slip,
       minimumOutputRaw, expectedOutput: expectedOutputRaw / 1_000_000, feeUsdc: limits.amount * SWAP_FEE_BPS / 10_000, createdAt: Date.now() });
     setNotice({ kind: "info", text: "Devnet transaction simulation ready for 15 seconds. It is an estimate; the on-chain minimum output enforces your selected limit." });
   } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not refresh the quote." }); }
 }

 function submitBuy() {
   if (!client || !selected || !quoteCurrent || !metrics?.isOpen || !maxSpendValid || quote!.amount > limits.maxSpend) return;
   const market = selected.publicKey; const amountMicro = Math.floor(quote!.amount * 1_000_000); const minOut = quote!.minimumOutputRaw;
   const reviewed = quote!;
   return transact(`Buy ${reviewed.side.toUpperCase()} with ${usd(reviewed.amount)}`, async () => {
     const fresh = await client.fetchMarket(market);
     if (!fresh || fresh.resolved || fresh.endTs.toNumber() <= Math.floor(Date.now() / 1000)) throw new Error("Market changed or expired. Refresh the quote before signing.");
     const currentOutput = await simulateBuyOutput(client, connection, { publicKey: market, account: fresh }, reviewed.side, amountMicro, anchorWallet!.publicKey);
     if (currentOutput < minOut) throw new Error("The fresh simulation no longer meets your reviewed minimum output. Refresh the quote before signing.");
     return client.send.swap(market, reviewed.side === "yes" ? "usdcToYes" : "usdcToNo", amountMicro, minOut);
   });
 }

 function createMarket() {
   if (!client || !createName.trim() || new TextEncoder().encode(createName.trim()).length > 64) return;
   const days = Number(createDays); const priceBps = Number(createPrice); const deposit = Number(createDeposit);
   if (!Number.isFinite(days) || days <= 0 || days > 3650 || !Number.isInteger(priceBps) || priceBps < 100 || priceBps > 9900 || !Number.isFinite(deposit) || deposit <= 0 || deposit > limits.maxSpend || deposit > 100) return;
   void transact("Create PREDICT market", async () => (await client.send.createMarket({ name: createName.trim(), durationSecs: Math.floor(days * 86_400), initialPriceBps: priceBps, depositUsdc: deposit })).signature);
 }

 function depositLiquidity() {
   const amount = Number(depositAmount);
   if (!client || !selected || !Number.isFinite(amount) || amount <= 0 || amount > limits.maxSpend || amount > 100 || !metrics?.isOpen) return;
   void transact("Deposit PREDICT liquidity", () => client.send.depositLiquidity(selected.publicKey, amount));
 }
 function withdrawLiquidity() {
   if (!client || !selected || !lp.data?.shares || lp.data.shares.isZero()) return;
   void transact("Withdraw all PREDICT LP shares", () => client.send.withdrawLiquidity(selected.publicKey, lp.data!.shares));
 }
 function claimResiduals() {
   if (!client || !selected) return;
   void transact("Claim accrued LP residuals", () => client.send.claimLpResiduals(selected.publicKey));
 }
 function claimWinnings() {
   if (!client || !selected || !selected.account.resolved) return;
   void transact("Claim resolved PREDICT winnings", () => client.send.claimWinnings(selected.publicKey));
 }

 const modeTitle = mode === "trade" ? "PREDICT on Devnet" : mode === "liquidity" ? "PREDICT liquidity" : "PREDICT analytics";
 const samplePoints = sampleHistory.length > 1 ? sampleHistory.map((point, i) => `${(i / (sampleHistory.length - 1)) * 100},${100 - point.p * 100}`).join(" ") : "";
 const outcome = selected ? selected.account.resolved ? selected.account.winningSide === 1 ? "YES resolved" : selected.account.winningSide === 2 ? "NO resolved" : "Resolved" : metrics?.isOpen ? "Open" : "Expired" : "No market";

 return <main className="main">
   <p className="eyebrow">SOLANA-NATIVE MARKET · DEVNET ONLY</p><h1 className="title">{modeTitle}</h1>
   <p className="sub">Official PREDICT PM-AMM SDK. Wallet-signed Devnet actions only; nothing submits automatically.</p>
   <section className="predict-risk-banner"><b>Protocol risk disclosure</b><span>PREDICT documents centralized market resolution, a single-key upgrade authority, no independent audit, and multi-outcome price drift. Use Devnet test assets only. The protocol is not audited or risk-free.</span></section>
   <section className="panel predict-control"><div><h2 className="panel-title">Network, wallet, and risk gate</h2><div className="panel-note">RPC health is checked server-side; signed transaction relay is off by default.</div></div><div className="predict-control-row"><WalletConnectButton /><label className="predict-pause"><input type="checkbox" checked={paused} onChange={event => { setPaused(event.target.checked); window.localStorage.setItem("predict-devnet-paused", event.target.checked ? "true" : "false"); }} /> Emergency stop: pause PREDICT transactions</label><span className={`source-badge ${networkReady ? "live" : "error"}`}>{rpc.data?.network ?? "RPC"} · {networkReady ? "DEVNET VERIFIED" : rpc.data?.http === "not-configured" || !rpc.data ? "RPC NOT READY" : "DEVNET NOT VERIFIED"}</span><span className={`source-badge ${canRelay ? "live" : "mock"}`}>{canRelay ? "SIGNED DEVNET RELAY ENABLED" : "TRANSACTIONS PAUSED"}</span></div>
     <div className="predict-risk-limits"><label>Per-action Devnet spend cap (max $100)<input type="number" min="0.1" max="100" step="0.1" value={maxSpend} onChange={event => setMaxSpend(event.target.value)} /></label><span>Swap slippage cap: 300 bps (3%). Each swap preview expires after 15 seconds and is rechecked before wallet signing.</span></div>
     {rpc.isError && <p className="market-warning">{rpc.error.message}</p>}{rpc.data && <p className="panel-note">HTTP {rpc.data.http} · WebSocket {rpc.data.websocket} · relay {rpc.data.transactionRelayEnabled ? "enabled" : "disabled"}</p>}
     {!networkReady && <p className="panel-note">Add the Devnet HTTP and WebSocket URLs to the API environment. The integration verifies the Devnet genesis hash before loading markets or accepting signed transaction relay.</p>}
   </section>
   {mode === "trade" && <section className="panel predict-operation-grid">
     <div className="predict-operation"><h2 className="panel-title">Create a binary market</h2><p className="panel-note">Your wallet becomes the market resolver. Resolution is centralized by the protocol design.</p><label>Question (64 bytes max)<input value={createName} maxLength={64} onChange={event => setCreateName(event.target.value)} placeholder="Will …?" /></label><div className="predict-form-row"><label>Duration (days)<input type="number" min="0.21" max="3650" value={createDays} onChange={event => setCreateDays(event.target.value)} /></label><label>Initial YES price (bps)<input type="number" min="100" max="9900" step="100" value={createPrice} onChange={event => setCreatePrice(event.target.value)} /></label><label>Initial liquidity (mUSDC)<input type="number" min="0.1" max={Math.min(100, maxSpendValid ? limits.maxSpend : 0)} step="0.1" value={createDeposit} onChange={event => setCreateDeposit(event.target.value)} /></label></div><button className="simulate-button" disabled={!canRelay || pending || !createName.trim() || !maxSpendValid} onClick={createMarket}>Review and sign market creation</button></div>
     <div className="predict-operation"><h2 className="panel-title">Buy YES / NO</h2><p className="panel-note">The exact-output estimate comes from an unsigned Devnet transaction simulation. A 2% fee applies to the USDC input. Execution is not guaranteed.</p><label>Market<select value={selectedId} onChange={event => setMarketAddress(event.target.value)}>{marketRows.map(row => <option key={row.publicKey.toBase58()} value={row.publicKey.toBase58()}>{accountName(row.account)}</option>)}</select></label><div className="predict-form-row"><label>Outcome<select value={buySide} onChange={event => setBuySide(event.target.value as "yes" | "no")}><option value="yes">Buy YES</option><option value="no">Buy NO</option></select></label><label>USDC input<input type="number" min="0.01" max={maxSpendValid ? limits.maxSpend : 0} step="0.01" value={buyAmount} onChange={event => setBuyAmount(event.target.value)} /></label><label>Slippage<select value={slippageBps} onChange={event => setSlippageBps(event.target.value)}><option value="50">0.5%</option><option value="100">1%</option><option value="200">2%</option><option value="300">3%</option></select></label></div><button className="retry-button" disabled={!client || !selected || !metrics?.isOpen || !amountValid || !maxSpendValid || Number(slippageBps) > 300 || markets.isFetching} onClick={() => void prepareQuote()}>{markets.isFetching ? "Refreshing markets…" : "Simulate exact quote"}</button>{quote && <div className="predict-quote"><span>Simulated output: <b>{quote.expectedOutput.toFixed(4)} {quote.side.toUpperCase()}</b></span><span>PREDICT swap fee estimate: {usd(quote.feeUsdc)}</span><span>Minimum output at {quote.slippageBps} bps: {(quote.minimumOutputRaw / 1_000_000).toFixed(4)} tokens</span><span>Simulation quote expires in 15 seconds; market state is simulated again before wallet signing.</span><button className="simulate-button" disabled={!canRelay || pending || !quoteCurrent || !metrics?.isOpen} onClick={() => void submitBuy()}>Review and sign Devnet swap</button></div>}</div>
   </section>}
   {(mode === "liquidity" || mode === "analytics") && <section className="panel predict-pool-panel"><div className="panel-head"><div><h2 className="panel-title">On-chain market state</h2><div className="panel-note">PREDICT PM-AMM account · {outcome} · refreshed every 30 seconds while this page is visible</div></div><button className="retry-button" onClick={() => void markets.refetch()} disabled={!client || markets.isFetching}>Refresh</button></div>
     {markets.isPending && <div className="empty-row">Waiting for a verified Devnet RPC and reading PREDICT market accounts…</div>}{markets.isError && <div className="empty-row source-badge error">PREDICT market read failed: {markets.error.message}</div>}{markets.data?.length === 0 && <div className="empty-row">No PREDICT markets were found on the configured Devnet program.</div>}
     {marketRows.length > 0 && <div className="predict-market-select"><label>Market<select value={selectedId} onChange={event => setMarketAddress(event.target.value)}>{marketRows.map(row => <option key={row.publicKey.toBase58()} value={row.publicKey.toBase58()}>{accountName(row.account)}</option>)}</select></label><span className="freshness">Observed {markets.dataUpdatedAt ? new Date(markets.dataUpdatedAt).toLocaleTimeString() : "—"}</span></div>}
     {selected && metrics && <><div className="predict-metric-grid"><div><span>YES probability</span><b>{percent(metrics.priceYes)}</b></div><div><span>NO probability</span><b>{percent(metrics.priceYes === null ? null : 1 - metrics.priceYes)}</b></div><div><span>Modeled pool value</span><b>{usd(metrics.liquidityValue)}</b></div><div><span>Remaining time</span><b>{metrics.remainingSecs ? `${(metrics.remainingSecs / 86_400).toFixed(1)} days` : "Expired"}</b></div></div>
     {mode === "liquidity" && <div className="predict-lp-actions"><div><h3>Liquidity provider position</h3><p className="panel-note">Verified from the connected wallet’s on-chain LP position.</p><b>{lp.isPending ? "Reading LP position…" : lp.data ? `${i80f48ToNumber(lp.data.shares).toFixed(6)} LP shares` : "No verified LP position"}</b><div className="predict-form-row"><label>Deposit mUSDC<input type="number" min="0.01" max={maxSpendValid ? limits.maxSpend : 0} step="0.01" value={depositAmount} onChange={event => setDepositAmount(event.target.value)} /></label><button className="simulate-button" disabled={!canRelay || pending || !metrics.isOpen || !maxSpendValid || Number(depositAmount) <= 0 || Number(depositAmount) > limits.maxSpend} onClick={depositLiquidity}>Review and sign deposit</button></div><div className="predict-lp-buttons"><button className="retry-button" disabled={!canRelay || pending || !lp.data || lp.data.shares.isZero()} onClick={withdrawLiquidity}>Withdraw all LP shares</button><button className="retry-button" disabled={!canRelay || pending} onClick={claimResiduals}>Claim accrued LP tokens</button>{selected.account.resolved && <button className="retry-button" disabled={!canRelay || pending} onClick={claimWinnings}>Claim winnings</button>}</div></div><div className="predict-lp-risk"><h3>Liquidity risk analytics</h3><div>Modeled daily LVR: <b>{usd(metrics.expectedDailyLvr)}</b></div><div>Pool liquidity utilization: <b>Not published by protocol</b></div><div>Verified fee income: <b>Unavailable</b></div><p>This model metric is expected loss-versus-rebalancing, not yield or a return promise. Deposits can lose value; withdrawals return outcome tokens based on pool reserves.</p></div></div>}
       {mode === "analytics" && <div className="predict-analytics"><h3>Probability history · this browser session</h3><p className="panel-note">Samples are collected while this page is open. Historical on-chain trade indexing is not configured.</p><div className="predict-chart"><span>100%</span><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="PREDICT YES probability samples">{samplePoints && <polyline points={samplePoints} fill="none" stroke="#24ac82" strokeWidth="2" vectorEffect="non-scaling-stroke" />}</svg><span>0%</span></div><div className="predict-metric-grid"><div><span>Modeled daily LVR</span><b>{usd(metrics.expectedDailyLvr)}</b></div><div><span>Trading volume</span><b>Not indexed</b></div><div><span>Execution quality</span><b>Not indexed</b></div><div><span>Price sample count</span><b>{sampleHistory.length}</b></div></div></div>}
     </>}
   </section>}
   {notice && <div className={`predict-notice ${notice.kind}`}>{notice.text}{signature && <div><a href={solscanTxUrl(signature, "devnet")} target="_blank" rel="noreferrer">View confirmed Devnet transaction ↗</a></div>}</div>}
   <section className="predict-risk-banner"><b>Risk controls active</b><span>Devnet cluster is genesis-verified. Mainnet is not used by this PREDICT integration. Per-action spend is capped at $100, swaps enforce a user-selected 0.5–3% minimum-output threshold, stale swap estimates expire, resolved/expired markets are suspended, and transaction relay requires the emergency stop to be off plus an explicit wallet signature.</span></section>
 </main>;
}
