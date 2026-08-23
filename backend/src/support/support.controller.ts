import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common'

import {
  SupportService,
} from './support.service'

@Controller('support')
export class SupportController {
  constructor(
    private readonly supportService:
      SupportService,
  ) {}

  // =========================
  // 👤 CUSTOMER CONVERSATION
  // =========================

  @Get(':token')
  async getThread(
    @Param('token')
    token: string,
  ) {
    return this.supportService
      .getCustomerThread(
        token,
      )
  }

  // =========================
  // 💬 CUSTOMER SEND MESSAGE
  // =========================

  @Post(':token/messages')
  async sendMessage(
    @Param('token')
    token: string,

    @Body()
    body: {
      message?: string
    },
  ) {
    return this.supportService
      .sendCustomerMessage(
        token,
        body?.message,
      )
  }

  // =========================
  // 👁 CUSTOMER READ ACK
  // =========================

  @Post(':token/read')
  async markRead(
    @Param('token')
    token: string,
  ) {
    return this.supportService
      .markCustomerRead(
        token,
      )
  }
}