import { Module } from '@nestjs/common'

import { TypeOrmModule } from '@nestjs/typeorm'

import { JwtModule } from '@nestjs/jwt'

import { MaintenanceAdmin } from './maintenance-admin.entity'
import { MaintenanceAuthController } from './maintenance-auth.controller'
import { MaintenanceAuthService } from './maintenance-auth.service'
import { MaintenanceJwtGuard } from './maintenance-jwt.guard'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaintenanceAdmin,
    ]),

    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        'supersecretkey',

      signOptions: {
        expiresIn: 60 * 60 * 12,
      },
    }),
  ],

  controllers: [
    MaintenanceAuthController,
  ],

  providers: [
    MaintenanceAuthService,
    MaintenanceJwtGuard,
  ],

  exports: [
    MaintenanceAuthService,
    MaintenanceJwtGuard,
    JwtModule,
  ],
})
export class MaintenanceAuthModule {}