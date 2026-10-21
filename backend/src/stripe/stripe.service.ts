import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import Stripe from 'stripe'
import {
  In,
  Repository,
} from 'typeorm'

import {
  Business,
  BusinessCountryCode,
  BusinessCurrency,
} from '../business/business.entity'
import {
  MenuItem,
} from '../menu/menu.entity'
import {
  normalizeRequestedSelections,
  validateCustomizationSelections,
} from '../menu/menu-customization'
import {
  PendingOrder,
  PendingOrderStatus,
  type PendingOrderItem,
} from '../pending-order/pending-order.entity'
import {
  CreateCheckoutDto,
} from './dto/create-checkout.dto'

type StripeAccountStatus = {
  connected: boolean
  accountId?: string
  charges_enabled: boolean
  payouts_enabled: boolean
  details_submitted: boolean
  ready: boolean
  issueActive: boolean
  message: string | null
}

type RequestedItem = {
  id: number
  qty: number
  note?: string
  customizations?: Array<{
    groupId: string
    optionIds: string[]
  }>
}

@Injectable()
export class StripeService {
  private readonly logger =
    new Logger(StripeService.name)

  private readonly stripe: Stripe

  private readonly frontendUrl =
    (
      process.env.FRONTEND_URL ||
      'http://localhost:3000'
    ).replace(/\/+$/, '')

  constructor(
    @InjectRepository(Business)
    private readonly businessRepo:
      Repository<Business>,

    @InjectRepository(MenuItem)
    private readonly menuItemRepo:
      Repository<MenuItem>,

    @InjectRepository(PendingOrder)
    private readonly pendingOrderRepo:
      Repository<PendingOrder>,
  ) {
    const key =
      process.env.STRIPE_SECRET_KEY

    const isProduction =
      process.env.NODE_ENV ===
      'production'

    if (!key) {
      throw new Error(
        'Missing STRIPE_SECRET_KEY.',
      )
    }

    if (
      isProduction &&
      !key.startsWith('sk_live_')
    ) {
      throw new Error(
        'Production requires a Stripe live secret key.',
      )
    }

    if (
      !isProduction &&
      !key.startsWith('sk_')
    ) {
      throw new Error(
        'Invalid STRIPE_SECRET_KEY.',
      )
    }

    if (
      isProduction &&
      !this.frontendUrl.startsWith(
        'https://',
      )
    ) {
      throw new Error(
        'Production FRONTEND_URL must use HTTPS.',
      )
    }

    this.stripe = new Stripe(key, {
      apiVersion:
        '2026-02-25.clover',
    })

    this.logger.log(
      'Stripe initialized from environment.',
    )
  }

  // =====================================
  // PUBLIC CUSTOMER CHECKOUT
  // =====================================

