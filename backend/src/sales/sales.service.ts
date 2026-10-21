import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import {
  DataSource,
  Repository,
} from 'typeorm'

import * as bcrypt from 'bcrypt'

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'crypto'

import { Resend } from 'resend'

import {
  SalesPartner,
  SalesPartnerStatus,
} from './entities/sales-partner.entity'

import {
  SalesPartnerAgreement,
} from './entities/sales-partner-agreement.entity'

import {
  SalesAuditLog,
} from './entities/sales-audit-log.entity'

import {
  createSalesPartnerToken,
} from './sales-partner-token'

import {
  LegalDocument,
} from '../maintenance/legal-document.entity'

type SignupContext = {
  ipAddress?: string | null
  userAgent?: string | null
}

@Injectable()
export class SalesService {
  private readonly resend =
    process.env.RESEND_API_KEY
      ? new Resend(
          process.env.RESEND_API_KEY,
        )
      : null

  constructor(
    @InjectRepository(
      SalesPartner,
    )
    private readonly partnerRepo:
      Repository<SalesPartner>,

    private readonly dataSource:
      DataSource,
  ) {}

  private normalizeEmail(
    value: string,
  ) {
    return String(
      value || '',
    )
      .trim()
      .toLowerCase()
  }

  private normalizeReferralCode(
    value: string,
  ) {
    return String(
      value || '',
    )
      .trim()
      .toUpperCase()
  }

  private assertValidEmail(
    email: string,
  ) {
    if (
      !email ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
        .test(email)
    ) {
      throw new BadRequestException(
        'Enter a valid email address.',
      )
    }
  }

  private async currentAgreement() {
    const agreement =
      await this.dataSource
        .getRepository(
          LegalDocument,
        )
        .findOne({
          where: {
            documentType:
              'SALES_PARTNER_AGREEMENT',

            status:
              'PUBLISHED',
          },
        })

    if (!agreement) {
      throw new Error(
        'No published Sales Partner Agreement is available.',
      )
    }

    return {
      title:
        agreement.title,

      agreementVersion:
        agreement.version,

      effectiveDate:
        agreement.effectiveDate,

      agreementHash:
        agreement.contentHash,

      text:
        agreement.content,
    }
  }

  async agreement() {
    return this.currentAgreement()
  }

  private createReferralCode() {
    /*
     * 32-character alphabet with ambiguous
     * characters removed. 10 random symbols
     * gives an extremely large code space.
     */
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

    const bytes =
      randomBytes(10)

    let result =
      'CQ'

    for (
      let index = 0;
      index < bytes.length;
      index += 1
    ) {
      result +=
        alphabet[
          bytes[index] %
            alphabet.length
        ]
    }

    return result
  }

  private publicPartner(
    partner: SalesPartner,
  ) {
    return {
      id:
        partner.id,

      email:
        partner.email,

      legalName:
        partner.legalName,

      displayName:
        partner.displayName,

      phone:
        partner.phone,

      countryCode:
        partner.countryCode,

      referralCode:
        partner.referralCode,

      commissionBps:
        partner.commissionBps,

      hardwareDiscountBps:
        partner.hardwareDiscountBps,

      status:
        partner.status,

      stripeConnected:
        Boolean(
          partner.stripeAccountId,
        ),

      stripeDetailsSubmitted:
        partner
          .stripeDetailsSubmitted,

      stripePayoutsEnabled:
        partner
          .stripePayoutsEnabled,

      stripeAccountReady:
        partner
          .stripeAccountReady,

      stripeLastCheckedAt:
        partner
          .stripeLastCheckedAt,

      lastLoginAt:
        partner.lastLoginAt,

      createdAt:
        partner.createdAt,
    }
  }

