import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  BadRequestException,
  UseGuards,

  UploadedFile,
  UseInterceptors,} from '@nestjs/common'


import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { randomBytes } from 'crypto'
import { extname } from 'path'
import { ShopService } from '../shop/shop.service'


import { BusinessService } from '../business/business.service'
import { MaintenanceService } from './maintenance.service'
import { PlatformPayoutService } from './platform-payout.service'
import { MaintenanceJwtGuard } from '../maintenance-auth/maintenance-jwt.guard'
import { StandService } from '../stand/stand.service'

@Controller('maintenance')
@UseGuards(MaintenanceJwtGuard)
export class MaintenanceController {
  constructor(
    private readonly businessService: BusinessService,
    private readonly maintenanceService: MaintenanceService,
    private readonly platformPayoutService: PlatformPayoutService,
    private readonly standService: StandService,

    private readonly shopService: ShopService,
  ) {}

  // =========================
  // 🔥 CREATE STORE + QR LINKS
  // =========================

  @Post('create-store')
  async createStore(
    @Body()
    body: {
      storeCode: string
      tables?: number
    },
  ) {
    const storeCode =
      String(body?.storeCode || '')
        .trim()
        .toLowerCase()

    const tables =
      Number(
        body?.tables ?? 10,
      )

    if (
      !storeCode ||
      storeCode.length < 3
    ) {
      throw new BadRequestException(
        'Valid storeCode required',
      )
    }

    if (
      !Number.isInteger(tables) ||
      tables < 1 ||
      tables > 100
    ) {
      throw new BadRequestException(
        'Tables must be between 1 and 100',
      )
    }

    /*
     * Never reserve a code that is
     * already owned by a real Business.
     */
    const existingBusiness =
      await this.businessService
        .findByStoreCode(
          storeCode,
        )

    if (existingBusiness) {
      const frontendUrl =
        process.env.FRONTEND_URL ||
        process.env.WEB_URL ||
        'http://localhost:3000'

      const cleanFrontendUrl =
        frontendUrl.replace(
          /\/+$/,
          '',
        )

      const links: {
        table: number
        url: string
      }[] = []

      for (
        let i = 1;
        i <= tables;
        i++
      ) {
        links.push({
          table: i,
          url:
            `${cleanFrontendUrl}/store/${storeCode}?table=${i}`,
        })
      }

      return {
        success: true,

        storeCode,

        tables,

        status:
          'CLAIMED',

        registered:
          true,

        alreadyExists:
          true,

        links,
      }
    }

    const allocation =
      await this.standService
        .createAllocation(
          storeCode,
          tables,
        )

    const stand =
      allocation.stand

    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.WEB_URL ||
      'http://localhost:3000'

    const cleanFrontendUrl =
      frontendUrl.replace(
        /\/+$/,
        '',
      )

    const links: {
      table: number
      url: string
    }[] = []

    for (
      let i = 1;
      i <= stand.tables;
      i++
    ) {
      links.push({
        table: i,
        url:
          `${cleanFrontendUrl}/store/${stand.storeCode}?table=${i}`,
      })
    }

    return {
      success: true,

      storeCode:
        stand.storeCode,

      tables:
        stand.tables,

      status:
        stand.status,

      alreadyExists:
        allocation.alreadyExists,

      links,
    }
  }

  // =========================
  // SHOP PRODUCTS
  // =========================

  @Get('shop/products')
  async getShopProducts() {
    return {
      products:
        await this.shopService
          .getAdminProducts(),
    }
  }

  @Post('shop/products')
  async createShopProduct(
    @Body()
    body: Record<string, unknown>,
  ) {
    return this.shopService
      .createProduct(body)
  }

  @Patch('shop/products/:id')
  async updateShopProduct(
    @Param('id')
    id: string,

    @Body()
    body: Record<string, unknown>,
  ) {
    return this.shopService
      .updateProduct(
        Number(id),
        body,
      )
  }

