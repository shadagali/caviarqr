import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common'

import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { randomBytes } from 'crypto'
import { extname } from 'path'

import { MenuService } from './menu.service'

import {
  MenuAccessGuard,
} from './menu-access.guard'

import type {
  MenuAccessRequest,
} from './menu-access.guard'

@Controller('menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
  ) {}

  // =========================
  // 🔥 CREATE ITEM
  // =========================
  @Post('create')
  @UseGuards(MenuAccessGuard)
  async create(
    @Req()
    request: MenuAccessRequest,

    @Body()
    body: any,
  ) {
    if (
      !body?.name ||
      !body?.price
    ) {
      throw new BadRequestException(
        'Missing fields',
      )
    }

    const discount =
      Number(body.discount || 0)

    if (
      !Number.isFinite(discount) ||
      discount < 0 ||
      discount >= 100
    ) {
      throw new BadRequestException(
        'Discount must be between 0 and less than 100.',
      )
    }

    return this.menuService.create({
      businessId:
        request.menuAccess!
          .businessId,
      name: body.name,
      price: Number(body.price),
      category:
        body.category || '',
      imageUrl:
        body.imageUrl || '',
      description:
        body.description || '',
      discount,
      customizations:
        body.customizations || [],
    })
  }

  // =========================
  // 🔥 GET MENU
  // =========================
  @Get(':businessId')
  async get(
    @Param('businessId')
    businessId: string,
  ) {
    return this.menuService.getByBusiness(
      Number(businessId),
    )
  }

  // =========================
  // 🔥 DELETE
  // =========================
  @Delete(':id')
  @UseGuards(MenuAccessGuard)
  async delete(
    @Req()
    request: MenuAccessRequest,

    @Param('id') id: string,
  ) {
    return this.menuService.delete(
      Number(id),
      request.menuAccess!
        .businessId,
    )
  }

  // =========================
  // 🔥 HIDE / UNHIDE
  // =========================
  @Patch('hide/:id')
  @UseGuards(MenuAccessGuard)
  async hide(
    @Req()
    request: MenuAccessRequest,

    @Param('id') id: string,
  ) {
    return this.menuService.toggleHide(
      Number(id),
      request.menuAccess!
        .businessId,
    )
  }

  // =========================
  // 🔥 OUT OF STOCK
  // =========================
  @Patch('stock/:id')
  @UseGuards(MenuAccessGuard)
  async stock(
    @Req()
    request: MenuAccessRequest,

    @Param('id') id: string,
  ) {
    return this.menuService.toggleStock(
      Number(id),
      request.menuAccess!
        .businessId,
    )
  }

  // =========================
  // SALE / DISCOUNT
  // =========================
  @Patch('discount/:id')
  @UseGuards(MenuAccessGuard)
  async discount(
    @Req()
    request: MenuAccessRequest,

    @Param('id')
    id: string,

    @Body()
    body: any,
  ) {
    return this.menuService.setDiscount(
      Number(id),
      request.menuAccess!
        .businessId,
      Number(body?.discount ?? 0),
    )
  }

  // =========================
  // 🔥 IMAGE UPLOAD
  // =========================
  @Post('upload')
  @UseGuards(MenuAccessGuard)
  @UseInterceptors(
    FileInterceptor('file', {
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
            ).toLowerCase()

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
            `menu-${randomBytes(16)
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

        cb(null, true)
      },
    }),
  )
  async upload(
    @UploadedFile()
    file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file',
      )
    }

    return {
      url: `/uploads/${file.filename}`,
    }
  }
}