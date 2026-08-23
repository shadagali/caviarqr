import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'

import type { Request } from 'express'

import { MaintenanceAuthService } from './maintenance-auth.service'
import { MaintenanceJwtGuard } from './maintenance-jwt.guard'

@Controller('maintenance-auth')
export class MaintenanceAuthController {
  constructor(
    private maintenanceAuthService: MaintenanceAuthService,
  ) {}

  @Post('register')
  async register(
    @Body()
    body: {
      email: string
      password: string
      otp: string
    },
  ) {
    return this.maintenanceAuthService.register(
      body,
    )
  }

  @Post('login')
  async login(
    @Body()
    body: {
      email: string
      password: string
    },
  ) {
    return this.maintenanceAuthService.login(
      body,
    )
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body()
    body: {
      email: string
    },
  ) {
    return this.maintenanceAuthService.forgotPassword(
      body,
    )
  }

  @Post('reset-password')
  async resetPassword(
    @Body()
    body: {
      email: string
      otp: string
      newPassword: string
    },
  ) {
    return this.maintenanceAuthService.resetPassword(
      body,
    )
  }

  @Get('me')
  @UseGuards(MaintenanceJwtGuard)
  async me(@Req() req: Request) {
    return this.maintenanceAuthService.me(
      (req as any).maintenanceAdmin,
    )
  }
}