import {
  Injectable,
} from '@nestjs/common'

import {
  randomUUID,
} from 'crypto'

import {
  DataSource,
} from 'typeorm'

import {
  SalesPartner,
  SalesPartnerStatus,
} from './entities/sales-partner.entity'

import {
  SalesCommission,
  SalesCommissionStatus,
} from './entities/sales-commission.entity'

import {
  SalesPayout,
  SalesPayoutStatus,
} from './entities/sales-payout.entity'

import {
  SalesPayoutItem,
} from './entities/sales-payout-item.entity'

type ExactCommissionRemainder = {
  commission: SalesCommission
  exactUnits: bigint
  consumedUnits: bigint
  remainingUnits: bigint
}

type ExactPayoutReservation = {
  created: boolean
  reason:
    | 'CREATED'
    | 'ACTIVE_PAYOUT_EXISTS'
    | 'NO_AVAILABLE_COMMISSION'
    | 'BELOW_ONE_CENT'
  payoutId: string | null
  amountCents: number
  reservedUnits: string
  residualUnits: string | null
}

const SALES_PAYOUT_UNITS_PER_CENT = 10000n

@Injectable()
export class SalesPayoutService {
  /*
   * Exact accounting scale:
   *
   * 10,000 commission units = 1 cent.
   *
   * Never round commission units.
   * Stripe can only receive whole cents, so:
   *
   * payoutCents =
   *   floor(totalPayableUnits / 10,000)
   *
   * With BigInt integer division this floor is
   * exact and cannot accidentally round upward.
   */
  constructor(
    private readonly dataSource:
      DataSource,
  ) {}

