import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import {
  Repository,
} from 'typeorm'

import {
  Resend,
} from 'resend'

import {
  Business,
} from '../business/business.entity'

import {
  MarketingSubscriber,
} from './marketing-subscriber.entity'

import {
  MarketingCampaign,
  MarketingCampaignStatus,
} from './marketing-campaign.entity'

@Injectable()
export class MarketingService {
  private readonly resend:
    Resend | null

  constructor(
    @InjectRepository(Business)
    private readonly businessRepo:
      Repository<Business>,

    @InjectRepository(
      MarketingSubscriber,
    )
    private readonly subscriberRepo:
      Repository<MarketingSubscriber>,

    @InjectRepository(
      MarketingCampaign,
    )
    private readonly campaignRepo:
      Repository<MarketingCampaign>,
  ) {
    const apiKey =
      String(
        process.env
          .RESEND_API_KEY ||
          '',
      ).trim()

    this.resend =
      apiKey
        ? new Resend(apiKey)
        : null
  }

  // =========================
  // MONTH
  // =========================

  private monthKey() {
    const now =
      new Date()

    return [
      now.getUTCFullYear(),
      String(
        now.getUTCMonth() + 1,
      ).padStart(
        2,
        '0',
      ),
    ].join('-')
  }

  // =========================
  // OWNER CAFE
  // =========================

  private async requireBusiness(
    businessId: number,
  ) {
    const business =
      await this.businessRepo
        .findOne({
          where: {
            id:
              businessId,
          },
        })

    if (!business) {
      throw new NotFoundException(
        'Cafe not found.',
      )
    }

    return business
  }

  private requireEmailMarketingEnabled(
    business: Business,
  ) {
    if (
      business.emailMarketingEnabled !==
      true
    ) {
      throw new ForbiddenException(
        'Email marketing has been disabled for this cafe.',
      )
    }
  }

  // =========================
  // EMAIL CONFIG
  // =========================

  private requireResend() {
    if (!this.resend) {
      throw new ServiceUnavailableException(
        'Marketing email service is not configured.',
      )
    }

    return this.resend
  }

  private marketingFrom() {
    const configured =
      String(
        process.env
          .MARKETING_EMAIL_FROM ||
          '',
      ).trim()

    if (configured) {
      return configured
    }

    if (
      process.env.NODE_ENV ===
      'production'
    ) {
      throw new ServiceUnavailableException(
        'MARKETING_EMAIL_FROM is not configured.',
      )
    }

    return (
      process.env
        .RECEIPT_EMAIL_FROM ||
      'CaviarQR <onboarding@resend.dev>'
    )
  }

  private unsubscribeBaseUrl() {
    return String(
      process.env
        .BACKEND_URL ||
        process.env
          .API_URL ||
        'https://api.caviarqr.com',
    )
      .trim()
      .replace(
        /\/+$/,
        '',
      )
  }

  // =========================
  // VALIDATION
  // =========================

  private cleanSubject(
    value: unknown,
  ) {
    const subject =
      String(
        value || '',
      ).trim()

    if (
      !subject ||
      subject.length > 200
    ) {
      throw new BadRequestException(
        'Subject must be between 1 and 200 characters.',
      )
    }

    return subject
  }

  private cleanMessage(
    value: unknown,
  ) {
    const message =
      String(
        value || '',
      ).trim()

    if (
      !message ||
      message.length > 10000
    ) {
      throw new BadRequestException(
        'Message must be between 1 and 10000 characters.',
      )
    }

    return message
  }

  private cleanEmail(
    value: unknown,
  ) {
    return String(
      value || '',
    )
      .trim()
      .toLowerCase()
  }

  private escapeHtml(
    value: string,
  ) {
    return value
      .replace(
        /&/g,
        '&amp;',
      )
      .replace(
        /</g,
        '&lt;',
      )
      .replace(
        />/g,
        '&gt;',
      )
      .replace(
        /"/g,
        '&quot;',
      )
      .replace(
        /'/g,
        '&#039;',
      )
  }

  private errorMessage(
    error: unknown,
  ) {
    if (
      error &&
      typeof error ===
        'object' &&
      'message' in error
    ) {
      return String(
        (
          error as {
            message?: unknown
          }
        ).message ||
          'Email send failed.',
      ).slice(
        0,
        1000,
      )
    }

    return String(
      error ||
        'Email send failed.',
    ).slice(
      0,
      1000,
    )
  }

  // =========================
  // EXPLICIT OPT-IN
  // =========================

  async subscribe(
    businessId: number,
    rawEmail: unknown,
    consentOrderId?: number | null,
    consentSource = 'CHECKOUT',
    consentedAt?: Date | null,
  ) {
    const business =
      await this.requireBusiness(
        businessId,
      )

    if (
      business.emailMarketingEnabled !==
      true
    ) {
      return {
        success: true,
        subscribed: false,
        reason:
          'EMAIL_MARKETING_DISABLED',
      }
    }

    const email =
      this.cleanEmail(
        rawEmail,
      )

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      throw new BadRequestException(
        'A valid email address is required.',
      )
    }

