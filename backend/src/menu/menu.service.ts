import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { MenuItem } from './menu.entity'

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private menuRepo: Repository<MenuItem>,
  ) {}

  async create(data: any) {
    const item = this.menuRepo.create({
      name: data.name,
      price: Number(data.price),
      discountPrice:
        data.discountPrice !== undefined
          ? Number(data.discountPrice)
          : null,
      description: data.description || '',
      imageUrl: data.imageUrl || '',
      businessId: Number(data.businessId),
      category: data.category || 'General',
      available: true,
    })

    return this.menuRepo.save(item)
  }

  // ✅ STANDARDIZED NAME
  async getByBusiness(businessId: number) {
    return this.menuRepo.find({
      where: { businessId },
      order: { createdAt: 'DESC' },
    })
  }

  async delete(id: number) {
    return this.menuRepo.delete(id)
  }

  async toggleAvailability(id: number) {
    const item = await this.menuRepo.findOne({
      where: { id },
    })

    if (!item) throw new Error('Item not found')

    item.available = !item.available

    return this.menuRepo.save(item)
  }

  async update(id: number, data: any) {
    const item = await this.menuRepo.findOne({
      where: { id },
    })

    if (!item) throw new Error('Item not found')

    item.name = data.name ?? item.name
    item.price = data.price ?? item.price
    item.discountPrice =
      data.discountPrice !== undefined
        ? data.discountPrice
        : item.discountPrice
    item.description = data.description ?? item.description
    item.imageUrl = data.imageUrl ?? item.imageUrl
    item.category = data.category ?? item.category

    return this.menuRepo.save(item)
  }
}