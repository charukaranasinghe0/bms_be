import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * Kitchen WebSocket Gateway
 * Broadcasts real-time events to all connected kitchen screens and POS panels.
 * No auth required — kitchen screen is a trusted internal device.
 */
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: '/kitchen',
})
export class KitchenGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(KitchenGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Kitchen client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Kitchen client disconnected: ${client.id}`);
  }

  /** New order arrived in kitchen — broadcast to all kitchen screens */
  emitNewOrder(order: unknown) {
    this.server.emit('kitchen:order:new', order);
  }

  /** Order status changed (accepted / done) */
  emitOrderUpdated(order: unknown) {
    this.server.emit('kitchen:order:updated', order);
  }

  /** Chef status changed (available / busy) */
  emitChefUpdated(chef: unknown) {
    this.server.emit('kitchen:chef:updated', chef);
  }

  /** Order acknowledged by cashier — remove from kitchen */
  emitOrderRemoved(chefOrderId: string) {
    this.server.emit('kitchen:order:removed', { id: chefOrderId });
  }

  /** Product availability changed — POS should refresh its product list */
  emitProductUpdated(product: unknown) {
    this.server.emit('kitchen:product:updated', product);
  }
}
