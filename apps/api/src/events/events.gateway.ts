import { Logger } from '@nestjs/common';
import { WebSocketGateway } from '@nestjs/websockets';
@WebSocketGateway({ namespace: '/events', cors: { origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000' } })
export class EventsGateway {
 private readonly logger = new Logger(EventsGateway.name);
 handleConnection() { this.logger.log('WebSocket client connected; no live venue feed is configured.'); }
}
