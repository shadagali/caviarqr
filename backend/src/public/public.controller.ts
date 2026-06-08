import { Controller, Get, Param } from '@nestjs/common'
import { PublicService } from './public.service'

@Controller('public')
export class PublicController {
  constructor(
    private readonly service: PublicService,
  ) {}

  @Get('store/:storeCode')
  async getStore(
    @Param('storeCode') storeCode: string,
  ) {
    return this.service.getStore(storeCode)
  }
}