  async createCheckoutSession(
    data: CreateCheckoutDto,
  ) {
    let savedPendingOrder:
      | PendingOrder
      | null = null

    try {
      const storeCode =
        String(data.storeCode || '')
          .trim()

      const checkoutRequestId =
        String(
          data.checkoutRequestId ||
            '',
        ).trim()

      const tableNumber =
        Number(data.tableNumber)

      if (!storeCode) {
        throw new BadRequestException(
          'Store code is required.',
        )
      }

      if (
        !this.isUuid(
          checkoutRequestId,
        )
      ) {
        throw new BadRequestException(
          'A valid checkoutRequestId is required.',
        )
      }

      if (
        !Number.isInteger(
          tableNumber,
        ) ||
        tableNumber < 0 ||
        tableNumber > 100_000
      ) {
        throw new BadRequestException(
          'Table number is invalid.',
        )
      }

      if (
        !Array.isArray(
          data.items,
        ) ||
        data.items.length === 0
      ) {
        throw new BadRequestException(
          'Cart is empty.',
        )
      }

      const business =
        await this.businessRepo
          .findOne({
            where: {
              storeCode,
            },
          })

      if (!business) {
        throw new BadRequestException(
          'Business not found.',
        )
      }

      if (!business.isOpen) {
        throw new BadRequestException(
          'Restaurant is currently closed.',
        )
      }

      /*
       * US LAUNCH LOCK
       *
       * India support remains in the data model for
       * a later Razorpay rollout, but Stripe checkout
       * must only run for US/USD restaurants during
       * the initial production launch.
       */
      this.assertUsLaunchBusiness(
        business,
      )

      const currency: 'usd' =
        'usd'

      const stripeStatus =
        await this
          .syncStripeAccountStatus(
            business,
          )

      if (
        !stripeStatus.ready ||
        !business.stripeAccountId
      ) {
        throw new BadRequestException(
          'Restaurant payments are not ready. Please ask the owner to complete Stripe setup.',
        )
      }

      const connectedAccountId =
        business.stripeAccountId

      // Merge duplicate item IDs before
      // validating quantities and pricing.
      const requestedItems =
        this.normalizeRequestedItems(
          data.items,
        )

      const requestedItemIds =
        Array.from(
          new Set(
            requestedItems.map(
              (item) =>
                item.id,
            ),
          ),
        )

      const databaseItems =
        await this.menuItemRepo.find({
          where: {
            id: In(
              requestedItemIds,
            ),
            businessId:
              business.id,
          },
        })

      if (
        databaseItems.length !==
        requestedItemIds.length
      ) {
        throw new BadRequestException(
          'One or more menu items are invalid.',
        )
      }

      const menuItemById =
        new Map(
          databaseItems.map(
            (item) => [
              Number(item.id),
              item,
            ],
          ),
        )

      // All amounts are calculated in
      // integer cents to avoid float errors.
      //
      // Base-item discounts apply to the base
      // item. Customization add-on prices are
      // then added at their configured amount.
      const safeItems:
        PendingOrderItem[] =
        requestedItems.map(
          (requestedItem) => {
            const menuItem =
              menuItemById.get(
                requestedItem.id,
              )

            if (!menuItem) {
              throw new BadRequestException(
                'Menu item not found.',
              )
            }

            if (
              menuItem.isHidden ||
              menuItem.isOutOfStock
            ) {
              throw new BadRequestException(
                `${menuItem.name} is not currently available.`,
              )
            }

            const originalPriceCents =
              Math.round(
                Number(
                  menuItem.price,
                ) * 100,
              )

            const discountPercent =
              Number(
                menuItem.discount ||
                  0,
              )

            if (
              !Number.isInteger(
                originalPriceCents,
              ) ||
              originalPriceCents < 1
            ) {
              throw new BadRequestException(
                `${menuItem.name} has an invalid price.`,
              )
            }

            if (
              !Number.isFinite(
                discountPercent,
              ) ||
              discountPercent < 0 ||
              discountPercent >= 100
            ) {
              throw new BadRequestException(
                `${menuItem.name} has an invalid discount.`,
              )
            }

            const discountedBasePriceCents =
              Math.round(
                originalPriceCents *
                  (
                    1 -
                    discountPercent /
                      100
                  ),
              )

            if (
              discountedBasePriceCents <
              1
            ) {
              throw new BadRequestException(
                `${menuItem.name} has an invalid final price.`,
              )
            }

            const customizationResult =
              validateCustomizationSelections(
                String(
                  menuItem.name,
                ),
                Array.isArray(
                  menuItem.customizations,
                )
                  ? menuItem.customizations
                  : [],
                requestedItem
                  .customizations ||
                  [],
              )

            const unitPriceCents =
              discountedBasePriceCents +
              customizationResult
                .extraPriceCents

            if (
              unitPriceCents < 1
            ) {
              throw new BadRequestException(
                `${menuItem.name} has an invalid final price.`,
              )
            }

            return {
              id:
                Number(
                  menuItem.id,
                ),

              name:
                String(
                  menuItem.name,
                ),

              qty:
                requestedItem.qty,

              ...(requestedItem.note
                ? {
                    note:
                      requestedItem.note,
                  }
                : {}),

              ...(customizationResult
                .snapshot.length
                ? {
                    customizations:
                      customizationResult
                        .snapshot,
                  }
                : {}),

              unitPriceCents,

              price:
                unitPriceCents /
                100,
            }
          },
        )

      const subtotalCents =
        safeItems.reduce(
          (
            sum,
            item,
          ) =>
            sum +
            item.unitPriceCents *
              item.qty,
          0,
        )

      if (
        subtotalCents < 1
      ) {
        throw new BadRequestException(
          'Checkout amount is invalid.',
        )
      }

      const serviceFeePercent =
        Number(
          business.serviceFee ||
            0,
        )

      if (
        !Number.isFinite(
          serviceFeePercent,
        ) ||
        serviceFeePercent < 0 ||
        serviceFeePercent > 30
      ) {
        throw new BadRequestException(
          'Restaurant service fee configuration is invalid.',
        )
      }

      const serviceFeeCents =
        Math.round(
          subtotalCents *
            (
              serviceFeePercent /
              100
            ),
        )

      const finalTotalCents =
        subtotalCents +
        serviceFeeCents

      const processingFeePercent =
        Number(
          business
            .processingFeePercent ??
            4.75,
        )

      if (
        !Number.isFinite(
          processingFeePercent,
        ) ||
        processingFeePercent < 0 ||
        processingFeePercent > 20
      ) {
        throw new BadRequestException(
          'CaviarQR processing fee configuration is invalid.',
        )
      }

      const platformFeeCents =
        Math.round(
          finalTotalCents *
            (
              processingFeePercent /
              100
            ),
        )

      if (
        platformFeeCents < 0 ||
        platformFeeCents >=
          finalTotalCents
      ) {
        throw new BadRequestException(
          'CaviarQR processing fee configuration is invalid.',
        )
      }

      const subtotal =
        subtotalCents / 100

      const serviceFeeAmount =
        serviceFeeCents / 100

      const platformFee =
        platformFeeCents / 100

      const finalTotal =
        finalTotalCents / 100

      /*
       * Customer marketing consent is explicit and
       * separate from the Stripe receipt email.
       *
       * Maintenance remains authoritative: even if a
       * client sends true, a disabled cafe cannot collect
       * a marketing opt-in.
       */
      const marketingOptIn =
        data.marketingOptIn === true &&
        business.emailMarketingEnabled ===
          true

      const itemSignature =
        this.createItemSignature(
          safeItems,
        )

      savedPendingOrder =
        await this.pendingOrderRepo
          .findOne({
            where: {
              checkoutRequestId,
            },
          })

      if (savedPendingOrder) {
        this.assertMatchingRetry(
          savedPendingOrder,
          {
            businessId:
              business.id,
            storeCode,
            tableNumber,
            total:
              finalTotal,
            currency,
            itemSignature,
            marketingOptIn,
          },
        )

        if (
          savedPendingOrder
            .stripeSessionId
        ) {
          const existingSession =
            await this.stripe
              .checkout.sessions
              .retrieve(
                savedPendingOrder
                  .stripeSessionId,
              )

          if (
            existingSession.status ===
              'open' &&
            existingSession.url
          ) {
            return {
              url:
                existingSession.url,

              pendingOrderId:
                savedPendingOrder.id,

              duplicateRequest:
                true,
            }
          }

          if (
            existingSession.status ===
            'complete'
          ) {
            throw new BadRequestException(
              'This checkout request has already been completed.',
            )
          }

          throw new BadRequestException(
            'This checkout session has expired. Please start checkout again.',
          )
        }

        savedPendingOrder.items =
          safeItems

        savedPendingOrder.subtotal =
          subtotal

        savedPendingOrder
          .serviceFeeAmount =
          serviceFeeAmount

        savedPendingOrder
          .platformFee =
          platformFee

        savedPendingOrder.total =
          finalTotal

        savedPendingOrder.currency =
          currency

        savedPendingOrder.marketingOptIn =
          marketingOptIn

        savedPendingOrder.marketingConsentAt =
          marketingOptIn
            ? (
                savedPendingOrder
                  .marketingConsentAt ||
                new Date()
              )
            : null

        savedPendingOrder.status =
          PendingOrderStatus.CREATED

        savedPendingOrder
          .failureReason =
          null

        savedPendingOrder
          .expiresAt =
          new Date(
            Date.now() +
              31 * 60 * 1000,
          )

        savedPendingOrder =
          await this.pendingOrderRepo
            .save(
              savedPendingOrder,
            )
      } else {
        const pendingOrder =
          this.pendingOrderRepo
            .create({
              checkoutRequestId,

              businessId:
                business.id,

              storeCode,

              tableNumber,

              items:
                safeItems,

              subtotal,

              serviceFeeAmount,

              platformFee,

              total:
                finalTotal,

              currency,

              marketingOptIn,

              marketingConsentAt:
                marketingOptIn
                  ? new Date()
                  : null,

              stripeSessionId:
                null,

              stripePaymentIntentId:
                null,

              status:
                PendingOrderStatus.CREATED,

              issueCreated:
                false,

              failureReason:
                null,

              completedAt:
                null,

              expiresAt:
                new Date(
                  Date.now() +
                    31 *
                      60 *
                      1000,
                ),
            })

        try {
          savedPendingOrder =
            await this.pendingOrderRepo
              .save(
                pendingOrder,
              )
        } catch (error: unknown) {
          if (
            !this
              .isPostgresUniqueViolation(
                error,
              )
          ) {
            throw error
          }

          savedPendingOrder =
            await this.pendingOrderRepo
              .findOne({
                where: {
                  checkoutRequestId,
                },
              })

          if (
            !savedPendingOrder
          ) {
            throw error
          }

          this.assertMatchingRetry(
            savedPendingOrder,
            {
              businessId:
                business.id,
              storeCode,
              tableNumber,
              total:
                finalTotal,
              currency,
              itemSignature,
            marketingOptIn,
            },
          )
        }
      }

      const paymentMetadata = {
        pendingOrderId:
          String(
            savedPendingOrder.id,
          ),

        businessId:
          String(
            business.id,
          ),

        storeCode,

        tableNumber:
          String(
            tableNumber,
          ),

        currency,
      }

      const encodedStoreCode =
        encodeURIComponent(
          storeCode,
        )

      const encodedTableNumber =
        encodeURIComponent(
          String(
            tableNumber,
          ),
        )

      const expiresAt =
        Math.floor(
          Date.now() /
            1000,
        ) +
        31 * 60

      const session =
        await this.stripe
          .checkout.sessions
          .create(
            {
              mode:
                'payment',

              /*
               * Show the restaurant's Branding name on Stripe Checkout.
               * storeCode remains internal only.
               */
              branding_settings: {
                display_name:
                  String(
                    business.name ||
                    storeCode,
                  ).trim(),
              },

              client_reference_id:
                String(
                  savedPendingOrder.id,
                ),

              /*
               * payment_method_types is
               * intentionally omitted.
               * Stripe can display eligible
               * payment methods configured
               * in the Dashboard.
               */
              customer_creation:
                'if_required',

              billing_address_collection:
                'required',

              phone_number_collection: {
                enabled:
                  true,
              },

              submit_type:
                'pay',

              expires_at:
                expiresAt,

              line_items: [
                ...safeItems.map(
                  (item) => ({
                    price_data: {
                      currency,

                      product_data: {
                        name:
                          item.name,
                      },

                      unit_amount:
                        item
                          .unitPriceCents,
                    },

                    quantity:
                      item.qty,
                  }),
                ),

                ...(serviceFeeCents >
                0
                  ? [
                      {
                        price_data: {
                          currency,

                          product_data: {
                            name:
                              'Service Fee',
                          },

                          unit_amount:
                            serviceFeeCents,
                        },

                        quantity:
                          1,
                      },
                    ]
                  : []),
              ],

              payment_intent_data: {
                ...(platformFeeCents >
                0
                  ? {
                      application_fee_amount:
                        platformFeeCents,
                    }
                  : {}),

                metadata:
                  paymentMetadata,
              },

              metadata:
                paymentMetadata,

              success_url:
                `${this.frontendUrl}/store/${encodedStoreCode}?table=${encodedTableNumber}&success=1&pendingOrderId=${savedPendingOrder.id}`,

              cancel_url:
                `${this.frontendUrl}/store/${encodedStoreCode}?table=${encodedTableNumber}`,
            },
            {
              stripeAccount:
                connectedAccountId,

              idempotencyKey:
                `caviarqr-checkout-${checkoutRequestId}`,
            },
          )

      if (!session.url) {
        throw new BadRequestException(
          'Stripe did not return a Checkout URL.',
        )
      }

      savedPendingOrder
        .stripeSessionId =
        session.id

      savedPendingOrder.status =
        PendingOrderStatus
          .CHECKOUT_CREATED

      savedPendingOrder
        .failureReason =
        null

      await this.pendingOrderRepo
        .save(
          savedPendingOrder,
        )

      this.logger.log(
        `Checkout created for pending order ${savedPendingOrder.id}.`,
      )

      return {
        url:
          session.url,

        pendingOrderId:
          savedPendingOrder.id,
      }
    } catch (error: unknown) {
      const message =
        this.getErrorMessage(
          error,
        )

      this.logger.error(
        `CHECKOUT_FAILED: ${message}`,
        error instanceof Error
          ? error.stack
          : undefined,
      )

      if (
        savedPendingOrder &&
        !savedPendingOrder
          .stripeSessionId
      ) {
        try {
          savedPendingOrder.status =
            PendingOrderStatus.FAILED

          savedPendingOrder
            .failureReason =
            message.slice(
              0,
              2_000,
            )

          await this.pendingOrderRepo
            .save(
              savedPendingOrder,
            )
        } catch (
          saveError: unknown
        ) {
          this.logger.error(
            'Could not save failed PendingOrder state.',
            saveError instanceof Error
              ? saveError.stack
              : String(
                  saveError,
                ),
          )
        }
      }

      if (
        error instanceof
        BadRequestException
      ) {
        throw error
      }

      throw new BadRequestException(
        process.env.NODE_ENV ===
          'production'
          ? 'Payment could not be started. Please try again.'
          : `Payment could not be started: ${message}`,
      )
    }
  }

