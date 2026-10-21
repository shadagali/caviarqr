import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common'

import {
  DataSource,
  EntityManager,
} from 'typeorm'

import {
  Order,
  OrderStatus,
} from '../order/order.entity'

import {
  Business,
} from '../business/business.entity'

import {
  SalesPartner,
  SalesPartnerStatus,
} from './entities/sales-partner.entity'

import {
  SalesCommission,
  SalesCommissionStatus,
} from './entities/sales-commission.entity'

@Injectable()
export class SalesCommissionService {
  private readonly logger =
    new Logger(
      SalesCommissionService.name,
    )

  constructor(
    private readonly dataSource:
      DataSource,
  ) {}

  private utcMonthBounds(
    value: Date,
  ) {
    const start =
      new Date(
        Date.UTC(
          value.getUTCFullYear(),
          value.getUTCMonth(),
          1,
          0,
          0,
          0,
          0,
        ),
      )

    const end =
      new Date(
        Date.UTC(
          value.getUTCFullYear(),
          value.getUTCMonth() + 1,
          1,
          0,
          0,
          0,
          0,
        ),
      )

    return {
      start,
      end,
    }
  }

  /*
   * Maintenance overview for every Sales Partner.
   * The current month is always a UTC calendar month.
   */
  async getMaintenanceSalesPartners() {
    const partnerRepo =
      this.dataSource.getRepository(
        SalesPartner,
      )

    const businessRepo =
      this.dataSource.getRepository(
        Business,
      )

    const commissionRepo =
      this.dataSource.getRepository(
        SalesCommission,
      )

    const now = new Date()
    const { start, end } =
      this.utcMonthBounds(now)

    const partners =
      await partnerRepo.find({
        order: {
          id: 'ASC',
        },
      })

    const commissionRows =
      await commissionRepo
        .createQueryBuilder(
          'commission',
        )
        .select(
          'commission.salesPartnerId',
          'salesPartnerId',
        )
        .addSelect(
          'COALESCE(SUM(commission.commissionUnits), 0)',
          'commissionUnits',
        )
        .where(
          'commission.earnedAt >= :start',
          { start },
        )
        .andWhere(
          'commission.earnedAt < :end',
          { end },
        )
        .andWhere(
          'commission.status IN (:...statuses)',
          {
            statuses: [
              SalesCommissionStatus.PENDING,
              SalesCommissionStatus.AVAILABLE,
              SalesCommissionStatus.PAYOUT_PENDING,
              SalesCommissionStatus.PAID,
            ],
          },
        )
        .groupBy(
          'commission.salesPartnerId',
        )
        .getRawMany()

    const cafeRows =
      await businessRepo
        .createQueryBuilder(
          'business',
        )
        .select(
          'business.salesPartnerId',
          'salesPartnerId',
        )
        .addSelect(
          'COUNT(business.id)',
          'attributedCafeCount',
        )
        .addSelect(
          `COUNT(business.id) FILTER (
            WHERE business.salesCommissionTerminatedAt IS NULL
          )`,
          'activeCafeCount',
        )
        .addSelect(
          `COUNT(business.id) FILTER (
            WHERE business.salesCommissionTerminatedAt IS NOT NULL
          )`,
          'terminatedCafeCount',
        )
        .where(
          'business.salesPartnerId IS NOT NULL',
        )
        .groupBy(
          'business.salesPartnerId',
        )
        .getRawMany()

    const commissionByPartner =
      new Map<number, bigint>()

    for (const row of commissionRows) {
      const partnerId =
        Number(
          row.salesPartnerId,
        )

      if (
        Number.isInteger(partnerId) &&
        partnerId > 0
      ) {
        commissionByPartner.set(
          partnerId,
          BigInt(
            String(
              row.commissionUnits ||
                '0',
            ),
          ),
        )
      }
    }

    const cafesByPartner =
      new Map<number, {
        attributedCafeCount: number
        activeCafeCount: number
        terminatedCafeCount: number
      }>()

    for (const row of cafeRows) {
      const partnerId =
        Number(
          row.salesPartnerId,
        )

      if (
        Number.isInteger(partnerId) &&
        partnerId > 0
      ) {
        cafesByPartner.set(
          partnerId,
          {
            attributedCafeCount:
              Number(
                row.attributedCafeCount ||
                  0,
              ),
            activeCafeCount:
              Number(
                row.activeCafeCount ||
                  0,
              ),
            terminatedCafeCount:
              Number(
                row.terminatedCafeCount ||
                  0,
              ),
          },
        )
      }
    }

    return {
      monthStart:
        start.toISOString(),
      monthEnd:
        end.toISOString(),
      partners:
        partners.map(
          (partner) => {
            const earnedUnits =
              commissionByPartner.get(
                partner.id,
              ) || 0n

            const capCents =
              Number(
                partner
                  .monthlyCommissionCapCents,
              )

            const validCapCents =
              Number.isInteger(capCents) &&
              capCents >= 0
                ? capCents
                : 2000000

            const capUnits =
              BigInt(
                validCapCents,
              ) * 10000n

            const remainingUnits =
              capUnits > earnedUnits
                ? capUnits -
                  earnedUnits
                : 0n

            const cafes =
              cafesByPartner.get(
                partner.id,
              ) || {
                attributedCafeCount:
                  0,
                activeCafeCount:
                  0,
                terminatedCafeCount:
                  0,
              }

            return {
              id: partner.id,
              email: partner.email,
              legalName:
                partner.legalName,
              displayName:
                partner.displayName,
              referralCode:
                partner.referralCode,
              status:
                partner.status,
              commissionBps:
                partner.commissionBps,
              monthlyCommissionCapCents:
                validCapCents,
              currentMonthCommissionUnits:
                earnedUnits.toString(),
              currentMonthEarnings:
                Number(
                  earnedUnits,
                ) / 1000000,
              remainingCap:
                Number(
                  remainingUnits,
                ) / 1000000,
              capReached:
                earnedUnits >=
                capUnits,
              ...cafes,
            }
          },
        ),
    }
  }

