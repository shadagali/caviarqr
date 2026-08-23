import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets'

import { Server, Socket } from 'socket.io'

import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Order } from './order.entity'

@WebSocketGateway({
  cors: { origin: '*' },
})
export class OrderGateway {
  @WebSocketServer()
  server: Server

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody()
    businessId: number,

    @ConnectedSocket()
    client: Socket,
  ) {
    const finalBusinessId =
      Number(businessId)

    client.join(
      `business-${finalBusinessId}`,
    )

    console.log(
      '🔥 CLIENT JOINED:',
      finalBusinessId,
    )

    client.emit('joined', {
      businessId: finalBusinessId,
    })
  }

  @SubscribeMessage('kitchenAck')
  async handleKitchenAck(
    @MessageBody()
    body: {
      orderId: number
      businessId: number
    },

    @ConnectedSocket()
    client: Socket,
  ) {
    const orderId =
      Number(body?.orderId)

    const businessId =
      Number(body?.businessId)

    if (!orderId || !businessId) {
      console.log(
        '❌ INVALID KITCHEN ACK:',
        body,
      )

      client.emit(
        'kitchenAckFailed',
        {
          orderId,
          message:
            'Invalid kitchen acknowledgement payload.',
        },
      )

      return {
        ok: false,
      }
    }

    const order =
      await this.orderRepo.findOne({
        where: {
          id: orderId,
          businessId,
        },
      })

    if (!order) {
      console.log(
        '❌ KITCHEN ACK ORDER NOT FOUND:',
        orderId,
      )

      client.emit(
        'kitchenAckFailed',
        {
          orderId,
          message:
            'Order not found for acknowledgement.',
        },
      )

      return {
        ok: false,
      }
    }

    order.kitchenAcknowledged = true
    order.kitchenAcknowledgedAt =
      new Date()

    await this.orderRepo.save(order)

    console.log(
      '✅ KITCHEN ACK RECEIVED:',
      order.id,
    )

    this.emitOrderUpdate(
      businessId,
      order,
    )

    client.emit(
      'kitchenAckSuccess',
      {
        orderId: order.id,
      },
    )

    return {
      ok: true,
      orderId: order.id,
    }
  }

  emitNewOrder(
    businessId: number,
    order: any,
  ) {
    const finalBusinessId =
      Number(businessId)

    console.log(
      '🔥 EMIT NEW ORDER:',
      finalBusinessId,
      order.id,
    )

    this.server
      .to(
        `business-${finalBusinessId}`,
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
    const finalBusinessId =
      Number(businessId)

    console.log(
      '🔥 EMIT ORDER UPDATE:',
      finalBusinessId,
      order.id,
    )

    this.server
      .to(
        `business-${finalBusinessId}`,
      )
      .emit(
        'orderUpdate',
        order,
      )
  }
}