  // =====================================
  // STRIPE ACCOUNT STATUS
  // =====================================

  private async syncStripeAccountStatus(
    business: Business,
  ): Promise<StripeAccountStatus> {
    const now =
      new Date()

    /*
     * US LAUNCH LOCK
     *
     * Do not call Stripe for an India/INR restaurant.
     * This prevents an accidental country selection
     * from reaching the US Stripe platform.
     */
    const launchConfigurationIssue =
      this.getUsLaunchConfigurationIssue(
        business,
      )

    if (launchConfigurationIssue) {
      business.stripeChargesEnabled =
        false

      business.stripePayoutsEnabled =
        false

      business.stripeDetailsSubmitted =
        false

      business.stripeAccountReady =
        false

      business.stripeIssueActive =
        true

      business.stripeIssueMessage =
        launchConfigurationIssue

      business.stripeIssueCreatedAt =
        business
          .stripeIssueCreatedAt ||
        now

      business.stripeLastCheckedAt =
        now

      await this.businessRepo.save(
        business,
      )

      return {
        connected:
          Boolean(
            business
              .stripeAccountId,
          ),

        ...(business
          .stripeAccountId
          ? {
              accountId:
                business
                  .stripeAccountId,
            }
          : {}),

        charges_enabled:
          false,

        payouts_enabled:
          false,

        details_submitted:
          false,

        ready:
          false,

        issueActive:
          true,

        message:
          business
            .stripeIssueMessage,
      }
    }

    if (!business.stripeAccountId) {
      business.stripeChargesEnabled =
        false

      business.stripePayoutsEnabled =
        false

      business.stripeDetailsSubmitted =
        false

      business.stripeAccountReady =
        false

      business.stripeIssueActive =
        true

      business.stripeIssueMessage =
        'Stripe account is not connected. Connect Stripe before accepting real payments and payouts.'

      business.stripeIssueCreatedAt =
        business
          .stripeIssueCreatedAt ||
        now

      business.stripeLastCheckedAt =
        now

      await this.businessRepo.save(
        business,
      )

      return {
        connected:
          false,
        charges_enabled:
          false,
        payouts_enabled:
          false,
        details_submitted:
          false,
        ready:
          false,
        issueActive:
          true,
        message:
          business
            .stripeIssueMessage,
      }
    }

    try {
      const account =
        await this.stripe
          .accounts.retrieve(
            business
              .stripeAccountId,
          )

      const expectedCountryCode:
        'US' = 'US'

      const stripeCountryCode =
        String(
          account.country ||
            '',
        ).toUpperCase()

      const countryMatches =
        stripeCountryCode ===
        expectedCountryCode

      const chargesEnabled =
        Boolean(
          account.charges_enabled,
        )

      const payoutsEnabled =
        Boolean(
          account.payouts_enabled,
        )

      const detailsSubmitted =
        Boolean(
          account
            .details_submitted,
        )

      const ready =
        chargesEnabled &&
        payoutsEnabled &&
        detailsSubmitted &&
        countryMatches

      business.stripeChargesEnabled =
        chargesEnabled

      business.stripePayoutsEnabled =
        payoutsEnabled

      business.stripeDetailsSubmitted =
        detailsSubmitted

      business.stripeAccountReady =
        ready

      business.stripeIssueActive =
        !ready

      business.stripeIssueMessage =
        ready
          ? null
          : !countryMatches
            ? `Stripe account country ${stripeCountryCode || 'UNKNOWN'} does not match the CaviarQR US launch country ${expectedCountryCode}. Create a new US connected account.`
            : 'Stripe account is not fully ready. Complete onboarding so charges and payouts work correctly.'

      business.stripeIssueCreatedAt =
        ready
          ? null
          : business
              .stripeIssueCreatedAt ||
            now

      business.stripeLastCheckedAt =
        now

      await this.businessRepo.save(
        business,
      )

      return {
        connected:
          true,

        accountId:
          business
            .stripeAccountId,

        charges_enabled:
          chargesEnabled,

        payouts_enabled:
          payoutsEnabled,

        details_submitted:
          detailsSubmitted,

        ready,

        issueActive:
          !ready,

        message:
          business
            .stripeIssueMessage,
      }
    } catch (error: unknown) {
      const message =
        this.getErrorMessage(
          error,
        )

      business.stripeChargesEnabled =
        false

      business.stripePayoutsEnabled =
        false

      business.stripeDetailsSubmitted =
        false

      business.stripeAccountReady =
        false

      business.stripeIssueActive =
        true

      business.stripeIssueMessage =
        `Stripe account status check failed: ${message}`

      business.stripeIssueCreatedAt =
        business
          .stripeIssueCreatedAt ||
        now

      business.stripeLastCheckedAt =
        now

      await this.businessRepo.save(
        business,
      )

      this.logger.warn(
        `STRIPE_ACCOUNT_CHECK_FAILED: ${message}`,
      )

      return {
        connected:
          false,

        accountId:
          business
            .stripeAccountId,

        charges_enabled:
          false,

        payouts_enabled:
          false,

        details_submitted:
          false,

        ready:
          false,

        issueActive:
          true,

        message:
          business
            .stripeIssueMessage,
      }
    }
  }