  async updateMonthlyCommissionCap(
    salesPartnerId: number,
    monthlyCommissionCapCents: number,
  ) {
    if (
      !Number.isInteger(
        salesPartnerId,
      ) ||
      salesPartnerId < 1
    ) {
      throw new BadRequestException(
        'Valid Sales Partner id is required.',
      )
    }

    if (
      !Number.isInteger(
        monthlyCommissionCapCents,
      ) ||
      monthlyCommissionCapCents < 0 ||
      monthlyCommissionCapCents >
        2000000000
    ) {
      throw new BadRequestException(
        'Monthly commission cap must be a valid non-negative cent amount.',
      )
    }

    return this.dataSource.transaction(
      async (manager) => {
        const repo =
          manager.getRepository(
            SalesPartner,
          )

        const partner =
          await repo
            .createQueryBuilder(
              'salesPartner',
            )
            .setLock(
              'pessimistic_write',
            )
            .where(
              'salesPartner.id = :salesPartnerId',
              { salesPartnerId },
            )
            .getOne()

        if (!partner) {
          throw new BadRequestException(
            'Sales Partner not found.',
          )
        }

        partner
          .monthlyCommissionCapCents =
            monthlyCommissionCapCents

        await repo.save(partner)

        return {
          success: true,
          salesPartnerId:
            partner.id,
          monthlyCommissionCapCents:
            partner
              .monthlyCommissionCapCents,
        }
      },
    )
  }

