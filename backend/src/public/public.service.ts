import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Business } from '../business/business.entity'

@Injectable()
export class PublicService {
  constructor(
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
  ) {}

  async getStore(storeCode: string) {
    return this.businessRepo.findOne({
      where: { storeCode },
    })
  }

  // ✅ FIXED: added method
  async getMenuByStore(storeCode: string) {
    const business = await this.businessRepo.findOne({
      where: { storeCode },
    })

    if (!business) return []

    // dummy for now (your menu module already exists)
    return []
  }
}