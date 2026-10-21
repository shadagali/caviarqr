import {
  BadRequestException,
  Injectable,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import {
  DataSource,
  Repository,
} from 'typeorm'

import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'crypto'

import {
  StandCode,
  StandCodeStatus,
} from './stand-code.entity'

import {
  ShopOrder,
} from '../shop/shop-order.entity'

@Injectable()
export class StandService {
  constructor(
    @InjectRepository(StandCode)
    private readonly standRepo:
      Repository<StandCode>,

    private readonly dataSource:
      DataSource,
  ) {}

  normalizeStoreCode(
    value: string,
  ) {
    return String(value || '')
      .trim()
      .toLowerCase()
  }

  private hashClaimCode(
    value: string,
  ) {
    return createHash('sha256')
      .update(value)
      .digest('hex')
  }

  async findByStoreCode(
    storeCode: string,
  ) {
    const normalized =
      this.normalizeStoreCode(
        storeCode,
      )

    if (!normalized) {
      return null
    }

    return this.standRepo.findOne({
      where: {
        storeCode:
          normalized,
      },
    })
  }

  async createAllocation(
    storeCode: string,
    tables: number,
    options: {
      shopOrderId?: number | null
    } = {},
  ) {
    const normalized =
      this.normalizeStoreCode(
        storeCode,
      )

    if (
      !normalized ||
      normalized.length < 3
    ) {
      throw new BadRequestException(
        'Valid store code required',
      )
    }

    if (
      !Number.isInteger(tables) ||
      tables < 1 ||
      tables > 100
    ) {
      throw new BadRequestException(
        'Tables must be between 1 and 100',
      )
    }

    const rawShopOrderId =
      options?.shopOrderId

    const shopOrderId =
      rawShopOrderId ===
          undefined ||
        rawShopOrderId ===
          null
        ? null
        : Number(
            rawShopOrderId,
          )

    if (
      shopOrderId !== null &&
      (
        !Number.isInteger(
          shopOrderId,
        ) ||
        shopOrderId < 1
      )
    ) {
      throw new BadRequestException(
        'Valid hardware order is required',
      )
    }

    return this.dataSource
      .transaction(
        async (manager) => {
          const standRepo =
            manager.getRepository(
              StandCode,
            )

          let salesPartnerId:
            number | null =
            null

          let salesAttributionSource:
            string | null =
            null

          /*
           * Never trust a partner ID sent
           * by the browser. When a hardware
           * order is supplied, attribution
           * is copied only from our immutable
           * paid ShopOrder snapshot.
           */
          if (
            shopOrderId !== null
          ) {
            const shopOrder =
              await manager
                .getRepository(
                  ShopOrder,
                )
                .findOne({
                  where: {
                    id:
                      shopOrderId,
                  },

                  lock: {
                    mode:
                      'pessimistic_read',
                  },
                })

            if (!shopOrder) {
              throw new BadRequestException(
                'Hardware order was not found',
              )
            }

            if (
              shopOrder
                .paymentStatus !==
              'PAID'
            ) {
              throw new BadRequestException(
                'Only paid hardware orders can create attributed stand sets',
              )
            }

            const refundStatus =
              String(
                shopOrder
                  .refundStatus ||
                  'NONE',
              )
                .trim()
                .toUpperCase()

            /*
             * FAILED means Stripe confirmed
             * the refund failed. UNKNOWN,
             * PENDING, CREATING and SUCCEEDED
             * are deliberately blocked.
             */
            if (
              ![
                'NONE',
                'FAILED',
              ].includes(
                refundStatus,
              )
            ) {
              throw new BadRequestException(
                'This hardware order cannot create a stand set while its refund status is unresolved or refunded',
              )
            }

            const candidatePartnerId =
              Number(
                shopOrder
                  .salesPartnerId ||
                  0,
              )

            salesPartnerId =
              Number.isInteger(
                candidatePartnerId,
              ) &&
              candidatePartnerId >
                0
                ? candidatePartnerId
                : null

            salesAttributionSource =
              salesPartnerId
                ? 'HARDWARE_ORDER'
                : null
          }

          const existing =
            await standRepo
              .findOne({
                where: {
                  storeCode:
                    normalized,
                },

                lock: {
                  mode:
                    'pessimistic_write',
                },
              })

          if (existing) {
            /*
             * An existing stand may be
             * linked to its hardware order
             * later, but existing immutable
             * attribution must never silently
             * switch to another order/partner.
             */
            if (
              shopOrderId !== null
            ) {
              if (
                existing
                  .shopOrderId !==
                  null &&
                existing
                  .shopOrderId !==
                  shopOrderId
              ) {
                throw new BadRequestException(
                  'This stand set is already linked to a different hardware order',
                )
              }

              if (
                existing
                  .salesPartnerId !==
                  null &&
                existing
                  .salesPartnerId !==
                  salesPartnerId
              ) {
                throw new BadRequestException(
                  'This stand set already has different Sales Partner attribution',
                )
              }

              let changed =
                false

              if (
                existing
                  .shopOrderId ===
                null
              ) {
                existing.shopOrderId =
                  shopOrderId

                changed =
                  true
              }

              if (
                existing
                  .salesPartnerId ===
                  null &&
                salesPartnerId !==
                  null
              ) {
                existing.salesPartnerId =
                  salesPartnerId

                changed =
                  true
              }

              if (
                salesPartnerId !==
                  null &&
                !existing
                  .salesAttributionSource
              ) {
                existing.salesAttributionSource =
                  salesAttributionSource

                changed =
                  true
              }

              if (changed) {
                await standRepo.save(
                  existing,
                )
              }
            }

            return {
              stand:
                existing,

              activationCode:
                null,

              alreadyExists:
                true,
            }
          }

          /*
           * Private code given to the café.
           * It is NOT placed in the QR/NFC URL.
           */
          const activationCode =
            randomBytes(16)
              .toString('hex')
              .toUpperCase()

          const stand =
            standRepo.create({
              storeCode:
                normalized,

              tables,

              status:
                StandCodeStatus
                  .UNCLAIMED,

              claimCodeHash:
                this.hashClaimCode(
                  activationCode,
                ),

              verifiedAt:
                null,

              claimedAt:
                null,

              claimedBusinessId:
                null,

              shopOrderId,

              salesPartnerId,

              salesAttributionSource,
            })

          const saved =
            await standRepo.save(
              stand,
            )

          return {
            stand:
              saved,

            activationCode,

            alreadyExists:
              false,
          }
        },
      )
  }

  verifyActivationCode(
    stand: StandCode,
    activationCode: string,
  ) {
    const suppliedHash =
      Buffer.from(
        this.hashClaimCode(
          String(
            activationCode || '',
          )
            .trim()
            .toUpperCase(),
        ),
        'hex',
      )

    const storedHash =
      Buffer.from(
        stand.claimCodeHash,
        'hex',
      )

    if (
      suppliedHash.length !==
      storedHash.length
    ) {
      return false
    }

    return timingSafeEqual(
      suppliedHash,
      storedHash,
    )
  }

  async markClaimed(
    stand: StandCode,
    businessId: number,
  ) {
    stand.status =
      StandCodeStatus.CLAIMED

    stand.claimedBusinessId =
      businessId

    stand.claimedAt =
      new Date()

    return this.standRepo.save(
      stand,
    )
  }
}
