import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common'

import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Business } from './business.entity'

import * as bcrypt from 'bcrypt'

@Injectable()
export class BusinessService {
  constructor(
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
  ) {}

  // =========================
  // 🔥 SIGNUP
  // =========================
  async signup(data: {
    email: string
    password: string
    storeCode: string
  }) {
    const email =
      data.email
        .toLowerCase()
        .trim()

    const existing =
      await this.businessRepo.findOne({
        where: [
          { email },
          {
            storeCode:
              data.storeCode,
          },
        ],
      })

    if (existing) {
      throw new BadRequestException(
        'Account already exists',
      )
    }

    const hashed =
      await bcrypt.hash(
        data.password,
        10,
      )

    const business =
      this.businessRepo.create({
        email,
        password: hashed,
        storeCode:
          data.storeCode,
        isOpen: true,
      })

    const saved =
      await this.businessRepo.save(
        business,
      )

    return {
      id: saved.id,
      email: saved.email,
      storeCode:
        saved.storeCode,
    }
  }

  // =========================
  // 🔥 LOGIN
  // =========================
  async login(data: {
    email: string
    password: string
  }) {
    if (
      !data.email ||
      !data.password
    ) {
      throw new BadRequestException(
        'Missing credentials',
      )
    }

    const email =
      data.email
        .toLowerCase()
        .trim()

    const business =
      await this.businessRepo.findOne({
        where: { email },
      })

    if (!business) {
      throw new UnauthorizedException(
        'Invalid email or password',
      )
    }

    const isMatch =
      await bcrypt.compare(
        data.password,
        business.password,
      )

    if (!isMatch) {
      throw new UnauthorizedException(
        'Invalid email or password',
      )
    }

    return {
      id: business.id,
      email: business.email,
      storeCode:
        business.storeCode,
      stripeAccountId:
        business.stripeAccountId,
      isOpen:
        business.isOpen,
    }
  }

  // =========================
  // 🔥 KITCHEN LOGIN
  // =========================
  async kitchenLogin(data: {
    storeCode: string
    password?: string
  }) {
    const business =
      await this.businessRepo.findOne({
        where: {
          storeCode:
            data.storeCode,
        },
      })

    if (!business) {
      throw new UnauthorizedException(
        'Invalid credentials',
      )
    }

    // 🔥 PASSWORDLESS MODE
    if (
      !business.kitchenPassword
    ) {
      return {
        businessId:
          business.id,
        storeCode:
          business.storeCode,
      }
    }

    if (!data.password) {
      throw new UnauthorizedException(
        'Invalid credentials',
      )
    }

    const isMatch =
      await bcrypt.compare(
        data.password,
        business.kitchenPassword,
      )

    if (!isMatch) {
      throw new UnauthorizedException(
        'Invalid credentials',
      )
    }

    return {
      businessId:
        business.id,
      storeCode:
        business.storeCode,
    }
  }

  // =========================
  // 🔥 SET KITCHEN PASSWORD
  // =========================
  async setKitchenPassword(
    businessId: number,
    password: string,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          id: businessId,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Business not found',
      )
    }

    const hashed =
      await bcrypt.hash(
        password,
        10,
      )

    await this.businessRepo.update(
      businessId,
      {
        kitchenPassword:
          hashed,
      },
    )

    return {
      success: true,
    }
  }

  // =========================
  // 🔥 DISABLE PASSWORD
  // =========================
  async disableKitchenPassword(
    businessId: number,
  ) {
    await this.businessRepo.update(
      businessId,
      {
        kitchenPassword:
          null,
      },
    )

    return {
      success: true,
    }
  }

  // =========================
  // 🔥 SERVICE FEE
  // =========================
  async setServiceFee(
    businessId: number,
    fee: number,
  ) {
    await this.businessRepo.update(
      businessId,
      {
        serviceFee:
          Number(fee) || 0,
      },
    )

    return {
      success: true,
    }
  }

  // =========================
  // 🔥 BRANDING UPDATE
  // =========================
  async updateBranding(
    businessId: number,
    name?: string,
    logo?: string,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          id: businessId,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Business not found',
      )
    }

    let finalLogo =
      business.logo

    if (logo) {
      const cleaned = logo
        .replace(
          /^\/+/g,
          '',
        )
        .replace(
          /^uploads\//g,
          '',
        )

      finalLogo = `/uploads/${cleaned}`
    }

    await this.businessRepo.update(
      businessId,
      {
        ...(name
          ? { name }
          : {}),
        ...(finalLogo
          ? {
              logo:
                finalLogo,
            }
          : {}),
      },
    )

    return {
      success: true,
      logo: finalLogo,
    }
  }

  // =========================
  // 🔥 TOGGLE OPEN/CLOSED
  // =========================
  async toggleOpen(
    businessId: number,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          id: businessId,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Business not found',
      )
    }

    // 🔥 FORCE FRESH VALUE
    const newValue =
      !business.isOpen

    await this.businessRepo.update(
      businessId,
      {
        isOpen: newValue,
      },
    )

    // 🔥 REFETCH
    const updated =
      await this.businessRepo.findOne({
        where: {
          id: businessId,
        },
      })

    return {
      success: true,
      isOpen:
        updated?.isOpen,
    }
  }

  // =========================
  // 🔥 FIND STORE
  // =========================
  async findByStoreCode(
    storeCode: string,
  ) {
    return this.businessRepo.findOne({
      where: {
        storeCode,
      },
    })
  }

  // =========================
  // 🔥 CREATE
  // =========================
  async create(data: {
    email: string
    password: string
    storeCode: string
  }) {
    const email =
      data.email
        .toLowerCase()
        .trim()

    const existing =
      await this.businessRepo.findOne({
        where: [
          { email },
          {
            storeCode:
              data.storeCode,
          },
        ],
      })

    if (existing) {
      return existing
    }

    const hashed =
      await bcrypt.hash(
        data.password,
        10,
      )

    const business =
      this.businessRepo.create({
        email,
        password: hashed,
        storeCode:
          data.storeCode,
        isOpen: true,
      })

    return this.businessRepo.save(
      business,
    )
  }

  // =========================
  // 🔥 GET ALL STORE CODES
  // =========================
  async getAllStoreCodes() {
    const businesses =
      await this.businessRepo.find({
        select: [
          'storeCode',
        ],
      })

    return businesses.map(
      (b) => b.storeCode,
    )
  }
}