  @Post('shop/products/:id/image')
  @UseInterceptors(
    FileInterceptor(
      'file',
      {
        storage: diskStorage({
          destination:
            './uploads',

          filename: (
            _req,
            file,
            cb,
          ) => {
            const originalExt =
              extname(
                file.originalname ||
                  '',
              )
                .toLowerCase()

            const allowedExt =
              new Set([
                '.jpg',
                '.jpeg',
                '.png',
                '.webp',
              ])

            const safeExt =
              allowedExt.has(
                originalExt,
              )
                ? originalExt
                : '.jpg'

            cb(
              null,
              `shop-${randomBytes(16)
                .toString('hex')}${safeExt}`,
            )
          },
        }),

        limits: {
          fileSize:
            5 * 1024 * 1024,
        },

        fileFilter: (
          _req,
          file,
          cb,
        ) => {
          const allowed =
            new Set([
              'image/jpeg',
              'image/png',
              'image/webp',
            ])

          if (
            !allowed.has(
              file.mimetype,
            )
          ) {
            return cb(
              new BadRequestException(
                'Only JPG, PNG and WebP images are allowed.',
              ),
              false,
            )
          }

          cb(
            null,
            true,
          )
        },
      },
    ),
  )
  async uploadShopProductImage(
    @Param('id')
    id: string,

    @UploadedFile()
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'Product image is required.',
      )
    }

    return this.shopService
      .setProductImage(
        Number(id),
        `/uploads/${file.filename}`,
      )
  }

  // =========================
  // SHOP ORDERS
  // =========================

  @Get('shop/orders')
  async getShopOrders(
    @Query('view')
    view?: string,

    @Query('limit')
    limit?: string,

    @Query('cursor')
    cursor?: string,

    @Query('search')
    search?: string,
  ) {
    return this.shopService
      .getOrders({
        view,
        limit,
        cursor,
        search,
      })
  }

  @Patch(
    'shop/orders/:id/fulfillment',
  )
  async updateShopOrderFulfillment(
    @Param('id')
    id: string,

    @Body()
    body: Record<string, unknown>,
  ) {
    return this.shopService
      .updateFulfillment(
        Number(id),
        body,
      )
  }

  @Post(
    'shop/orders/:id/refund',
  )
  async refundShopOrder(
    @Param('id')
    id: string,

    @Body()
    body: Record<string, unknown>,
  ) {
    return this.shopService
      .refundHardwareOrder(
        Number(id),
        body,
      )
  }

  @Get('stores')
  async getStores() {
    const stores =
      await this.businessService.getAllStoreCodes()

    return {
      success: true,
      count:
        stores.length,
      stores,
    }
  }

  // =========================
  // 🔥 ACTION CENTER
  // =========================

  @Get('action-center')
  async getActionCenter() {
    const issues =
      await this.maintenanceService.getIssues()

    return {
      success: true,
      issues,
    }
  }

  // =========================
  // 🔥 ISSUES ONLY
  // =========================

  @Get('issues')
  async getIssues() {
    const issues =
      await this.maintenanceService.getIssues()

    return {
      success: true,
      issues,
    }
  }

  // =========================
  // 🔥 RECONCILE PENDING ORDERS
  // =========================

  @Post('reconcile-pending-orders')
  async reconcilePendingOrders() {
    return this.maintenanceService.reconcilePendingOrders()
  }

  // =========================
  // 🔥 DASHBOARD STATS
  // =========================

  @Get('stats')
  async getStats() {
    return this.maintenanceService.getDashboardStats()
  }

  // =========================
  // 🔥 ALL ORDERS
  // =========================

  @Get('orders')
  async getAllOrders() {
    const orders =
      await this.maintenanceService.getAllOrders()

    return {
      success: true,
      orders,
    }
  }

  // =========================
  // 🔥 GET CAFE DETAILS
  // =========================

  @Get('cafe/:storeCode')
  async getCafe(
    @Param('storeCode')
    storeCode: string,
  ) {
    const cleanStoreCode =
      String(storeCode || '')
        .trim()
        .toLowerCase()

    if (!cleanStoreCode) {
      throw new BadRequestException(
        'Valid store code is required.',
      )
    }

    const data =
      await this.maintenanceService.getCafeDetails(
        cleanStoreCode,
      )

    return {
      success: true,
      ...data,
    }
  }

  // =========================
  // 🔥 UPDATE PROCESSING FEE
  // =========================

  @Patch(
    'cafe/:storeCode/processing-fee',
  )
  async updateProcessingFee(
    @Param('storeCode')
    storeCode: string,

    @Body()
    body: {
      processingFeePercent: number
    },
  ) {
    const cleanStoreCode =
      String(storeCode || '')
        .trim()
        .toLowerCase()

    if (!cleanStoreCode) {
      throw new BadRequestException(
        'Valid store code is required.',
      )
    }

    const fee =
      Number(
        body?.processingFeePercent,
      )

    if (Number.isNaN(fee)) {
      throw new BadRequestException(
        'Valid processing fee is required.',
      )
    }

    return this.maintenanceService.updateProcessingFee(
      cleanStoreCode,
      fee,
    )
  }

  // =========================
  // 📧 EMAIL MARKETING ACCESS
  // =========================

  @Patch(
    'cafe/:storeCode/email-marketing',
  )
  async updateEmailMarketing(
    @Param('storeCode')
    storeCode: string,

    @Body()
    body: {
      enabled?: unknown
    },
  ) {
    const cleanStoreCode =
      String(
        storeCode || '',
      )
        .trim()
        .toLowerCase()

    if (!cleanStoreCode) {
      throw new BadRequestException(
        'Valid store code is required.',
      )
    }

    if (
      typeof body?.enabled !==
      'boolean'
    ) {
      throw new BadRequestException(
        'Email marketing enabled must be true or false.',
      )
    }

    return this.maintenanceService
      .updateEmailMarketingEnabled(
        cleanStoreCode,
        body.enabled,
      )
  }

  // =========================
  // 🔥 RESOLVE ISSUE
  // =========================

  @Patch('resolve/:id')
  async resolveIssue(
    @Param('id')
    id: string,
  ) {
    const orderId =
      Number(id)

    if (
      !orderId ||
      Number.isNaN(orderId)
    ) {
      throw new BadRequestException(
        'Valid order id is required.',
      )
    }

    return this.maintenanceService.resolveIssue(
      orderId,
    )
  }

  // =========================
  // 💳 REFUND ORDER
  // =========================

  @Patch('refund/:id')
  async refundOrder(
    @Param('id')
    id: string,

    @Body()
    body: {
      reason?: string
    },
  ) {
    const orderId =
      Number(id)

    if (
      !orderId ||
      Number.isNaN(orderId)
    ) {
      throw new BadRequestException(
        'Valid order id is required.',
      )
    }

    const reason =
      String(
        body?.reason ||
          'Refunded by CaviarQR maintenance.',
      ).trim()

    return this.maintenanceService.refundOrder(
      orderId,
      {
        reason,
        performedBy:
          'MAINTENANCE_ADMIN',
      },
    )
  }

  // =========================
  // 🔥 EMAIL CUSTOMER
  // =========================

  @Post('email-customer')
  async emailCustomer(
    @Body()
    body: {
      orderId: number
      email: string
      name?: string
      note: string
    },
  ) {
    return this.maintenanceService.emailCustomer(
      body,
    )
  }

  // =========================
  // 🔥 CAVIARQR PLATFORM BALANCE
  // =========================

  @Get('platform-balance')
  async getPlatformBalance() {
    return this.maintenanceService.getPlatformBalance()
  }

  @Get('platform-revenue')
  async getPlatformRevenue() {
    return this.platformPayoutService
      .getPlatformRevenue()
  }

  // =========================
  // CAVIARQR PLATFORM PAYOUT
  // =========================

  @Post('platform-withdraw')
  async withdrawPlatformBalance(
    @Body()
    body: {
      amountCents?: unknown
      idempotencyKey?: unknown
    },
  ) {
    return this.platformPayoutService
      .withdrawPlatformBalance({
        amountCents:
          body?.amountCents,

        idempotencyKey:
          body?.idempotencyKey,

        requestedBy:
          'MAINTENANCE_ADMIN',
      })
  }
}