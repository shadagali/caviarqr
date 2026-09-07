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
  Repository,
} from 'typeorm'

import {
  PlatformPayout,
} from './platform-payout.entity'

@Injectable()
export class PlatformPayoutService {
  private readonly logger =
    new Logger(
      PlatformPayoutService.name,
    )

  private readonly stripe: Stripe

  constructor(
    @InjectRepository(
      PlatformPayout,
    )
    private readonly payoutRepo:
      Repository<PlatformPayout>,
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

    this.stripe =
      new Stripe(
        key,
        {
          apiVersion:
            '2026-02-25.clover',
        },
      )
  }

  async getPlatformRevenue() {
    const [
      balance,
      records,
      stripePayouts,
    ] =
      await Promise.all([
        this.stripe
          .balance
          .retrieve(),

        this.payoutRepo.find({
          order: {
            createdAt:
              'DESC',
          },

          take: 25,
        }),

        this.stripe
          .payouts
          .list({
            limit: 25,
          }),
      ])

    const availableCents =
      balance.available
        .filter(
          entry =>
            entry.currency ===
            'usd',
        )
        .reduce(
          (
            total,
            entry,
          ) =>
            total +
            entry.amount,
          0,
        )

    const pendingCents =
      balance.pending
        .filter(
          entry =>
            entry.currency ===
            'usd',
        )
        .reduce(
          (
            total,
            entry,
          ) =>
            total +
            entry.amount,
          0,
        )

    const configuredReserve =
      Number(
        process.env
          .PLATFORM_PAYOUT_RESERVE_CENTS ||
          0,
      )

    const reserveCents =
      Number.isInteger(
        configuredReserve,
      ) &&
      configuredReserve > 0
        ? Math.min(
            configuredReserve,
            availableCents,
          )
        : 0

    const withdrawableCents =
      Math.max(
        0,
        availableCents -
          reserveCents,
      )

    const stripePayoutMap =
      new Map(
        stripePayouts.data.map(
          payout => [
            payout.id,
            payout,
          ],
        ),
      )

    return {
      success: true,

      available:
        this.toDollars(
          availableCents,
        ),

      pending:
        this.toDollars(
          pendingCents,
        ),

      reserve:
        this.toDollars(
          reserveCents,
        ),

      withdrawable:
        this.toDollars(
          withdrawableCents,
        ),

      /*
       * Kept for frontend
       * backwards compatibility.
       *
       * Platform balance now contains
       * both restaurant fees and
       * hardware-store revenue, so it
       * must not be mislabeled as only
       * restaurant net fees.
       */
      recordedNetFees: 0,

      currency: 'usd',

      payouts:
        records.map(
          record => {
            const stripePayout =
              record
                .stripePayoutId
                ? stripePayoutMap.get(
                    record
                      .stripePayoutId,
                  )
                : undefined

            return {
              id:
                String(
                  record.id,
                ),

              amount:
                this.toDollars(
                  record
                    .amountCents,
                ),

              currency:
                record.currency,

              status:
                stripePayout
                  ?.status ||
                record.status,

              stripePayoutId:
                record
                  .stripePayoutId,

              requestedBy:
                record
                  .requestedBy,

              failureMessage:
                record
                  .failureMessage,

              createdAt:
                record
                  .createdAt
                  .toISOString(),
            }
          },
        ),
    }
  }

