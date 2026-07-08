import {
  Injectable,
  BadRequestException,
} from '@nestjs/common'

import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { MenuItem } from './menu.entity'

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
  async delete(id: number) {
    const item =
      await this.menuRepo.findOne({
        where: { id },
      })

    if (!item) {
      throw new BadRequestException(
        'Menu item not found',
      )
    }

    await this.menuRepo.delete(id)

    return {
      success: true,
    }
  }

  // =========================
  // 🔥 HIDE ITEM
  // =========================
  async toggleHide(id: number) {
    const item =
      await this.menuRepo.findOne({
        where: { id },
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
  async toggleStock(id: number) {
    const item =
      await this.menuRepo.findOne({
        where: { id },
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
    discount: number,
  ) {
    const item =
      await this.menuRepo.findOne({
        where: { id },
      })

    if (!item) {
      throw new BadRequestException(
        'Menu item not found',
      )
    }

    item.discount =
      Number(discount || 0)

    return this.menuRepo.save(item)
  }
}