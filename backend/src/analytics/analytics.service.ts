import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { IsNull, Repository } from 'typeorm'
import {
  Order,
  OrderStatus,
} from '../order/order.entity'

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  // ====================================
  // NET REVENUE HELPERS
  // ====================================

  private async getHistoricalTotals(
    businessId: number,
  ) {
    const rows:
      Array<{
        orderCount: string
        grossRevenueCents: string
        ownerAnalyticsNetRevenueCents: string
      }> =
      await this.orderRepo.manager.query(
        `
          SELECT
            COALESCE(
              SUM("orderCount"),
              0
            )::text AS "orderCount",

            COALESCE(
              SUM("grossRevenueCents"),
              0
            )::text AS "grossRevenueCents",

            COALESCE(
              SUM(
                "ownerAnalyticsNetRevenueCents"
              ),
              0
            )::text
              AS "ownerAnalyticsNetRevenueCents"

          FROM
            "business_order_history_monthly"

          WHERE
            "businessId" = $1
        `,
        [businessId],
      )

    const row =
      rows[0] || {
        orderCount: '0',
        grossRevenueCents: '0',
        ownerAnalyticsNetRevenueCents:
          '0',
      }

    return {
      orderCount:
        Number(
          row.orderCount || 0,
        ),

      grossRevenue:
        Number(
          row.grossRevenueCents || 0,
        ) / 100,

      ownerAnalyticsNetRevenue:
        Number(
          row.ownerAnalyticsNetRevenueCents ||
            0,
        ) / 100,
    }
  }

  private async getHistoricalTopItems(
    businessId: number,
  ) {
    const rows:
      Array<{
        itemName: string
        quantitySold: string
      }> =
      await this.orderRepo.manager.query(
        `
          SELECT
            "itemName",

            SUM(
              "quantitySold"
            )::text AS "quantitySold"

          FROM
            "business_order_item_history_monthly"

          WHERE
            "businessId" = $1

          GROUP BY
            "itemName"
        `,
        [businessId],
      )

    return rows.map(
      (row) => ({
        itemName:
          row.itemName,

        quantitySold:
          Number(
            row.quantitySold || 0,
          ),
      }),
    )
  }

  private money(
    value: unknown,
  ): number {
    const number =
      Number(value || 0)

    return Number.isFinite(number)
      ? number
      : 0
  }

  private isSuccessfulRefund(
    order: Order,
  ): boolean {
    return (
      order.refundProcessed ===
        true ||
      order.status ===
        OrderStatus.REFUNDED ||
      String(
        order.stripeRefundStatus ||
          '',
      ).toLowerCase() ===
        'succeeded'
    )
  }

  private orderRevenueBeforeRefund(
    order: Order,
  ): number {
    return (
      this.money(order.total) -
      this.money(order.stripeFee) -
      this.money(order.platformFee)
    )
  }

  private refundAmount(
    order: Order,
  ): number {
    if (
      !this.isSuccessfulRefund(
        order,
      )
    ) {
      return 0
    }

    return this.money(
      order.refundAmount ??
        order.total,
    )
  }

  private isSameDay(
    value: Date | string | null | undefined,
    target: Date,
  ): boolean {
    if (!value) {
      return false
    }

    const date =
      new Date(value)

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return false
    }

    return (
      date.getDate() ===
        target.getDate() &&
      date.getMonth() ===
        target.getMonth() &&
      date.getFullYear() ===
        target.getFullYear()
    )
  }

  private isSameMonth(
    value: Date | string | null | undefined,
    target: Date,
  ): boolean {
    if (!value) {
      return false
    }

    const date =
      new Date(value)

    if (
      Number.isNaN(
        date.getTime(),
      )
    ) {
      return false
    }

    return (
      date.getMonth() ===
        target.getMonth() &&
      date.getFullYear() ===
        target.getFullYear()
    )
  }

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
          archivedAt:
            IsNull(),
        },
      })

    const historical =
      await this.getHistoricalTotals(
        businessId,
      )

    const now =
      new Date()

    const todayOrders =
      orders.filter(
        (order) =>
          this.isSameDay(
            order.createdAt,
            now,
          ),
      )

    const monthOrders =
      orders.filter(
        (order) =>
          this.isSameMonth(
            order.createdAt,
            now,
          ),
      )

    /*
     * Revenue is recognized when the order
     * is created. Refunds are recognized on
     * the day/month the successful refund
     * happened, including refunds for older
     * orders.
     */

    const todaySalesAfterFees =
      todayOrders.reduce(
        (sum, order) =>
          sum +
          this.orderRevenueBeforeRefund(
            order,
          ),
        0,
      )

    const todayRefunds =
      orders.reduce(
        (sum, order) =>
          sum +
          (
            this.isSuccessfulRefund(
              order,
            ) &&
            this.isSameDay(
              order.refundAt,
              now,
            )
              ? this.refundAmount(
                  order,
                )
              : 0
          ),
        0,
      )

    const monthSalesAfterFees =
      monthOrders.reduce(
        (sum, order) =>
          sum +
          this.orderRevenueBeforeRefund(
            order,
          ),
        0,
      )

    const monthRefunds =
      orders.reduce(
        (sum, order) =>
          sum +
          (
            this.isSuccessfulRefund(
              order,
            ) &&
            this.isSameMonth(
              order.refundAt,
              now,
            )
              ? this.refundAmount(
                  order,
                )
              : 0
          ),
        0,
      )

    const allTimeSalesAfterFees =
      orders.reduce(
        (sum, order) =>
          sum +
          this.orderRevenueBeforeRefund(
            order,
          ),
        0,
      )

    const allTimeRefunds =
      orders.reduce(
        (sum, order) =>
          sum +
          this.refundAmount(
            order,
          ),
        0,
      )

    const todayNetRevenue =
      todaySalesAfterFees -
      todayRefunds

    const monthNetRevenue =
      monthSalesAfterFees -
      monthRefunds

    const allTimeNetRevenue =
      historical.ownerAnalyticsNetRevenue +
      allTimeSalesAfterFees -
      allTimeRefunds

    const allTimeOrderCount =
      historical.orderCount +
      orders.length

    const grossRevenue =
      historical.grossRevenue +
      orders.reduce(
        (sum, order) =>
          sum +
          this.money(
            order.total,
          ),
        0,
      )

    return {
      /*
       * Keep the existing response field
       * names so the current frontend and
       * legacy endpoints remain compatible.
       * Their values are now NET revenue.
       */
      todayRevenue:
        Number(
          todayNetRevenue.toFixed(
            2,
          ),
        ),

      todayOrders:
        todayOrders.length,

      monthRevenue:
        Number(
          monthNetRevenue.toFixed(
            2,
          ),
        ),

      monthOrders:
        monthOrders.length,

      allTimeRevenue:
        Number(
          allTimeNetRevenue.toFixed(
            2,
          ),
        ),

      allTimeOrders:
        allTimeOrderCount,

      averageOrderValue:
        allTimeOrderCount > 0
          ? Number(
              (
                grossRevenue /
                  allTimeOrderCount
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
          archivedAt:
            IsNull(),
        },
      })

    const itemMap =
      new Map<
        string,
        number
      >()

    const historicalItems =
      await this.getHistoricalTopItems(
        businessId,
      )

    for (
      const item
      of historicalItems
    ) {
      itemMap.set(
        item.itemName,
        item.quantitySold,
      )
    }

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

        const qty =
          Number(
            item?.qty || 1,
          )

        itemMap.set(
          itemName,
          (
            itemMap.get(
              itemName,
            ) || 0
          ) + qty,
        )
      }
    }

    return [
      ...itemMap.entries(),
    ]
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
  // NET REVENUE CHART
  // LAST 30 DAYS
  // ====================================

  async getRevenueChart(
    businessId: number,
  ) {
    const orders =
      await this.orderRepo.find({
        where: {
          businessId,
          archivedAt:
            IsNull(),
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

    /*
     * Add sales on the order date after
     * Stripe + CaviarQR fees.
     */
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
          this.orderRevenueBeforeRefund(
            order,
          )
      }
    }

    /*
     * Subtract successful refunds on the
     * actual refund date.
     */
    for (const order of orders) {
      if (
        !this.isSuccessfulRefund(
          order,
        ) ||
        !order.refundAt
      ) {
        continue
      }

      const key =
        new Date(
          order.refundAt,
        )
          .toISOString()
          .split('T')[0]

      if (
        revenueMap[key] !==
        undefined
      ) {
        revenueMap[key] -=
          this.refundAmount(
            order,
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
          archivedAt:
            IsNull(),
        },

        order: {
          createdAt:
            'DESC',
        },

        take: 20,
      })

    return orders.map(
      (order) => ({
        id:
          order.id,

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
        archivedAt:
          IsNull(),
      },

      order: {
        createdAt:
          'DESC',
      },
    })
  }

  async getStats(
    businessId: number,
  ) {
    const orders =
      await this.orderRepo.find({
        where: {
          businessId,
          archivedAt:
            IsNull(),
        },
      })

    const historical =
      await this.getHistoricalTotals(
        businessId,
      )

    const netRevenue =
      historical.ownerAnalyticsNetRevenue +
      orders.reduce(
        (sum, order) =>
          sum +
          this.orderRevenueBeforeRefund(
            order,
          ) -
          this.refundAmount(
            order,
          ),
        0,
      )

    return {
      totalOrders:
        historical.orderCount +
        orders.length,

      revenue:
        Number(
          netRevenue.toFixed(
            2,
          ),
        ),
    }
  }
}