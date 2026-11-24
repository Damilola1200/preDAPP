import { Body, Controller, Get, Post } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { SolanaRpcService } from './solana-rpc.service';

@Public()
@Controller('solana/rpc')
export class SolanaRpcController {
  constructor(private readonly rpc: SolanaRpcService) {}
  @Get('health') health() { return this.rpc.health(); }
  @Post() proxy(@Body() body: unknown) { return this.rpc.proxy(body); }
}

