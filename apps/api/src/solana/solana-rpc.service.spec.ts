import { SolanaRpcService } from './solana-rpc.service';

const config = (values: Record<string, string>) => ({ get: (key: string, fallback?: string) => values[key] ?? fallback }) as never;

describe('SolanaRpcService', () => {
  it('exposes network and status without exposing provider URLs', () => {
    const service = new SolanaRpcService(config({ SOLANA_NETWORK: 'devnet', SOLANA_RPC_URL: 'https://secret.invalid/rpc-key', SOLANA_WS_URL: 'wss://secret.invalid/ws-key' }));
    expect(service.publicConfig()).toEqual({ network: 'devnet', configured: true, rpcProxy: '/api/v1/solana/rpc', healthPath: '/api/v1/solana/rpc/health', transactionRelayEnabled: false, executionEnabled: false });
    expect(JSON.stringify(service.publicConfig())).not.toContain('secret');
  });

  it('rejects transaction submission on the read-only proxy', async () => {
    const service = new SolanaRpcService(config({ SOLANA_NETWORK: 'devnet', SOLANA_RPC_URL: 'https://rpc.invalid', SOLANA_WS_URL: 'wss://rpc.invalid' }));
    await expect(service.proxy({ jsonrpc: '2.0', id: 1, method: 'sendTransaction', params: ['signed'] })).rejects.toThrow('read-only');
  });

  it('enables transaction relay only when explicitly configured for Devnet', () => {
    const devnet = new SolanaRpcService(config({ SOLANA_NETWORK: 'devnet', SOLANA_DEVNET_TRANSACTIONS: true as unknown as string }));
    const mainnet = new SolanaRpcService(config({ SOLANA_NETWORK: 'mainnet', SOLANA_DEVNET_TRANSACTIONS: true as unknown as string }));
    expect(devnet.publicConfig().transactionRelayEnabled).toBe(true);
    expect(mainnet.publicConfig().transactionRelayEnabled).toBe(false);
  });

  it('rejects malformed JSON-RPC requests as client errors', async () => {
    const service = new SolanaRpcService(config({ SOLANA_NETWORK: 'devnet', SOLANA_RPC_URL: 'https://rpc.invalid', SOLANA_WS_URL: 'wss://rpc.invalid' }));
    await expect(service.proxy({ method: 'getBalance' })).rejects.toThrow('Invalid JSON-RPC');
  });

  it('allows unsigned transaction simulation through the read-only RPC proxy', async () => {
    const service = new SolanaRpcService(config({ SOLANA_NETWORK: 'devnet', SOLANA_RPC_URL: 'https://rpc.invalid', SOLANA_WS_URL: 'wss://rpc.invalid' }));
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, status: 200, json: async () => ({ jsonrpc: '2.0', id: 1, result: { value: { err: null } } }) } as Response);
    try {
      await expect(service.proxy({ jsonrpc: '2.0', id: 1, method: 'simulateTransaction', params: ['unsigned-base64', { sigVerify: false }] })).resolves.toMatchObject({ result: { value: { err: null } } });
    } finally {
      fetch.mockRestore();
    }
  });
});