  async reserveAvailablePayout(
    salesPartnerId: number,
  ): Promise<ExactPayoutReservation> {
    if (
      !Number.isInteger(
        salesPartnerId,
      ) ||
      salesPartnerId < 1
    ) {
      throw new Error(
        'Valid Sales Partner id is required.',
      )
    }

    return this.dataSource
      .transaction(
        async (manager) => {
          const partnerRepo =
            manager.getRepository(
              SalesPartner,
            )

          const commissionRepo =
            manager.getRepository(
              SalesCommission,
            )

          const payoutRepo =
            manager.getRepository(
              SalesPayout,
            )

          const payoutItemRepo =
            manager.getRepository(
              SalesPayoutItem,
            )

          /*
           * This row lock serializes payout
           * reservation for one Sales Partner.
           *
           * Two workers cannot reserve the same
           * exact commission units concurrently.
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
                  salesPartnerId,
                },
              )
              .getOne()

          if (!partner) {
            throw new Error(
              `Sales Partner ${salesPartnerId} was not found.`,
            )
          }

          if (
            partner.status !==
              SalesPartnerStatus.ACTIVE
          ) {
            throw new Error(
              `Sales Partner ${salesPartnerId} is not ACTIVE.`,
            )
          }

          /*
           * Keep only one unsettled payout batch
           * per partner at a time.
           */
          const activePayout =
            await payoutRepo
              .createQueryBuilder(
                'payout',
              )
              .where(
                'payout.salesPartnerId = :salesPartnerId',
                {
                  salesPartnerId,
                },
              )
              .andWhere(
                'payout.status IN (:...statuses)',
                {
                  statuses: [
                    SalesPayoutStatus.PENDING,
                    SalesPayoutStatus.PROCESSING,
                  ],
                },
              )
              .orderBy(
                'payout.id',
                'DESC',
              )
              .getOne()

          if (activePayout) {
            const reservedUnits =
              BigInt(
                activePayout.amountCents,
              ) *
              SALES_PAYOUT_UNITS_PER_CENT

            return {
              created:
                false,

              reason:
                'ACTIVE_PAYOUT_EXISTS',

              payoutId:
                activePayout.id,

              amountCents:
                activePayout.amountCents,

              reservedUnits:
                reservedUnits.toString(),

              residualUnits:
                null,
            }
          }

          const now =
            new Date()

          /*
           * Only explicitly AVAILABLE commissions
           * whose availability time has arrived
           * may participate.
           *
           * PENDING commissions are intentionally
           * excluded because no payout-hold policy
           * has been approved yet.
           */
          const commissions =
            await commissionRepo
              .createQueryBuilder(
                'commission',
              )
              .setLock(
                'pessimistic_write',
              )
              .where(
                'commission.salesPartnerId = :salesPartnerId',
                {
                  salesPartnerId,
                },
              )
              .andWhere(
                'commission.status = :status',
                {
                  status:
                    SalesCommissionStatus.AVAILABLE,
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
                'LOWER(commission.currency) = :currency',
                {
                  currency:
                    'usd',
                },
              )
              .orderBy(
                'commission.id',
                'ASC',
              )
              .getMany()

          if (
            commissions.length ===
            0
          ) {
            return {
              created:
                false,

              reason:
                'NO_AVAILABLE_COMMISSION',

              payoutId:
                null,

              amountCents:
                0,

              reservedUnits:
                '0',

              residualUnits:
                '0',
            }
          }

          const commissionIds =
            commissions.map(
              (commission) =>
                commission.id,
            )

          /*
           * Count units already reserved or paid.
           *
           * FAILED payouts are deliberately
           * excluded so their units can eventually
           * be re-reserved by a future retry flow.
           */
          const consumedRows =
            await payoutItemRepo
              .createQueryBuilder(
                'item',
              )
              .innerJoin(
                SalesPayout,
                'payout',
                'payout.id = item.salesPayoutId',
              )
              .select(
                'item.salesCommissionId',
                'salesCommissionId',
              )
              .addSelect(
                'COALESCE(SUM(item.amountUnits), 0)',
                'consumedUnits',
              )
              .where(
                'item.salesCommissionId IN (:...commissionIds)',
                {
                  commissionIds,
                },
              )
              .andWhere(
                'payout.status IN (:...statuses)',
                {
                  statuses: [
                    SalesPayoutStatus.PENDING,
                    SalesPayoutStatus.PROCESSING,
                    SalesPayoutStatus.PAID,
                  ],
                },
              )
              .groupBy(
                'item.salesCommissionId',
              )
              .getRawMany<{
                salesCommissionId:
                  string
                consumedUnits:
                  string
              }>()

          const consumedByCommission =
            new Map<
              string,
              bigint
            >()

          for (
            const row of
              consumedRows
          ) {
            consumedByCommission
              .set(
                String(
                  row.salesCommissionId,
                ),
                BigInt(
                  row.consumedUnits ||
                    '0',
                ),
              )
          }

          const remaining: ExactCommissionRemainder[] = []

          let totalPayableUnits =
            0n

          for (
            const commission of
              commissions
          ) {
            const exactUnits =
              BigInt(
                commission
                  .commissionUnits,
              )

            const consumedUnits =
              consumedByCommission
                .get(
                  String(
                    commission.id,
                  ),
                ) ||
              0n

            if (
              exactUnits < 0n ||
              consumedUnits < 0n ||
              consumedUnits >
                exactUnits
            ) {
              throw new Error(
                `Sales commission ${commission.id} has invalid payout consumption.`,
              )
            }

            const remainingUnits =
              exactUnits -
              consumedUnits

            if (
              remainingUnits ===
              0n
            ) {
              throw new Error(
                `AVAILABLE Sales commission ${commission.id} is already fully consumed.`,
              )
            }

            remaining.push({
              commission,
              exactUnits,
              consumedUnits,
              remainingUnits,
            })

            totalPayableUnits +=
              remainingUnits
          }

          /*
           * BigInt division floors exactly.
           * There is NO Math.round(), ceil(),
           * or floating-point conversion here.
           */
          const payoutCentsBig =
            totalPayableUnits /
            SALES_PAYOUT_UNITS_PER_CENT

          const payoutUnits =
            payoutCentsBig *
            SALES_PAYOUT_UNITS_PER_CENT

          const residualUnits =
            totalPayableUnits -
            payoutUnits

          if (
            payoutCentsBig ===
            0n
          ) {
            return {
              created:
                false,

              reason:
                'BELOW_ONE_CENT',

              payoutId:
                null,

              amountCents:
                0,

              reservedUnits:
                '0',

              residualUnits:
                residualUnits
                  .toString(),
            }
          }

          /*
           * sales_payout.amountCents is a
           * PostgreSQL INTEGER.
           */
          if (
            payoutCentsBig >
            2147483647n
          ) {
            throw new Error(
              'Sales payout exceeds the current single-batch cent limit.',
            )
          }

          const amountCents =
            Number(
              payoutCentsBig,
            )

          /*
           * One stable Stripe idempotency key per
           * persisted payout batch.
           *
           * Any retry of THIS payout will reuse
           * the same stored key.
           *
           * If this payout eventually fails and
           * its exact units are released, a future
           * NEW payout batch receives a different
           * key and therefore cannot collide with
           * the failed historical payout.
           */
          const idempotencyKey =
            `caviarqr-sales-payout-${salesPartnerId}-${randomUUID()}`

          const payout =
            payoutRepo.create({
              salesPartnerId,

              amountCents,

              currency:
                'usd',

              /*
               * No Stripe destination is frozen
               * until this payout actually begins
               * processing.
               */
              stripeDestinationAccountId:
                null,

              status:
                SalesPayoutStatus.PENDING,

              stripeTransferId:
                null,

              idempotencyKey,

              /*
               * No Stripe request has happened.
               */
              requestedAt:
                null,

              paidAt:
                null,

              failedAt:
                null,

              failureMessage:
                null,
            })

          const savedPayout =
            await payoutRepo.save(
              payout,
            )

          let unitsStillNeeded =
            payoutUnits

          const items:
            SalesPayoutItem[] =
            []

          for (
            const entry of remaining
          ) {
            if (
              unitsStillNeeded ===
              0n
            ) {
              break
            }

            const amountUnits =
              entry.remainingUnits <
              unitsStillNeeded
                ? entry
                    .remainingUnits
                : unitsStillNeeded

            if (
              amountUnits <=
              0n
            ) {
              continue
            }

            items.push(
              payoutItemRepo.create({
                salesPayoutId:
                  savedPayout.id,

                salesCommissionId:
                  entry
                    .commission
                    .id,

                amountUnits:
                  amountUnits
                    .toString(),
              }),
            )

            const newlyConsumed =
              entry.consumedUnits +
              amountUnits

            /*
             * Fully reserved commission:
             * no exact units remain available.
             *
             * Partially reserved commission:
             * fractional residual remains AVAILABLE
             * and carries into a later payout.
             */
            entry
              .commission
              .status =
              newlyConsumed ===
              entry.exactUnits
                ? SalesCommissionStatus
                    .PAYOUT_PENDING
                : SalesCommissionStatus
                    .AVAILABLE

            unitsStillNeeded -=
              amountUnits
          }

          if (
            unitsStillNeeded !==
            0n
          ) {
            throw new Error(
              'Exact Sales payout allocation did not balance.',
            )
          }

          if (
            items.length ===
            0
          ) {
            throw new Error(
              'Exact Sales payout contained no payout items.',
            )
          }

          await payoutItemRepo.save(
            items,
          )

          await commissionRepo.save(
            remaining.map(
              (entry) =>
                entry.commission,
            ),
          )

          /*
           * Strong application invariant:
           * payout items must reserve exactly the
           * whole-cent payout amount and nothing
           * more.
           */
          const allocatedUnits =
            items.reduce(
              (
                total,
                item,
              ) =>
                total +
                BigInt(
                  item.amountUnits,
                ),
              0n,
            )

          if (
            allocatedUnits !==
            payoutUnits
          ) {
            throw new Error(
              'Exact Sales payout item total does not equal payout amount.',
            )
          }

          return {
            created:
              true,

            reason:
              'CREATED',

            payoutId:
              savedPayout.id,

            amountCents,

            reservedUnits:
              payoutUnits
                .toString(),

            residualUnits:
              residualUnits
                .toString(),
          }
        },
      )
  }

  /*
   * Mark one payout batch FAILED and release
   * its exact reserved units atomically.
   *
   * Failed payout items remain immutable
   * historical records, but FAILED payouts
   * do not count as consumed/reserved units.
   *
   * The Sales Partner row is locked first so
   * this transition serializes with payout
   * reservation for the same partner.
   */
  /*
   * Freeze the Stripe destination before any
   * transfer request is sent.
   *
   * This method does NOT call Stripe.
   *
   * First call:
   *   PENDING -> PROCESSING
   *   snapshots the current connected acct_ id.
   *
   * Retry:
   *   PROCESSING returns the already-snapshotted
   *   destination and the same idempotency key.
   *
   * A later change to SalesPartner.stripeAccountId
   * can therefore never redirect an in-flight
   * payout retry to another Stripe account.
   */
  async beginPayoutProcessing(
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

    return this.dataSource
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
           * Discover the partner, then acquire
           * the same partner lock used by reserve,
           * failure, and paid finalization.
           */
          const lookup =
            await payoutRepo.findOne({
              where: {
                id:
                  normalizedPayoutId,
              },
            })

          if (!lookup) {
            throw new Error(
              `Sales payout ${normalizedPayoutId} was not found.`,
            )
          }

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
                    lookup
                      .salesPartnerId,
                },
              )
              .getOne()

