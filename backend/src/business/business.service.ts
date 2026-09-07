import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common'

import { InjectRepository } from '@nestjs/typeorm'
import { DataSource, Repository } from 'typeorm'

import {
  Business,
  BusinessCountryCode,
  BusinessCurrency,
} from './business.entity'

import * as bcrypt from 'bcrypt'

import {
  createHash,
  createHmac,
  timingSafeEqual,
} from 'crypto'

import { Resend } from 'resend'

import {
  createOwnerToken,
} from '../owner-auth/owner-token'

import {
  StandCode,
  StandCodeStatus,
} from '../stand/stand-code.entity'


@Injectable()
export class BusinessService {
  private readonly resend =
    process.env.RESEND_API_KEY
      ? new Resend(
          process.env.RESEND_API_KEY,
        )
      : null

  constructor(
    @InjectRepository(Business)
    private businessRepo: Repository<Business>,

    private readonly dataSource:
      DataSource,
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
      String(
        data.email || '',
      )
        .toLowerCase()
        .trim()

    const storeCode =
      String(
        data.storeCode || '',
      )
        .trim()
        .toLowerCase()

    /*
     * Manufactured activation codes
     * are hexadecimal and generated
     * uppercase. Accept lowercase input
     * from restaurant owners too.
     */
    if (
      !email ||
      !data.password ||
      !storeCode
    ) {
      throw new BadRequestException(
        'Email, password and store code are required',
      )
    }

    /*
     * Hash outside the transaction so
     * bcrypt does not hold a DB lock
     * longer than necessary.
     */
    const hashed =
      await bcrypt.hash(
        data.password,
        10,
      )

    return this.dataSource.transaction(
      async (manager) => {
        const businessRepo =
          manager.getRepository(
            Business,
          )

        const standRepo =
          manager.getRepository(
            StandCode,
          )

        const existing =
          await businessRepo.findOne({
            where: [
              {
                email,
              },
              {
                storeCode,
              },
            ],
          })

        if (existing) {
          throw new BadRequestException(
            'Account already exists',
          )
        }

        /*
         * If this is a manufactured
         * CaviarQR code, lock its row
         * during the claim.
         *
         * If no StandCode exists, we keep
         * the legacy signup behavior.
         */
        const stand =
          await standRepo.findOne({
            where: {
              storeCode,
            },

            lock: {
              mode:
                'pessimistic_write',
            },
          })

        if (stand) {
          if (
            stand.status ===
            StandCodeStatus.CLAIMED
          ) {
            throw new BadRequestException(
              'Store code is already claimed',
            )
          }

        }

        const business =
          businessRepo.create({
            email,

            password:
              hashed,

            storeCode,

            isOpen:
              true,

            countryCode:
              BusinessCountryCode
                .UNITED_STATES,

            currency:
              BusinessCurrency.USD,
          })

        const saved =
          await businessRepo.save(
            business,
          )

        /*
         * Business creation and stand
         * claiming are part of this same
         * transaction.
         */
        if (stand) {
          stand.status =
            StandCodeStatus.CLAIMED

          stand.claimedBusinessId =
            saved.id

          stand.claimedAt =
            new Date()

          await standRepo.save(
            stand,
          )
        }

        return {
          id:
            saved.id,

          email:
            saved.email,

          storeCode:
            saved.storeCode,

          countryCode:
            saved.countryCode,

          currency:
            saved.currency,

          standClaimed:
            Boolean(stand),
        }
      },
    )
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
        where: {
          email,
        },
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

    const token =
      createOwnerToken(
        business.id,
        business.storeCode,
      )

    return {
      success: true,

      role: 'owner',

      token,

      id:
        business.id,

      email:
        business.email,

      storeCode:
        business.storeCode,

      stripeAccountId:
        business.stripeAccountId,

      isOpen:
        business.isOpen,

      countryCode:
        business.countryCode,

      currency:
        business.currency,
    }
  }

  // =========================
  // 🔐 FORGOT PASSWORD
  // =========================

