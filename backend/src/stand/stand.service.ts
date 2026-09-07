import {
  BadRequestException,
  Injectable,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import {
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

@Injectable()
export class StandService {
  constructor(
    @InjectRepository(StandCode)
    private readonly standRepo:
      Repository<StandCode>,
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

    const existing =
      await this.findByStoreCode(
        normalized,
      )

    if (existing) {
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
      this.standRepo.create({
        storeCode:
          normalized,

        tables,

        status:
          StandCodeStatus.UNCLAIMED,

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
      })

    const saved =
      await this.standRepo.save(
        stand,
      )

    return {
      stand:
        saved,

      activationCode,

      alreadyExists:
        false,
    }
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
          ).trim(),
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
