import { BadRequestException, Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { PolymarketAdapter } from './polymarket.adapter';

@Public()
@Controller('markets')
export class MarketsController {
  constructor(private readonly polymarket: PolymarketAdapter) {}

  @Get()
  list(@Query('q') query?: string, @Query('category') category?: string, @Query('venue') venue?: string, @Query('includeClosed') includeClosed?: string) {
    return this.polymarket.list({ query, category, venue, includeClosed: includeClosed === 'true' });
  }

  @Get(':venue/:id/history')
  async history(@Param('venue') venue: string, @Param('id') id: string, @Query('outcome') outcome = '0', @Query('interval') interval = '1d') {
    if (venue !== 'polymarket') throw new NotFoundException('Market venue is not configured.');
    const index = Number(outcome);
    if (!Number.isSafeInteger(index) || index < 0 || index > 49) throw new BadRequestException('Outcome must be an integer from 0 to 49.');
    if (!['1d', '1w', '1m', 'max'].includes(interval)) throw new BadRequestException('Interval must be one of 1d, 1w, 1m, or max.');
    const history = await this.polymarket.history(id, index, interval as '1d' | '1w' | '1m' | 'max');
    if (!history) throw new NotFoundException('Market outcome price history is unavailable.');
    return history;
  }

  @Get(':venue/:id')
  async get(@Param('venue') venue: string, @Param('id') id: string) {
    if (venue !== 'polymarket') throw new NotFoundException('Market venue is not configured.');
    const market = await this.polymarket.get(id);
    if (!market) throw new NotFoundException('Market not found in the current synchronized dataset.');
    return market;
  }
}