  // =====================================
  // CONNECT ONBOARDING
  // =====================================

  async createConnectLink(
    businessId: number,
  ) {
    const business =
      await this.findBusinessById(
        businessId,
      )

    this.assertUsLaunchBusiness(
      business,
    )

    const countryCode: 'US' =
      'US'

    const currency: 'usd' =
      'usd'

    let accountId =
      business.stripeAccountId

    const stripeDisplayName =
      business.name?.trim() ||
      business.storeCode

    /*
     * If an account ID is already saved, verify it
     * is a US connected account before generating
     * another onboarding link.
     */
    if (accountId) {
      await this
        .assertStripeAccountIsUs(
          accountId,
        )
    }

    if (!accountId) {
      const account =
        await this.stripe
          .accounts.create({
            type:
              'express',

            country:
              countryCode,

            business_profile: {
              name:
                stripeDisplayName,
            },

            ...(business.email
              ? {
                  email:
                    business.email,
                }
              : {}),

            capabilities: {
              card_payments: {
                requested:
                  true,
              },

              transfers: {
                requested:
                  true,
              },
            },

            metadata: {
              businessId:
                String(
                  business.id,
                ),

              storeCode:
                business.storeCode,

              countryCode,

              currency,
            },
          })

      accountId =
        account.id

      business.stripeAccountId =
        accountId

      business.stripeAccountReady =
        false

      business.stripeIssueActive =
        true

      business.stripeIssueMessage =
        'Stripe onboarding must be completed before accepting payments.'

      business.stripeIssueCreatedAt =
        business
          .stripeIssueCreatedAt ||
        new Date()

      business.stripeLastCheckedAt =
        new Date()

      await this.businessRepo.save(
        business,
      )
    }

    const accountLink =
      await this.stripe
        .accountLinks.create({
          account:
            accountId,

          refresh_url:
            `${this.frontendUrl}/dashboard/owner?stripe=refresh`,

          return_url:
            `${this.frontendUrl}/dashboard/owner?stripe=return`,

          type:
            'account_onboarding',
        })

    return {
      url:
        accountLink.url,
    }
  }

