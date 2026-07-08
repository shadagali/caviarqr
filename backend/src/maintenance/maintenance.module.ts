import { Module } from '@nestjs/common'

import { TypeOrmModule } from '@nestjs/typeorm'

import { MaintenanceController } from './maintenance.controller'
import { MaintenanceService } from './maintenance.service'

import { BusinessModule } from '../business/business.module'

import { Order } from '../order/order.entity'
import { Business } from '../business/business.entity'

@Module({
  imports: [
    BusinessModule,

    TypeOrmModule.forFeature([
      Order,
      Business,
    ]),
  ],

  controllers: [
    MaintenanceController,
  ],

  providers: [
    MaintenanceService,
  ],

  exports: [
    MaintenanceService,
  ],
})
export class MaintenanceModule {}