import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { Kit } from './kit.entity'

@Injectable()
export class KitsService {

  constructor(
    @InjectRepository(Kit)
    private repo: Repository<Kit>,
  ) {}

  async listKits() {
    return this.repo.find()
  }

  async createKit(data: Partial<Kit>) {
    const kit = this.repo.create(data)
    return this.repo.save(kit)
  }

  async activateKit(kitCode: string, businessId: number) {

    const kit = await this.repo.findOne({
      where: { kitCode }
    })

    if (!kit) {
      throw new Error('Kit not found')
    }

    kit.businessId = businessId
    kit.activated = true

    return this.repo.save(kit)
  }

  async findByCode(code: string) {
    return this.repo.findOne({
      where: { kitCode: code }
    })
  }

}