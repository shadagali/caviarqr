import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import Stripe from 'stripe'

import {
  DataSource,
  Repository,
} from 'typeorm'

import {
  SalesPartner,
  SalesPartnerStatus,
} from './entities/sales-partner.entity'

import {
  SalesPartnerAgreement,
} from './entities/sales-partner-agreement.entity'

import {
  LegalDocument,
} from '../maintenance/legal-document.entity'

import {
  SalesPayout,
  SalesPayoutStatus,
} from './entities/sales-payout.entity'

import {
  SalesPayoutService,
} from './sales-payout.service'

type SalesStripeStatus = {
  connected: boolean
  detailsSubmitted: boolean
  payoutsEnabled: boolean
  transfersCapability:
    | 'active'
    | 'inactive'
    | 'pending'
    | null
  ready: boolean
  disabledReason: string | null
  currentlyDue: string[]
  message: string | null
}

@Injectable()
export class SalesStripeService {
  private readonly logger =
    new Logger(
      SalesStripeService.name,
    )

  private readonly stripe:
    Stripe

  private readonly frontendUrl =
    String(
      process.env.FRONTEND_URL ||
        process.env.WEB_URL ||
        'http://localhost:3000',
    ).replace(/\/+$/, '')

  private readonly salesPortalUrl =
    String(
      process.env
        .SALES_PARTNER_PORTAL_URL ||
        `${this.frontendUrl}/sales`,
    ).replace(/\/+$/, '')

  constructor(
    @InjectRepository(
      SalesPartner,
    )
    private readonly partnerRepo:
      Repository<SalesPartner>,

    @InjectRepository(
      SalesPartnerAgreement,
    )
    private readonly agreementRepo:
      Repository<SalesPartnerAgreement>,

    private readonly dataSource:
      DataSource,

    private readonly salesPayoutService:
      SalesPayoutService,
  ) {
    const key =
      process.env
        .STRIPE_SECRET_KEY

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
      !key.startsWith(
        'sk_live_',
      )
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
      !this.salesPortalUrl
        .startsWith(
          'https://',
        )
    ) {
      throw new Error(
        'Production Sales Partner portal URL must use HTTPS.',
      )
    }

    this.stripe =
      new Stripe(
        key,
        {
          apiVersion:
            '2026-02-25.clover',
        },
      )

