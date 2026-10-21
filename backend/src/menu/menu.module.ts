import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MenuItem } from './menu.entity'
import { MenuService } from './menu.service'
import { MenuController } from './menu.controller'
import { MenuAccessGuard } from './menu-access.guard'

@Module({
  imports: [TypeOrmModule.forFeature([MenuItem])],
  controllers: [MenuController],
  providers: [
    MenuService,
    MenuAccessGuard,
  ],
})
export class MenuModule {}