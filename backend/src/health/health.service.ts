import { Injectable } from '@nestjs/common'
import { DataSource } from 'typeorm'
import Stripe from 'stripe'

@Injectable()
export class HealthService {
  private readonly stripe: Stripe

  constructor(
    private readonly dataSource: DataSource,
  ) {
    this.stripe = new Stripe(
      process.env.STRIPE_SECRET_KEY || '',
      {
        apiVersion: '2026-02-25.clover',
      },
    )
  }

  async getHealth() {
    return {
      status: 'ok',
      service: 'caviarqr-backend',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(
        process.uptime(),
      ),
    }
  }

  async getDbHealth() {
    try {
      await this.dataSource.query(
        'SELECT 1',
      )

      return {
        status: 'ok',
        database: 'connected',
      }
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown database error',
      }
    }
  }

  async getStripeHealth() {
    try {
      await this.stripe.balance.retrieve()

      return {
        status: 'ok',
        stripe: 'connected',
      }
    } catch (error) {
      return {
        status: 'error',
        stripe: 'disconnected',
        message:
          error instanceof Error
            ? error.message
            : 'Unknown Stripe error',
      }
    }
  }
}