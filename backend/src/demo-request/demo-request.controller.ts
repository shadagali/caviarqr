import {
  Body,
  Controller,
  Post,
} from '@nestjs/common'

import {
  Throttle,
} from '@nestjs/throttler'

import {
  CreateDemoRequestDto,
} from './demo-request.dto'

import {
  DemoRequestService,
} from './demo-request.service'

@Controller('demo-requests')
export class DemoRequestController {
  constructor(
    private readonly demoRequestService:
      DemoRequestService,
  ) {}

  @Post()
  @Throttle({
    default: {
      limit: 8,
      ttl: 60_000,
    },
  })
  create(
    @Body()
    body: CreateDemoRequestDto,
  ) {
    return this.demoRequestService
      .create(body)
  }
}
