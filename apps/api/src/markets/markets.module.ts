import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { PolymarketAdapter } from './polymarket.adapter';

@Module({ controllers: [MarketsController], providers: [PolymarketAdapter], exports: [PolymarketAdapter] })
export class MarketsModule {}
