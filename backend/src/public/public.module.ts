import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { PublicController } from './public.controller'
import { PublicService } from './public.service'

import { Business } from '../business/business.entity'
import { MenuItem } from '../menu/menu.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Business, MenuItem])],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}