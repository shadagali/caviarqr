import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'

import {
  MaintenanceJwtGuard,
} from '../maintenance-auth/maintenance-jwt.guard'

import {
  SupportService,
} from './support.service'

@Controller('maintenance/support')
@UseGuards(MaintenanceJwtGuard)
export class SupportAdminController {
  constructor(
    private readonly supportService:
      SupportService,
  ) {}

  // =========================
  // 🧑‍💼 ACTION CENTER LIST
  // =========================

  @Get('threads')
  async getThreads() {
    return this.supportService
      .getAdminThreads()
  }

  // =========================
  // 🧑‍💼 SINGLE THREAD
  // =========================

  @Get('order/:orderId')
  async getThread(
    @Param('orderId')
    orderId: string,
  ) {
    return this.supportService
      .getAdminThread(
        Number(orderId),
      )
  }

  // =========================
  // ↩️ REPLY
  // =========================

  @Post('order/:orderId/reply')
  async reply(
    @Param('orderId')
    orderId: string,

    @Body()
    body: {
      message?: string
      senderName?: string
    },
  ) {
    return this.supportService
      .sendAdminReply(
        Number(orderId),
        body?.message,
        body?.senderName ||
          'Restaurant',
      )
  }

  // =========================
  // 👁 RESTAURANT READ ACK
  // =========================

  @Patch('order/:orderId/read')
  async markRead(
    @Param('orderId')
    orderId: string,
  ) {
    return this.supportService
      .markRestaurantRead(
        Number(orderId),
      )
  }

  // =========================
  // ✅ RESOLVE
  // =========================

  @Patch('order/:orderId/resolve')
  async resolve(
    @Param('orderId')
    orderId: string,
  ) {
    return this.supportService
      .resolveAdminThread(
        Number(orderId),
      )
  }
}