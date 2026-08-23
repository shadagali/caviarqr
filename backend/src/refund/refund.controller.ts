import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common'

import type {
  Request,
} from 'express'

import {
  MaintenanceJwtGuard,
} from '../maintenance-auth/maintenance-jwt.guard'

import {
  CreateRefundDto,
} from './dto/create-refund.dto'

import {
  RefundService,
} from './refund.service'

type MaintenanceRequest =
  Request & {
    user?: {
      id?: string | number
      sub?: string
      email?: string
      role?: string
    }
  }

@Controller('maintenance/refund')
@UseGuards(MaintenanceJwtGuard)
export class RefundController {
  constructor(
    private readonly refundService:
      RefundService,
  ) {}

  @Patch(':orderId')
  @HttpCode(HttpStatus.OK)
  createRefund(
    @Param(
      'orderId',
      ParseIntPipe,
    )
    orderId: number,

    @Body()
    dto: CreateRefundDto,

    @Req()
    request: MaintenanceRequest,
  ) {
    const requestedBy =
      String(
        request.user?.email ||
          request.user?.sub ||
          request.user?.id ||
          'maintenance-admin',
      )

    return this.refundService
      .createRefund(
        orderId,
        dto,
        {
          requestedBy,

          requestIp:
            request.ip ||
            null,

          userAgent:
            request.get(
              'user-agent',
            ) || null,
        },
      )
  }

  @Get(':orderId/attempts')
  getRefundAttempts(
    @Param(
      'orderId',
      ParseIntPipe,
    )
    orderId: number,
  ) {
    return this.refundService
      .getAttemptsForOrder(
        orderId,
      )
  }
}