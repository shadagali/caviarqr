import {
  Injectable,
  BadRequestException,
} from '@nestjs/common'

import { InjectRepository } from '@nestjs/typeorm'

import { Repository } from 'typeorm'

import { Order } from '../order/order.entity'
import { Business } from '../business/business.entity'

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,

    @InjectRepository(Business)
    private businessRepo: Repository<Business>,
  ) {}

  // =========================
  // 🔥 GET ALL OPEN ISSUES
  // =========================

  async getIssues() {
    return this.orderRepo.find({
      where: {
        issueResolved: false,
      },
      order: {
        id: 'DESC',
      },
    })
  }

  // =========================
  // 🔥 RESOLVE ISSUE
  // =========================

  async resolveIssue(id: number) {
    const order =
      await this.orderRepo.findOne({
        where: {
          id,
        },
      })

    if (!order) {
      throw new BadRequestException(
        'Order not found',
      )
    }

    order.issueResolved = true
    order.issueType = ''

    await this.orderRepo.save(order)

    return {
      success: true,
      orderId: order.id,
    }
  }

  // =========================
  // 🔥 EMAIL CUSTOMER
  // =========================

  async emailCustomer(body: {
    orderId: number
    email: string
    name: string
    note: string
  }) {
    console.log('EMAIL CUSTOMER')
    console.log(body)

    // TODO:
    // Send email with Resend

    return {
      success: true,
      message: 'Email queued',
    }
  }

  // =========================
  // 🔥 GET ALL ORDERS
  // =========================

  async getAllOrders() {
    return this.orderRepo.find({
      order: {
        id: 'DESC',
      },
    })
  }

  // =========================
  // 🔥 DASHBOARD STATS
  // =========================

  async getDashboardStats() {
    const orders =
      await this.orderRepo.find()

    const revenue =
      orders.reduce(
        (sum, o) => sum + o.total,
        0,
      )

    return {
      totalOrders:
        orders.length,

      totalRevenue:
        revenue,

      unresolvedIssues:
        orders.filter(
          (o) =>
            !o.issueResolved,
        ).length,

      refundedOrders:
        orders.filter(
          (o) =>
            o.status ===
            'REFUNDED',
        ).length,
    }
  }

  // =========================
  // 🔥 ADMIN DASHBOARD
  // =========================

  async getAdminDashboard() {
    const orders =
      await this.orderRepo.find({
        order: {
          id: 'DESC',
        },
      })

    const totalRevenue =
      orders.reduce(
        (sum, o) => sum + o.total,
        0,
      )

    const totalOrders =
      orders.length

    const unresolvedIssues =
      orders.filter(
        (o) => !o.issueResolved,
      ).length

    const refundedOrders =
      orders.filter(
        (o) =>
          o.status ===
          'REFUNDED',
      ).length

    const platformFees =
      orders.reduce(
        (sum, o) =>
          sum +
          (o.platformFee || 0),
        0,
      )

    const averageOrderValue =
      totalOrders > 0
        ? totalRevenue /
          totalOrders
        : 0

    return {
      totalRevenue,
      totalOrders,
      unresolvedIssues,
      refundedOrders,
      platformFees,
      averageOrderValue,
      recentOrders:
        orders.slice(0, 10),
    }
  }

  // =========================
  // 🔥 GET CAFE DETAILS
  // =========================

  async getCafeDetails(
    storeCode: string,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          storeCode,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Cafe not found',
      )
    }

    const orders =
      await this.orderRepo.find({
        where: {
          storeCode,
        },
        order: {
          id: 'DESC',
        },
      })

    const today =
      new Date()

    today.setHours(
      0,
      0,
      0,
      0,
    )

    const month =
      new Date()

    month.setDate(1)

    month.setHours(
      0,
      0,
      0,
      0,
    )

    const todayOrders =
      orders.filter(
        (
          o,
        ) =>
          new Date(
            o.createdAt,
          ) >= today,
      )

    const monthOrders =
      orders.filter(
        (
          o,
        ) =>
          new Date(
            o.createdAt,
          ) >= month,
      )

    return {
      business,

      todayRevenue:
        todayOrders.reduce(
          (
            s,
            o,
          ) =>
            s +
            o.total,
          0,
        ),

      monthRevenue:
        monthOrders.reduce(
          (
            s,
            o,
          ) =>
            s +
            o.total,
          0,
        ),

      allTimeRevenue:
        orders.reduce(
          (
            s,
            o,
          ) =>
            s +
            o.total,
          0,
        ),

      todayPlatformFees:
        todayOrders.reduce(
          (
            s,
            o,
          ) =>
            s +
            o.platformFee,
          0,
        ),

      monthPlatformFees:
        monthOrders.reduce(
          (
            s,
            o,
          ) =>
            s +
            o.platformFee,
          0,
        ),

      allTimePlatformFees:
        orders.reduce(
          (
            s,
            o,
          ) =>
            s +
            o.platformFee,
          0,
        ),

      averageOrder:
        orders.length
          ? orders.reduce(
              (
                s,
                o,
              ) =>
                s +
                o.total,
              0,
            ) /
            orders.length
          : 0,

      refunds:
        orders.filter(
          (
            o,
          ) =>
            o.status ===
            'REFUNDED',
        ).length,

      openIssues:
        orders.filter(
          (
            o,
          ) =>
            !o.issueResolved,
        ).length,

      recentOrders:
        orders.slice(
          0,
          15,
        ),
    }
  }

  // =========================
  // 🔥 UPDATE PROCESSING FEE
  // =========================

  async updateProcessingFee(
    storeCode: string,
    fee: number,
  ) {
    const business =
      await this.businessRepo.findOne({
        where: {
          storeCode,
        },
      })

    if (!business) {
      throw new BadRequestException(
        'Cafe not found',
      )
    }

    const processingFee =
      Number(fee)

    if (
      Number.isNaN(processingFee) ||
      processingFee < 0 ||
      processingFee > 10
    ) {
      throw new BadRequestException(
        'Processing fee must be between 0 and 10%',
      )
    }

    business.processingFeePercent =
      processingFee

    await this.businessRepo.save(
      business,
    )

    return {
      success: true,
      processingFeePercent:
        business.processingFeePercent,
    }
  }
}