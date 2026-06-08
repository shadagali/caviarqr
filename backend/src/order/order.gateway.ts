import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'

import { Server, Socket } from 'socket.io'

@WebSocketGateway({
  cors: { origin: '*' },
})
export class OrderGateway {
  @WebSocketServer()
  server: Server

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody()
    businessId: number,

    @ConnectedSocket()
    client: Socket,
  ) {
    client.join(
      `business-${businessId}`,
    )

    console.log(
      '🔥 CLIENT JOINED:',
      businessId,
    )
  }

  emitNewOrder(
    businessId: number,
    order: any,
  ) {
    console.log(
      '🔥 EMIT NEW ORDER:',
      businessId,
      order.id,
    )

    this.server
      .to(
        `business-${businessId}`,
      )
      .emit(
        'newOrder',
        order,
      )
  }

  emitOrderUpdate(
    businessId: number,
    order: any,
  ) {
    console.log(
      '🔥 EMIT ORDER UPDATE:',
      businessId,
      order.id,
    )

    this.server
      .to(
        `business-${businessId}`,
      )
      .emit(
        'orderUpdate',
        order,
      )
  }
}