    this.logger.log(
      'Sales Partner Stripe initialized from environment.',
    )
  }

  private async getPartner(
    salesPartnerId:
      number,
  ) {
    const partner =
      await this.partnerRepo
        .findOne({
          where: {
            id:
              salesPartnerId,
          },
        })

    if (!partner) {
      throw new BadRequestException(
        'Sales Partner account was not found.',
      )
    }

    return partner
  }

  private async currentAgreement() {
    const agreement =
      await this.dataSource
        .getRepository(
          LegalDocument,
        )
        .findOne({
          where: {
            documentType:
              'SALES_PARTNER_AGREEMENT',

            status:
              'PUBLISHED',
          },
        })

    if (!agreement) {
      throw new BadRequestException(
        'The current Sales Partner Agreement is unavailable.',
      )
    }

    return {
      agreementVersion:
        agreement.version,

      agreementHash:
        agreement.contentHash,
    }
  }

  private async assertCurrentAgreementAccepted(
    salesPartnerId:
      number,
  ) {
    const {
      agreementVersion,
      agreementHash,
    } =
      await this.currentAgreement()

    const agreement =
      await this.agreementRepo
        .findOne({
          where: {
            salesPartnerId,
            agreementVersion,
          },
        })

    if (
      !agreement ||
      String(
        agreement
          .agreementHash ||
          '',
      ).toLowerCase() !==
        agreementHash
    ) {
      throw new BadRequestException(
        'Accept the current Independent Sales Partner Agreement before connecting Stripe.',
      )
    }
  }

  private statusFromAccount(
    account: Stripe.Account,
  ): SalesStripeStatus {
    const transfersCapability =
      account.capabilities
        ?.transfers ??
      null

    const detailsSubmitted =
      Boolean(
        account
          .details_submitted,
      )

    const payoutsEnabled =
      Boolean(
        account
          .payouts_enabled,
      )

    const countryOk =
      String(
        account.country ||
          '',
      ).toUpperCase() ===
        'US'

    const expressOk =
      account.type ===
        'express'

    const ready =
      countryOk &&
      expressOk &&
      detailsSubmitted &&
      payoutsEnabled &&
      transfersCapability ===
        'active'

    const disabledReason =
      account.requirements
        ?.disabled_reason ??
      null

    const currentlyDue =
      Array.isArray(
        account.requirements
          ?.currently_due,
      )
        ? account
            .requirements!
            .currently_due!
        : []

    let message:
      string | null = null

    if (!expressOk) {
      message =
        'Sales Partner Stripe account must be an Express account.'
    } else if (!countryOk) {
      message =
        'Sales Partner payouts currently require a United States Stripe account.'
    } else if (
      transfersCapability ===
      'pending'
    ) {
      message =
        'Stripe is reviewing payout eligibility.'
    } else if (
      transfersCapability !==
      'active'
    ) {
      message =
        'Stripe transfers are not enabled yet.'
    } else if (
      !detailsSubmitted
    ) {
      message =
        'Stripe onboarding is incomplete.'
    } else if (
      !payoutsEnabled
    ) {
      message =
        'Stripe payouts are not enabled yet.'
    }

    return {
      connected:
        true,

      detailsSubmitted,

      payoutsEnabled,

      transfersCapability,

      ready,

      disabledReason,

      currentlyDue,

      message,
    }
  }

  private async persistStatus(
    partner:
      SalesPartner,

    status:
      SalesStripeStatus,
  ) {
    partner
      .stripeDetailsSubmitted =
      status.detailsSubmitted

    partner
      .stripePayoutsEnabled =
      status.payoutsEnabled

    partner
      .stripeAccountReady =
      status.ready

    partner
      .stripeLastCheckedAt =
      new Date()

    await this.partnerRepo
      .save(partner)
  }

  async status(
    salesPartnerId:
      number,
  ): Promise<SalesStripeStatus> {
    const partner =
      await this.getPartner(
        salesPartnerId,
      )

    if (
      !partner
        .stripeAccountId
    ) {
      return {
        connected:
          false,

        detailsSubmitted:
          false,

        payoutsEnabled:
          false,

        transfersCapability:
          null,

        ready:
          false,

        disabledReason:
          null,

        currentlyDue:
          [],

        message:
          'Stripe payout account is not connected.',
      }
    }

    let retrieved:
      Stripe.Account |
      Stripe.DeletedAccount

    try {
      retrieved =
        await this.stripe
          .accounts
          .retrieve(
            partner
              .stripeAccountId,
          )
    } catch (error) {
      this.logger.error(
        `Unable to retrieve Sales Partner Stripe account for partner ${partner.id}.`,
      )

      throw new BadRequestException(
        'Unable to check Stripe payout status right now.',
      )
    }

    if (
      (
        retrieved as unknown as
          Stripe.DeletedAccount
      ).deleted
    ) {
      partner
        .stripeDetailsSubmitted =
        false

      partner
        .stripePayoutsEnabled =
        false

      partner
        .stripeAccountReady =
        false

      partner
        .stripeLastCheckedAt =
        new Date()

      await this.partnerRepo
        .save(partner)

      return {
        connected:
          false,

        detailsSubmitted:
          false,

        payoutsEnabled:
          false,

        transfersCapability:
          null,

        ready:
          false,

        disabledReason:
          'account_deleted',

        currentlyDue:
          [],

        message:
          'Stripe payout account is no longer available.',
      }
    }

    const account =
      retrieved as
        Stripe.Account

    /*
     * A Sales Partner account is deliberately
     * separate from restaurant merchant
     * accounts. Metadata protects against
     * accidentally attaching the wrong
     * connected account to a partner.
     */
    const metadataPartnerId =
      String(
        account.metadata
          ?.salesPartnerId ||
          '',
      )

    const metadataRole =
      String(
        account.metadata
          ?.caviarqrRole ||
          '',
      )

    if (
      metadataPartnerId !==
        String(
          partner.id,
        ) ||
      metadataRole !==
        'sales_partner'
    ) {
      throw new BadRequestException(
        'Stripe account does not belong to this Sales Partner.',
      )
    }

    const status =
      this.statusFromAccount(
        account,
      )

    await this.persistStatus(
      partner,
      status,
    )

    return status
  }

  async createOnboardingLink(
    salesPartnerId:
      number,
  ) {
    const partner =
      await this.getPartner(
        salesPartnerId,
      )

    await this
      .assertCurrentAgreementAccepted(
        partner.id,
      )

    let accountId =
      partner
        .stripeAccountId

    if (!accountId) {
      let account:
        Stripe.Account

      try {
        account =
          await this.stripe
            .accounts
            .create(
              {
                type:
                  'express',

                country:
                  'US',

                default_currency:
                  'usd',

                /*
                 * Sales Partners are recipients of
                 * commission transfers only. They do
                 * not process restaurant card payments.
                 */
                tos_acceptance: {
                  service_agreement:
                    'recipient',
                },

                email:
                  partner.email,

                /*
                 * Sales Partners receive
                 * commission payouts only.
                 * They do NOT process
                 * restaurant customer cards.
                 */
                capabilities: {
                  transfers: {
                    requested:
                      true,
                  },
                },

                metadata: {
                  caviarqrRole:
                    'sales_partner',

                  salesPartnerId:
                    String(
                      partner.id,
                    ),

                  referralCode:
                    partner
                      .referralCode,
                },
              },

              {
                /*
                 * Prevent duplicate Express
                 * accounts if the request is
                 * retried or double-clicked.
                 */
                idempotencyKey:
                  `caviarqr-sales-partner-${partner.id}-express-v1`,
              },
            )
      } catch (error: any) {
        /*
         * Record Stripe's safe diagnostic fields.
         * Never log the API secret or full request.
         */
        const stripeType =
          String(
            error?.type ||
            error?.raw?.type ||
            'unknown',
          )
            .replace(/[\\r\\n]/g, ' ')
            .slice(0, 100)

        const stripeCode =
          String(
            error?.code ||
            error?.raw?.code ||
            'unknown',
          )
            .replace(/[\\r\\n]/g, ' ')
            .slice(0, 100)

        const stripeMessage =
          String(
            error?.message ||
            error?.raw?.message ||
            'unknown',
          )
            .replace(/[\\r\\n]/g, ' ')
            .slice(0, 500)

        const stripeRequestId =
          String(
            error?.requestId ||
            error?.raw?.requestId ||
            'unknown',
          )
            .replace(/[\\r\\n]/g, ' ')
            .slice(0, 120)

        this.logger.error(
          `Unable to create Sales Partner Stripe account for partner ${partner.id}. stripeType=${stripeType} stripeCode=${stripeCode} stripeRequestId=${stripeRequestId} stripeMessage=${stripeMessage}`,
        )

        throw new BadRequestException(
          'Unable to create Stripe payout account right now.',
        )
      }

      accountId =
        account.id

      partner
        .stripeAccountId =
        account.id

      const initialStatus =
        this.statusFromAccount(
          account,
        )

      await this.persistStatus(
        partner,
        initialStatus,
      )
    }

    /*
     * Validate an existing account before
     * generating another onboarding URL.
     */
    if (
      partner
        .stripeAccountId
    ) {
      await this.status(
        partner.id,
      )
    }

    try {
      const link =
        await this.stripe
          .accountLinks
          .create({
            account:
              accountId,

            refresh_url:
              `${this.salesPortalUrl}?stripe=refresh`,

            return_url:
              `${this.salesPortalUrl}?stripe=return`,

            type:
              'account_onboarding',

            collection_options: {
              fields:
                'eventually_due',

              future_requirements:
                'include',
            },
          })

      return {
        success:
          true,

        url:
          link.url,

        expiresAt:
          link.expires_at,
      }
    } catch (error) {
      this.logger.error(
        `Unable to create Sales Partner Stripe onboarding link for partner ${partner.id}.`,
      )

      throw new BadRequestException(
        'Unable to start Stripe onboarding right now.',
      )
    }
  }

  async createDashboardLink(
    salesPartnerId:
      number,
  ) {
    const partner =
      await this.getPartner(
        salesPartnerId,
      )

    if (
      !partner
        .stripeAccountId
    ) {
      throw new BadRequestException(
        'Connect Stripe before opening the payout dashboard.',
      )
    }

    /*
     * Re-check ownership and current
     * readiness before issuing a
     * Stripe Express Dashboard link.
     */
    const status =
      await this.status(
        partner.id,
      )

    if (!status.connected) {
      throw new BadRequestException(
        'Stripe payout account is unavailable.',
      )
    }

    try {
      const link =
        await this.stripe
          .accounts
          .createLoginLink(
            partner
              .stripeAccountId,
          )

      return {
        success:
          true,

        url:
          link.url,
      }
    } catch (error) {
      this.logger.error(
        `Unable to create Sales Partner Stripe dashboard link for partner ${partner.id}.`,
      )

      throw new BadRequestException(
        'Unable to open the Stripe payout dashboard right now.',
      )
    }
  }

  /*
   * Execute or reconcile one Sales Partner
   * Stripe Transfer.
   *
   * IMPORTANT:
   *
   * - beginPayoutProcessing() freezes the
   *   destination account before we get here.
   *
   * - The persisted payout idempotency key is
   *   reused for every Stripe create retry.
   *
   * - transfer_group gives us a durable Stripe
   *   reconciliation key even if an earlier
   *   network response was lost.
   *
   * - A database row lock serializes the
   *   Stripe list/create section so two workers
   *   cannot independently create the same
   *   payout at the same time.
   *
   * - Any uncertain Stripe error leaves the
   *   payout PROCESSING. Exact commission units
   *   are NOT released automatically.
   *
   * This method is intentionally not exposed
   * through SalesController yet.
   */
  async executePayoutTransfer(
    payoutId:
      string | number,
  ) {
    const normalizedPayoutId =
      String(
        payoutId,
      ).trim()

    if (
      !/^[1-9][0-9]*$/.test(
        normalizedPayoutId,
      )
    ) {
      throw new Error(
        'A valid Sales payout id is required.',
      )
    }

    /*
     * Make already-completed execution retries
     * idempotent without beginning a new Stripe
     * operation.
     */
    const existingPayout =
      await this.dataSource
        .getRepository(
          SalesPayout,
        )
        .findOne({
          where: {
            id:
              normalizedPayoutId,
          },
        })

    if (!existingPayout) {
      throw new Error(
        `Sales payout ${normalizedPayoutId} was not found.`,
      )
    }

    if (
      existingPayout.status ===
      SalesPayoutStatus.PAID
    ) {
      const existingTransferId =
        String(
          existingPayout
            .stripeTransferId ||
            '',
        ).trim()

      if (
        !/^tr_[A-Za-z0-9_]+$/.test(
          existingTransferId,
        )
      ) {
        throw new Error(
          `Sales payout ${existingPayout.id} is PAID without a valid Stripe Transfer id.`,
        )
      }

      return {
        payoutId:
          existingPayout.id,

        status:
          existingPayout.status,

        stripeTransferId:
          existingTransferId,

        alreadyPaid:
          true,
      }
    }

    if (
      existingPayout.status ===
      SalesPayoutStatus.FAILED
    ) {
      throw new Error(
        `Sales payout ${existingPayout.id} is FAILED and cannot be transferred.`,
      )
    }

    /*
     * PENDING -> PROCESSING freezes the Stripe
     * destination.
     *
     * PROCESSING retry returns the exact same
     * destination and idempotency key.
     */
    await this.salesPayoutService
      .beginPayoutProcessing(
        normalizedPayoutId,
      )

    let confirmedTransferId:
      string

    /*
     * Hold a PostgreSQL payout-row lock across
     * Stripe reconciliation/create.
     *
     * This is deliberately conservative. Payout
     * volume is low relative to restaurant-order
     * traffic and correctness is more important
     * than parallelizing two workers for the same
     * payout.
     */
    confirmedTransferId =
      await this.dataSource
        .transaction(
          async (manager) => {
            const payoutRepo =
              manager.getRepository(
                SalesPayout,
              )

            const partnerRepo =
              manager.getRepository(
                SalesPartner,
              )

            /*
             * Match the canonical Sales payout
             * lock order used everywhere else:
             *
             *   Sales Partner -> Sales payout
             *
             * This prevents lock inversion with
             * reservation, failure release, and
             * successful-payout finalization.
             */
            const partner =
              await partnerRepo
                .createQueryBuilder(
                  'partner',
                )
                .setLock(
                  'pessimistic_write',
                )
                .where(
                  'partner.id = :salesPartnerId',
                  {
                    salesPartnerId:
                      existingPayout
                        .salesPartnerId,
                  },
                )
                .getOne()

            if (!partner) {
              throw new Error(
                `Sales Partner ${existingPayout.salesPartnerId} was not found during Stripe execution.`,
              )
            }

            const payout =
              await payoutRepo
                .createQueryBuilder(
                  'payout',
                )
                .setLock(
                  'pessimistic_write',
                )
                .where(
                  'payout.id = :payoutId',
                  {
                    payoutId:
                      normalizedPayoutId,
                  },
                )
                .getOne()

            if (!payout) {
              throw new Error(
                `Sales payout ${normalizedPayoutId} disappeared during Stripe execution.`,
              )
            }

            if (
              payout.salesPartnerId !==
              partner.id
            ) {
              throw new Error(
                `Sales payout ${payout.id} changed Sales Partner during Stripe execution.`,
              )
            }

            /*
             * Another worker may have completed
             * while this worker was waiting for
             * the row lock.
             */
            if (
              payout.status ===
              SalesPayoutStatus.PAID
            ) {
              const paidTransferId =
                String(
                  payout
                    .stripeTransferId ||
                    '',
                ).trim()

              if (
                !/^tr_[A-Za-z0-9_]+$/.test(
                  paidTransferId,
                )
              ) {
                throw new Error(
                  `Sales payout ${payout.id} is PAID without a valid Stripe Transfer id.`,
                )
              }

              return paidTransferId
            }

            if (
              payout.status ===
              SalesPayoutStatus.FAILED
            ) {
              throw new Error(
                `Sales payout ${payout.id} became FAILED during Stripe execution.`,
              )
            }

            if (
              payout.status !==
              SalesPayoutStatus.PROCESSING
            ) {
              throw new Error(
                `Sales payout ${payout.id} must be PROCESSING before Stripe execution.`,
              )
            }

            const destination =
              String(
                payout
                  .stripeDestinationAccountId ||
                  '',
              ).trim()

            if (
              !/^acct_[A-Za-z0-9]+$/.test(
                destination,
              )
            ) {
              throw new Error(
                `Sales payout ${payout.id} has no valid frozen Stripe destination.`,
              )
            }

            const currency =
              String(
                payout.currency ||
                  '',
              ).toLowerCase()

            if (currency !== 'usd') {
              throw new Error(
                `Sales payout ${payout.id} is not USD.`,
              )
            }

            if (
              !Number.isInteger(
                payout.amountCents,
              ) ||
              payout.amountCents <=
                0
            ) {
              throw new Error(
                `Sales payout ${payout.id} has an invalid amount.`,
              )
            }

            const idempotencyKey =
              String(
                payout
                  .idempotencyKey ||
                  '',
              ).trim()

            if (!idempotencyKey) {
              throw new Error(
                `Sales payout ${payout.id} has no idempotency key.`,
              )
            }

            /*
             * Stable, deterministic reconciliation
             * key. One transfer_group belongs to
             * exactly one CaviarQR payout id.
             */
            const transferGroup =
              `caviarqr-sales-payout-${payout.id}`

            const validateTransfer =
              (
                transfer:
                  Stripe.Transfer,
              ) => {
                const transferDestination =
                  typeof transfer
                    .destination ===
                  'string'
                    ? transfer
                        .destination
                    : String(
                        transfer
                          .destination
                          ?.id ||
                          '',
                      )

                if (
                  transfer.amount !==
                    payout.amountCents ||
                  String(
                    transfer.currency ||
                      '',
                  ).toLowerCase() !==
                    currency ||
                  transferDestination !==
                    destination ||
                  String(
                    transfer
                      .transfer_group ||
                      '',
                  ) !==
                    transferGroup ||
                  String(
                    transfer
                      .metadata
                      ?.caviarqrSalesPayoutId ||
                      '',
                  ) !==
                    String(
                      payout.id,
                    ) ||
                  String(
                    transfer
                      .metadata
                      ?.caviarqrSalesPartnerId ||
                      '',
                  ) !==
                    String(
                      payout
                        .salesPartnerId,
                    )
                ) {
                  throw new Error(
                    `Stripe Transfer ${transfer.id} does not exactly match Sales payout ${payout.id}.`,
                  )
                }

                if (
                  transfer.reversed ===
                    true ||
                  Number(
                    transfer
                      .amount_reversed ||
                      0,
                  ) !== 0
                ) {
                  throw new Error(
                    `Stripe Transfer ${transfer.id} for Sales payout ${payout.id} has been reversed and requires manual review.`,
                  )
                }

                return transfer.id
              }

            /*
             * If the Transfer id was already
             * persisted, retrieve exactly that
             * Stripe object and verify every
             * immutable accounting field.
             */
            if (
              payout
                .stripeTransferId
            ) {
              const transfer =
                await this.stripe
                  .transfers
                  .retrieve(
                    payout
                      .stripeTransferId,
                  )

              return validateTransfer(
                transfer,
              )
            }

            /*
             * Reconcile by transfer_group BEFORE
             * creating anything.
             *
             * This handles the critical case where
             * Stripe accepted an earlier request
             * but CaviarQR lost the response before
             * stripeTransferId was persisted.
             */
            const priorTransfers =
              await this.stripe
                .transfers
                .list({
                  transfer_group:
                    transferGroup,

                  limit:
                    100,
                })

            if (
              priorTransfers
                .has_more
            ) {
              throw new Error(
                `Too many Stripe Transfers exist for Sales payout ${payout.id}; manual review is required.`,
              )
            }

            if (
              priorTransfers
                .data
                .length >
              1
            ) {
              throw new Error(
                `Multiple Stripe Transfers exist for Sales payout ${payout.id}; manual review is required.`,
              )
            }

            let transfer:
              Stripe.Transfer

            if (
              priorTransfers
                .data
                .length ===
              1
            ) {
              transfer =
                priorTransfers
                  .data[0]
            } else {
              /*
               * There is no existing Stripe
               * Transfer to reconcile.
               *
               * Everything below this point is
               * therefore a NEW money-moving
               * operation and receives stricter
               * live eligibility checks.
               */

              /*
               * Global payout kill switch.
               *
               * Reconciliation above remains
               * available even while new payouts
               * are disabled, but no new Transfer
               * may be created unless explicitly
               * enabled.
               */
              if (
                String(
                  process.env
                    .SALES_PAYOUTS_ENABLED ||
                    '',
                ).toLowerCase() !==
                'true'
              ) {
                throw new Error(
                  'New Sales payouts are disabled by configuration.',
                )
              }

              if (
                partner.status !==
                SalesPartnerStatus.ACTIVE
              ) {
                throw new Error(
                  `Sales Partner ${partner.id} is not ACTIVE; no new Stripe Transfer was created.`,
                )
              }

              /*
               * The payout destination is frozen
               * for retry safety, but before the
               * FIRST Transfer we also require it
               * to remain the partner's current
               * account.
               *
               * If the partner intentionally
               * changed accounts before money
               * moved, this payout requires manual
               * review rather than paying an old
               * account automatically.
               */
              if (
                String(
                  partner
                    .stripeAccountId ||
                    '',
                ).trim() !==
                destination
              ) {
                throw new Error(
                  `Sales payout ${payout.id} frozen Stripe destination is no longer the Sales Partner's current account; manual review is required.`,
                )
              }

              /*
               * Do not trust cached readiness
               * booleans for a money-moving call.
               *
               * Retrieve the exact FROZEN acct_
               * directly from Stripe immediately
               * before creating the Transfer.
               */
              let retrievedDestination:
                Stripe.Account |
                Stripe.DeletedAccount

              try {
                retrievedDestination =
                  await this.stripe
                    .accounts
                    .retrieve(
                      destination,
                    )
              } catch (error) {
                this.logger.error(
                  `Unable to verify frozen Stripe destination ${destination} for Sales payout ${payout.id}.`,
                )

                /*
                 * Do NOT fail/release the payout.
                 * PROCESSING remains reserved and
                 * can safely be retried.
                 */
                throw new Error(
                  `Unable to verify Stripe destination for Sales payout ${payout.id}; payout remains PROCESSING.`,
                )
              }

              if (
                (
                  retrievedDestination as unknown as
                    Stripe.DeletedAccount
                ).deleted
              ) {
                throw new Error(
                  `Frozen Stripe destination for Sales payout ${payout.id} has been deleted; no new Transfer was created.`,
                )
              }

              const destinationAccount =
                retrievedDestination as
                  Stripe.Account

              if (
                destinationAccount.id !==
                destination
              ) {
                throw new Error(
                  `Stripe returned the wrong destination account for Sales payout ${payout.id}.`,
                )
              }

              const metadataPartnerId =
                String(
                  destinationAccount
                    .metadata
                    ?.salesPartnerId ||
                    '',
                )

              const metadataRole =
                String(
                  destinationAccount
                    .metadata
                    ?.caviarqrRole ||
                    '',
                )

              if (
                metadataPartnerId !==
                  String(
                    payout
                      .salesPartnerId,
                  ) ||
                metadataRole !==
                  'sales_partner'
              ) {
                throw new Error(
                  `Frozen Stripe destination does not belong to Sales Partner ${payout.salesPartnerId}; no new Transfer was created.`,
                )
              }

              const liveDestinationStatus =
                this.statusFromAccount(
                  destinationAccount,
                )

              if (
                !liveDestinationStatus
                  .ready
              ) {
                throw new Error(
                  `Stripe destination for Sales payout ${payout.id} is not currently payout-ready; no new Transfer was created.`,
                )
              }

              /*
               * Only this branch can move money.
               *
               * Partner + payout row locks prevent
               * concurrent CaviarQR workers from
               * reaching it for the same payout.
               *
               * Stripe also receives the payout's
               * stable persisted idempotency key.
               */
              transfer =
                await this.stripe
                  .transfers
                  .create(
                    {
                      amount:
                        payout
                          .amountCents,

                      currency,

                      destination,

                      transfer_group:
                        transferGroup,

                      metadata: {
                        caviarqrRole:
                          'sales_partner_payout',

                        caviarqrSalesPayoutId:
                          String(
                            payout.id,
                          ),

                        caviarqrSalesPartnerId:
                          String(
                            payout
                              .salesPartnerId,
                          ),
                      },
                    },

                    {
                      idempotencyKey,
                    },
                  )
            }

            const transferId =
              validateTransfer(
                transfer,
              )

            /*
             * Persist Stripe's Transfer id while
             * still holding the payout row lock.
             *
             * If CaviarQR crashes after Stripe
             * succeeds but before this save,
             * the next retry reconciles via the
             * transfer_group above.
             */
            payout.stripeTransferId =
              transferId

            await payoutRepo.save(
              payout,
            )

            return transferId
          },
        )

    /*
     * The external Stripe operation and Transfer
     * id are now settled. Final commission status
     * transitions happen atomically in the
     * already-tested payout finalizer.
     */
    return this.salesPayoutService
      .markPayoutPaid(
        normalizedPayoutId,
        confirmedTransferId,
      )
  }

}
