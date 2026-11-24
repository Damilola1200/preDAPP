import { validateEnvironment } from './env';
describe('configuration validation', () => {
 it('rejects missing required service URLs', () => { expect(() => validateEnvironment({})).toThrow(); });
 it('accepts valid service configuration', () => { expect(validateEnvironment({ DATABASE_URL: 'postgresql://localhost/db', REDIS_URL: 'redis://localhost' }).API_PORT).toBe(4000); });
});
