import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { PolymarketAdapter } from './polymarket.adapter';
import { PredictPmAmmAdapter } from './predict-pm-amm.adapter';

@Module({ controllers: [MarketsController], providers: [PolymarketAdapter, PredictPmAmmAdapter], exports: [PolymarketAdapter, PredictPmAmmAdapter] })
export class MarketsModule {}
