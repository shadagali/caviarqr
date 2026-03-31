import { Controller, Get, Param, Post, Body, Delete } from '@nestjs/common'
import { MenuService } from './menu.service'

@Controller('menu')
export class MenuController {
  constructor(private menuService: MenuService) {}

  @Get(':businessId')
  async getMenu(@Param('businessId') businessId: number) {
    return this.menuService.getByBusiness(Number(businessId))
  }

  @Post()
  async create(@Body() body: any) {
    return this.menuService.create(body)
  }

  @Delete(':id')
  async delete(@Param('id') id: number) {
    return this.menuService.delete(Number(id))
  }
}