  async getDashboardLink(
    businessId: number,
  ) {
    const business =
      await this.findBusinessById(
        businessId,
      )

    this.assertUsLaunchBusiness(
      business,
    )

    if (
      !business.stripeAccountId
    ) {
      return this.createConnectLink(
        businessId,
      )
    }

    await this
      .assertStripeAccountIsUs(
        business
          .stripeAccountId,
      )

    // Dashboard login must not modify merchant identity.
    const loginLink =
      await this.stripe
        .accounts
        .createLoginLink(
          business
            .stripeAccountId,
        )

    return {
      url:
        loginLink.url,
    }
  }

  async getBalance(
    businessId: number,
  ) {
    const business =
      await this.findBusinessById(
        businessId,
      )

    this.assertUsLaunchBusiness(
      business,
    )

    const currency: 'usd' =
      'usd'

    if (
      !business.stripeAccountId
    ) {
      return {
        connected:
          false,
        balance:
          0,
        currency,
        availableBalances:
          [],
        pendingBalances:
          [],
      }
    }

    await this
      .assertStripeAccountIsUs(
        business
          .stripeAccountId,
      )

    const balance =
      await this.stripe
        .balance.retrieve(
          {},
          {
            stripeAccount:
              business
                .stripeAccountId,
          },
        )

    const availableBalances =
      balance.available.map(
        (entry) => ({
          amount:
            Number(
              (
                entry.amount /
                100
              ).toFixed(2),
            ),

          currency:
            entry.currency,
        }),
      )

    const pendingBalances =
      balance.pending.map(
        (entry) => ({
          amount:
            Number(
              (
                entry.amount /
                100
              ).toFixed(2),
            ),

          currency:
            entry.currency,
        }),
      )

    return {
      connected:
        true,

      balance:
        availableBalances.find(
          (entry) =>
            entry.currency ===
            currency,
        )?.amount || 0,

      currency,

      availableBalances,

      pendingBalances,
    }
  }

