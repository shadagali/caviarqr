import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { MaintenanceController } from './maintenance.controller'
import { MaintenanceService } from './maintenance.service'
import { MaintenanceAuditLog } from './maintenance-audit-log.entity'

import { BusinessModule } from '../business/business.module'
import { MaintenanceAuthModule } from '../maintenance-auth/maintenance-auth.module'
import { StripeModule } from '../stripe/stripe.module'

import { Order } from '../order/order.entity'
import { Business } from '../business/business.entity'
import { PendingOrder } from '../pending-order/pending-order.entity'

@Module({
  imports: [
    BusinessModule,

    MaintenanceAuthModule,

    StripeModule,

    TypeOrmModule.forFeature([
      Order,
      Business,
      PendingOrder,
      MaintenanceAuditLog,
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