import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
async function bootstrap() {
 const app = await NestFactory.create(AppModule, { bufferLogs: true });
 app.useLogger(['error', 'warn', 'log']);
 app.use(helmet());
 app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
 app.setGlobalPrefix('api/v1');
 app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
 const swagger = new DocumentBuilder().setTitle('Market Aggregator API').setDescription('Foundation API. No venue trading endpoints are configured.').setVersion('1.0').build();
 SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
 const config = app.get(ConfigService);
 await app.listen(config.get<number>('API_PORT', 4000), '0.0.0.0');
}
bootstrap();
