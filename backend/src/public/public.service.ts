import {
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import {
  Business,
  BusinessCountryCode,
  BusinessCurrency,
} from '../business/business.entity'

import { MenuItem } from '../menu/menu.entity'

import {
  StandService,
} from '../stand/stand.service'

import {
  StandCodeStatus,
} from '../stand/stand-code.entity'

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Business)
    private businessRepo:
      Repository<Business>,

    @InjectRepository(MenuItem)
    private menuRepo:
      Repository<MenuItem>,

    private readonly standService:
      StandService,
  ) {}

  async getStore(
    storeCode: string,
  ) {
    const normalizedStoreCode =
      String(storeCode || '').trim()

    const business =
      await this.businessRepo.findOne({
        where: {
          storeCode:
            normalizedStoreCode,
        },
      })

    if (business?.deletedAt) {
      throw new NotFoundException(
        'Store not found',
      )
    }

    if (!business) {
      const stand =
        await this.standService
          .findByStoreCode(
            normalizedStoreCode,
          )

      if (!stand) {
        throw new NotFoundException(
          'Store not found',
        )
      }

      /*
       * A CLAIMED stand should normally
       * have a Business row. If it does
       * not, fail safely instead of
       * treating it as unclaimed.
       */
      if (
        stand.status ===
        StandCodeStatus.CLAIMED
      ) {
        throw new NotFoundException(
          'Store setup incomplete',
        )
      }

      return {
        mode:
          'stand',

        business:
          null,

        menu:
          [],

        stand: {
          storeCode:
            stand.storeCode,

          tables:
            stand.tables,

          status:
            stand.status,

          verified:
            stand.status ===
            StandCodeStatus.VERIFIED,

          claimed:
            false,
        },
      }
    }

    const menu =
      await this.menuRepo.find({
        where: {
          businessId:
            business.id,
        },

        order: {
          id: 'DESC',
        },
      })

    const currency =
      business.currency ===
      BusinessCurrency.INR
        ? BusinessCurrency.INR
        : BusinessCurrency.USD

    const countryCode =
      business.countryCode ===
      BusinessCountryCode.INDIA
        ? BusinessCountryCode.INDIA
        : BusinessCountryCode
            .UNITED_STATES

    const paymentsReady =
      business.stripeAccountReady ===
      true

    const paymentMessage =
      paymentsReady
        ? null
        : business.stripeIssueMessage ||
          'Online ordering is temporarily unavailable. Please ask the restaurant owner to complete payment setup.'

    return {
      business: {
        id:
          business.id,

        storeCode:
          business.storeCode,

        name:
          business.cafeName ||
          business.name ||
          normalizedStoreCode,

        cafeName:
          business.cafeName ||
          business.name ||
          normalizedStoreCode,

        // =========================
        // COUNTRY AND CURRENCY
        // =========================

        countryCode,

        currency,

        // Keep old frontend compatibility
        logo:
          business.logo ||
          null,

        coverImage:
          business.coverImage ||
          business.logo ||
          null,

        // Keep new frontend compatibility
        logoUrl:
          business.logo ||
          null,

        coverUrl:
          business.coverImage ||
          business.logo ||
          null,

        serviceFee:
          Number(
            business.serviceFee ||
              0,
          ),

        isOpen:
          business.isOpen ===
          true,

        // =========================
        // CUSTOMER PAYMENT STATUS
        // =========================

        paymentsReady,

        emailMarketingEnabled:
          business.emailMarketingEnabled ===
          true,

        paymentMessage,

        stripeIssueActive:
          business.stripeIssueActive ===
          true,
      },

      menu,
    }
  }
}