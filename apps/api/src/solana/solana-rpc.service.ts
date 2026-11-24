import { BadGatewayException, BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

const allowedMethods = new Set([
  'getHealth', 'getSlot', 'getVersion', 'getBlockHeight', 'getEpochInfo', 'getLatestBlockhash',
  'getBalance', 'getAccountInfo', 'getMultipleAccounts', 'getTokenAccountsByOwner',
  'getTokenAccountBalance', 'getSignatureStatuses', 'getTransaction', 'getProgramAccounts', 'getGenesisHash',
  'getMinimumBalanceForRentExemption', 'getFeeForMessage', 'simulateTransaction',
]);
const rpcRequest = z.object({ jsonrpc: z.literal('2.0'), id: z.union([z.string(), z.number()]), method: z.string(), params: z.union([z.array(z.unknown()), z.record(z.unknown())]).optional() });
const healthTimeoutMs = 3_000;
const DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG';

@Injectable()
export class SolanaRpcService {
  private readonly network: 'devnet' | 'mainnet';
  private readonly httpUrl?: string;
  private readonly wsUrl?: string;
  private readonly devnetTransactionsEnabled: boolean;
  private devnetVerifiedAt = 0;

  constructor(config: ConfigService) {
    this.network = config.get<'devnet' | 'mainnet'>('SOLANA_NETWORK', 'devnet');
    this.httpUrl = config.get<string>('SOLANA_RPC_URL') || undefined;
    this.wsUrl = config.get<string>('SOLANA_WS_URL') || undefined;
    this.devnetTransactionsEnabled = this.network === 'devnet' && config.get<boolean>('SOLANA_DEVNET_TRANSACTIONS', false);
  }

  publicConfig() {
    return { network: this.network, configured: Boolean(this.httpUrl && this.wsUrl), rpcProxy: '/api/v1/solana/rpc', healthPath: '/api/v1/solana/rpc/health', transactionRelayEnabled: this.devnetTransactionsEnabled, executionEnabled: false };
  }

  async health() {
    if (!this.httpUrl || !this.wsUrl) return { ...this.publicConfig(), http: 'not-configured', websocket: 'not-configured', checkedAt: new Date().toISOString() };
    const [http, websocket, devnetVerified] = await Promise.all([this.probeHttp(), this.probeWebSocket(), this.network === 'devnet' ? this.verifyDevnetCluster() : Promise.resolve(false)]);
    return { ...this.publicConfig(), http, websocket, devnetVerified, checkedAt: new Date().toISOString() };
  }

  async proxy(body: unknown): Promise<unknown> {
    if (!this.httpUrl) throw new ServiceUnavailableException('Solana RPC provider endpoints are not configured.');
    const parsedBatch = z.array(rpcRequest).max(20).safeParse(body);
    const parsedSingle = rpcRequest.safeParse(body);
    const requests = parsedBatch.success ? parsedBatch.data : parsedSingle.success ? [parsedSingle.data] : null;
    if (!requests || !requests.length) throw new BadRequestException('Invalid JSON-RPC request.');
    if (requests.some(request => !allowedMethods.has(request.method) && !(request.method === 'sendTransaction' && this.devnetTransactionsEnabled))) {
      throw new ServiceUnavailableException('This read-only RPC proxy does not permit the requested method. Transaction submission is disabled.');
    }
    if (Array.isArray(body) && requests.some(request => request.method === 'sendTransaction')) {
      throw new ServiceUnavailableException('Transaction submission must be sent as a single wallet-authorized request.');
    }
    if (requests.some(request => request.method === 'sendTransaction') && !await this.verifyDevnetCluster(true)) {
      throw new ServiceUnavailableException('Transaction relay is blocked because the configured RPC endpoint is not verified as Solana Devnet.');
    }
    const requestBody = Array.isArray(body) ? requests : requests[0];
    try {
      const requestInit = { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(requestBody) };
      // Never retry a transaction submission: an upstream timeout can leave its outcome ambiguous.
      const response = requests.some(request => request.method === 'sendTransaction')
        ? await this.fetchWithTimeout(this.httpUrl, requestInit, 15_000)
        : await this.fetchWithRetry(this.httpUrl, requestInit, 8_000);
      if (!response.ok) throw new Error(`RPC upstream returned HTTP ${response.status}.`);
      return await response.json();
    } catch {
      throw new BadGatewayException('Solana RPC request failed. Verify provider status and endpoint configuration.');
    }
  }

  private async probeHttp(): Promise<'healthy' | 'error'> {
    try {
      const response = await this.fetchWithTimeout(this.httpUrl!, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getHealth' }) }, healthTimeoutMs);
      if (!response.ok) return 'error';
      const payload = await response.json() as { result?: unknown; error?: unknown };
      return payload.error || payload.result !== 'ok' ? 'error' : 'healthy';
    } catch { return 'error'; }
  }

  private async verifyDevnetCluster(force = false): Promise<boolean> {
    if (this.network !== 'devnet' || !this.httpUrl) return false;
    if (!force && Date.now() - this.devnetVerifiedAt < 15_000) return true;
    try {
      const response = await this.fetchWithTimeout(this.httpUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getGenesisHash' }) }, healthTimeoutMs);
      if (!response.ok) return false;
      const payload = await response.json() as { result?: unknown };
      if (payload.result !== DEVNET_GENESIS_HASH) return false;
      this.devnetVerifiedAt = Date.now();
      return true;
    } catch { return false; }
  }

  private probeWebSocket(): Promise<'healthy' | 'error' | 'unavailable'> {
    if (typeof globalThis.WebSocket !== 'function') return Promise.resolve('unavailable');
    return new Promise(resolve => {
      let socket: WebSocket;
      try { socket = new WebSocket(this.wsUrl!); }
      catch { resolve('error'); return; }
      let settled = false;
      const finish = (status: 'healthy' | 'error' | 'unavailable') => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        try { socket.close(); } catch { /* socket may already be closed */ }
        resolve(status);
      };
      const timer = setTimeout(() => finish('error'), healthTimeoutMs);
      socket.addEventListener('open', () => socket.send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'slotSubscribe' })));
      socket.addEventListener('message', event => {
        try {
          const message = JSON.parse(typeof (event as MessageEvent).data === 'string' ? (event as MessageEvent<string>).data : '') as { id?: unknown; result?: unknown; error?: unknown };
          if (message.id === 1) finish(message.error ? 'error' : 'healthy');
        } catch { /* ignore unrelated subscription notifications */ }
      });
      socket.addEventListener('error', () => finish('error'));
      socket.addEventListener('close', () => finish('error'));
    });
  }

  private fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
  }

  private async fetchWithRetry(url: string, init: RequestInit, timeoutMs: number) {
    let lastResponse: Response | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout(url, init, timeoutMs);
        if (response.status !== 429 && response.status < 500) return response;
        lastResponse = response;
      }
      catch (error) { lastError = error; }
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 200));
    }
    if (lastResponse) return lastResponse;
    throw lastError;
  }
}

