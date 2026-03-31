import { Controller, Post, Body } from '@nestjs/common'
import { StripeService } from './stripe.service'

@Controller('stripe/connect')
export class StripeConnectController {
  constructor(private stripeService: StripeService) {}

  @Post('create-account')
  async createAccount(@Body() body: any) {
    const account = await this.stripeService.createConnectAccount(
      body.email,
    )

    return account
  }

  @Post('onboarding-link')
  async onboarding(@Body() body: any) {
    const link = await this.stripeService.generateOnboardingLink(
      body.accountId,
    )

    return link
  }
}