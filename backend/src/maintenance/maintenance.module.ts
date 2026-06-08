import { Module } from '@nestjs/common'
import { MaintenanceController } from './maintenance.controller'
import { BusinessModule } from '../business/business.module'

@Module({
  imports: [BusinessModule],
  controllers: [MaintenanceController],
})
export class MaintenanceModule {}