  async isStripeReady(
    businessId: number,
  ) {
    const business =
      await this.findBusinessById(
        businessId,
      )

    return this
      .syncStripeAccountStatus(
        business,
      )
  }

  // =====================================
  // READ-ONLY PLATFORM BALANCE
  // =====================================

  async getPlatformBalance() {
    try {
      const balance =
        await this.stripe
          .balance.retrieve()

      const availableBalances =
        balance.available.map(
          (entry) => ({
            amount:
              Number(
                (
                  entry.amount /
                  100
                ).toFixed(2),
              ),

            currency:
              entry.currency,
          }),
        )

      const pendingBalances =
        balance.pending.map(
          (entry) => ({
            amount:
              Number(
                (
                  entry.amount /
                  100
                ).toFixed(2),
              ),

            currency:
              entry.currency,
          }),
        )

      return {
        success:
          true,

        available:
          availableBalances.find(
            (entry) =>
              entry.currency ===
              'usd',
          )?.amount || 0,

        pending:
          pendingBalances.find(
            (entry) =>
              entry.currency ===
              'usd',
          )?.amount || 0,

        currency:
          'usd',

        availableBalances,

        pendingBalances,
      }
    } catch (error: unknown) {
      const message =
        this.getErrorMessage(
          error,
        )

      this.logger.error(
        `PLATFORM_BALANCE_FAILED: ${message}`,
        error instanceof Error
          ? error.stack
          : undefined,
      )

      throw new BadRequestException(
        'Could not load CaviarQR platform balance.',
      )
    }
  }