  async forgotPassword(
    rawEmail: string,
  ) {
    const email =
      String(rawEmail || '')
        .trim()
        .toLowerCase()

    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email,
      )
    ) {
      throw new BadRequestException(
        'Enter a valid email address.',
      )
    }

    const business =
      await this.businessRepo.findOne({
        where: {
          email,
        },
      })

    /*
     * Always return the same response when the
     * account does not exist so this endpoint
     * cannot be used to discover owner emails.
     */
    if (!business) {
      return {
        success: true,
        message:
          'If an account exists for this email, a reset link has been sent.',
      }
    }

    const secret =
      String(
        process.env
          .PASSWORD_RESET_SECRET ||
          '',
      ).trim()

    if (!secret) {
      throw new BadRequestException(
        'Password reset service is not configured.',
      )
    }

    if (!this.resend) {
      throw new BadRequestException(
        'Email service is not configured. Add RESEND_API_KEY to backend .env and restart the backend.',
      )
    }

    const passwordFingerprint =
      createHash('sha256')
        .update(
          business.password,
        )
        .digest('hex')

    const payload =
      Buffer.from(
        JSON.stringify({
          email:
            business.email,
          exp:
            Date.now() +
            30 * 60 * 1000,
          passwordFingerprint,
        }),
        'utf8',
      ).toString(
        'base64url',
      )

    const signature =
      createHmac(
        'sha256',
        secret,
      )
        .update(payload)
        .digest(
          'base64url',
        )

    const token =
      `${payload}.${signature}`

    const frontendUrl =
      String(
        process.env
          .FRONTEND_URL ||
          process.env
            .WEB_URL ||
          'http://localhost:3000',
      ).replace(
        /\/+$/,
        '',
      )

    const resetUrl =
      `${frontendUrl}/reset-password?token=${encodeURIComponent(
        token,
      )}`

    const from =
      process.env
        .PASSWORD_RESET_EMAIL_FROM ||
      process.env
        .MAINTENANCE_EMAIL_FROM ||
      'CaviarQR <onboarding@resend.dev>'

    const result =
      await this.resend.emails.send({
        from,

        to:
          business.email,

        subject:
          'Reset your CaviarQR password',

        text:
          `You requested a CaviarQR password reset.

Open this link to create a new password:

${resetUrl}

This link expires in 30 minutes.

If you did not request this reset, you can ignore this email.`,

        html:
          `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
              <h2 style="margin: 0 0 12px;">
                Reset your CaviarQR password
              </h2>

              <p>
                We received a request to reset your CaviarQR password.
              </p>

              <p style="margin: 24px 0;">
                <a
                  href="${resetUrl}"
                  style="display: inline-block; padding: 12px 18px; background: #111827; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 700;"
                >
                  Reset Password
                </a>
              </p>

              <p>
                This link expires in 30 minutes.
              </p>

              <p>
                If you did not request this reset, you can ignore this email.
              </p>
            </div>
          `,
      })

    if (result.error) {
      throw new BadRequestException(
        result.error.message ||
          'Reset email could not be sent.',
      )
    }

    return {
      success: true,
      message:
        'If an account exists for this email, a reset link has been sent.',
    }
  }

  // =========================
  // 🔐 RESET PASSWORD
  // =========================

  async resetPassword(
    rawToken: string,
    rawPassword: string,
  ) {
    const token =
      String(
        rawToken || '',
      ).trim()

    const password =
      String(
        rawPassword || '',
      )

    if (!token) {
      throw new BadRequestException(
        'Reset token is required.',
      )
    }

    if (
      password.length < 8
    ) {
      throw new BadRequestException(
        'Password must be at least 8 characters.',
      )
    }

    const secret =
      String(
        process.env
          .PASSWORD_RESET_SECRET ||
          '',
      ).trim()

    if (!secret) {
      throw new BadRequestException(
        'Password reset service is not configured.',
      )
    }

    const parts =
      token.split('.')

    if (
      parts.length !== 2
    ) {
      throw new BadRequestException(
        'Invalid or expired reset link.',
      )
    }

    const [
      payload,
      providedSignature,
    ] = parts

    const expectedSignature =
      createHmac(
        'sha256',
        secret,
      )
        .update(payload)
        .digest(
          'base64url',
        )

    const providedBuffer =
      Buffer.from(
        providedSignature,
        'utf8',
      )

    const expectedBuffer =
      Buffer.from(
        expectedSignature,
        'utf8',
      )

    if (
      providedBuffer.length !==
        expectedBuffer.length ||
      !timingSafeEqual(
        providedBuffer,
        expectedBuffer,
      )
    ) {
      throw new BadRequestException(
        'Invalid or expired reset link.',
      )
    }

    let decoded: {
      email?: string
      exp?: number
      passwordFingerprint?: string
    }

    try {
      decoded =
        JSON.parse(
          Buffer.from(
            payload,
            'base64url',
          ).toString(
            'utf8',
          ),
        )
    } catch {
      throw new BadRequestException(
        'Invalid or expired reset link.',
      )
    }

    if (
      !decoded.email ||
      !decoded.exp ||
      !decoded.passwordFingerprint ||
      decoded.exp <
        Date.now()
    ) {
      throw new BadRequestException(
        'Invalid or expired reset link.',
      )
    }

    const email =
      String(
        decoded.email,
      )
        .trim()
        .toLowerCase()

    const business =
      await this.businessRepo.findOne({
        where: {
          email,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Invalid or expired reset link.',
      )
    }

    const currentFingerprint =
      createHash('sha256')
        .update(
          business.password,
        )
        .digest('hex')

    const providedFingerprint =
      Buffer.from(
        decoded.passwordFingerprint,
        'utf8',
      )

    const currentFingerprintBuffer =
      Buffer.from(
        currentFingerprint,
        'utf8',
      )

    if (
      providedFingerprint.length !==
        currentFingerprintBuffer.length ||
      !timingSafeEqual(
        providedFingerprint,
        currentFingerprintBuffer,
      )
    ) {
      throw new BadRequestException(
        'Invalid or expired reset link.',
      )
    }

    business.password =
      await bcrypt.hash(
        password,
        12,
      )

    await this.businessRepo.save(
      business,
    )

    return {
      success: true,
      message:
        'Password updated successfully.',
    }
  }

  // =========================
  // 🔥 COUNTRY / CURRENCY
  // =========================

  async setCountryAndCurrency(
    businessId: number,
    countryCode:
      | BusinessCountryCode
      | string,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          id:
            businessId,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Business not found',
      )
    }

    const normalizedCountry =
      String(
        countryCode || '',
      )
        .trim()
        .toUpperCase()

    let nextCountry:
      BusinessCountryCode

    let nextCurrency:
      BusinessCurrency

    if (
      normalizedCountry ===
      BusinessCountryCode
        .UNITED_STATES
    ) {
      nextCountry =
        BusinessCountryCode
          .UNITED_STATES

      nextCurrency =
        BusinessCurrency.USD
    } else if (
      normalizedCountry ===
      BusinessCountryCode.INDIA
    ) {
      nextCountry =
        BusinessCountryCode.INDIA

      nextCurrency =
        BusinessCurrency.INR
    } else {
      throw new BadRequestException(
        'Country must be US or IN.',
      )
    }

    business.countryCode =
      nextCountry

    business.currency =
      nextCurrency

    /*
     * Reset Stripe readiness after
     * a country change.
     *
     * Stripe status logic will
     * re-check whether the connected
     * account country matches the
     * selected café country.
     */
    business.stripeAccountReady =
      false

    business.stripeIssueActive =
      false

    business.stripeIssueMessage =
      null

    const saved =
      await this.businessRepo.save(
        business,
      )

    return {
      success:
        true,

      countryCode:
        saved.countryCode,

      currency:
        saved.currency,
    }
  }

  // =========================
  // 🔥 KITCHEN LOGIN
  // =========================

  async kitchenLogin(data: {
    storeCode: string
    password?: string
  }) {
    const storeCode =
      String(
        data.storeCode || '',
      ).trim()

    if (!storeCode) {
      throw new UnauthorizedException(
        'Invalid credentials',
      )
    }

    const business =
      await this.businessRepo.findOne({
        where: {
          storeCode,
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
    if (
      !password ||
      !password.trim()
    ) {
      throw new BadRequestException(
        'Kitchen password is required',
      )
    }

    const business =
      await this.businessRepo.findOne({
        where: {
          id:
            businessId,
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
      success:
        true,
    }
  }

  // =========================
  // 🔥 DISABLE PASSWORD
  // =========================

  async disableKitchenPassword(
    businessId: number,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          id:
            businessId,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Business not found',
      )
    }

    await this.businessRepo.update(
      businessId,
      {
        kitchenPassword:
          null,
      },
    )

    return {
      success:
        true,
    }
  }

  // =========================
  // 🔥 SERVICE FEE
  // =========================

  async setServiceFee(
    businessId: number,
    fee: number,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          id:
            businessId,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Business not found',
      )
    }

    const normalizedFee =
      Number(fee)

    if (
      !Number.isFinite(
        normalizedFee,
      ) ||
      normalizedFee < 0 ||
      normalizedFee > 100
    ) {
      throw new BadRequestException(
        'Service fee must be between 0 and 100.',
      )
    }

    await this.businessRepo.update(
      businessId,
      {
        serviceFee:
          normalizedFee,
      },
    )

    return {
      success:
        true,

      serviceFee:
        normalizedFee,
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
          id:
            businessId,
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
      const cleaned =
        logo
          .replace(
            /^\/+/g,
            '',
          )
          .replace(
            /^uploads\//g,
            '',
          )

      finalLogo =
        cleaned
          ? `/uploads/${cleaned}`
          : null
    }

    const cleanedName =
      typeof name ===
        'string'
        ? name.trim()
        : ''

    await this.businessRepo.update(
      businessId,
      {
        ...(cleanedName
          ? {
              name:
                cleanedName,
            }
          : {}),

        ...(logo
          ? {
              logo:
                finalLogo,
            }
          : {}),
      },
    )

    return {
      success:
        true,

      logo:
        finalLogo,
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
          id:
            businessId,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Business not found',
      )
    }

    const newValue =
      !business.isOpen

    await this.businessRepo.update(
      businessId,
      {
        isOpen:
          newValue,
      },
    )

    const updated =
      await this.businessRepo.findOne({
        where: {
          id:
            businessId,
        },
      })

    return {
      success:
        true,

      isOpen:
        updated?.isOpen ===
        true,
    }
  }

  // =========================
  // 🔥 FIND STORE
  // =========================

  async findByStoreCode(
    storeCode: string,
  ) {
    const normalizedStoreCode =
      String(
        storeCode || '',
      ).trim()

    if (!normalizedStoreCode) {
      return null
    }

    return this.businessRepo.findOne({
      where: {
        storeCode:
          normalizedStoreCode,
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

    const storeCode =
      String(
        data.storeCode || '',
      ).trim()

    if (
      !email ||
      !data.password ||
      !storeCode
    ) {
      throw new BadRequestException(
        'Email, password and store code are required',
      )
    }

    const existing =
      await this.businessRepo.findOne({
        where: [
          {
            email,
          },
          {
            storeCode,
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

        password:
          hashed,

        storeCode,

        isOpen:
          true,

        countryCode:
          BusinessCountryCode
            .UNITED_STATES,

        currency:
          BusinessCurrency.USD,
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

    return businesses
      .map(
        (business) =>
          business.storeCode,
      )
      .filter(
        (
          storeCode,
        ): storeCode is string =>
          typeof storeCode ===
            'string' &&
          storeCode.length > 0,
      )
  }
}