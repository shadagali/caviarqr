import { Controller, Get } from '@nestjs/common'

@Controller()
export class AppController {
  // 🔥 HEALTH CHECK (for uptime monitoring)
  @Get('health')
  health() {
    return { status: 'ok' }
  }

  // Optional root route
  @Get()
  root() {
    return { message: 'CaviarQR backend running' }
  }
}