  async signup(
    body: {
      email: string
      password: string
      legalName: string
      displayName?: string
      phone?: string
      agreementAccepted: boolean
      agreementVersion: string
    },
    context: SignupContext = {},
  ) {
    const email =
      this.normalizeEmail(
        body.email,
      )

    this.assertValidEmail(
      email,
    )

    const password =
      String(
        body.password || '',
      )

    if (
      password.length < 8
    ) {
      throw new BadRequestException(
        'Password must be at least 8 characters.',
      )
    }

    const legalName =
      String(
        body.legalName || '',
      ).trim()

    if (
      legalName.length < 2 ||
      legalName.length > 180
    ) {
      throw new BadRequestException(
        'Legal name is required.',
      )
    }

    const displayName =
      String(
        body.displayName || '',
      ).trim()

    if (
      displayName.length > 180
    ) {
      throw new BadRequestException(
        'Display name is too long.',
      )
    }

    const phone =
      String(
        body.phone || '',
      ).trim()

    if (
      phone.length > 50
    ) {
      throw new BadRequestException(
        'Phone number is too long.',
      )
    }

    if (
      body.agreementAccepted !==
      true
    ) {
      throw new BadRequestException(
        'You must accept the Independent Sales Partner Agreement.',
      )
    }

    const {
      agreementVersion,
      agreementHash,
    } =
      await this.currentAgreement()

    if (
      String(
        body.agreementVersion ||
        '',
      ).trim() !==
      agreementVersion
    ) {
      throw new BadRequestException(
        'The Sales Partner agreement has changed. Please review the current agreement.',
      )
    }

    /*
     * Hash before opening the transaction
     * so bcrypt never holds database locks.
     */
    const passwordHash =
      await bcrypt.hash(
        password,
        12,
      )

    /*
     * Referral-code collisions are
     * extraordinarily unlikely, but the
     * unique database constraint remains
     * authoritative.
     */
    const referralCode =
      this.createReferralCode()

    let saved:
      SalesPartner

    try {
      saved =
        await this
          .dataSource
          .transaction(
            async (manager) => {
              const partnerRepo =
                manager.getRepository(
                  SalesPartner,
                )

              const agreementRepo =
                manager.getRepository(
                  SalesPartnerAgreement,
                )

              const auditRepo =
                manager.getRepository(
                  SalesAuditLog,
                )

              const existing =
                await partnerRepo
                  .findOne({
                    where: {
                      email,
                    },

                    select: {
                      id:
                        true,
                    },
                  })

              if (existing) {
                throw new BadRequestException(
                  'Sales partner account already exists.',
                )
              }

              const partner =
                partnerRepo.create({
                  email,

                  passwordHash,

                  legalName,

                  displayName:
                    displayName ||
                    null,

                  phone:
                    phone ||
                    null,

                  countryCode:
                    'US',

                  referralCode:
                    this
                      .normalizeReferralCode(
                        referralCode,
                      ),

                  /*
                   * 1000 basis points =
                   * 10% of CaviarQR's
                   * actual platform fee.
                   */
                  commissionBps:
                    1000,

                  /*
                   * Discount stays at zero
                   * until Maintenance sets
                   * the desired promotion.
                   */
                  hardwareDiscountBps:
                    0,

                  /*
                   * Self-service Sales Partner signup
                   * becomes immediately usable.
                   *
                   * Stripe payout readiness remains
                   * independent, and actual payout
                   * execution is still protected by
                   * SALES_PAYOUTS_ENABLED.
                   */
                  status:
                    SalesPartnerStatus
                      .ACTIVE,

                  stripeAccountId:
                    null,

                  stripeDetailsSubmitted:
                    false,

                  stripePayoutsEnabled:
                    false,

                  stripeAccountReady:
                    false,

                  stripeLastCheckedAt:
                    null,

                  lastLoginAt:
                    null,

                  failedLoginAttempts:
                    0,

                  lockedUntil:
                    null,
                })

              const created =
                await partnerRepo
                  .save(partner)

              const acceptedAt =
                new Date()

              await agreementRepo.save(
                agreementRepo.create({
                  salesPartnerId:
                    created.id,

                  agreementVersion,

                  agreementHash,

                  acceptedAt,

                  ipAddress:
                    context.ipAddress
                      ? String(
                          context
                            .ipAddress,
                        )
                          .trim()
                          .slice(
                            0,
                            64,
                          ) ||
                        null
                      : null,

                  userAgent:
                    context.userAgent
                      ? String(
                          context
                            .userAgent,
                        )
                          .slice(
                            0,
                            4000,
                          ) ||
                        null
                      : null,
                }),
              )

              await auditRepo.save(
                auditRepo.create({
                  salesPartnerId:
                    created.id,

                  actorType:
                    'SALES_PARTNER',

                  actorIdentifier:
                    created.email,

                  action:
                    'PARTNER_SIGNUP',

                  metadata: {
                    status:
                      created.status,

                    referralCode:
                      created
                        .referralCode,

                    agreementVersion,
                  },
                }),
              )

              return created
            },
          )
    } catch (error: any) {
      /*
       * PostgreSQL unique violation:
       * email or referral-code collision.
       * Never expose database internals.
       */
      if (
        error?.code ===
        '23505'
      ) {
        throw new BadRequestException(
          'Sales partner account already exists. Please try again.',
        )
      }

      throw error
    }

    const token =
      createSalesPartnerToken(
        saved.id,
        saved.referralCode,
      )

    return {
      success:
        true,

      role:
        'sales_partner',

      token,

      partner:
        this.publicPartner(
          saved,
        ),
    }
  }

