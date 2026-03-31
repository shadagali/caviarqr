import { Module } from '@nestjs/common'
import { PublicController } from './public.controller'
import { MenuModule } from '../menu/menu.module'
import { BusinessModule } from '../business/business.module'

@Module({
  imports: [
    MenuModule, // ✅ REQUIRED
    BusinessModule, // ✅ REQUIRED
  ],
  controllers: [PublicController],
})
export class PublicModule {}