          if (!partner) {
            throw new Error(
              `Sales Partner ${lookup.salesPartnerId} was not found.`,
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
              `Sales payout ${normalizedPayoutId} disappeared during processing.`,
            )
          }

          if (
            payout.salesPartnerId !==
            partner.id
          ) {
            throw new Error(
              'Sales payout partner changed during processing.',
            )
          }

          /*
           * An uncertain Stripe response must
           * remain PROCESSING. A retry returns
           * the exact original destination and
           * exact original idempotency key.
           */
          if (
            payout.status ===
            SalesPayoutStatus.PROCESSING
          ) {
            const frozenDestination =
              String(
                payout
                  .stripeDestinationAccountId ||
                  '',
              ).trim()

            if (
              !/^acct_[A-Za-z0-9]+$/.test(
                frozenDestination,
              )
            ) {
              throw new Error(
                `Sales payout ${payout.id} is PROCESSING without a valid frozen Stripe destination.`,
              )
            }

            return {
              payoutId:
                payout.id,

              status:
                payout.status,

              amountCents:
                payout.amountCents,

              currency:
                payout.currency,

              stripeDestinationAccountId:
                frozenDestination,

              idempotencyKey:
                payout.idempotencyKey,

              alreadyProcessing:
                true,
            }
          }

          if (
            payout.status ===
            SalesPayoutStatus.PAID
          ) {
            throw new Error(
              `Sales payout ${payout.id} is already PAID.`,
            )
          }

