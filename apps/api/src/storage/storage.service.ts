import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
@Injectable()
export class StorageService implements OnModuleDestroy {
 private readonly logger = new Logger(StorageService.name);
 private readonly prisma = new PrismaClient();
 private readonly redis: Redis;
 constructor(config: ConfigService) {
  this.redis = new Redis(config.get<string>('REDIS_URL')!, { lazyConnect: true, connectTimeout: 1500, maxRetriesPerRequest: 1, retryStrategy: attempt => Math.min(attempt * 500, 5000) });
  this.redis.on('error', () => this.logger.warn('Redis connection unavailable.'));
 }
 async readiness() {
  const [postgres, redis] = await Promise.all([
   Promise.race([this.prisma.$queryRaw`SELECT 1`.then(() => 'up').catch(() => 'down'), new Promise<'down'>(resolve => setTimeout(() => resolve('down'), 2000))]),
   this.redis.ping().then(() => 'up' as const).catch(() => 'down' as const),
  ]);
  return { status: postgres === 'up' && redis === 'up' ? 'ready' : 'degraded', dependencies: { postgres, redis } };
 }
 async onModuleDestroy() { this.redis.disconnect(); await this.prisma.$disconnect(); }
}
