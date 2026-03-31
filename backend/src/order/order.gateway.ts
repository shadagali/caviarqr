import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class OrderGateway {
  @WebSocketServer()
  server: Server;

  // 🔥 CLIENT JOINS STORE ROOM
  @SubscribeMessage('joinStore')
  handleJoin(@MessageBody() storeCode: string) {
    return storeCode;
  }

  emitNewOrder(storeCode: string, order: any) {
    this.server.to(storeCode).emit('newOrder', order);
  }

  emitOrderUpdate(storeCode: string, order: any) {
    this.server.to(storeCode).emit('orderUpdate', order);
  }
}