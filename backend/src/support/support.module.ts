import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Order } from '../order/order.entity'
import { Business } from '../business/business.entity'

import { MaintenanceAuthModule } from '../maintenance-auth/maintenance-auth.module'

import { SupportThread } from './support-thread.entity'
import { SupportMessage } from './support-message.entity'

import { SupportService } from './support.service'
import { SupportController } from './support.controller'
import { SupportAdminController } from './support-admin.controller'

@Module({
  imports: [
    MaintenanceAuthModule,

    TypeOrmModule.forFeature([
      Order,
      Business,
      SupportThread,
      SupportMessage,
    ]),
  ],

  controllers: [
    SupportController,
    SupportAdminController,
  ],

  providers: [
    SupportService,
  ],

  exports: [
    SupportService,
  ],
})
export class SupportModule {}