  async terminateCafeCommission(
    storeCode: string,
  ) {
    const cleanStoreCode =
      String(storeCode || '')
        .trim()
        .toLowerCase()

    if (!cleanStoreCode) {
      throw new BadRequestException(
        'Valid store code is required.',
      )
    }

    return this.dataSource.transaction(
      async (manager) => {
        const repo =
          manager.getRepository(
            Business,
          )

        const business =
          await repo
            .createQueryBuilder(
              'business',
            )
            .setLock(
              'pessimistic_write',
            )
            .where(
              'business.storeCode = :storeCode',
              {
                storeCode:
                  cleanStoreCode,
              },
            )
            .getOne()

        if (!business) {
          throw new BadRequestException(
            'Cafe not found.',
          )
        }

        if (!business.salesPartnerId) {
          throw new BadRequestException(
            'This cafe is not attributed to a Sales Partner.',
          )
        }

        if (
          !business
            .salesCommissionTerminatedAt
        ) {
          business
            .salesCommissionTerminatedAt =
              new Date()

          await repo.save(
            business,
          )
        }

        return {
          success: true,
          storeCode:
            business.storeCode,
          salesPartnerId:
            business.salesPartnerId,
          salesCommissionBps:
            business.salesCommissionBps,
          salesCommissionTerminatedAt:
            business
              .salesCommissionTerminatedAt,
        }
      },
    )
  }

