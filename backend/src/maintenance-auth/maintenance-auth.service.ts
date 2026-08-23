import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

import { InjectRepository } from '@nestjs/typeorm'

import { Repository } from 'typeorm'

import { JwtService } from '@nestjs/jwt'

import * as bcrypt from 'bcrypt'

import { Resend } from 'resend'

import { MaintenanceAdmin } from './maintenance-admin.entity'

@Injectable()
export class MaintenanceAuthService {
  private resend: Resend | null = null

  constructor(
    @InjectRepository(
      MaintenanceAdmin,
    )
    private adminRepo: Repository<MaintenanceAdmin>,

    private jwtService: JwtService,
  ) {
    if (process.env.RESEND_API_KEY) {
      this.resend = new Resend(
        process.env.RESEND_API_KEY,
      )
    }
  }

  private normalizeEmail(
    email: string,
  ) {
    return String(email || '')
      .trim()
      .toLowerCase()
  }

  private getAllowedAdminEmail() {
    return this.normalizeEmail(
      process.env.MAINTENANCE_ADMIN_EMAIL ||
        '',
    )
  }

  private assertAllowedEmail(
    email: string,
  ) {
    const normalized =
      this.normalizeEmail(email)

    const allowed =
      this.getAllowedAdminEmail()

    if (!allowed) {
      throw new BadRequestException(
        'MAINTENANCE_ADMIN_EMAIL is missing in .env',
      )
    }

    if (normalized !== allowed) {
      throw new UnauthorizedException(
        'This email is not allowed for Maintenance',
      )
    }

    return normalized
  }

  private async signToken(
    admin: MaintenanceAdmin,
  ) {
    return this.jwtService.signAsync(
      {
        sub: admin.id,
        email: admin.email,
        role: 'maintenance_admin',
      },
      {
        secret:
          process.env.JWT_SECRET ||
          'supersecretkey',

        expiresIn: 60 * 60 * 12,
      },
    )
  }

  private async sendOtpEmail(
    email: string,
    otp: string,
  ) {
    const from =
      process.env.MAINTENANCE_EMAIL_FROM ||
      'CaviarQR <onboarding@resend.dev>'

    if (!this.resend) {
      console.log(
        'MAINTENANCE PASSWORD RESET OTP:',
        otp,
      )

      return
    }

    await this.resend.emails.send({
      from,
      to: email,
      subject:
        'Your CaviarQR Maintenance reset code',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5">
          <h2>CaviarQR Maintenance</h2>
          <p>Your password reset code is:</p>
          <h1 style="letter-spacing:4px">${otp}</h1>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this, ignore this email.</p>
        </div>
      `,
    })
  }

  async register(body: {
    email: string
    password: string
    otp: string
  }) {
    const email =
      this.assertAllowedEmail(
        body.email,
      )

    const registerOtp =
      process.env
        .MAINTENANCE_REGISTER_OTP ||
      ''

    if (!registerOtp) {
      throw new BadRequestException(
        'MAINTENANCE_REGISTER_OTP is missing in .env',
      )
    }

    if (
      String(body.otp || '').trim() !==
      registerOtp
    ) {
      throw new UnauthorizedException(
        'Invalid register OTP',
      )
    }

    if (
      !body.password ||
      body.password.length < 8
    ) {
      throw new BadRequestException(
        'Password must be at least 8 characters',
      )
    }

    const existing =
      await this.adminRepo.findOne({
        where: {
          email,
        },
      })

    if (existing) {
      throw new BadRequestException(
        'Maintenance admin already exists',
      )
    }

    const passwordHash =
      await bcrypt.hash(
        body.password,
        12,
      )

    const admin =
      this.adminRepo.create({
        email,
        passwordHash,
        isActive: true,
        resetOtpHash: null,
        resetOtpExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: null,
      })

    const saved =
      await this.adminRepo.save(
        admin,
      )

    const token =
      await this.signToken(saved)

    return {
      success: true,
      token,
      admin: {
        id: saved.id,
        email: saved.email,
      },
    }
  }

  async login(body: {
    email: string
    password: string
  }) {
    const email =
      this.assertAllowedEmail(
        body.email,
      )

    const admin =
      await this.adminRepo.findOne({
        where: {
          email,
        },
      })

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException(
        'Invalid login',
      )
    }

    if (
      admin.lockedUntil &&
      admin.lockedUntil > new Date()
    ) {
      throw new UnauthorizedException(
        'Too many failed attempts. Try again later.',
      )
    }

    const ok =
      await bcrypt.compare(
        body.password || '',
        admin.passwordHash,
      )

    if (!ok) {
      admin.failedLoginAttempts =
        Number(
          admin.failedLoginAttempts ||
            0,
        ) + 1

      if (
        admin.failedLoginAttempts >=
        5
      ) {
        admin.lockedUntil =
          new Date(
            Date.now() +
              15 * 60 * 1000,
          )
      }

      await this.adminRepo.save(
        admin,
      )

      throw new UnauthorizedException(
        'Invalid login',
      )
    }

    admin.failedLoginAttempts = 0
    admin.lockedUntil = null
    admin.lastLoginAt = new Date()

    await this.adminRepo.save(admin)

    const token =
      await this.signToken(admin)

    return {
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
      },
    }
  }

  async forgotPassword(body: {
    email: string
  }) {
    const email =
      this.assertAllowedEmail(
        body.email,
      )

    const admin =
      await this.adminRepo.findOne({
        where: {
          email,
        },
      })

    if (!admin) {
      return {
        success: true,
        message:
          'If this admin exists, a reset code was sent.',
      }
    }

    const otp =
      String(
        Math.floor(
          100000 +
            Math.random() *
              900000,
        ),
      )

    admin.resetOtpHash =
      await bcrypt.hash(otp, 12)

    admin.resetOtpExpiresAt =
      new Date(
        Date.now() +
          10 * 60 * 1000,
      )

    await this.adminRepo.save(admin)

    await this.sendOtpEmail(
      email,
      otp,
    )

    return {
      success: true,
      message:
        'If this admin exists, a reset code was sent.',
    }
  }

  async resetPassword(body: {
    email: string
    otp: string
    newPassword: string
  }) {
    const email =
      this.assertAllowedEmail(
        body.email,
      )

    if (
      !body.newPassword ||
      body.newPassword.length < 8
    ) {
      throw new BadRequestException(
        'Password must be at least 8 characters',
      )
    }

    const admin =
      await this.adminRepo.findOne({
        where: {
          email,
        },
      })

    if (
      !admin ||
      !admin.resetOtpHash ||
      !admin.resetOtpExpiresAt
    ) {
      throw new BadRequestException(
        'Invalid or expired OTP',
      )
    }

    if (
      admin.resetOtpExpiresAt <
      new Date()
    ) {
      throw new BadRequestException(
        'Invalid or expired OTP',
      )
    }

    const ok =
      await bcrypt.compare(
        String(body.otp || '').trim(),
        admin.resetOtpHash,
      )

    if (!ok) {
      throw new BadRequestException(
        'Invalid or expired OTP',
      )
    }

    admin.passwordHash =
      await bcrypt.hash(
        body.newPassword,
        12,
      )

    admin.resetOtpHash = null
    admin.resetOtpExpiresAt = null
    admin.failedLoginAttempts = 0
    admin.lockedUntil = null

    await this.adminRepo.save(admin)

    return {
      success: true,
      message:
        'Password reset successfully',
    }
  }

  async me(payload: any) {
    return {
      success: true,
      admin: {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      },
    }
  }
}