import { Controller, Get, HttpException, HttpStatus, Module } from '@nestjs/common';
import { Public } from '../auth/public.decorator';
import { StorageService } from '../storage/storage.service';
@Controller('health')
class HealthController {
 constructor(private readonly storage: StorageService) {}
 @Public() @Get() check() { return { status: 'ok', service: 'api', timestamp: new Date().toISOString() }; }
 @Public() @Get('ready') async readiness() {
  const result = await this.storage.readiness();
  if (result.status !== 'ready') throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
  return result;
 }
}
@Module({ controllers: [HealthController] })
export class HealthModule {}