    let subscriber =
      await this.subscriberRepo
        .findOne({
          where: {
            businessId,
            email,
          },
        })

    const now =
      consentedAt instanceof Date &&
      Number.isFinite(
        consentedAt.getTime(),
      )
        ? consentedAt
        : new Date()

    if (!subscriber) {
      subscriber =
        this.subscriberRepo
          .create({
            businessId,

            email,

            isSubscribed:
              true,

            consentSource:
              String(
                consentSource ||
                  'CHECKOUT',
              ).slice(
                0,
                50,
              ),

            consentOrderId:
              consentOrderId ||
              null,

            consentedAt:
              now,

            unsubscribedAt:
              null,
          })
    } else {
      subscriber.isSubscribed =
        true

      subscriber.consentSource =
        String(
          consentSource ||
            'CHECKOUT',
        ).slice(
          0,
          50,
        )

      subscriber.consentOrderId =
        consentOrderId ||
        null

      subscriber.consentedAt =
        now

      subscriber.unsubscribedAt =
        null
    }

    await this.subscriberRepo
      .save(
        subscriber,
      )

    return {
      success: true,
    }
  }

  // =========================
  // STATUS
  // =========================

  async status(
    businessId: number,
  ) {
    const business =
      await this.requireBusiness(
        businessId,
      )

    const monthKey =
      this.monthKey()

    const [
      subscriberCount,
      currentMonthCampaigns,
    ] =
      await Promise.all([
        this.subscriberRepo
          .count({
            where: {
              businessId,
              isSubscribed:
                true,
            },
          }),

        this.campaignRepo
          .find({
            where: {
              businessId,
              monthKey,
            },
            order: {
              createdAt:
                'DESC',
            },
          }),
      ])

    /*
     * A FAILED attempt does not consume the
     * monthly promotional-email slot.
     *
     * Any SENDING or SENT campaign does.
     *
     * We inspect all campaigns for the month
     * instead of only the newest row so a newer
     * FAILED row can never hide an older successful
     * campaign and incorrectly make the UI say
     * another send is available.
     */
    const activeCampaign =
      currentMonthCampaigns.find(
        (campaign) =>
          campaign.status ===
            MarketingCampaignStatus
              .SENDING ||
          campaign.status ===
            MarketingCampaignStatus
              .SENT,
      ) || null

    const latestCampaign =
      currentMonthCampaigns[0] ||
      null

    return {
      success: true,

      monthKey,

      emailMarketingEnabled:
        business.emailMarketingEnabled ===
        true,

      subscriberCount,

      canSendThisMonth:
        business.emailMarketingEnabled ===
          true &&
        !activeCampaign,

      campaign:
        activeCampaign ||
        latestCampaign,
    }
  }

  // =========================
  // HISTORY
  // =========================

  async campaigns(
    businessId: number,
  ) {
    await this.requireBusiness(
      businessId,
    )

    const campaigns =
      await this.campaignRepo
        .find({
          where: {
            businessId,
          },

          order: {
            createdAt:
              'DESC',
          },

          take: 24,
        })

    return {
      success: true,
      campaigns,
    }
  }

  // =========================
  // TEST EMAIL
  // =========================

  async sendTest(
    businessId: number,
    rawSubject: unknown,
    rawMessage: unknown,
  ) {
    const business =
      await this.requireBusiness(
        businessId,
      )

    this.requireEmailMarketingEnabled(
      business,
    )

    const resend =
      this.requireResend()

    const from =
      this.marketingFrom()

    const subject =
      this.cleanSubject(
        rawSubject,
      )

    const message =
      this.cleanMessage(
        rawMessage,
      )

    const email =
      this.cleanEmail(
        business.email,
      )

    if (!email) {
      throw new BadRequestException(
        'Cafe owner email is missing.',
      )
    }

    const safeMessage =
      this.escapeHtml(
        message,
      ).replace(
        /\n/g,
        '<br />',
      )

    const result =
      await resend
        .emails.send({
          from,

          to:
            email,

          subject:
            `[TEST] ${subject}`,

          text:
            `${message}\n\nThis is a CaviarQR promotional email test. No customers received this email.`,

          html:
            `
              <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #191919;">
                <p>
                  <strong>
                    CaviarQR promotional email test
                  </strong>
                </p>

                <p>
                  ${safeMessage}
                </p>

                <hr />

                <p style="font-size: 12px; color: #666;">
                  No customers received this test.
                </p>
              </div>
            `,
        })

    if (result.error) {
      throw new ServiceUnavailableException(
        this.errorMessage(
          result.error,
        ),
      )
    }

    return {
      success: true,
      message:
        'Test email sent.',
    }
  }

  // =========================
  // MONTHLY BROADCAST
  // =========================

  async sendCampaign(
    businessId: number,
    rawSubject: unknown,
    rawMessage: unknown,
  ) {
    const business =
      await this.requireBusiness(
        businessId,
      )

    this.requireEmailMarketingEnabled(
      business,
    )

    const resend =
      this.requireResend()

    const from =
      this.marketingFrom()

    const subject =
      this.cleanSubject(
        rawSubject,
      )

    const message =
      this.cleanMessage(
        rawMessage,
      )

    const subscribers =
      await this.subscriberRepo
        .find({
          where: {
            businessId,
            isSubscribed:
              true,
          },

          order: {
            createdAt:
              'ASC',
          },
        })

    if (
      subscribers.length < 1
    ) {
      throw new BadRequestException(
        'There are no subscribed customers.',
      )
    }

    const monthKey =
      this.monthKey()

    let campaign =
      this.campaignRepo
        .create({
          businessId,

          monthKey,

          subject,

          message,

          status:
            MarketingCampaignStatus
              .SENDING,

          recipientCount:
            subscribers.length,

          sentCount:
            0,

          failedCount:
            0,

          failureMessage:
            null,

          sentAt:
            null,
        })

    try {
      campaign =
        await this.campaignRepo
          .save(
            campaign,
          )
    } catch (error: any) {
      if (
        error?.driverError
          ?.code ===
        '23505'
      ) {
        throw new ConflictException(
          'This cafe has already sent its promotional email for this month.',
        )
      }

      throw error
    }

    let sentCount =
      0

    let failedCount =
      0

    let firstFailure:
      string | null =
      null

    let nextIndex =
      0

    const worker =
      async () => {
        while (true) {
          const index =
            nextIndex++

          if (
            index >=
            subscribers.length
          ) {
            return
          }

          const subscriber =
            subscribers[
              index
            ]

          const unsubscribeUrl =
            `${this.unsubscribeBaseUrl()}/marketing/unsubscribe/${encodeURIComponent(
              subscriber
                .unsubscribeToken,
            )}`

          const safeMessage =
            this.escapeHtml(
              message,
            ).replace(
              /\n/g,
              '<br />',
            )

          try {
            const result =
              await resend
                .emails.send({
                  from,

                  to:
                    subscriber.email,

                  subject,

                  text:
                    `${message}\n\nUnsubscribe from promotional emails from this cafe:\n${unsubscribeUrl}`,

                  html:
                    `
                      <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #191919;">
                        <p>
                          ${safeMessage}
                        </p>

                        <hr />

                        <p style="font-size: 12px; color: #666;">
                          You are receiving this promotional email because you opted in to emails from this cafe through CaviarQR.
                        </p>

                        <p style="font-size: 12px;">
                          <a href="${unsubscribeUrl}">
                            Unsubscribe
                          </a>
                        </p>
                      </div>
                    `,

                  headers: {
                    'List-Unsubscribe':
                      `<${unsubscribeUrl}>`,
                  },
                })

            if (
              result.error
            ) {
              throw new Error(
                this.errorMessage(
                  result.error,
                ),
              )
            }

            sentCount += 1
          } catch (error) {
            failedCount +=
              1

            if (
              !firstFailure
            ) {
              firstFailure =
                this.errorMessage(
                  error,
                )
            }
          }
        }
      }

    const concurrency =
      Math.min(
        5,
        subscribers.length,
      )

    await Promise.all(
      Array.from(
        {
          length:
            concurrency,
        },
        () => worker(),
      ),
    )

    /*
     * If at least one customer received the
     * campaign, the month is consumed. This
     * prevents retrying and accidentally
     * emailing successful recipients twice.
     *
     * If zero emails were delivered, FAILED
     * allows the cafe to try again.
     */
    if (sentCount > 0) {
      campaign.status =
        MarketingCampaignStatus
          .SENT

      campaign.sentAt =
        new Date()
    } else {
      campaign.status =
        MarketingCampaignStatus
          .FAILED

      campaign.sentAt =
        null
    }

    campaign.sentCount =
      sentCount

    campaign.failedCount =
      failedCount

    campaign.failureMessage =
      firstFailure

    await this.campaignRepo
      .save(
        campaign,
      )

    if (
      sentCount === 0
    ) {
      throw new ServiceUnavailableException(
        firstFailure ||
          'The promotional email could not be sent.',
      )
    }

    return {
      success: true,

      campaignId:
        campaign.id,

      monthKey,

      recipientCount:
        subscribers.length,

      sentCount,

      failedCount,
    }
  }

  // =========================
  // UNSUBSCRIBE
  // =========================

  async unsubscribe(
    rawToken: unknown,
  ) {
    const token =
      String(
        rawToken || '',
      ).trim()

    if (
      !token ||
      token.length > 100
    ) {
      throw new NotFoundException(
        'Unsubscribe link is invalid.',
      )
    }

    const subscriber =
      await this.subscriberRepo
        .findOne({
          where: {
            unsubscribeToken:
              token,
          },
        })

    if (!subscriber) {
      throw new NotFoundException(
        'Unsubscribe link is invalid.',
      )
    }

    if (
      subscriber
        .isSubscribed
    ) {
      subscriber.isSubscribed =
        false

      subscriber.unsubscribedAt =
        new Date()

      await this.subscriberRepo
        .save(
          subscriber,
        )
    }

    return {
      success: true,

      message:
        'You have been unsubscribed from promotional emails from this cafe.',
    }
  }
}
