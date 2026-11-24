import { z } from 'zod';
const optionalUrl = z.preprocess(value => value === '' ? undefined : value, z.string().url().optional());
const booleanValue = z.preprocess(value => typeof value === 'string' ? ['true', '1', 'yes'].includes(value.toLowerCase()) : value, z.boolean().default(false));
const schema = z.object({
 API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
 WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
 DATABASE_URL: z.string().min(1), REDIS_URL: z.string().min(1),
 SOLANA_NETWORK: z.enum(['devnet', 'mainnet']).default('devnet'),
 SOLANA_RPC_URL: optionalUrl,
 SOLANA_WS_URL: optionalUrl,
 SOLANA_DEVNET_TRANSACTIONS: booleanValue,
}).superRefine((value, ctx) => {
 if (Boolean(value.SOLANA_RPC_URL) !== Boolean(value.SOLANA_WS_URL)) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Configure both SOLANA_RPC_URL and SOLANA_WS_URL together.' });
 }
 if (value.SOLANA_RPC_URL && !['http:', 'https:'].includes(new URL(value.SOLANA_RPC_URL).protocol)) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SOLANA_RPC_URL'], message: 'SOLANA_RPC_URL must use HTTP or HTTPS.' });
 }
 if (value.SOLANA_WS_URL && !['ws:', 'wss:'].includes(new URL(value.SOLANA_WS_URL).protocol)) {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SOLANA_WS_URL'], message: 'SOLANA_WS_URL must use WS or WSS.' });
 }
 if (value.SOLANA_DEVNET_TRANSACTIONS && value.SOLANA_NETWORK !== 'devnet') {
  ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['SOLANA_DEVNET_TRANSACTIONS'], message: 'Signed transaction relay can only be enabled for Devnet.' });
 }
});
export function validateEnvironment(config: Record<string, unknown>) { return schema.parse(config); }
