import {
  Logger,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets'

import {
  Repository,
} from 'typeorm'

import {
  Server,
  Socket,
} from 'socket.io'

import {
  Order,
} from './order.entity'

import {
  KitchenSession,
  verifyKitchenToken,
} from '../kitchen-auth/kitchen-token'

function socketOrigins() {
  const values = [
    process.env.FRONTEND_URL,
    process.env.WEB_URL,

    process.env.NODE_ENV !==
    'production'
      ? 'http://localhost:3000'
      : undefined,

    process.env.NODE_ENV !==
    'production'
      ? 'http://127.0.0.1:3000'
      : undefined,
  ]

  return Array.from(
    new Set(
      values.filter(
        (value): value is string =>
          Boolean(
            value &&
              value.trim(),
          ),
      ),
    ),
  )
}

@WebSocketGateway({
  cors: {
    origin: socketOrigins(),
    credentials: true,
  },
})
export class OrderGateway {
  private readonly logger =
    new Logger(OrderGateway.name)

  @WebSocketServer()
  server: Server

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo:
      Repository<Order>,
  ) {}

  @SubscribeMessage('join')
  async joinKitchen(
    @ConnectedSocket()
    client: Socket,
  ) {
    try {
      const kitchen =
        this.authenticate(client)

      client.data.kitchen =
        kitchen

      const room =
        this.room(
          kitchen.businessId,
        )

      await client.join(room)

      this.logger.log(
        `Kitchen joined ${room}`,
      )

      client.emit(
        'kitchenJoined',
        {
          businessId:
            kitchen.businessId,
          storeCode:
            kitchen.storeCode,
        },
      )

      return {
        success: true,
      }
    } catch (error: any) {
      this.logger.warn(
        `Rejected unauthorised kitchen socket ${client.id}: ${
          error?.message ||
          'invalid session'
        }`,
      )

      client.emit(
        'kitchenAuthFailed',
        {
          message:
            'Kitchen session is invalid or expired.',
        },
      )

      client.disconnect(true)

      return {
        success: false,
      }
    }
  }

  @SubscribeMessage('kitchenAck')
  async kitchenAck(
    @ConnectedSocket()
    client: Socket,

    @MessageBody()
    payload: {
      orderId?: unknown
    },
  ) {
    let orderId = 0

    try {
      const kitchen =
        this.sessionFor(client)

      orderId = Number(
        payload?.orderId,
      )

      if (
        !Number.isInteger(orderId) ||
        orderId < 1
      ) {
        throw new Error(
          'Invalid order id.',
        )
      }

      const order =
        await this.orderRepo
          .findOne({
            where: {
              id: orderId,
              businessId:
                kitchen.businessId,
              storeCode:
                kitchen.storeCode,
            },
          })

      if (!order) {
        // The client never learns whether this id
        // exists in a different cafe.
        throw new Error(
          'Order is not assigned to this kitchen.',
        )
      }

      const now = new Date()

      if (
        order.kitchenAcknowledged !==
        true
      ) {
        order.kitchenAcknowledged =
          true
        order.kitchenAcknowledgedAt =
          now
      }

      order.lastKitchenAckAt =
        now

      order.kitchenAckCount =
        Math.max(
          0,
          Number(
            order.kitchenAckCount ||
              0,
          ),
        ) + 1

      const saved =
        await this.orderRepo.save(
          order,
        )

      client.emit(
        'kitchenAckSuccess',
        {
          orderId:
            saved.id,
        },
      )

      this.emitOrderUpdate(
        kitchen.businessId,
        saved,
      )

      return {
        success: true,
      }
    } catch (error: any) {
      this.logger.warn(
        `Kitchen ACK rejected for order ${orderId || 'unknown'}: ${
          error?.message ||
          'invalid request'
        }`,
      )

      client.emit(
        'kitchenAckFailed',
        {
          orderId:
            orderId || null,
          message:
            'Kitchen acknowledgement was rejected.',
        },
      )

      return {
        success: false,
      }
    }
  }

  emitNewOrder(
    businessId: number,
    order: Order,
  ) {
    const cleanBusinessId =
      Number(businessId)

    if (
      !Number.isInteger(
        cleanBusinessId,
      ) ||
      cleanBusinessId < 1 ||
      Number(order.businessId) !==
        cleanBusinessId
    ) {
      this.logger.error(
        'Blocked cross-tenant newOrder socket emission.',
      )
      return
    }

    this.server
      .to(
        this.room(
          cleanBusinessId,
        ),
      )
      .emit(
        'newOrder',
        order,
      )
  }

  emitOrderUpdate(
    businessId: number,
    order: Order,
  ) {
    const cleanBusinessId =
      Number(businessId)

    if (
      !Number.isInteger(
        cleanBusinessId,
      ) ||
      cleanBusinessId < 1 ||
      Number(order.businessId) !==
        cleanBusinessId
    ) {
      this.logger.error(
        'Blocked cross-tenant orderUpdate socket emission.',
      )
      return
    }

    this.server
      .to(
        this.room(
          cleanBusinessId,
        ),
      )
      .emit(
        'orderUpdate',
        order,
      )
  }

  private sessionFor(
    client: Socket,
  ) {
    const existing =
      client.data
        .kitchen as
        | KitchenSession
        | undefined

    if (existing) {
      return existing
    }

    const kitchen =
      this.authenticate(client)

    client.data.kitchen =
      kitchen

    return kitchen
  }

  private authenticate(
    client: Socket,
  ) {
    const authToken =
      typeof client.handshake
        .auth?.token === 'string'
        ? client.handshake
            .auth.token
        : ''

    const header =
      String(
        client.handshake
          .headers
          .authorization || '',
      )

    const bearer =
      /^Bearer\s+(.+)$/i.exec(
        header,
      )?.[1] || ''

    const token =
      String(
        authToken || bearer,
      ).trim()

    if (!token) {
      throw new Error(
        'Missing kitchen socket token.',
      )
    }

    return verifyKitchenToken(
      token,
    )
  }

  private room(
    businessId: number,
  ) {
    return `business-${businessId}`
  }
}
