import { z } from 'zod';
const schema = z.object({ API_PORT: z.coerce.number().int().min(1).max(65535).default(4000), WEB_ORIGIN: z.string().url().default('http://localhost:3000'), DATABASE_URL: z.string().min(1), REDIS_URL: z.string().min(1) });
export function validateEnvironment(config: Record<string, unknown>) { return schema.parse(config); }
