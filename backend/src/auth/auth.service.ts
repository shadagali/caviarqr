import { Injectable, UnauthorizedException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'

import { Merchant } from '../merchant/merchant.entity'

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Merchant)
    private merchantRepo: Repository<Merchant>,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string, businessId: string) {

    const existing = await this.merchantRepo.findOne({
      where: { email },
    })

    if (existing) {
      throw new UnauthorizedException('Email already exists')
    }

    const hashed = await bcrypt.hash(password, 10)

    const merchant = this.merchantRepo.create({
      email,
      password: hashed,
      businessId,
    })

    await this.merchantRepo.save(merchant)

    const payload = {
      sub: merchant.id,
      email: merchant.email,
      businessId: merchant.businessId,
    }

    return {
      token: this.jwtService.sign(payload),
    }
  }

  async login(email: string, password: string) {

    const merchant = await this.merchantRepo.findOne({
      where: { email },
    })

    if (!merchant) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const valid = await bcrypt.compare(password, merchant.password)

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials')
    }

    const payload = {
      sub: merchant.id,
      email: merchant.email,
      businessId: merchant.businessId,
    }

    return {
      token: this.jwtService.sign(payload),
    }
  }
}