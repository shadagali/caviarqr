import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { JwtModule } from '@nestjs/jwt'

import { Business } from './business.entity'
import { BusinessService } from './business.service'
import { BusinessController } from './business.controller'

@Module({
  imports: [
    TypeOrmModule.forFeature([Business]),

    // 🔥 JWT (GLOBAL SAFE CONFIG)
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET || 'supersecret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [BusinessService],
  controllers: [BusinessController],

  // 🔥 EXPORT JWT + SERVICE (IMPORTANT)
  exports: [BusinessService, JwtModule],
})
export class BusinessModule {}