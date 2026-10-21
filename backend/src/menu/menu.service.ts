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
  // UPDATE MENU ITEM (tenant-scoped)
  // =========================
  async updateItem(id: number, businessId: number, data: any) {
    const item = await this.menuRepo.findOne({ where: { id, businessId } })
    if (!item) {
      throw new BadRequestException('Menu item not found')
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('Invalid menu item changes.')
    }

    if (data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim()) {
        throw new BadRequestException('Name is required.')
      }
      item.name = data.name.trim()
    }
    if (data.price !== undefined) {
      const price = Number(data.price)
      if (!Number.isFinite(price) || price <= 0) {
        throw new BadRequestException('Price must be greater than zero.')
      }
      item.price = price
    }
    if (data.discount !== undefined) {
      const discount = Number(data.discount)
      if (!Number.isFinite(discount) || discount < 0 || discount >= 100) {
        throw new BadRequestException('Discount must be between 0 and less than 100.')
      }
      item.discount = discount
    }
    if (data.category !== undefined) {
      if (typeof data.category !== 'string') {
        throw new BadRequestException('Invalid category.')
      }
      item.category = data.category.trim() || 'Menu'
    }
    if (data.description !== undefined) {
      if (typeof data.description !== 'string') {
        throw new BadRequestException('Invalid description.')
      }
      item.description = data.description.trim()
    }
    if (data.customizations !== undefined) {
      if (!Array.isArray(data.customizations)) {
        throw new BadRequestException('Customizations must be an array.')
      }
      item.customizations = normalizeCustomizationsForSave(data.customizations)
    }
    // Only a new uploaded image path or an explicit removal is allowed.
    // Omitted imageUrl means leave the current image unchanged.
    if (data.imageUrl !== undefined) {
      if (data.imageUrl === null || data.imageUrl === '') {
        item.imageUrl = ''
      } else if (
        typeof data.imageUrl === 'string' &&
        /^\/uploads\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i.test(data.imageUrl) &&
        !data.imageUrl.includes('..')
      ) {
        item.imageUrl = data.imageUrl
      } else {
        throw new BadRequestException('Invalid menu image URL.')
      }
    }

    // Never modify businessId, stock/visibility flags or historical orders here.
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