  // =====================================
  // BLOCK LEGACY MONEY-MOVEMENT METHODS
  // =====================================

  async refundOrder(
    _paymentIntentId: string,
  ): Promise<never> {
    throw new BadRequestException(
      'Use PATCH /maintenance/refund/:orderId so refunds are audited and idempotent.',
    )
  }

  async withdrawPlatformBalance(
    _amount?: number,
  ): Promise<never> {
    throw new BadRequestException(
      'Use POST /maintenance/platform-withdraw so payouts are audited and idempotent.',
    )
  }

  // =====================================
  // HELPERS
  // =====================================

  private async findBusinessById(
    businessId: number,
  ) {
    const normalizedBusinessId =
      Number(businessId)

    if (
      !Number.isInteger(
        normalizedBusinessId,
      ) ||
      normalizedBusinessId < 1
    ) {
      throw new BadRequestException(
        'Business ID is invalid.',
      )
    }

    const business =
      await this.businessRepo
        .findOne({
          where: {
            id:
              normalizedBusinessId,
          },
        })

    if (!business) {
      throw new BadRequestException(
        'Business not found.',
      )
    }

    return business
  }

  /*
   * US-ONLY PRODUCTION LAUNCH
   *
   * India values remain supported by the Business
   * entity so Razorpay can be added later without a
   * destructive migration. Stripe itself is locked
   * to US/USD until that rollout is intentionally
   * enabled.
   */
  private getUsLaunchConfigurationIssue(
    business: Business,
  ) {
    const countryCode =
      String(
        business.countryCode ||
          '',
      )
        .trim()
        .toUpperCase()

    const currency =
      String(
        business.currency ||
          '',
      )
        .trim()
        .toLowerCase()

    if (
      countryCode !== 'US' ||
      currency !== 'usd'
    ) {
      return 'CaviarQR is currently launching in the United States only. Set this restaurant to US/USD before using Stripe.'
    }

    return null
  }

  private assertUsLaunchBusiness(
    business: Business,
  ) {
    const issue =
      this.getUsLaunchConfigurationIssue(
        business,
      )

    if (issue) {
      throw new BadRequestException(
        issue,
      )
    }
  }

  private async assertStripeAccountIsUs(
    accountId: string,
  ) {
    const account =
      await this.stripe
        .accounts.retrieve(
          accountId,
        )

    const stripeCountryCode =
      String(
        account.country ||
          '',
      )
        .trim()
        .toUpperCase()

    if (
      stripeCountryCode !==
      'US'
    ) {
      throw new BadRequestException(
        `Stripe account country ${stripeCountryCode || 'UNKNOWN'} is not supported during the CaviarQR US launch. Connect a US Stripe account.`,
      )
    }

    return account
  }

  private normalizeCustomerNote(
    value: unknown,
  ): string {
    if (
      value === undefined ||
      value === null
    ) {
      return ''
    }

    if (typeof value !== 'string') {
      throw new BadRequestException(
        'Item note must be text.',
      )
    }

    const note =
      value
        .replace(/\r\n?/g, '\n')
        .trim()

    if (note.length > 300) {
      throw new BadRequestException(
        'Item note must be 300 characters or fewer.',
      )
    }

    return note
  }

