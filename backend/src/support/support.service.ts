import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
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
  Order,
  OrderStatus,
  OwnerIssueSeverity,
  OwnerIssueType,
} from '../order/order.entity'

import {
  Business,
} from '../business/business.entity'

import {
  SupportMessage,
  SupportSenderType,
} from './support-message.entity'

import {
  SupportThread,
  SupportThreadStatus,
} from './support-thread.entity'

import {
  createSupportAccessToken,
  verifySupportAccessToken,
} from './support-token'

@Injectable()
export class SupportService {
  private readonly logger =
    new Logger(
      SupportService.name,
    )

  private resend:
    | Resend
    | null = null

  constructor(
    @InjectRepository(Order)
    private orderRepo:
      Repository<Order>,

    @InjectRepository(Business)
    private businessRepo:
      Repository<Business>,

    @InjectRepository(
      SupportThread,
    )
    private threadRepo:
      Repository<SupportThread>,

    @InjectRepository(
      SupportMessage,
    )
    private messageRepo:
      Repository<SupportMessage>,
  ) {
    const resendKey =
      String(
        process.env
          .RESEND_API_KEY ||
          '',
      ).trim()

    if (resendKey) {
      this.resend =
        new Resend(
          resendKey,
        )
    }
  }

  // =========================
  // 🔐 HELP TOKEN
  // =========================

  private getThreadIdFromToken(
    token: string,
  ) {
    let threadId:
      | string
      | null = null

    try {
      threadId =
        verifySupportAccessToken(
          token,
        )
    } catch (error: any) {
      this.logger.error(
        'SUPPORT_TOKEN_VERIFY_FAILED',
        error?.message ||
          error,
      )
    }

    if (!threadId) {
      throw new NotFoundException(
        'This support link is invalid or unavailable.',
      )
    }

    return threadId
  }

  private getFrontendUrl() {
    return String(
      process.env.FRONTEND_URL ||
        process.env.WEB_URL ||
        'http://localhost:3000',
    ).replace(
      /\/+$/,
      '',
    )
  }

