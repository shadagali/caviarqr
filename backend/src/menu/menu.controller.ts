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
  BadRequestException,
} from '@nestjs/common'

import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'

import { MenuService } from './menu.service'

@Controller('menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
  ) {}

  // =========================
  // 🔥 CREATE ITEM
  // =========================
  @Post('create')
  async create(@Body() body: any) {
    if (
      !body?.businessId ||
      !body?.name ||
      !body?.price
    ) {
      throw new BadRequestException(
        'Missing fields',
      )
    }

    return this.menuService.create({
      businessId: Number(
        body.businessId,
      ),
      name: body.name,
      price: Number(body.price),
      category:
        body.category || '',
      imageUrl:
        body.imageUrl || '',
      discount:
        Number(
          body.discount,
        ) || 0,
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
  async delete(
    @Param('id') id: string,
  ) {
    return this.menuService.delete(
      Number(id),
    )
  }

  // =========================
  // 🔥 HIDE / UNHIDE
  // =========================
  @Patch('hide/:id')
  async hide(
    @Param('id') id: string,
  ) {
    return this.menuService.toggleHide(
      Number(id),
    )
  }

  // =========================
  // 🔥 OUT OF STOCK
  // =========================
  @Patch('stock/:id')
  async stock(
    @Param('id') id: string,
  ) {
    return this.menuService.toggleStock(
      Number(id),
    )
  }

  // =========================
  // 🔥 IMAGE UPLOAD
  // =========================
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination:
          './uploads',
        filename: (
          req,
          file,
          cb,
        ) => {
          const unique =
            Date.now() +
            '-' +
            file.originalname

          cb(null, unique)
        },
      }),
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