  private normalizeRequestedItems(
    items: CreateCheckoutDto['items'],
  ): RequestedItem[] {
    const itemBySignature =
      new Map<
        string,
        RequestedItem
      >()

    for (const item of items) {
      const id =
        Number(item.id)

      const qty =
        Number(item.qty)

      const note =
        this.normalizeCustomerNote(
          item.note,
        )

      const customizations =
        normalizeRequestedSelections(
          item.customizations,
        )

      if (
        !Number.isInteger(id) ||
        id < 1
      ) {
        throw new BadRequestException(
          'A menu item ID is invalid.',
        )
      }

      if (
        !Number.isInteger(qty) ||
        qty < 1 ||
        qty > 50
      ) {
        throw new BadRequestException(
          'Item quantity must be between 1 and 50.',
        )
      }

      const signature =
        JSON.stringify({
          id,
          note,
          customizations,
        })

      const existing =
        itemBySignature.get(
          signature,
        )

      if (existing) {
        const combinedQty =
          existing.qty + qty

        if (
          combinedQty > 50
        ) {
          throw new BadRequestException(
            'The combined quantity for one item variant cannot exceed 50.',
          )
        }

        existing.qty =
          combinedQty

        continue
      }

      itemBySignature.set(
        signature,
        {
          id,
          qty,

          ...(note
            ? {
                note,
              }
            : {}),

          ...(customizations.length
            ? {
                customizations,
              }
            : {}),
        },
      )
    }

    if (
      itemBySignature.size >
      99
    ) {
      throw new BadRequestException(
        'Cart contains too many different items.',
      )
    }

    return Array.from(
      itemBySignature.entries(),
    )
      .sort(
        (
          [leftKey],
          [rightKey],
        ) =>
          leftKey.localeCompare(
            rightKey,
          ),
      )
      .map(
        ([, value]) =>
          value,
      )
  }

  private createItemSignature(
    items: PendingOrderItem[],
  ) {
    const normalized =
      [...items]
        .map(
          (item) => ({
            id:
              item.id,

            qty:
              item.qty,

            note:
              String(
                item.note || '',
              ).trim(),

            customizations:
              Array.isArray(
                item.customizations,
              )
                ? item.customizations
                : [],

            unitPriceCents:
              item
                .unitPriceCents,
          }),
        )
        .sort(
          (left, right) =>
            JSON.stringify(
              left,
            ).localeCompare(
              JSON.stringify(
                right,
              ),
            ),
        )

    return JSON.stringify(
      normalized,
    )
  }

  private assertMatchingRetry(
    pendingOrder:
      PendingOrder,

    expected: {
      businessId: number
      storeCode: string
      tableNumber: number
      total: number
      currency: string
      itemSignature: string
      marketingOptIn: boolean
    },
  ) {
    const existingSignature =
      this.createItemSignature(
        pendingOrder.items ||
          [],
      )

    if (
      pendingOrder.businessId !==
        expected.businessId ||
      pendingOrder.storeCode !==
        expected.storeCode ||
      pendingOrder.tableNumber !==
        expected.tableNumber ||
      Number(
        pendingOrder.total,
      ) !== expected.total ||
      String(
        pendingOrder.currency ||
          '',
      ).toLowerCase() !==
        expected.currency ||
      existingSignature !==
        expected.itemSignature ||
      pendingOrder.marketingOptIn !==
        expected.marketingOptIn
    ) {
      throw new BadRequestException(
        'checkoutRequestId was already used for a different checkout.',
      )
    }
  }

  private getBusinessCurrency(
    value:
      | BusinessCurrency
      | string
      | null
      | undefined,
  ): 'usd' | 'inr' {
    const normalized =
      String(
        value ||
          '',
      ).toLowerCase()

    if (
      normalized ===
      BusinessCurrency.USD
    ) {
      return 'usd'
    }

    if (
      normalized ===
      BusinessCurrency.INR
    ) {
      return 'inr'
    }

    throw new BadRequestException(
      'Restaurant currency configuration is invalid.',
    )
  }

  private getBusinessCountryCode(
    value:
      | BusinessCountryCode
      | string
      | null
      | undefined,
  ): 'US' | 'IN' {
    const normalized =
      String(
        value ||
          '',
      ).toUpperCase()

    if (
      normalized ===
      BusinessCountryCode
        .UNITED_STATES
    ) {
      return 'US'
    }

    if (
      normalized ===
      BusinessCountryCode.INDIA
    ) {
      return 'IN'
    }

    throw new BadRequestException(
      'Restaurant country configuration is invalid.',
    )
  }

  private isUuid(
    value: string,
  ) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  }

  private isPostgresUniqueViolation(
    error: unknown,
  ) {
    if (
      !error ||
      typeof error !==
        'object'
    ) {
      return false
    }

    const possibleError =
      error as {
        code?: string
        driverError?: {
          code?: string
        }
      }

    return (
      possibleError.code ===
        '23505' ||
      possibleError
        .driverError
        ?.code ===
        '23505'
    )
  }

  private getErrorMessage(
    error: unknown,
  ) {
    if (
      error instanceof Error
    ) {
      return (
        error.message ||
        'Unknown error'
      )
    }

    return String(
      error ||
        'Unknown error',
    )
  }
}