  async withdrawPlatformBalance(
    body: {
      amountCents?: unknown
      idempotencyKey?: unknown
      requestedBy?: string
    },
  ) {
    const amountCents =
      Number(
        body
          ?.amountCents,
      )

    if (
      !Number.isInteger(
        amountCents,
      ) ||
      amountCents < 100
    ) {
      throw new BadRequestException(
        'Withdrawal must be at least $1.00.',
      )
    }

    const idempotencyKey =
      String(
        body
          ?.idempotencyKey ||
          '',
      ).trim()

    if (
      idempotencyKey.length <
        8 ||
      idempotencyKey.length >
        255
    ) {
      throw new BadRequestException(
        'A valid payout idempotency key is required.',
      )
    }

    const requestedBy =
      String(
        body
          ?.requestedBy ||
          'MAINTENANCE_ADMIN',
      )
        .trim()
        .slice(
          0,
          120,
        )

    let record =
      await this.payoutRepo
        .findOne({
          where: {
            idempotencyKey,
          },
        })

    if (
      record?.stripePayoutId
    ) {
      return this
        .payoutResponse(
          record,
        )
    }

    if (
      record?.status ===
      'FAILED'
    ) {
      throw new BadRequestException(
        record.failureMessage ||
          'This payout request previously failed.',
      )
    }

    /*
     * Existing CREATING / UNKNOWN requests
     * must retry using the SAME Stripe
     * idempotency key. This safely resolves
     * connection-loss / unknown-outcome cases
     * without creating a second payout.
     */
    if (
      record &&
      (
        record.status ===
          'CREATING' ||
        record.status ===
          'UNKNOWN'
      )
    ) {
      return this
        .executeStripePayout(
          record,
          String(
            record.requestedBy ||
              'MAINTENANCE_ADMIN',
          ),
        )
    }

    const balance =
      await this.stripe
        .balance
        .retrieve()

    const availableCents =
      balance.available
        .filter(
          entry =>
            entry.currency ===
            'usd',
        )
        .reduce(
          (
            total,
            entry,
          ) =>
            total +
            entry.amount,
          0,
        )

    const configuredReserve =
      Number(
        process.env
          .PLATFORM_PAYOUT_RESERVE_CENTS ||
          0,
      )

    const reserveCents =
      Number.isInteger(
        configuredReserve,
      ) &&
      configuredReserve > 0
        ? Math.min(
            configuredReserve,
            availableCents,
          )
        : 0

    const withdrawableCents =
      Math.max(
        0,
        availableCents -
          reserveCents,
      )

    if (
      amountCents >
      withdrawableCents
    ) {
      throw new BadRequestException(
        `Maximum available withdrawal is $${(
          withdrawableCents /
          100
        ).toFixed(2)}.`,
      )
    }

    if (!record) {
      record =
        await this
          .payoutRepo
          .save(
            this
              .payoutRepo
              .create({
                amountCents,

                currency:
                  'usd',

                status:
                  'CREATING',

                stripePayoutId:
                  null,

                idempotencyKey,

                requestedBy,

                failureMessage:
                  null,
              }),
          )
    } else if (
      record.amountCents !==
      amountCents
    ) {
      throw new BadRequestException(
        'This payout request ID was already used for a different amount.',
      )
    }

    return this
      .executeStripePayout(
        record,
        requestedBy,
      )
  }

  private async executeStripePayout(
    record: PlatformPayout,
    requestedBy: string,
  ) {
    const amountCents =
      record.amountCents

    const idempotencyKey =
      record.idempotencyKey

    try {
      const payout =
        await this.stripe
          .payouts
          .create(
            {
              amount:
                amountCents,

              currency:
                'usd',

              metadata: {
                source:
                  'caviarqr_platform_withdrawal',

                localPayoutId:
                  String(
                    record.id,
                  ),

                requestedBy,
              },
            },
            {
              idempotencyKey,
            },
          )

      record.stripePayoutId =
        payout.id

      record.status =
        payout.status

      record.failureMessage =
        null

      await this
        .payoutRepo
        .save(
          record,
        )

      this.logger.log(
        `PLATFORM_PAYOUT_CREATED ${record.id} ${payout.id}`,
      )

      return this
        .payoutResponse(
          record,
        )
    } catch (error: any) {
      const message =
        String(
          error?.message ||
          'Stripe payout failed.',
        )

      const outcomeUnknown =
        error?.type ===
          'StripeConnectionError' ||
        error?.type ===
          'StripeAPIError'

      record.status =
        outcomeUnknown
          ? 'UNKNOWN'
          : 'FAILED'

      record.failureMessage =
        message

      await this
        .payoutRepo
        .save(
          record,
        )

      this.logger.error(
        `PLATFORM_PAYOUT_FAILED ${record.id}: ${message}`,
        error instanceof Error
          ? error.stack
          : undefined,
      )

      if (outcomeUnknown) {
        throw new BadRequestException(
          'Stripe payout outcome is unknown. Check Stripe before starting a new payout request.',
        )
      }

      throw new BadRequestException(
        `Stripe payout failed: ${message}`,
      )
    }
  }

  private payoutResponse(
    record:
      PlatformPayout,
  ) {
    return {
      success: true,

      id:
        String(
          record.id,
        ),

      amount:
        this.toDollars(
          record
            .amountCents,
        ),

      amountCents:
        record
          .amountCents,

      currency:
        record.currency,

      payoutId:
        record
          .stripePayoutId,

      status:
        record.status,

      createdAt:
        record
          .createdAt
          ?.toISOString(),
    }
  }

  private toDollars(
    cents: number,
  ) {
    return Number(
      (
        Number(cents || 0) /
        100
      ).toFixed(2),
    )
  }
}
