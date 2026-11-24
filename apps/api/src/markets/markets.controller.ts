import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PolymarketAdapter } from './polymarket.adapter';
import { PredictPmAmmAdapter } from './predict-pm-amm.adapter';
import { buildOpportunityReport } from './opportunity-engine';
import { z } from 'zod';

@Public()
@Controller('markets')
export class MarketsController {
  constructor(private readonly polymarket: PolymarketAdapter, private readonly predict: PredictPmAmmAdapter) {}

  @Get()
  list(@Query('q') query?: string, @Query('category') category?: string, @Query('venue') venue?: string, @Query('includeClosed') includeClosed?: string) {
    if (venue && !['all', 'polymarket', 'predict'].includes(venue)) throw new BadRequestException('Venue must be all, polymarket, or predict.');
    return this.listAll({ query, category, venue, includeClosed: includeClosed === 'true' });
  }

  @Get('opportunities')
  async opportunities() {
    const [polymarket, predict] = await Promise.all([this.polymarket.list(), this.predict.list()]);
    return buildOpportunityReport(polymarket.markets, predict.markets, [polymarket, predict]);
  }

  @Get(':venue/:id/history')
  async history(@Param('venue') venue: string, @Param('id') id: string, @Query('outcome') outcome = '0', @Query('interval') interval = '1d') {
    if (venue !== 'polymarket' && venue !== 'predict') throw new NotFoundException('Market venue is not configured.');
    const index = Number(outcome);
    if (!Number.isSafeInteger(index) || index < 0 || index > 49) throw new BadRequestException('Outcome must be an integer from 0 to 49.');
    if (!['1d', '1w', '1m', 'max'].includes(interval)) throw new BadRequestException('Interval must be one of 1d, 1w, 1m, or max.');
    const history = venue === 'polymarket'
      ? await this.polymarket.history(id, index, interval as '1d' | '1w' | '1m' | 'max')
      : await this.predict.history(id, index, interval as '1d' | '1w' | '1m' | 'max');
    if (!history) throw new NotFoundException('Market outcome price history is unavailable.');
    return history;
  }

  @Post(':venue/:id/quote')
  async quote(@Param('venue') venue: string, @Param('id') id: string, @Body() body: unknown) {
    if (venue !== 'polymarket') throw new NotFoundException('Market venue is not configured.');
    const input = z.object({ outcomeIndex: z.number().int().min(0).max(49), side: z.enum(['BUY', 'SELL']), shares: z.number().finite().positive().max(100_000) }).safeParse(body);
    if (!input.success) throw new BadRequestException('Provide an outcome index, BUY or SELL side, and a share quantity from 0 to 100,000.');
    const quote = await this.polymarket.quote(id, input.data.outcomeIndex, input.data.side, input.data.shares);
    if (!quote) throw new NotFoundException('Market or outcome order book is unavailable.');
    return quote;
  }

  @Get(':venue/:id')
  async get(@Param('venue') venue: string, @Param('id') id: string) {
    if (venue !== 'polymarket' && venue !== 'predict') throw new NotFoundException('Market venue is not configured.');
    const market = venue === 'polymarket' ? await this.polymarket.get(id) : await this.predict.get(id);
    if (!market) throw new NotFoundException('Market not found in the current synchronized dataset.');
    return market;
  }

  private async listAll(filters: { query?: string; category?: string; venue?: string; includeClosed?: boolean }) {
    const includePolymarket = !filters.venue || filters.venue === 'all' || filters.venue === 'polymarket';
    const includePredict = !filters.venue || filters.venue === 'all' || filters.venue === 'predict';
    const [polymarket, predict] = await Promise.all([
      includePolymarket ? this.polymarket.list({ ...filters, venue: 'polymarket' }) : null,
      includePredict ? this.predict.list({ ...filters, venue: 'predict' }) : null,
    ]);
    const snapshots = [polymarket, predict].filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot));
    const markets = snapshots.flatMap(snapshot => snapshot.markets)
      .sort((a, b) => (b.volume24h ?? b.liquidity ?? -1) - (a.volume24h ?? a.liquidity ?? -1));
    const fetchedAt = snapshots.map(snapshot => snapshot.fetchedAt).sort().at(-1) ?? new Date().toISOString();
    return {
      venue: filters.venue === 'polymarket' || filters.venue === 'predict' ? filters.venue : 'all',
      venueName: filters.venue === 'polymarket' ? 'Polymarket' : filters.venue === 'predict' ? 'PREDICT PM-AMM' : 'All venues',
      sourceUrl: 'multiple', fetchedAt, expiresAt: new Date(Date.now() + 30_000).toISOString(),
      stale: snapshots.some(snapshot => snapshot.stale), realtime: snapshots.some(snapshot => snapshot.realtime),
      lastStreamAt: polymarket?.lastStreamAt ?? null,
      error: snapshots.map(snapshot => snapshot.error).filter((message): message is string => Boolean(message)).join(' · ') || null,
      markets,
      sources: snapshots.map(({ venue: sourceVenue, venueName, fetchedAt: sourceFetchedAt, stale, realtime, lastStreamAt, error }) => ({ venue: sourceVenue, venueName, fetchedAt: sourceFetchedAt, stale, realtime, lastStreamAt, error })),
    };
  }
}
