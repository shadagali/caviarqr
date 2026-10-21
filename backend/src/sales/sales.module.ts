import {
  SalesDashboardService,
} from './sales-dashboard.service'

import { SalesTaxReportService } from './sales-tax-report.service'

import { SalesCommissionService } from './sales-commission.service'
import { SalesPayoutService } from './sales-payout.service'
import {
  Module,
} from '@nestjs/common'

import {
  TypeOrmModule,
} from '@nestjs/typeorm'

import {
  SalesPartner,
} from './entities/sales-partner.entity'

import {
  SalesPartnerAgreement,
} from './entities/sales-partner-agreement.entity'

import {
  SalesCommission,
} from './entities/sales-commission.entity'

import {
  SalesPayout,
} from './entities/sales-payout.entity'

import {
  SalesPayoutItem,
} from './entities/sales-payout-item.entity'

import {
  SalesAuditLog,
} from './entities/sales-audit-log.entity'

import {
  SalesController,
} from './sales.controller'

import {
  SalesService,
} from './sales.service'

import {
  SalesPartnerGuard,
} from './sales-partner.guard'

import {
  SalesStripeService,
} from './sales-stripe.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SalesPartner,
      SalesPartnerAgreement,
      SalesCommission,
      SalesPayout,
      SalesPayoutItem,
      SalesAuditLog,
    ]),
  ],

  controllers: [
    SalesController,
  ],

  providers: [
    SalesService,
    SalesPartnerGuard,
    SalesStripeService,
    SalesCommissionService,
    SalesPayoutService,
    SalesDashboardService,
    SalesTaxReportService,
  ],

  exports: [
    TypeOrmModule,
    SalesService,
    SalesPartnerGuard,
    SalesStripeService,
    SalesCommissionService,
    SalesPayoutService,
    SalesDashboardService,
    SalesTaxReportService,
  ],
})
export class SalesModule {}
