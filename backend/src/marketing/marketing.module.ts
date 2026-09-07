import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Business } from '../business/business.entity'

import {
  MarketingSubscriber,
} from './marketing-subscriber.entity'

import {
  MarketingCampaign,
} from './marketing-campaign.entity'

import {
  OwnerSessionGuard,
} from '../owner-auth/owner-session.guard'

import {
  MarketingService,
} from './marketing.service'

import {
  MarketingController,
} from './marketing.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business,
      MarketingSubscriber,
      MarketingCampaign,
    ]),
  ],

  controllers: [
    MarketingController,
  ],

  providers: [
    MarketingService,
    OwnerSessionGuard,
  ],

  exports: [
    MarketingService,
  ],
})
export class MarketingModule {}