  /*
   * Record the exact commission earned from
   * one genuine paid restaurant order.
   *
   * There is deliberately NO commission
   * rounding here.
   *
   * commissionUnits =
   *   platformFeeCents * commissionBps
   *
   * 10,000 commissionUnits = 1 cent.
   */
  async recordPaidOrder(
    orderId: number,
  ): Promise<SalesCommission | null> {
    if (
      !Number.isInteger(orderId) ||
      orderId < 1
    ) {
      throw new Error(
        'Valid paid order id is required.',
      )
    }

    return this.dataSource.transaction(
      async (manager) => {
        const orderRepo =
          manager.getRepository(Order)

        const businessRepo =
          manager.getRepository(Business)

        const commissionRepo =
          manager.getRepository(
            SalesCommission,
          )

        /*
         * Serializes webhook/reconciliation
         * workers for the same order.
         */
        const order =
          await orderRepo
            .createQueryBuilder(
              'order',
            )
            .setLock(
              'pessimistic_write',
            )
            .where(
              'order.id = :orderId',
              {
                orderId,
              },
            )
            .getOne()

        if (!order) {
          throw new Error(
            `Paid order ${orderId} was not found.`,
          )
        }

        /*
         * An unpaid order never earns commission.
         */
        if (
          order.status ===
            OrderStatus.PENDING_PAYMENT
        ) {
          return null
        }

        /*
         * Customer refunds currently retain
         * CaviarQR's application fee.
         *
         * Therefore a refunded customer order
         * STILL earns the Sales Partner's exact
         * commission when CaviarQR retained that
         * fee.
         *
         * Only suppress commission if CaviarQR's
         * application fee itself was actually
         * refunded.
         */
        if (
          order.refundApplicationFee ===
            true
        ) {
          return null
        }

        if (
          !order.stripePaymentIntentId
        ) {
          return null
        }

        const currency =
          String(
            order.currency ||
              'usd',
          )
            .trim()
            .toLowerCase()

        if (currency !== 'usd') {
          throw new Error(
            `Sales commission only supports USD orders. Order ${order.id} is ${currency}.`,
          )
        }

        /*
         * Unique orderId is also enforced by
         * PostgreSQL. The order row lock makes
         * normal concurrent execution serialize
         * before reaching this point.
         */
        const existing =
          await commissionRepo
            .findOne({
              where: {
                orderId:
                  order.id,
              },
            })

        if (existing) {
          /*
           * An ACTIVE Partner's commission may have
           * been durably recorded before Order.paidAt
           * was recoverable from Stripe.
           *
           * Once paidAt is repaired, fill the exact
           * 30-day availability timestamp without
           * recalculating or recreating commission.
           *
           * INELIGIBLE, PAID, REVERSED and payout
           * states are never changed here.
           */
          const existingPaidAt =
            order.paidAt

          if (
            existing.status ===
              SalesCommissionStatus.PENDING &&
            !existing.availableAt &&
            existingPaidAt &&
            !Number.isNaN(
              existingPaidAt.getTime(),
            )
          ) {
            existing.availableAt =
              new Date(
                existingPaidAt.getTime() +
                  30 *
                    24 *
                    60 *
                    60 *
                    1000,
              )

            return await commissionRepo
              .save(existing)
          }

          return existing
        }

        const businessId =
          Number(
            order.businessId,
          )

        if (
          !Number.isInteger(
            businessId,
          ) ||
          businessId < 1
        ) {
          throw new Error(
            `Order ${order.id} has no valid business.`,
          )
        }

        const business =
          await businessRepo
            .createQueryBuilder(
              'business',
            )
            .setLock(
              'pessimistic_write',
            )
            .where(
              'business.id = :businessId',
              {
                businessId,
              },
            )
            .getOne()

        if (!business) {
          throw new Error(
            `Business ${businessId} was not found for Order ${order.id}.`,
          )
        }

        /*
         * The first genuine paid restaurant
         * transaction permanently locks Sales
         * attribution even when this cafe has
         * no Sales Partner.
         *
         * This prevents a cafe from processing
         * real revenue first and being assigned
         * to a rep afterward.
         */
        if (
          !business
            .salesAttributionLockedAt
        ) {
          business
            .salesAttributionLockedAt =
              new Date()

          await businessRepo.save(
            business,
          )
        }

        const salesPartnerId =
          Number(
            business.salesPartnerId,
          )

        /*
         * No Sales attribution means there is
         * intentionally no commission row.
         */
        if (
          !Number.isInteger(
            salesPartnerId,
          ) ||
          salesPartnerId < 1
        ) {
          return null
        }

        /*
         * Lock the Partner row for the entire cap decision.
         * This serializes simultaneous orders from different
         * attributed cafes so they cannot race above the same
         * monthly cap.
         */
        const salesPartner =
          await manager
            .getRepository(
              SalesPartner,
            )
            .createQueryBuilder(
              'salesPartner',
            )
            .setLock(
              'pessimistic_write',
            )
            .where(
              'salesPartner.id = :salesPartnerId',
              {
                salesPartnerId,
              },
            )
            .getOne()

        if (!salesPartner) {
          throw new Error(
            `Sales Partner ${salesPartnerId} was not found for Order ${order.id}.`,
          )
        }

        const partnerIsActive =
          salesPartner.status ===
            SalesPartnerStatus.ACTIVE

        const paidAt =
          order.paidAt

        const hasValidPaidAt =
          Boolean(
            paidAt &&
            !Number.isNaN(
              paidAt.getTime(),
            ),
          )

        const orderCreatedAt =
          order.createdAt

        const hasValidOrderCreatedAt =
          Boolean(
            orderCreatedAt &&
            !Number.isNaN(
              new Date(
                orderCreatedAt,
              ).getTime(),
            ),
          )

        /*
         * Stable cap/termination accounting timestamp.
         * Prefer Stripe paidAt. If it is temporarily missing,
         * the durable order creation time is the fallback.
         */
        const earnedAt =
          hasValidPaidAt
            ? new Date(
                paidAt!.getTime(),
              )
            : hasValidOrderCreatedAt
              ? new Date(
                  orderCreatedAt,
                )
              : new Date()

        const terminatedAt =
          business
            .salesCommissionTerminatedAt

        const cafeCommissionActive =
          !(
            terminatedAt &&
            !Number.isNaN(
              terminatedAt.getTime(),
            ) &&
            earnedAt.getTime() >=
              terminatedAt.getTime()
          )

        const commissionEligible =
          partnerIsActive &&
          cafeCommissionActive

        /*
         * Commission availability is measured from Stripe's
         * successful-payment timestamp. A missing paidAt keeps
         * an otherwise eligible row pending until repair.
         */
        const availableAt =
          hasValidPaidAt
            ? new Date(
                paidAt!.getTime() +
                  30 *
                    24 *
                    60 *
                    60 *
                    1000,
              )
            : null

        const commissionBps =
          Number(
            business.salesCommissionBps,
          )

        if (
          !Number.isInteger(
            commissionBps,
          ) ||
          commissionBps < 0 ||
          commissionBps > 10000
        ) {
          throw new Error(
            `Business ${business.id} has an invalid Sales commission rate.`,
          )
        }

        const platformFee =
          Number(
            order.platformFee ||
              0,
          )

        if (
          !Number.isFinite(
            platformFee,
          ) ||
          platformFee < 0
        ) {
          throw new Error(
            `Order ${order.id} has an invalid platform fee.`,
          )
        }

        const rawPlatformFeeCents =
          platformFee * 100

        const platformFeeCents =
          Math.round(
            rawPlatformFeeCents,
          )

        if (
          !Number.isSafeInteger(
            platformFeeCents,
          ) ||
          platformFeeCents < 0 ||
          Math.abs(
            rawPlatformFeeCents -
              platformFeeCents,
          ) > 0.000001
        ) {
          throw new Error(
            `Order ${order.id} platform fee is not an exact cent amount.`,
          )
        }

        const fullCommissionUnits =
          BigInt(
            platformFeeCents,
          ) *
          BigInt(
            commissionBps,
          )

        let commissionUnits =
          fullCommissionUnits

        let capApplied = false

        if (commissionEligible) {
          const monthlyCapCents =
            Number(
              salesPartner
                .monthlyCommissionCapCents,
            )

          if (
            !Number.isInteger(
              monthlyCapCents,
            ) ||
            monthlyCapCents < 0
          ) {
            throw new Error(
              `Sales Partner ${salesPartnerId} has an invalid monthly commission cap.`,
            )
          }

          const { start, end } =
            this.utcMonthBounds(
              earnedAt,
            )

          const monthRow =
            await commissionRepo
              .createQueryBuilder(
                'commission',
              )
              .select(
                'COALESCE(SUM(commission.commissionUnits), 0)',
                'commissionUnits',
              )
              .where(
                'commission.salesPartnerId = :salesPartnerId',
                { salesPartnerId },
              )
              .andWhere(
                'commission.earnedAt >= :start',
                { start },
              )
              .andWhere(
                'commission.earnedAt < :end',
                { end },
              )
              .andWhere(
                'commission.status IN (:...statuses)',
                {
                  statuses: [
                    SalesCommissionStatus.PENDING,
                    SalesCommissionStatus.AVAILABLE,
                    SalesCommissionStatus.PAYOUT_PENDING,
                    SalesCommissionStatus.PAID,
                  ],
                },
              )
              .getRawOne()

          const earnedThisMonthUnits =
            BigInt(
              String(
                monthRow
                  ?.commissionUnits ||
                  '0',
              ),
            )

          const monthlyCapUnits =
            BigInt(
              monthlyCapCents,
            ) * 10000n

          const remainingUnits =
            monthlyCapUnits >
              earnedThisMonthUnits
              ? monthlyCapUnits -
                earnedThisMonthUnits
              : 0n

          if (
            commissionUnits >
            remainingUnits
          ) {
            commissionUnits =
              remainingUnits
            capApplied = true
          }
        }

        const capBlocked =
          commissionEligible &&
          commissionUnits === 0n &&
          fullCommissionUnits > 0n

        const payable =
          commissionEligible &&
          !capBlocked

        if (
          payable &&
          !availableAt
        ) {
          this.logger.warn(
            `SALES_COMMISSION_WAITING_FOR_PAID_AT order=${order.id} partner=${salesPartnerId}`,
          )
        }

        let ineligibleReason:
          string | null = null

        if (!partnerIsActive) {
          ineligibleReason =
            `PARTNER_NOT_ACTIVE_AT_TRANSACTION:${salesPartner.status}`
        } else if (!cafeCommissionActive) {
          ineligibleReason =
            `CAFE_COMMISSION_TERMINATED_AT:${terminatedAt!.toISOString()}`
        } else if (capBlocked) {
          ineligibleReason =
            `MONTHLY_COMMISSION_CAP_REACHED:${salesPartner.monthlyCommissionCapCents}`
        }

        const commission =
          commissionRepo.create({
            salesPartnerId,
            businessId:
              business.id,
            orderId:
              order.id,
            platformFeeCents,
            commissionBps,
            commissionUnits:
              commissionUnits.toString(),
            earnedAt,
            capApplied,
            currency:
              'usd',
            status:
              payable
                ? SalesCommissionStatus
                    .PENDING
                : SalesCommissionStatus
                    .INELIGIBLE,
            availableAt:
              payable
                ? availableAt
                : null,
            reversedAt:
              null,
            reversalReason:
              ineligibleReason,
          })

        const saved =
          await commissionRepo.save(
            commission,
          )

        if (payable) {
          this.logger.log(
            `SALES_COMMISSION_RECORDED order=${order.id} partner=${salesPartnerId} platformFeeCents=${platformFeeCents} commissionBps=${commissionBps} commissionUnits=${saved.commissionUnits} capApplied=${saved.capApplied} availableAt=${saved.availableAt?.toISOString() || 'PENDING_PAID_AT_REPAIR'}`,
          )
        } else {
          this.logger.warn(
            `SALES_COMMISSION_INELIGIBLE order=${order.id} partner=${salesPartnerId} reason=${ineligibleReason || 'UNKNOWN'}`,
          )
        }

        return saved
      },
    )
  }

