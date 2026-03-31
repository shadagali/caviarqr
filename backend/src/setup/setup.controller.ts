import { Controller, Post, Body } from '@nestjs/common'
import { SetupService } from './setup.service'

@Controller('setup')
export class SetupController {
  constructor(private setupService: SetupService) {}

  // 🔥 FIX: replace old activateKit call
  @Post('init')
  init(@Body() body: any) {
    return this.setupService.init()
  }
}