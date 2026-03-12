import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../database/prisma.service';

@WebSocketGateway({
  cors: {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/orders',
})
export class DeliveryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private tenantRooms = new Map<string, Set<string>>();

  constructor(
    private redisService: RedisService,
    private prisma: PrismaService,
  ) {
    this.subscribeToRedis();
  }

  async handleConnection(client: Socket) {
    console.log(`🔌 Client connected: ${client.id}`);

    // Extract tenant ID from handshake auth
    const tenantId = client.handshake.auth?.tenantId;
    if (tenantId) {
      await this.joinTenantRoom(client, tenantId);
    }
  }

  async handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected: ${client.id}`);

    // Remove from all tenant rooms
    for (const [tenantId, clients] of this.tenantRooms.entries()) {
      clients.delete(client.id);
      if (clients.size === 0) {
        this.tenantRooms.delete(tenantId);
      }
    }
  }

  private async joinTenantRoom(client: Socket, tenantId: string) {
    const roomName = `tenant:${tenantId}`;
    await client.join(roomName);

    if (!this.tenantRooms.has(tenantId)) {
      this.tenantRooms.set(tenantId, new Set());
    }
    this.tenantRooms.get(tenantId)!.add(client.id);

    console.log(`📱 Client ${client.id} joined room: ${roomName}`);
  }

  private subscribeToRedis() {
    // Subscribe to order events from Redis Pub/Sub
    this.redisService.subscribe('orders:*', async (message) => {
      try {
        const event = JSON.parse(message);
        const { tenantId, type, data } = event;

        // Emit to tenant room
        const roomName = `tenant:${tenantId}`;
        this.server.to(roomName).emit(type, data);

        console.log(`📡 Emitted ${type} to ${roomName}`);
      } catch (error) {
        console.error('❌ Error processing Redis message:', error);
      }
    });
  }

  // Client can subscribe to specific tenant
  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { tenantId: string },
  ) {
    await this.joinTenantRoom(client, data.tenantId);
    return { success: true, room: `tenant:${data.tenantId}` };
  }

  // Helper method to broadcast order events (called by webhook handler)
  async broadcastOrderEvent(tenantId: string, type: string, data: any) {
    // Publish to Redis for all backend instances
    await this.redisService.publish('orders:*', JSON.stringify({
      tenantId,
      type,
      data,
    }));

    // Also emit directly for this instance
    const roomName = `tenant:${tenantId}`;
    this.server.to(roomName).emit(type, data);
  }
}