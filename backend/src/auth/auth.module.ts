import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthService } from './auth.service'
import { AuthController } from './auth.controller'
import { JwtStrategy } from './jwt.strategy'

import { Merchant } from '../merchant/merchant.entity'

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: 'tapserve-secret',
      signOptions: { expiresIn: '7d' },
    }),
    TypeOrmModule.forFeature([Merchant]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}