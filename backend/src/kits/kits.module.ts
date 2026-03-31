import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { Kit } from './kit.entity'
import { KitsService } from './kits.service'

@Module({
  imports: [TypeOrmModule.forFeature([Kit])],
  providers: [KitsService],
  exports: [KitsService],
})
export class KitsModule {}