          if (
            payout.status ===
            SalesPayoutStatus.FAILED
          ) {
            throw new Error(
              `Sales payout ${payout.id} is FAILED and cannot begin processing.`,
            )
          }

          if (
            payout.status !==
            SalesPayoutStatus.PENDING
          ) {
            throw new Error(
              `Sales payout ${payout.id} cannot begin processing from ${payout.status}.`,
            )
          }

          if (
            partner.status !==
            SalesPartnerStatus.ACTIVE
          ) {
            throw new Error(
              `Sales Partner ${partner.id} is not ACTIVE.`,
            )
          }

          if (
            !partner
              .stripeDetailsSubmitted ||
            !partner
              .stripePayoutsEnabled ||
            !partner
              .stripeAccountReady
          ) {
            throw new Error(
              `Sales Partner ${partner.id} Stripe payout account is not ready.`,
            )
          }

          const destination =
            String(
              partner
                .stripeAccountId ||
                '',
            ).trim()

          if (
            !/^acct_[A-Za-z0-9]+$/.test(
              destination,
            ) ||
            destination.length >
              255
          ) {
            throw new Error(
              `Sales Partner ${partner.id} does not have a valid Stripe destination account.`,
            )
          }

          if (
            payout
              .stripeDestinationAccountId &&
            payout
              .stripeDestinationAccountId !==
                destination
          ) {
            throw new Error(
              `Sales payout ${payout.id} already has a different frozen Stripe destination.`,
            )
          }

