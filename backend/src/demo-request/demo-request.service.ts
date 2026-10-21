import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'

import {
  InjectRepository,
} from '@nestjs/typeorm'

import {
  Repository,
} from 'typeorm'

import {
  CreateDemoRequestDto,
} from './demo-request.dto'

import {
  DemoRequest,
  DemoRequestStatus,
} from './demo-request.entity'

@Injectable()
export class DemoRequestService {
  constructor(
    @InjectRepository(
      DemoRequest,
    )
    private readonly demoRequestRepository:
      Repository<DemoRequest>,
  ) {}

  async create(
    body: CreateDemoRequestDto,
  ) {
    const email =
      String(body.email || '')
        .trim()
        .toLowerCase()

    const phone =
      String(body.phone || '')
        .trim()

    const message =
      String(body.message || '')
        .trim()

    if (
      !email ||
      !phone ||
      !message
    ) {
      throw new BadRequestException(
        'Email, phone number and message are required.',
      )
    }

    const request =
      this.demoRequestRepository
        .create({
          email,
          phone,
          message,
          status: 'NEW',
          contactedAt: null,
          closedAt: null,
        })

    const saved =
      await this.demoRequestRepository
        .save(request)

    return {
      success: true,
      id: saved.id,
      message:
        'Thanks — your demo request has been received.',
    }
  }

  async list(
    status?: string,
  ) {
    const normalizedStatus =
      String(status || '')
        .trim()
        .toUpperCase()

    const allowedStatuses:
      DemoRequestStatus[] = [
        'NEW',
        'CONTACTED',
        'CLOSED',
      ]

    const where =
      normalizedStatus &&
      allowedStatuses.includes(
        normalizedStatus as DemoRequestStatus,
      )
        ? {
            status:
              normalizedStatus as DemoRequestStatus,
          }
        : undefined

    const requests =
      await this.demoRequestRepository
        .find({
          where,
          order: {
            createdAt: 'DESC',
          },
          take: 500,
        })

    const counts =
      await this.demoRequestRepository
        .createQueryBuilder(
          'demo',
        )
        .select(
          'demo.status',
          'status',
        )
        .addSelect(
          'COUNT(*)',
          'count',
        )
        .groupBy(
          'demo.status',
        )
        .getRawMany<{
          status: string
          count: string
        }>()

    const stats = {
      total: 0,
      new: 0,
      contacted: 0,
      closed: 0,
    }

    for (const row of counts) {
      const count =
        Math.max(
          0,
          Number(
            row.count || 0,
          ),
        )

      stats.total += count

      if (row.status === 'NEW') {
        stats.new = count
      }

      if (
        row.status ===
        'CONTACTED'
      ) {
        stats.contacted = count
      }

      if (
        row.status ===
        'CLOSED'
      ) {
        stats.closed = count
      }
    }

    return {
      success: true,
      requests,
      stats,
    }
  }

  async updateStatus(
    id: string,
    status: DemoRequestStatus,
  ) {
    const request =
      await this.demoRequestRepository
        .findOne({
          where: {
            id,
          },
        })

    if (!request) {
      throw new NotFoundException(
        'Demo request not found.',
      )
    }

    const now =
      new Date()

    request.status = status

    if (
      status === 'CONTACTED' &&
      !request.contactedAt
    ) {
      request.contactedAt = now
    }

    if (
      status === 'CLOSED' &&
      !request.closedAt
    ) {
      request.closedAt = now
    }

    if (status === 'NEW') {
      request.contactedAt = null
      request.closedAt = null
    }

    const saved =
      await this.demoRequestRepository
        .save(request)

    return {
      success: true,
      request: saved,
    }
  }
}
