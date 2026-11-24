import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnvironment } from './config/env';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';
import { AuthGuard } from './auth/auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { StorageModule } from './storage/storage.module';
import { MarketsModule } from './markets/markets.module';
@Module({
 imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env', validate: validateEnvironment }), ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), StorageModule, HealthModule, EventsModule, MarketsModule],
 providers: [
  { provide: APP_FILTER, useClass: HttpExceptionFilter },
  { provide: APP_GUARD, useClass: ThrottlerGuard },
  { provide: APP_GUARD, useClass: AuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
 ],
})
export class AppModule {}