  /*
   * Paid-order delivery must NEVER fail
   * because Sales accounting had a problem.
   */
  async recordPaidOrderSafely(
    orderId: number,
    source: string,
  ): Promise<SalesCommission | null> {
    try {
      return await this
        .recordPaidOrder(
          orderId,
        )
    } catch (error: any) {
      this.logger.error(
        `SALES_COMMISSION_RECORD_FAILED source=${source} order=${orderId} error=${String(
          error?.message ||
            error,
        )}`,
      )

      return null
    }
  }

  /*
   * Durable repair sweep for attributed cafes.
   *
   * This intentionally does NOT invent a second
   * commission calculation path. It only finds
   * genuine paid orders that appear to be missing
   * their ledger row and then delegates each one
   * back through recordPaidOrderSafely().
   *
   * Historical protection:
   * only orders created at/after the immutable
   * business Sales attribution timestamp qualify.
   * This prevents retroactive commission creation
   * for orders that pre-date Sales attribution.
   */
  async reconcileMissingCommissions(
    limit = 100,
  ): Promise<{
    checked: number
    recorded: number
  }> {
    const safeLimit =
      Number.isInteger(limit) &&
      limit > 0 &&
      limit <= 500
        ? limit
        : 100

    const candidates =
      await this.dataSource
        .getRepository(Order)
        .createQueryBuilder(
          'order',
        )
        .innerJoin(
          Business,
          'business',
          'business.id = order.businessId',
        )
        .leftJoin(
          SalesCommission,
          'commission',
          'commission.orderId = order.id',
        )
        .select(
          'order.id',
          'id',
        )
        .where(
          'commission.id IS NULL',
        )
        .andWhere(
          'business.salesPartnerId IS NOT NULL',
        )
        .andWhere(
          'business.salesCommissionBps IS NOT NULL',
        )
        .andWhere(
          'business.salesAttributedAt IS NOT NULL',
        )
        .andWhere(
          'order.createdAt >= business.salesAttributedAt',
        )
        .andWhere(
          'order.status != :pendingPayment',
          {
            pendingPayment:
              OrderStatus.PENDING_PAYMENT,
          },
        )
        .andWhere(
          'order.stripePaymentIntentId IS NOT NULL',
        )
        .andWhere(
          'LOWER(order.currency) = :currency',
          {
            currency:
              'usd',
          },
        )
        .andWhere(
          'order.refundApplicationFee = false',
        )
        .orderBy(
          'order.id',
          'ASC',
        )
        .take(
          safeLimit,
        )
        .getRawMany<{
          id:
            string | number
        }>()

    let recorded =
      0

    for (const candidate of candidates) {
      const orderId =
        Number(
          candidate.id,
        )

      if (
        !Number.isInteger(
          orderId,
        ) ||
        orderId < 1
      ) {
        continue
      }

      const commission =
        await this
          .recordPaidOrderSafely(
            orderId,
            'MISSING_LEDGER_SWEEP',
          )

      if (commission) {
        recorded +=
          1
      }
    }

    return {
      checked:
        candidates.length,

      recorded,
    }
  }