  private escapeHtml(
    value: unknown,
  ) {
    return String(
      value ?? '',
    )
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  private validateMessage(
    rawMessage: unknown,
  ) {
    const message =
      String(
        rawMessage || '',
      ).trim()

    if (!message) {
      throw new BadRequestException(
        'Message is required.',
      )
    }

    if (
      message.length >
      2_000
    ) {
      throw new BadRequestException(
        'Message must be 2,000 characters or less.',
      )
    }

    return message
  }

  private async getThreadRecord(
    threadId: string,
  ) {
    const thread =
      await this.threadRepo
        .findOne({
          where: {
            id: threadId,
          },
        })

    if (!thread) {
      throw new NotFoundException(
        'Support conversation not found.',
      )
    }

    return thread
  }

  private async getOrderRecord(
    orderId: number,
  ) {
    const order =
      await this.orderRepo
        .findOne({
          where: {
            id: orderId,
          },
        })

    if (!order) {
      throw new NotFoundException(
        'Order not found.',
      )
    }

    return order
  }

  private async getBusinessName(
    businessId: number,
    fallback:
      | string
      | null,
  ) {
    const business =
      await this.businessRepo
        .findOne({
          where: {
            id: businessId,
          },
        })

    const name =
      String(
        (business as any)
          ?.cafeName ||
          (business as any)
            ?.name ||
          fallback ||
          'Restaurant',
      ).trim()

    return name ||
      'Restaurant'
  }

  // =========================
  // 👤 CUSTOMER VIEW
  // =========================

  async getCustomerThread(
    token: string,
  ) {
    const threadId =
      this.getThreadIdFromToken(
        token,
      )

    const thread =
      await this
        .getThreadRecord(
          threadId,
        )

    const order =
      await this
        .getOrderRecord(
          thread.orderId,
        )

    const messages =
      await this.messageRepo
        .find({
          where: {
            threadId:
              thread.id,
          },

          order: {
            createdAt:
              'ASC',
            id:
              'ASC',
          },
        })

    const cafeName =
      await this
        .getBusinessName(
          thread.businessId,
          order.storeCode,
        )

    return {
      success: true,

      thread: {
        id:
          thread.id,

        status:
          thread.status,

        cafeName,

        order: {
          id:
            order.id,

          items:
            Array.isArray(
              order.items,
            )
              ? order.items
              : [],

          total:
            Number(
              order.total ||
                0,
            ),

          currency:
            String(
              order.currency ||
                'usd',
            ),

          tableNumber:
            order.tableNumber,

          status:
            order.status,

          refundProcessed:
            Boolean(
              order
                .refundProcessed,
            ),

          refundAmount:
            order.refundAmount ===
            null
              ? null
              : Number(
                  order
                    .refundAmount,
                ),

          createdAt:
            order.createdAt,
        },

        messages:
          messages.map(
            (message) => ({
              id:
                message.id,

              senderType:
                message
                  .senderType,

              senderName:
                message
                  .senderName,

              message:
                message.message,

              metadata:
                message
                  .metadata,

              createdAt:
                message
                  .createdAt,
            }),
          ),
      },
    }
  }

  // =========================
  // 💬 CUSTOMER MESSAGE
  // =========================

  async sendCustomerMessage(
    token: string,
    rawMessage: unknown,
  ) {
    const threadId =
      this.getThreadIdFromToken(
        token,
      )

    const message =
      this.validateMessage(
        rawMessage,
      )

    const thread =
      await this
        .getThreadRecord(
          threadId,
        )

    const order =
      await this
        .getOrderRecord(
          thread.orderId,
        )

    const savedMessage =
      await this.messageRepo
        .save(
          this.messageRepo
            .create({
              threadId:
                thread.id,

              senderType:
                SupportSenderType
                  .CUSTOMER,

              senderName:
                order.customerName ||
                'Customer',

              message,

              metadata:
                null,

              emailNotificationSentAt:
                null,
            }),
        )

    const now =
      new Date()

    thread.status =
      SupportThreadStatus
        .AWAITING_RESTAURANT

    thread.restaurantUnreadCount =
      Math.max(
        0,
        Number(
          thread
            .restaurantUnreadCount ||
            0,
        ),
      ) + 1

    thread.lastMessageAt =
      now

    thread.resolvedAt =
      null

    await this.threadRepo.save(
      thread,
    )

    /*
     * Keep an Order-based Action Center alert for
     * compatibility with the existing dashboard.
     *
     * Do not overwrite another active non-support
     * payment/kitchen incident. The final dashboard
     * will also load support_thread directly, so
     * both issues can remain visible independently.
     */
    if (
      !order.requiresOwnerAction ||
      order.ownerIssueType ===
        OwnerIssueType
          .CUSTOMER_SUPPORT_REQUEST
    ) {
      order.requiresOwnerAction =
        true

      order.issueResolved =
        false

      order.issueType =
        OwnerIssueType
          .CUSTOMER_SUPPORT_REQUEST

      order.ownerIssueType =
        OwnerIssueType
          .CUSTOMER_SUPPORT_REQUEST

      order.ownerIssueSeverity =
        OwnerIssueSeverity
          .WARNING

      order.ownerActionMessage =
        message

      order.ownerActionCreatedAt =
        now

      order.ownerActionResolvedAt =
        null

      order.ownerActionResolvedBy =
        null

      if (
        !order.ownerActionId
      ) {
        order.ownerActionId =
          `SUP-${String(
            order.id,
          ).padStart(
            6,
            '0',
          )}`
      }

      await this.orderRepo.save(
        order,
      )
    }

    this.logger.warn(
      JSON.stringify({
        customerSupport:
          true,

        orderId:
          order.id,

        threadId:
          thread.id,

        messageId:
          savedMessage.id,

        storeCode:
          order.storeCode,
      }),
    )

    return {
      success: true,

      message: {
        id:
          savedMessage.id,

        senderType:
          savedMessage
            .senderType,

        senderName:
          savedMessage
            .senderName,

        message:
          savedMessage.message,

        createdAt:
          savedMessage
            .createdAt,
      },
    }
  }

  // =========================
  // 🧑‍💼 ACTION CENTER THREADS
  // =========================

  async getAdminThreads() {
    const threads =
      await this.threadRepo
        .find({
          order: {
            lastMessageAt:
              'DESC',

            createdAt:
              'DESC',
          },
        })

    const results =
      await Promise.all(
        threads.map(
          async (thread) => {
            const order =
              await this.orderRepo
                .findOne({
                  where: {
                    id:
                      thread.orderId,
                  },
                })

            if (!order) {
              return null
            }

            const latest =
              await this.messageRepo
                .findOne({
                  where: {
                    threadId:
                      thread.id,
                  },

                  order: {
                    createdAt:
                      'DESC',
                    id:
                      'DESC',
                  },
                })

            return {
              id:
                thread.id,

              orderId:
                thread.orderId,

              businessId:
                thread.businessId,

              storeCode:
                thread.storeCode,

              customerEmail:
                thread.customerEmail,

              customerName:
                thread.customerName,

              status:
                thread.status,

              restaurantUnreadCount:
                thread
                  .restaurantUnreadCount,

              customerUnreadCount:
                thread
                  .customerUnreadCount,

              lastMessageAt:
                thread
                  .lastMessageAt,

              latestMessage:
                latest
                  ? {
                      id:
                        latest.id,

                      senderType:
                        latest
                          .senderType,

                      senderName:
                        latest
                          .senderName,

                      message:
                        latest
                          .message,

                      createdAt:
                        latest
                          .createdAt,
                    }
                  : null,

              order: {
                id:
                  order.id,

                total:
                  Number(
                    order.total ||
                      0,
                  ),

                currency:
                  order.currency,

                tableNumber:
                  order.tableNumber,

                status:
                  order.status,

                stripePaymentIntentId:
                  order
                    .stripePaymentIntentId,

                refundProcessed:
                  order
                    .refundProcessed,

                refundAmount:
                  order
                    .refundAmount,

                createdAt:
                  order.createdAt,
              },
            }
          },
        ),
      )

    return {
      success: true,

      threads:
        results.filter(
          Boolean,
        ),
    }
  }

  async getAdminThread(
    orderId: number,
  ) {
    const cleanOrderId =
      Number(orderId)

    if (
      !cleanOrderId ||
      Number.isNaN(
        cleanOrderId,
      )
    ) {
      throw new BadRequestException(
        'Valid order id is required.',
      )
    }

    const thread =
      await this.threadRepo
        .findOne({
          where: {
            orderId:
              cleanOrderId,
          },
        })

    if (!thread) {
      throw new NotFoundException(
        'Support conversation not found.',
      )
    }

    const order =
      await this
        .getOrderRecord(
          cleanOrderId,
        )

    const messages =
      await this.messageRepo
        .find({
          where: {
            threadId:
              thread.id,
          },

          order: {
            createdAt:
              'ASC',
            id:
              'ASC',
          },
        })

    return {
      success: true,

      thread: {
        ...thread,

        order: {
          id:
            order.id,

          items:
            order.items,

          total:
            Number(
              order.total ||
                0,
            ),

          currency:
            order.currency,

          tableNumber:
            order.tableNumber,

          status:
            order.status,

          customerEmail:
            order.customerEmail,

          customerName:
            order.customerName,

          refundProcessed:
            order.refundProcessed,

          refundAmount:
            order.refundAmount,

          stripePaymentIntentId:
            order
              .stripePaymentIntentId,

          createdAt:
            order.createdAt,
        },

        messages:
          messages.map(
            (item) => ({
              id:
                item.id,

              senderType:
                item
                  .senderType,

              senderName:
                item
                  .senderName,

              message:
                item.message,

              metadata:
                item
                  .metadata,

              createdAt:
                item
                  .createdAt,
            }),
          ),
      },
    }
  }

  // =========================
  // ↩️ RESTAURANT REPLY
  // =========================

  async sendAdminReply(
    orderId: number,
    rawMessage: unknown,
    senderName =
      'Restaurant',
  ) {
    const cleanOrderId =
      Number(orderId)

    if (
      !cleanOrderId ||
      Number.isNaN(
        cleanOrderId,
      )
    ) {
      throw new BadRequestException(
        'Valid order id is required.',
      )
    }

    const message =
      this.validateMessage(
        rawMessage,
      )

    const thread =
      await this.threadRepo
        .findOne({
          where: {
            orderId:
              cleanOrderId,
          },
        })

    if (!thread) {
      throw new NotFoundException(
        'Support conversation not found.',
      )
    }

    const order =
      await this
        .getOrderRecord(
          cleanOrderId,
        )

    const savedMessage =
      await this.messageRepo
        .save(
          this.messageRepo
            .create({
              threadId:
                thread.id,

              senderType:
                SupportSenderType
                  .RESTAURANT,

              senderName:
                String(
                  senderName ||
                    'Restaurant',
                ).slice(
                  0,
                  255,
                ),

              message,

              metadata:
                null,

              emailNotificationSentAt:
                null,
            }),
        )

    thread.status =
      SupportThreadStatus
        .AWAITING_CUSTOMER

    thread.restaurantUnreadCount =
      0

    thread.customerUnreadCount =
      Math.max(
        0,
        Number(
          thread
            .customerUnreadCount ||
            0,
        ),
      ) + 1

    thread.lastMessageAt =
      new Date()

    thread.resolvedAt =
      null

    await this.threadRepo.save(
      thread,
    )

    await this
      .emailCustomerAboutReply(
        order,
        thread,
        savedMessage.id,
        message,
      )

    return {
      success: true,
      message:
        savedMessage,
    }
  }

  private async emailCustomerAboutReply(
    order: Order,
    thread: SupportThread,
    messageId: number,
    reply: string,
  ) {
    const email =
      String(
        order.customerEmail ||
          thread.customerEmail ||
          '',
      )
        .trim()
        .toLowerCase()

    if (
      !email ||
      !this.resend
    ) {
      return
    }

    try {
      const token =
        createSupportAccessToken(
          thread.id,
        )

      const helpUrl =
        `${this.getFrontendUrl()}/help/${encodeURIComponent(
          token,
        )}`

      const from =
        process.env
          .SUPPORT_EMAIL_FROM ||
        process.env
          .RECEIPT_EMAIL_FROM ||
        process.env
          .MAINTENANCE_EMAIL_FROM ||
        'CaviarQR <onboarding@resend.dev>'

      const safeReply =
        this.escapeHtml(
          reply,
        ).replace(
          /\n/g,
          '<br />',
        )

      const result =
        await this.resend
          .emails.send({
            from,

            to:
              email,

            subject:
              `New reply about CaviarQR order #${order.id}`,

            text:
              `There is a new reply about your order #${order.id}.

${reply}

View the conversation:
${helpUrl}`,

            html:
              `
                <div style="font-family: Arial, Helvetica, sans-serif; line-height: 1.6; color: #191919;">
                  <h2>
                    New reply about order #${order.id}
                  </h2>

                  <p>
                    ${safeReply}
                  </p>

                  <p style="margin-top: 24px;">
                    <a
                      href="${this.escapeHtml(
                        helpUrl,
                      )}"
                      style="display: inline-block; padding: 12px 18px; border-radius: 10px; background: #ff3008; color: #ffffff; text-decoration: none; font-weight: 700;"
                    >
                      View Conversation
                    </a>
                  </p>

                  <p style="margin-top: 24px; font-size: 12px; color: #767676;">
                    CaviarQR Support
                  </p>
                </div>
              `,
          })

      if (
        result.error
      ) {
        throw new Error(
          result.error.message,
        )
      }

      await this.messageRepo
        .update(
          {
            threadId:
              thread.id,

            id:
              messageId,
          },

          {
            emailNotificationSentAt:
              new Date(),
          },
        )
    } catch (error: any) {
      /*
       * A reply must remain saved even if email delivery
       * fails. The customer can still see it by reopening
       * the original secure receipt link.
       */
      this.logger.error(
        `SUPPORT_REPLY_EMAIL_FAILED: Order ${order.id}`,
        error?.message ||
          error,
      )
    }
  }

  // =========================
  // ✅ RESOLVE SUPPORT
  // =========================

  async resolveAdminThread(
    orderId: number,
  ) {
    const cleanOrderId =
      Number(orderId)

    if (
      !cleanOrderId ||
      Number.isNaN(
        cleanOrderId,
      )
    ) {
      throw new BadRequestException(
        'Valid order id is required.',
      )
    }

    const thread =
      await this.threadRepo
        .findOne({
          where: {
            orderId:
              cleanOrderId,
          },
        })

    if (!thread) {
      throw new NotFoundException(
        'Support conversation not found.',
      )
    }

    const order =
      await this
        .getOrderRecord(
          cleanOrderId,
        )

    thread.status =
      order.status ===
      OrderStatus.REFUNDED
        ? SupportThreadStatus
            .REFUNDED
        : SupportThreadStatus
            .RESOLVED

    thread.restaurantUnreadCount =
      0

    thread.resolvedAt =
      new Date()

    await this.threadRepo.save(
      thread,
    )

    if (
      order.ownerIssueType ===
      OwnerIssueType
        .CUSTOMER_SUPPORT_REQUEST
    ) {
      order.issueResolved =
        true

      order.requiresOwnerAction =
        false

      order.issueType =
        'RESOLVED'

      order.ownerIssueType =
        null

      order.ownerIssueSeverity =
        null

      order.ownerActionMessage =
        'Customer support request resolved.'

      order.ownerActionResolvedAt =
        new Date()

      order.ownerActionResolvedBy =
        'MAINTENANCE_ADMIN'

      order.resolutionReason =
        'CUSTOMER_SUPPORT_RESOLVED'

      await this.orderRepo.save(
        order,
      )
    }

    return {
      success: true,

      status:
        thread.status,
    }
  }

  async markRestaurantRead(
    orderId: number,
  ) {
    const thread =
      await this.threadRepo
        .findOne({
          where: {
            orderId:
              Number(orderId),
          },
        })

    if (!thread) {
      throw new NotFoundException(
        'Support conversation not found.',
      )
    }

    thread.restaurantUnreadCount =
      0

    await this.threadRepo.save(
      thread,
    )

    return {
      success: true,
    }
  }

  async markCustomerRead(
    token: string,
  ) {
    const threadId =
      this.getThreadIdFromToken(
        token,
      )

    const thread =
      await this
        .getThreadRecord(
          threadId,
        )

    thread.customerUnreadCount =
      0

    await this.threadRepo.save(
      thread,
    )

    return {
      success: true,
    }
  }
}