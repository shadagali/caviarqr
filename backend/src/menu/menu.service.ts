import {
  Injectable,
  BadRequestException,
} from '@nestjs/common'

import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { MenuItem } from './menu.entity'

import {
  normalizeCustomizationsForSave,
} from './menu-customization'

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private menuRepo: Repository<MenuItem>,
  ) {}

  // =========================
  // 🔥 CREATE ITEM
  // =========================
  async create(data: any) {
    let imageUrl = data.imageUrl || null

    if (imageUrl) {
      imageUrl = imageUrl
        .replace(/\\/g, '/')
        .replace(/^\/+/g, '')
        .replace(/^uploads\//g, '')

      imageUrl = `/uploads/${imageUrl}`
    }

    const item = this.menuRepo.create({
      businessId: data.businessId,
      name: data.name,
      description: data.description || '',
      category: data.category || 'Menu',
      price: Number(data.price || 0),
      discount: Number(data.discount || 0),
      customizations:
        normalizeCustomizationsForSave(
          data.customizations,
        ),
      imageUrl,
      isHidden: false,
      isOutOfStock: false,
    })

    return this.menuRepo.save(item)
  }

  // =========================
  // 🔥 GET BUSINESS MENU
  // =========================
  async getByBusiness(
    businessId: number,
  ) {
    return this.menuRepo.find({
      where: {
        businessId,
      },
      order: {
        id: 'DESC',
      },
    })
  }

  // =========================
  // 🔥 DELETE ITEM
  // =========================
  async delete(
    id: number,
    businessId: number,
  ) {
    const item =
      await this.menuRepo.findOne({
        where: {
          id,
          businessId,
        },
      })

    if (!item) {
      throw new BadRequestException(
        'Menu item not found',
      )
    }

    await this.menuRepo.delete({
      id,
      businessId,
    })

    return {
      success: true,
    }
  }

  // =========================
  // 🔥 HIDE ITEM
  // =========================
  async toggleHide(
    id: number,
    businessId: number,
  ) {
    const item =
      await this.menuRepo.findOne({
        where: {
          id,
          businessId,
        },
      })

    if (!item) {
      throw new BadRequestException(
        'Menu item not found',
      )
    }

    item.isHidden =
      !item.isHidden

    return this.menuRepo.save(item)
  }

  // =========================
  // 🔥 OUT OF STOCK
  // =========================
  async toggleStock(
    id: number,
    businessId: number,
  ) {
    const item =
      await this.menuRepo.findOne({
        where: {
          id,
          businessId,
        },
      })

    if (!item) {
      throw new BadRequestException(
        'Menu item not found',
      )
    }

    item.isOutOfStock =
      !item.isOutOfStock

    return this.menuRepo.save(item)
  }

  // =========================
  // 🔥 DISCOUNT
  // =========================
  async setDiscount(
    id: number,
    businessId: number,
    discount: number,
  ) {
    const normalizedDiscount =
      Number(discount)

    if (
      !Number.isFinite(
        normalizedDiscount,
      ) ||
      normalizedDiscount < 0 ||
      normalizedDiscount >= 100
    ) {
      throw new BadRequestException(
        'Discount must be between 0 and less than 100.',
      )
    }

    const item =
      await this.menuRepo.findOne({
        where: {
          id,
          businessId,
        },
      })

    if (!item) {
      throw new BadRequestException(
        'Menu item not found',
      )
    }

    item.discount =
      normalizedDiscount

    return this.menuRepo.save(item)
  }
}