          if (
            payout.currency
              .toLowerCase() !==
            'usd'
          ) {
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

          payout
            .stripeDestinationAccountId =
            destination

          payout.status =
            SalesPayoutStatus
              .PROCESSING

          payout.requestedAt =
            payout.requestedAt ||
            new Date()

          payout.failedAt =
            null

          payout.failureMessage =
            null

          await payoutRepo.save(
            payout,
          )

          return {
            payoutId:
              payout.id,

            status:
              payout.status,

            amountCents:
              payout.amountCents,

            currency:
              payout.currency,

            stripeDestinationAccountId:
              payout
                .stripeDestinationAccountId,

            idempotencyKey:
              payout.idempotencyKey,

            alreadyProcessing:
              false,
          }
        },
      )
  }

  async markPayoutFailed(
    payoutId:
      string | number,

    failureMessage:
      string,
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

    const normalizedFailureMessage =
      String(
        failureMessage || '',
      ).trim()

    if (
      normalizedFailureMessage.length ===
      0
    ) {
      throw new Error(
        'A Sales payout failure reason is required.',
      )
    }

    return this.dataSource
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

          const commissionRepo =
            manager.getRepository(
              SalesCommission,
            )

          const payoutItemRepo =
            manager.getRepository(
              SalesPayoutItem,
            )

          /*
           * First read only discovers which
           * partner row must be locked.
           *
           * The payout is re-read under lock
           * after the partner lock is acquired.
           */
          const payoutLookup =
            await payoutRepo.findOne({
              where: {
                id:
                  normalizedPayoutId,
              },
            })

          if (!payoutLookup) {
            throw new Error(
              `Sales payout ${normalizedPayoutId} was not found.`,
            )
          }

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
                    payoutLookup
                      .salesPartnerId,
                },
              )
              .getOne()

          if (!partner) {
            throw new Error(
              `Sales Partner ${payoutLookup.salesPartnerId} was not found.`,
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
              `Sales payout ${normalizedPayoutId} disappeared during failure processing.`,
            )
          }

          if (
            payout.salesPartnerId !==
            partner.id
          ) {
            throw new Error(
              'Sales payout partner changed during failure processing.',
            )
          }

          /*
           * Idempotent repeat failure handling.
           */
          if (
            payout.status ===
            SalesPayoutStatus.FAILED
          ) {
            return {
              payoutId:
                payout.id,

              status:
                payout.status,

              alreadyFailed:
                true,

              releasedCommissions:
                0,
            }
          }

          /*
           * A completed payout must never be
           * released back into payable balance.
           */
          if (
            payout.status ===
            SalesPayoutStatus.PAID
          ) {
            throw new Error(
              `Sales payout ${payout.id} is already PAID and cannot be failed.`,
            )
          }

          if (
            payout.status !==
              SalesPayoutStatus.PENDING &&
            payout.status !==
              SalesPayoutStatus.PROCESSING
          ) {
            throw new Error(
              `Sales payout ${payout.id} cannot transition from ${payout.status} to FAILED.`,
            )
          }

          const payoutItems =
            await payoutItemRepo
              .createQueryBuilder(
                'item',
              )
              .where(
                'item.salesPayoutId = :payoutId',
                {
                  payoutId:
                    payout.id,
                },
              )
              .orderBy(
                'item.id',
                'ASC',
              )
              .getMany()

          const commissionIds =
            [
              ...new Set(
                payoutItems.map(
                  (item) =>
                    String(
                      item.salesCommissionId,
                    ),
                ),
              ),
            ]

          const commissions =
            commissionIds.length > 0
              ? await commissionRepo
                  .createQueryBuilder(
                    'commission',
                  )
                  .setLock(
                    'pessimistic_write',
                  )
                  .where(
                    'commission.id IN (:...commissionIds)',
                    {
                      commissionIds,
                    },
                  )
                  .orderBy(
                    'commission.id',
                    'ASC',
                  )
                  .getMany()
              : []

          if (
            commissions.length !==
            commissionIds.length
          ) {
            throw new Error(
              'Sales payout references a missing commission.',
            )
          }

          payout.status =
            SalesPayoutStatus.FAILED

          payout.failedAt =
            new Date()

          payout.failureMessage =
            normalizedFailureMessage

          payout.paidAt =
            null

          await payoutRepo.save(
            payout,
          )

          /*
           * Recompute each affected commission
           * using only PENDING, PROCESSING, and
           * PAID payouts.
           *
           * The payout just marked FAILED is
           * intentionally excluded.
           */
          let consumptionRows:
            Array<{
              salesCommissionId:
                string
              activeUnits:
                string
              paidUnits:
                string
            }> =
            []

          if (
            commissionIds.length >
            0
          ) {
            consumptionRows =
              await payoutItemRepo
                .createQueryBuilder(
                  'item',
                )
                .innerJoin(
                  SalesPayout,
                  'payout',
                  'payout.id = item.salesPayoutId',
                )
                .select(
                  'item.salesCommissionId',
                  'salesCommissionId',
                )
                .addSelect(
                  `
                    COALESCE(
                      SUM(
                        CASE
                          WHEN payout.status IN (:...activeStatuses)
                          THEN item."amountUnits"
                          ELSE 0
                        END
                      ),
                      0
                    )
                  `,
                  'activeUnits',
                )
                .addSelect(
                  `
                    COALESCE(
                      SUM(
                        CASE
                          WHEN payout.status = :paidStatus
                          THEN item."amountUnits"
                          ELSE 0
                        END
                      ),
                      0
                    )
                  `,
                  'paidUnits',
                )
                .where(
                  'item.salesCommissionId IN (:...commissionIds)',
                  {
                    commissionIds,
                  },
                )
                .setParameters({
                  activeStatuses: [
                    SalesPayoutStatus
                      .PENDING,
                    SalesPayoutStatus
                      .PROCESSING,
                  ],

                  paidStatus:
                    SalesPayoutStatus
                      .PAID,
                })
                .groupBy(
                  'item.salesCommissionId',
                )
                .getRawMany<{
                  salesCommissionId:
                    string
                  activeUnits:
                    string
                  paidUnits:
                    string
                }>()
          }

          const consumptionByCommission =
            new Map<
              string,
              {
                activeUnits:
                  bigint
                paidUnits:
                  bigint
              }
            >()

          for (
            const row of
              consumptionRows
          ) {
            consumptionByCommission
              .set(
                String(
                  row.salesCommissionId,
                ),
                {
                  activeUnits:
                    BigInt(
                      row.activeUnits ||
                        '0',
                    ),

                  paidUnits:
                    BigInt(
                      row.paidUnits ||
                        '0',
                    ),
                },
              )
          }

          let releasedCommissions =
            0

          for (
            const commission of
              commissions
          ) {
            /*
             * Reversal is a separate accounting
             * state and must not be undone by a
             * payout failure.
             */
            if (
              commission.status ===
              SalesCommissionStatus.REVERSED
            ) {
              continue
            }

            const exactUnits =
              BigInt(
                commission
                  .commissionUnits,
              )

            const consumed =
              consumptionByCommission
                .get(
                  String(
                    commission.id,
                  ),
                ) || {
                activeUnits:
                  0n,
                paidUnits:
                  0n,
              }

            const activeUnits =
              consumed.activeUnits

            const paidUnits =
              consumed.paidUnits

            const totalConsumed =
              activeUnits +
              paidUnits

            if (
              activeUnits < 0n ||
              paidUnits < 0n ||
              totalConsumed >
                exactUnits
            ) {
              throw new Error(
                `Sales commission ${commission.id} has invalid payout consumption.`,
              )
            }

            const previousStatus =
              commission.status

            /*
             * Fully paid means final PAID.
             *
             * Fully consumed with any active
             * reservation remains PAYOUT_PENDING.
             *
             * Anything less than fully consumed
             * becomes AVAILABLE so its exact
             * residual can participate in a
             * future payout.
             */
            if (
              paidUnits ===
              exactUnits
            ) {
              commission.status =
                SalesCommissionStatus
                  .PAID
            } else if (
              totalConsumed ===
              exactUnits
            ) {
              commission.status =
                SalesCommissionStatus
                  .PAYOUT_PENDING
            } else {
              commission.status =
                SalesCommissionStatus
                  .AVAILABLE
            }

            if (
              previousStatus !==
              commission.status
            ) {
              releasedCommissions +=
                1
            }
          }

          if (
            commissions.length >
            0
          ) {
            await commissionRepo.save(
              commissions,
            )
          }

          return {
            payoutId:
              payout.id,

            status:
              payout.status,

            alreadyFailed:
              false,

            releasedCommissions,
          }
        },
      )
  }


  /*
   * Atomically finalize one payout batch after
   * Stripe has confirmed a successful Transfer.
   *
   * This method does NOT call Stripe.
   *
   * The partner row is locked first so paid,
   * failed, and reservation transitions for the
   * same Sales Partner cannot race each other.
   */
  async markPayoutPaid(
    payoutId:
      string | number,

    stripeTransferId:
      string,
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

    const normalizedTransferId =
      String(
        stripeTransferId || '',
      ).trim()

    if (
      !/^tr_[A-Za-z0-9_]+$/.test(
        normalizedTransferId,
      ) ||
      normalizedTransferId.length >
        255
    ) {
      throw new Error(
        'A valid Stripe Transfer id is required.',
      )
    }

    return this.dataSource
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

          const commissionRepo =
            manager.getRepository(
              SalesCommission,
            )

          const payoutItemRepo =
            manager.getRepository(
              SalesPayoutItem,
            )

          /*
           * Discover the partner first, then
           * serialize all payout state changes
           * for that partner on the partner row.
           */
          const payoutLookup =
            await payoutRepo.findOne({
              where: {
                id:
                  normalizedPayoutId,
              },
            })

          if (!payoutLookup) {
            throw new Error(
              `Sales payout ${normalizedPayoutId} was not found.`,
            )
          }

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
                    payoutLookup
                      .salesPartnerId,
                },
              )
              .getOne()

          if (!partner) {
            throw new Error(
              `Sales Partner ${payoutLookup.salesPartnerId} was not found.`,
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
              `Sales payout ${normalizedPayoutId} disappeared during paid processing.`,
            )
          }

          if (
            payout.salesPartnerId !==
            partner.id
          ) {
            throw new Error(
              'Sales payout partner changed during paid processing.',
            )
          }

          /*
           * Repeating the same successful Stripe
           * result is idempotent.
           *
           * A different Transfer id for an already
           * paid payout is always rejected.
           */
          if (
            payout.status ===
            SalesPayoutStatus.PAID
          ) {
            if (
              payout.stripeTransferId !==
              normalizedTransferId
            ) {
              throw new Error(
                `Sales payout ${payout.id} is already PAID with a different Stripe Transfer.`,
              )
            }

            return {
              payoutId:
                payout.id,

              status:
                payout.status,

              stripeTransferId:
                payout.stripeTransferId,

              alreadyPaid:
                true,

              finalizedCommissions:
                0,
            }
          }

          if (
            payout.status ===
            SalesPayoutStatus.FAILED
          ) {
            throw new Error(
              `Sales payout ${payout.id} is FAILED and cannot be marked PAID.`,
            )
          }

          if (
            payout.status !==
            SalesPayoutStatus.PROCESSING
          ) {
            throw new Error(
              `Sales payout ${payout.id} cannot transition from ${payout.status} to PAID.`,
            )
          }

          const frozenDestination =
            String(
              payout
                .stripeDestinationAccountId ||
                '',
            ).trim()

          if (
            !/^acct_[A-Za-z0-9]+$/.test(
              frozenDestination,
            )
          ) {
            throw new Error(
              `Sales payout ${payout.id} has no valid frozen Stripe destination.`,
            )
          }

          if (
            payout.currency
              .toLowerCase() !==
            'usd'
          ) {
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

          if (
            payout.stripeTransferId &&
            payout.stripeTransferId !==
              normalizedTransferId
          ) {
            throw new Error(
              `Sales payout ${payout.id} already references a different Stripe Transfer.`,
            )
          }

          const duplicateTransfer =
            await payoutRepo
              .createQueryBuilder(
                'otherPayout',
              )
              .where(
                'otherPayout.stripeTransferId = :stripeTransferId',
                {
                  stripeTransferId:
                    normalizedTransferId,
                },
              )
              .andWhere(
                'otherPayout.id <> :payoutId',
                {
                  payoutId:
                    payout.id,
                },
              )
              .getOne()

          if (duplicateTransfer) {
            throw new Error(
              `Stripe Transfer ${normalizedTransferId} is already assigned to Sales payout ${duplicateTransfer.id}.`,
            )
          }

          const payoutItems =
            await payoutItemRepo
              .createQueryBuilder(
                'item',
              )
              .where(
                'item.salesPayoutId = :payoutId',
                {
                  payoutId:
                    payout.id,
                },
              )
              .orderBy(
                'item.id',
                'ASC',
              )
              .getMany()

          if (
            payoutItems.length ===
            0
          ) {
            throw new Error(
              `Sales payout ${payout.id} has no payout items.`,
            )
          }

          const payoutUnits =
            BigInt(
              payout.amountCents,
            ) *
            SALES_PAYOUT_UNITS_PER_CENT

          const itemUnits =
            payoutItems.reduce(
              (
                total,
                item,
              ) =>
                total +
                BigInt(
                  item.amountUnits,
                ),
              0n,
            )

          if (
            itemUnits !==
            payoutUnits
          ) {
            throw new Error(
              `Sales payout ${payout.id} items do not equal its exact payout amount.`,
            )
          }

          const commissionIds =
            [
              ...new Set(
                payoutItems.map(
                  (item) =>
                    String(
                      item.salesCommissionId,
                    ),
                ),
              ),
            ]

          const commissions =
            await commissionRepo
              .createQueryBuilder(
                'commission',
              )
              .setLock(
                'pessimistic_write',
              )
              .where(
                'commission.id IN (:...commissionIds)',
                {
                  commissionIds,
                },
              )
              .orderBy(
                'commission.id',
                'ASC',
              )
              .getMany()

          if (
            commissions.length !==
            commissionIds.length
          ) {
            throw new Error(
              'Sales payout references a missing commission.',
            )
          }

          for (
            const commission of
              commissions
          ) {
            if (
              commission.salesPartnerId !==
              payout.salesPartnerId
            ) {
              throw new Error(
                `Sales commission ${commission.id} belongs to a different Sales Partner.`,
              )
            }
          }

          /*
           * Persist PAID first inside this same
           * transaction. The consumption query
           * below therefore counts this payout as
           * paid, while rollback still protects
           * the entire transition if any invariant
           * fails afterward.
           */
          const now =
            new Date()

          payout.status =
            SalesPayoutStatus.PAID

          payout.stripeTransferId =
            normalizedTransferId

          payout.requestedAt =
            payout.requestedAt ||
            now

          payout.paidAt =
            now

          payout.failedAt =
            null

          payout.failureMessage =
            null

          await payoutRepo.save(
            payout,
          )

          const consumptionRows =
            await payoutItemRepo
              .createQueryBuilder(
                'item',
              )
              .innerJoin(
                SalesPayout,
                'otherPayout',
                'otherPayout.id = item.salesPayoutId',
              )
              .select(
                'item.salesCommissionId',
                'salesCommissionId',
              )
              .addSelect(
                `
                  COALESCE(
                    SUM(
                      CASE
                        WHEN otherPayout.status IN (:...activeStatuses)
                        THEN item."amountUnits"
                        ELSE 0
                      END
                    ),
                    0
                  )
                `,
                'activeUnits',
              )
              .addSelect(
                `
                  COALESCE(
                    SUM(
                      CASE
                        WHEN otherPayout.status = :paidStatus
                        THEN item."amountUnits"
                        ELSE 0
                      END
                    ),
                    0
                  )
                `,
                'paidUnits',
              )
              .where(
                'item.salesCommissionId IN (:...commissionIds)',
                {
                  commissionIds,
                },
              )
              .setParameters({
                activeStatuses: [
                  SalesPayoutStatus
                    .PENDING,
                  SalesPayoutStatus
                    .PROCESSING,
                ],

                paidStatus:
                  SalesPayoutStatus
                    .PAID,
              })
              .groupBy(
                'item.salesCommissionId',
              )
              .getRawMany<{
                salesCommissionId:
                  string
                activeUnits:
                  string
                paidUnits:
                  string
              }>()

          const consumptionByCommission =
            new Map<
              string,
              {
                activeUnits:
                  bigint
                paidUnits:
                  bigint
              }
            >()

          for (
            const row of
              consumptionRows
          ) {
            consumptionByCommission
              .set(
                String(
                  row.salesCommissionId,
                ),
                {
                  activeUnits:
                    BigInt(
                      row.activeUnits ||
                        '0',
                    ),

                  paidUnits:
                    BigInt(
                      row.paidUnits ||
                        '0',
                    ),
                },
              )
          }

          let finalizedCommissions =
            0

          for (
            const commission of
              commissions
          ) {
            /*
             * Payout settlement must never undo
             * an explicit commission reversal.
             */
            if (
              commission.status ===
              SalesCommissionStatus.REVERSED
            ) {
              continue
            }

            const exactUnits =
              BigInt(
                commission
                  .commissionUnits,
              )

            const consumed =
              consumptionByCommission
                .get(
                  String(
                    commission.id,
                  ),
                ) || {
                activeUnits:
                  0n,
                paidUnits:
                  0n,
              }

            const activeUnits =
              consumed.activeUnits

            const paidUnits =
              consumed.paidUnits

            const totalConsumed =
              activeUnits +
              paidUnits

            if (
              activeUnits < 0n ||
              paidUnits < 0n ||
              totalConsumed >
                exactUnits
            ) {
              throw new Error(
                `Sales commission ${commission.id} has invalid payout consumption.`,
              )
            }

            const previousStatus =
              commission.status

            /*
             * Fully paid exact units -> PAID.
             *
             * Fully consumed but with an active
             * reservation still outstanding ->
             * PAYOUT_PENDING.
             *
             * Otherwise an exact residual remains
             * AVAILABLE for a future payout.
             */
            if (
              paidUnits ===
              exactUnits
            ) {
              commission.status =
                SalesCommissionStatus
                  .PAID
            } else if (
              totalConsumed ===
              exactUnits
            ) {
              commission.status =
                SalesCommissionStatus
                  .PAYOUT_PENDING
            } else {
              commission.status =
                SalesCommissionStatus
                  .AVAILABLE
            }

            if (
              previousStatus !==
              commission.status
            ) {
              finalizedCommissions +=
                1
            }
          }

          await commissionRepo.save(
            commissions,
          )

          return {
            payoutId:
              payout.id,

            status:
              payout.status,

            stripeTransferId:
              payout.stripeTransferId,

            alreadyPaid:
              false,

            finalizedCommissions,
          }
        },
      )
  }

}
