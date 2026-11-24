import { validateEnvironment } from './env';
describe('configuration validation', () => {
 it('rejects missing required service URLs', () => { expect(() => validateEnvironment({})).toThrow(); });
 it('accepts valid service configuration', () => { expect(validateEnvironment({ DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'redis://localhost' }).API_PORT).toBe(4000); });
 it('accepts blank RPC placeholders without inventing provider URLs', () => { expect(validateEnvironment({ DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'redis://localhost', SOLANA_RPC_URL: '', SOLANA_WS_URL: '' })).toMatchObject({ SOLANA_NETWORK: 'devnet' }); });
 it('requires the HTTP and WebSocket RPC endpoints to be configured together', () => { expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'redis://localhost', SOLANA_RPC_URL: 'https://rpc.example.test' })).toThrow(); });
 it('rejects WebSocket URLs supplied as the HTTP RPC endpoint', () => { expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'redis://localhost', SOLANA_RPC_URL: 'wss://rpc.example.test', SOLANA_WS_URL: 'wss://ws.example.test' })).toThrow(); });
 it('defaults signed transaction relay off', () => { expect(validateEnvironment({ DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'redis://localhost' }).SOLANA_DEVNET_TRANSACTIONS).toBe(false); });
 it('rejects signed transaction relay on Mainnet', () => { expect(() => validateEnvironment({ DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'redis://localhost', SOLANA_NETWORK: 'mainnet', SOLANA_DEVNET_TRANSACTIONS: 'true' })).toThrow(); });
});
