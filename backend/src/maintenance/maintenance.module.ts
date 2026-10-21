import { SalesModule } from '../sales/sales.module'
import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { StandModule } from '../stand/stand.module'
import { ShopModule } from '../shop/shop.module'

import { MaintenanceController } from './maintenance.controller'
import { MaintenanceService } from './maintenance.service'
import { MaintenanceAuditLog } from './maintenance-audit-log.entity'
import { PlatformPayout } from './platform-payout.entity'
import { PlatformPayoutService } from './platform-payout.service'

import {
  LegalDocument,
} from './legal-document.entity'

import {
  LegalDocumentService,
} from './legal-document.service'

import {
  LegalController,
} from './legal.controller'

import { BusinessModule } from '../business/business.module'
import { MaintenanceAuthModule } from '../maintenance-auth/maintenance-auth.module'
import { StripeModule } from '../stripe/stripe.module'
import { OrderModule } from '../order/order.module'
import { DemoRequestModule } from '../demo-request/demo-request.module'

import { Order } from '../order/order.entity'
import { Business } from '../business/business.entity'
import { PendingOrder } from '../pending-order/pending-order.entity'

@Module({
  imports: [
    SalesModule,
    StandModule,
    ShopModule,
    BusinessModule,

    MaintenanceAuthModule,

    StripeModule,
    OrderModule,
    DemoRequestModule,

    TypeOrmModule.forFeature([
      Order,
      Business,
      PendingOrder,
      MaintenanceAuditLog,
      PlatformPayout,
      LegalDocument,
    ]),
  ],

  controllers: [
    MaintenanceController,
    LegalController,
  ],

  providers: [
    MaintenanceService,
    PlatformPayoutService,
    LegalDocumentService,
  ],

  exports: [
    MaintenanceService,
  ],
})
export class MaintenanceModule {}