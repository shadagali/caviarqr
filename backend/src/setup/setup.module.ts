import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { SetupService } from './setup.service'
import { SetupController } from './setup.controller'

import { Business } from '../business/business.entity'
import { Merchant } from '../auth/merchant.entity'
import { Kit } from '../kits/kit.entity'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Business,
      Merchant,
      Kit
    ])
  ],
  controllers: [SetupController],
  providers: [SetupService],
})
export class SetupModule {}