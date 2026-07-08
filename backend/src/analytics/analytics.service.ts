import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { Order } from '../order/order.entity'

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  // ====================================
  // DASHBOARD
  // ====================================

  async getDashboard(
    businessId: number,
  ) {
    const orders =
      await this.orderRepo.find({
        where: {
          businessId,
        },
      })

    const now = new Date()

    const todayOrders =
      orders.filter((order) => {
        const d = new Date(
          order.createdAt,
        )

        return (
          d.getDate() ===
            now.getDate() &&
          d.getMonth() ===
            now.getMonth() &&
          d.getFullYear() ===
            now.getFullYear()
        )
      })

    const monthOrders =
      orders.filter((order) => {
        const d = new Date(
          order.createdAt,
        )

        return (
          d.getMonth() ===
            now.getMonth() &&
          d.getFullYear() ===
            now.getFullYear()
        )
      })

    const allTimeRevenue =
      orders.reduce(
        (sum, order) =>
          sum +
          Number(order.total || 0),
        0,
      )

    return {
      todayRevenue:
        Number(
          todayOrders
            .reduce(
              (sum, order) =>
                sum +
                Number(
                  order.total || 0,
                ),
              0,
            )
            .toFixed(2),
        ),

      todayOrders:
        todayOrders.length,

      monthRevenue:
        Number(
          monthOrders
            .reduce(
              (sum, order) =>
                sum +
                Number(
                  order.total || 0,
                ),
              0,
            )
            .toFixed(2),
        ),

      monthOrders:
        monthOrders.length,

      allTimeRevenue:
        Number(
          allTimeRevenue.toFixed(
            2,
          ),
        ),

      allTimeOrders:
        orders.length,

      averageOrderValue:
        orders.length > 0
          ? Number(
              (
                allTimeRevenue /
                orders.length
              ).toFixed(2),
            )
          : 0,
    }
  }

  // ====================================
  // TOP SELLING ITEMS
  // ====================================

  async getTopItems(
    businessId: number,
  ) {
    const orders =
      await this.orderRepo.find({
        where: {
          businessId,
        },
      })

    const itemMap =
      new Map<
        string,
        number
      >()

    for (const order of orders) {
      const items =
        Array.isArray(
          order.items,
        )
          ? order.items
          : []

      for (const item of items) {
        const itemName =
          item?.name ||
          'Unknown'

        const qty = Number(
          item?.qty || 1,
        )

        itemMap.set(
          itemName,
          (itemMap.get(
            itemName,
          ) || 0) + qty,
        )
      }
    }

    return [...itemMap.entries()]
      .map(
        ([
          itemName,
          quantitySold,
        ]) => ({
          itemName,
          quantitySold,
        }),
      )
      .sort(
        (a, b) =>
          b.quantitySold -
          a.quantitySold,
      )
      .slice(0, 10)
  }

  // ====================================
  // REVENUE CHART
  // LAST 30 DAYS
  // ====================================

  async getRevenueChart(
    businessId: number,
  ) {
    const orders =
      await this.orderRepo.find({
        where: {
          businessId,
        },
      })

    const revenueMap:
      Record<
        string,
        number
      > = {}

    for (
      let i = 29;
      i >= 0;
      i--
    ) {
      const date =
        new Date()

      date.setDate(
        date.getDate() - i,
      )

      const key =
        date
          .toISOString()
          .split('T')[0]

      revenueMap[key] = 0
    }

    for (const order of orders) {
      const key =
        new Date(
          order.createdAt,
        )
          .toISOString()
          .split('T')[0]

      if (
        revenueMap[key] !==
        undefined
      ) {
        revenueMap[key] +=
          Number(
            order.total || 0,
          )
      }
    }

    return Object.keys(
      revenueMap,
    ).map((date) => ({
      date,
      revenue:
        Number(
          revenueMap[
            date
          ].toFixed(2),
        ),
    }))
  }

  // ====================================
  // RECENT ORDERS
  // ====================================

  async getRecentOrders(
    businessId: number,
  ) {
    const orders =
      await this.orderRepo.find({
        where: {
          businessId,
        },

        order: {
          createdAt:
            'DESC',
        },

        take: 20,
      })

    return orders.map(
      (order) => ({
        id: order.id,

        total:
          order.total,

        status:
          order.status,

        tableNumber:
          order.tableNumber,

        createdAt:
          order.createdAt,

        itemCount:
          Array.isArray(
            order.items,
          )
            ? order.items
                .length
            : 0,
      }),
    )
  }

  // ====================================
  // LEGACY ENDPOINTS
  // KEEP FOR COMPATIBILITY
  // ====================================

  async getRevenue(
    businessId: number,
  ) {
    const dashboard =
      await this.getDashboard(
        businessId,
      )

    return {
      revenue:
        dashboard.allTimeRevenue,
    }
  }

  async getOrders(
    businessId: number,
  ) {
    return this.orderRepo.find({
      where: {
        businessId,
      },

      order: {
        createdAt:
          'DESC',
      },
    })
  }

  async getStats() {
    const orders =
      await this.orderRepo.find()

    const revenue =
      orders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.total || 0,
          ),
        0,
      )

    return {
      totalOrders:
        orders.length,

      revenue:
        Number(
          revenue.toFixed(2),
        ),
    }
  }
}