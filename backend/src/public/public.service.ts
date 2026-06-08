import {
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Business } from '../business/business.entity'
import { MenuItem } from '../menu/menu.entity'

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    @InjectRepository(MenuItem)
    private menuRepo: Repository<MenuItem>,
  ) {}

  async getStore(
    storeCode: string,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          storeCode,
        },
      })

    if (!business) {
      throw new NotFoundException(
        'Store not found',
      )
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

    return {
      business: {
        id: business.id,

        name:
          business.cafeName ||
          business.name ||
          storeCode,

        cafeName:
          business.cafeName ||
          business.name ||
          storeCode,

        logo:
          business.logo ||
          null,

        coverImage:
          business.coverImage ||
          business.logo ||
          null,

        serviceFee:
          Number(
            business.serviceFee ||
              0,
          ),

        // 🔥 FIXED
        isOpen:
          business.isOpen ===
          true,
      },

      menu,
    }
  }
}