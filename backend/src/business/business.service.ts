import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Business } from './business.entity'
import { Order } from '../order/order.entity'
import { StripeService } from '../stripe/stripe.service'

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    private stripeService: StripeService,
  ) {}

  async findByStoreCode(storeCode: string) {
    return this.businessRepo.findOne({
      where: { storeCode },
    })
  }

  async register(data: any) {
    const existing = await this.businessRepo.findOne({
      where: { storeCode: data.storeCode },
    })

    if (existing) {
      return { success: false, message: 'Store already exists' }
    }

    const business = this.businessRepo.create({
      storeCode: data.storeCode,
      name: data.name,
      email: data.email,
      password: data.password,
    })

    await this.businessRepo.save(business)

    return {
      success: true,
      storeCode: business.storeCode,
    }
  }

  async login(storeCode: string, password: string) {
    const business = await this.businessRepo.findOne({
      where: { storeCode },
    })

    if (!business) {
      return { success: false, message: 'Store not found' }
    }

    if (business.password !== password) {
      return { success: false, message: 'Invalid password' }
    }

    return {
      success: true,
      storeCode: business.storeCode,
    }
  }

  async getEarnings(storeCode: string) {
    const business = await this.findByStoreCode(storeCode)

    if (!business) {
      return { success: false, message: 'Business not found' }
    }

    const orders = await this.orderRepo.find({
      where: { storeCode },
    })

    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.totalAmount || 0),
      0,
    )

    const platformFees = orders.reduce(
      (sum, o) => sum + Number(o.platformFee || 0),
      0,
    )

    const net = totalRevenue - platformFees

    return {
      success: true,
      totalRevenue,
      platformFees,
      net,
      orderCount: orders.length,
    }
  }

  async withdraw(storeCode: string) {
    const business = await this.findByStoreCode(storeCode)

    if (!business) {
      return { success: false, message: 'Business not found' }
    }

    if (!business.stripeAccountId) {
      return { success: false, message: 'Stripe not connected' }
    }

    const earnings = await this.getEarnings(storeCode)

    // ✅ FIX: guard earnings
    if (!earnings.success || earnings.net === undefined) {
      return { success: false, message: 'Earnings unavailable' }
    }

    if (earnings.net <= 0) {
      return { success: false, message: 'No funds available' }
    }

    try {
      await this.stripeService.createConnectedAccountPayout(
        business.stripeAccountId,
        earnings.net,
      )

      return {
        success: true,
        amount: earnings.net,
      }
    } catch (err) {
      return {
        success: false,
        message: 'Payout failed',
      }
    }
  }
}