  /*
   * Release commissions whose exact 30-day
   * availability timestamp has arrived.
   *
   * This does not calculate commission and does
   * not move money. It only performs the durable
   * PENDING -> AVAILABLE ledger transition.
   *
   * The conditional UPDATE makes concurrent sweep
   * workers idempotent.
   */
  async releaseMatureCommissions(
    limit = 100,
  ): Promise<{
    checked: number
    released: number
  }> {
    const safeLimit =
      Number.isInteger(limit) &&
      limit > 0 &&
      limit <= 500
        ? limit
        : 100

    const now =
      new Date()

    const commissionRepo =
      this.dataSource.getRepository(
        SalesCommission,
      )

    const candidates =
      await commissionRepo
        .createQueryBuilder(
          'commission',
        )
        .innerJoin(
          Order,
          'order',
          'order.id = commission.orderId',
        )
        .select(
          'commission.id',
          'id',
        )
        .where(
          'commission.status = :status',
          {
            status:
              SalesCommissionStatus.PENDING,
          },
        )
        .andWhere(
          'commission.availableAt IS NOT NULL',
        )
        .andWhere(
          'commission.availableAt <= :now',
          {
            now,
          },
        )
        .andWhere(
          'order.paidAt IS NOT NULL',
        )
        .andWhere(
          'order.refundApplicationFee = false',
        )
        .orderBy(
          'commission.availableAt',
          'ASC',
        )
        .addOrderBy(
          'commission.id',
          'ASC',
        )
        .take(
          safeLimit,
        )
        .getRawMany<{
          id:
            string
        }>()

    let released =
      0

    for (const candidate of candidates) {
      const result =
        await commissionRepo
          .createQueryBuilder()
          .update(
            SalesCommission,
          )
          .set({
            status:
              SalesCommissionStatus.AVAILABLE,
          })
          .where(
            'id = :id',
            {
              id:
                candidate.id,
            },
          )
          .andWhere(
            'status = :status',
            {
              status:
                SalesCommissionStatus.PENDING,
            },
          )
          .andWhere(
            '"availableAt" IS NOT NULL',
          )
          .andWhere(
            '"availableAt" <= :now',
            {
              now,
            },
          )
          .execute()

      released +=
        Number(
          result.affected ||
            0,
        )
    }

    return {
      checked:
        candidates.length,

      released,
    }
  }

  /*
   * Future-proof helper.
   *
   * Current CaviarQR refund policy retains
   * the application fee, so ordinary customer
   * refunds MUST NOT call this.
   *
   * This exists only for a future flow where
   * CaviarQR actually returns its application
   * fee.
   */
  async reverseCommissionForRefund(
    orderId: number,
    manager: EntityManager,
    reason:
      string,
  ): Promise<SalesCommission | null> {
    const commissionRepo =
      manager.getRepository(
        SalesCommission,
      )

    const commission =
      await commissionRepo
        .createQueryBuilder(
          'commission',
        )
        .setLock(
          'pessimistic_write',
        )
        .where(
          'commission.orderId = :orderId',
          {
            orderId,
          },
        )
        .getOne()

    if (
      !commission ||
      commission.status ===
        SalesCommissionStatus.REVERSED
    ) {
      return commission || null
    }

    commission.status =
      SalesCommissionStatus.REVERSED

    commission.reversedAt =
      new Date()

    commission.reversalReason =
      reason

    const saved =
      await commissionRepo.save(
        commission,
      )

    this.logger.warn(
      `SALES_COMMISSION_REVERSED order=${orderId} commission=${saved.id} reason=${reason}`,
    )

    return saved
  }
}