  async login(body: {
    email: string
    password: string
  }) {
    const email =
      this.normalizeEmail(
        body.email,
      )

    const password =
      String(
        body.password || '',
      )

    if (
      !email ||
      !password
    ) {
      throw new BadRequestException(
        'Missing credentials.',
      )
    }

    const partner =
      await this.partnerRepo
        .findOne({
          where: {
            email,
          },
        })

    /*
     * Same response for unknown and
     * disabled accounts prevents simple
     * account enumeration.
     */
    if (
      !partner ||
      partner.status ===
        SalesPartnerStatus.DISABLED
    ) {
      throw new UnauthorizedException(
        'Invalid email or password.',
      )
    }

    const now =
      new Date()

    if (
      partner.lockedUntil &&
      partner.lockedUntil >
        now
    ) {
      throw new UnauthorizedException(
        'Too many failed attempts. Try again later.',
      )
    }

    const ok =
      await bcrypt.compare(
        password,
        partner.passwordHash,
      )

    if (!ok) {
      partner.failedLoginAttempts =
        Number(
          partner
            .failedLoginAttempts ||
          0,
        ) + 1

      if (
        partner
          .failedLoginAttempts >=
        5
      ) {
        partner.lockedUntil =
          new Date(
            Date.now() +
              15 * 60 * 1000,
          )
      }

      await this.partnerRepo
        .save(partner)

      throw new UnauthorizedException(
        'Invalid email or password.',
      )
    }

    partner.failedLoginAttempts =
      0

    partner.lockedUntil =
      null

    partner.lastLoginAt =
      now

    await this.partnerRepo
      .save(partner)

    const token =
      createSalesPartnerToken(
        partner.id,
        partner.referralCode,
      )

    return {
      success:
        true,

      role:
        'sales_partner',

      token,

      partner:
        this.publicPartner(
          partner,
        ),
    }
  }

  // =========================
  // SALES PARTNER PASSWORD RESET
  // =========================

  async forgotPassword(
    rawEmail: string,
  ) {
    const email =
      this.normalizeEmail(
        rawEmail,
      )

    this.assertValidEmail(
      email,
    )

    const genericResponse = {
      success: true,
      message:
        'If a Sales Partner account exists for this email, a reset link has been sent.',
    }

    const partner =
      await this.partnerRepo
        .findOne({
          where: {
            email,
          },
        })

    /*
     * Do not reveal whether an account
     * exists or whether it is disabled.
     */
    if (
      !partner ||
      partner.status ===
        SalesPartnerStatus.DISABLED
    ) {
      return genericResponse
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
        'Email service is not configured.',
      )
    }

    /*
     * Fingerprinting the existing hash means
     * a reset link becomes invalid immediately
     * after the password has been changed.
     */
    const passwordFingerprint =
      createHash('sha256')
        .update(
          partner.passwordHash,
        )
        .digest('hex')

    const payload =
      Buffer.from(
        JSON.stringify({
          purpose:
            'sales_partner_password_reset',

          email:
            partner.email,

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
      `${frontendUrl}/sales/reset?token=${encodeURIComponent(
        token,
      )}`

    const from =
      process.env
        .PASSWORD_RESET_EMAIL_FROM ||
      process.env
        .MAINTENANCE_EMAIL_FROM ||
      'CaviarQR <onboarding@resend.dev>'

    const result =
      await this.resend
        .emails
        .send({
          from,

          to:
            partner.email,

          subject:
            'Reset your CaviarQR Sales Partner password',

          text:
            `You requested a CaviarQR Sales Partner password reset.

Open this link to create a new password:

${resetUrl}

This link expires in 30 minutes.

If you did not request this reset, you can ignore this email.`,

          html:
            `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
                <h2 style="margin: 0 0 12px;">
                  Reset your Sales Partner password
                </h2>

                <p>
                  We received a request to reset your CaviarQR Sales Partner password.
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

    return genericResponse
  }

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
      purpose?: string
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
      decoded.purpose !==
        'sales_partner_password_reset' ||
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
      this.normalizeEmail(
        decoded.email,
      )

    const partner =
      await this.partnerRepo
        .findOne({
          where: {
            email,
          },
        })

    if (
      !partner ||
      partner.status ===
        SalesPartnerStatus.DISABLED
    ) {
      throw new BadRequestException(
        'Invalid or expired reset link.',
      )
    }

    const currentFingerprint =
      createHash('sha256')
        .update(
          partner.passwordHash,
        )
        .digest('hex')

    if (
      currentFingerprint !==
        decoded.passwordFingerprint
    ) {
      throw new BadRequestException(
        'Invalid or expired reset link.',
      )
    }

    partner.passwordHash =
      await bcrypt.hash(
        password,
        10,
      )

    partner.failedLoginAttempts =
      0

    partner.lockedUntil =
      null

    await this.partnerRepo
      .save(partner)

    return {
      success: true,
      message:
        'Password updated successfully.',
    }
  }

  async me(
    salesPartnerId: number,
  ) {
    const partner =
      await this.partnerRepo
        .findOne({
          where: {
            id:
              salesPartnerId,
          },
        })

    if (
      !partner ||
      partner.status ===
        SalesPartnerStatus.DISABLED
    ) {
      throw new UnauthorizedException(
        'Sales partner account is unavailable.',
      )
    }

    return {
      success:
        true,

      role:
        'sales_partner',

      partner:
        this.publicPartner(
          partner,
        ),
    }
  }
}
