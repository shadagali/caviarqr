import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'

import {
  MarketingService,
} from './marketing.service'

import {
  OwnerSessionGuard,
} from '../owner-auth/owner-session.guard'

import type {
  OwnerRequest,
} from '../owner-auth/owner-session.guard'

@Controller('marketing')
export class MarketingController {
  constructor(
    private readonly marketingService:
      MarketingService,
  ) {}

  private businessId(
    request:
      OwnerRequest,
  ) {
    const businessId =
      Number(
        request.owner
          ?.businessId,
      )

    if (
      !Number.isInteger(
        businessId,
      ) ||
      businessId < 1
    ) {
      throw new UnauthorizedException(
        'Owner login required.',
      )
    }

    return businessId
  }

  @Get('status')
  @UseGuards(
    OwnerSessionGuard,
  )
  status(
    @Req()
    request:
      OwnerRequest,
  ) {
    return this.marketingService
      .status(
        this.businessId(
          request,
        ),
      )
  }

  @Get('campaigns')
  @UseGuards(
    OwnerSessionGuard,
  )
  campaigns(
    @Req()
    request:
      OwnerRequest,
  ) {
    return this.marketingService
      .campaigns(
        this.businessId(
          request,
        ),
      )
  }

  @Post('test')
  @UseGuards(
    OwnerSessionGuard,
  )
  test(
    @Req()
    request:
      OwnerRequest,

    @Body()
    body: {
      subject?: unknown
      message?: unknown
    },
  ) {
    return this.marketingService
      .sendTest(
        this.businessId(
          request,
        ),
        body?.subject,
        body?.message,
      )
  }

  @Post('send')
  @UseGuards(
    OwnerSessionGuard,
  )
  send(
    @Req()
    request:
      OwnerRequest,

    @Body()
    body: {
      subject?: unknown
      message?: unknown
    },
  ) {
    return this.marketingService
      .sendCampaign(
        this.businessId(
          request,
        ),
        body?.subject,
        body?.message,
      )
  }

  /*
   * Public by design. A customer must be able
   * to unsubscribe without creating an account.
   */
  @Get(
    'unsubscribe/:token',
  )
  unsubscribe(
    @Param('token')
    token: string,
  ) {
    return this.marketingService
      .unsubscribe(
        token,
      )
  }
}
