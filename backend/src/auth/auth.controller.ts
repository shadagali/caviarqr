import { Controller, Post, Body } from '@nestjs/common'

@Controller('auth')
export class AuthController {
  // 🔥 SIMPLE KITCHEN LOGIN (PER BUSINESS)
  @Post('kitchen-login')
  async kitchenLogin(@Body() body: any) {
    const { storeCode } = body

    if (!storeCode) {
      return { success: false, message: 'Store code required' }
    }

    return {
      success: true,
      storeCode,
    }
  }
}