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

import { OrderStatus,
  Order,
} from './order.entity'

import { Business } from '../business/business.entity'

import {
  KitchenSession,
  verifyKitchenToken,
  kitchenSessionMatchesPassword,
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

    @InjectRepository(Business)
    private readonly businessRepo:
      Repository<Business>,
  ) {}

  @SubscribeMessage('join')
  async joinKitchen(
    @ConnectedSocket()
    client: Socket,
  ) {
    try {
      const kitchen =
        await this.authenticate(client)

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
        await this.sessionFor(client)

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

      if (order.status === OrderStatus.PENDING_PAYMENT) {
        throw new Error(
          'Cannot acknowledge an unpaid order.',
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

      /*
       * If the only outstanding Action Center problem was
       * a missing kitchen ACK, receiving the ACK proves that
       * specific problem has recovered.
       *
       * Do not resolve or overwrite any other issue type.
       */
      if (
        order.requiresOwnerAction === true &&
        order.issueResolved !== true &&
        order.ownerIssueType ===
          'KITCHEN_ACK_TIMEOUT'
      ) {
        order.requiresOwnerAction =
          false
        order.issueResolved =
          true
        order.ownerActionResolvedAt =
          now
        order.ownerActionResolvedBy =
          'SYSTEM_KITCHEN_ACK'
      }

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

  private async sessionFor(client: Socket) {
    const kitchen = await this.authenticate(client)
    client.data.kitchen = kitchen
    return kitchen
  }

  private async authenticate(
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

    const kitchen = verifyKitchenToken(token)

    const business = await this.businessRepo.findOne({
      where: {
        id: kitchen.businessId,
        storeCode: kitchen.storeCode,
      },
    })

    if (!business || business.deletedAt || !kitchenSessionMatchesPassword(
      kitchen,
      business.kitchenPassword,
    )) {
      throw new Error('Kitchen session was revoked.')
    }

    return kitchen
  }

  revokeKitchenSessions(businessId: number) {
    if (!this.server) return

    const room = this.room(businessId)

    this.server.to(room).emit('kitchenAuthFailed', {
      message: 'Kitchen password changed. Sign in again.',
    })

    this.server.in(room).disconnectSockets(true)
  }

  private room(
    businessId: number,
  ) {
    return `business-${businessId}`
  }
}
