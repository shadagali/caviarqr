import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import {
  Repository,
} from 'typeorm'

import * as bcrypt from 'bcrypt'

import {
  Business,
} from '../business/business.entity'

import {
  Order,
  OrderStatus,
} from '../order/order.entity'

import {
  OrderGateway,
} from '../order/order.gateway'

import {
  createKitchenToken,
  getKitchenTokenSecret,
} from './kitchen-token'

import {
  KitchenSessionGuard,
} from './kitchen-session.guard'

import type {
  KitchenRequest,
} from './kitchen-session.guard'

@Controller('kitchen-auth')
export class KitchenAuthController {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepo:
      Repository<Business>,

    @InjectRepository(Order)
    private readonly orderRepo:
      Repository<Order>,

    private readonly gateway:
      OrderGateway,
  ) {
    // Fail fast instead of discovering an auth
    // misconfiguration after restaurants are live.
    getKitchenTokenSecret()
  }

  @Post('login')
  async login(
    @Body()
    body: {
      storeCode?: unknown
      password?: unknown
    },
  ) {
    const storeCode =
      String(
        body?.storeCode || '',
      ).trim()

    if (!storeCode) {
      throw new UnauthorizedException(
        'Invalid kitchen credentials.',
      )
    }

    const business =
      await this.businessRepo
        .findOne({
          where: {
            storeCode,
          },
        })

    if (!business) {
      throw new UnauthorizedException(
        'Invalid kitchen credentials.',
      )
    }

    if (
      business.kitchenPassword
    ) {
      const password =
        String(
          body?.password || '',
        )

      if (!password) {
        throw new UnauthorizedException(
          'Invalid kitchen credentials.',
        )
      }

      const valid =
        await bcrypt.compare(
          password,
          business.kitchenPassword,
        )

      if (!valid) {
        throw new UnauthorizedException(
          'Invalid kitchen credentials.',
        )
      }
    } else if (
      process.env.NODE_ENV ===
      'production'
    ) {
      /*
       * Passwordless kitchen mode is convenient
       * locally, but a public production storeCode
       * must never be sufficient to open a kitchen.
       */
      throw new UnauthorizedException(
        'This cafe must set a kitchen password before production kitchen login can be used.',
      )
    }

    const token =
      createKitchenToken(
        business.id,
        business.storeCode,
      )

    return {
      success: true,
      role: 'kitchen',
      businessId:
        business.id,
      storeCode:
        business.storeCode,
      token,
    }
  }

  @Get('me')
  @UseGuards(KitchenSessionGuard)
  async me(
    @Req()
    request: KitchenRequest,
  ) {
    const kitchen =
      this.requireKitchen(request)

    const business =
      await this.businessRepo
        .findOne({
          where: {
            id:
              kitchen.businessId,
            storeCode:
              kitchen.storeCode,
          },
        })

    if (!business) {
      throw new UnauthorizedException(
        'Kitchen account no longer exists.',
      )
    }

    return {
      success: true,
      role: 'kitchen',
      businessId:
        business.id,
      storeCode:
        business.storeCode,
      isOpen:
        business.isOpen === true,
    }
  }

  @Get('orders')
  @UseGuards(KitchenSessionGuard)
  async orders(
    @Req()
    request: KitchenRequest,
  ) {
    const kitchen =
      this.requireKitchen(request)

    return this.orderRepo
      .createQueryBuilder('order')
      .where(
        'order.businessId = :businessId',
        {
          businessId:
            kitchen.businessId,
        },
      )
      .andWhere(
        'order.storeCode = :storeCode',
        {
          storeCode:
            kitchen.storeCode,
        },
      )
      .andWhere(
        'order.status != :done',
        {
          done:
            OrderStatus.DONE,
        },
      )
      .andWhere(
        'order.status != :refunded',
        {
          refunded:
            OrderStatus.REFUNDED,
        },
      )
      .orderBy(
        'order.id',
        'DESC',
      )
      .getMany()
  }

  @Get('orders/history')
  @UseGuards(KitchenSessionGuard)
  async history(
    @Req()
    request: KitchenRequest,
  ) {
    const kitchen =
      this.requireKitchen(request)

    // Keep previous orders visible in the kitchen
    // for 24 hours only. Orders are not deleted.
    const cutoff = new Date(
      Date.now() -
        24 *
          60 *
          60 *
          1000,
    )

    return this.orderRepo
      .createQueryBuilder('order')
      .where(
        'order.businessId = :businessId',
        {
          businessId:
            kitchen.businessId,
        },
      )
      .andWhere(
        'order.storeCode = :storeCode',
        {
          storeCode:
            kitchen.storeCode,
        },
      )
      .andWhere(
        'order.createdAt >= :cutoff',
        {
          cutoff,
        },
      )
      .orderBy(
        'order.id',
        'DESC',
      )
      .getMany()
  }

  @Patch('orders/:id/status')
  @UseGuards(KitchenSessionGuard)
  async updateStatus(
    @Param('id', ParseIntPipe)
    orderId: number,

    @Body()
    body: {
      status?: unknown
    },

    @Req()
    request: KitchenRequest,
  ) {
    const kitchen =
      this.requireKitchen(request)

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
      // Do not reveal whether the id belongs to
      // another restaurant.
      throw new NotFoundException(
        'Order not found.',
      )
    }

    if (
      order.status ===
        OrderStatus.REFUNDED ||
      order.status ===
        OrderStatus.DONE
    ) {
      throw new BadRequestException(
        'This order is already closed.',
      )
    }

    const requestedStatus =
      String(
        body?.status || '',
      ).toUpperCase()

    const allowed = [
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.DONE,
    ]

    if (
      !allowed.includes(
        requestedStatus as OrderStatus,
      )
    ) {
      throw new BadRequestException(
        'Kitchen status must be PREPARING, READY, or DONE.',
      )
    }

    const status =
      requestedStatus as OrderStatus

    order.status = status
    order.lastStatusAt =
      new Date()

    // Preserve the existing kitchen behavior:
    // progressing a paid order clears its operational
    // owner-action warning.
    order.requiresOwnerAction =
      false
    order.ownerIssueType = null
    order.ownerIssueSeverity =
      null
    order.ownerActionMessage =
      null
    order.ownerActionResolvedAt =
      new Date()
    order.ownerActionResolvedBy =
      'KITCHEN'
    order.ownerActionCreatedAt =
      null
    order.ownerActionId = null
    order.issueResolved = true
    order.issueType = null

    const saved =
      await this.orderRepo.save(
        order,
      )

    this.gateway.emitOrderUpdate(
      kitchen.businessId,
      saved,
    )

    return saved
  }

  @Patch('toggle-open')
  @UseGuards(KitchenSessionGuard)
  async toggleOpen(
    @Req()
    request: KitchenRequest,
  ) {
    const kitchen =
      this.requireKitchen(request)

    const business =
      await this.businessRepo
        .findOne({
          where: {
            id:
              kitchen.businessId,
            storeCode:
              kitchen.storeCode,
          },
        })

    if (!business) {
      throw new ForbiddenException(
        'Kitchen cafe is unavailable.',
      )
    }

    business.isOpen =
      business.isOpen !== true

    const saved =
      await this.businessRepo.save(
        business,
      )

    return {
      success: true,
      isOpen:
        saved.isOpen === true,
    }
  }

  private requireKitchen(
    request: KitchenRequest,
  ) {
    if (!request.kitchen) {
      throw new UnauthorizedException(
        'Kitchen login required.',
      )
    }

    return request.kitchen
  }
}