import { Controller, Get, Param } from '@nestjs/common'
import { BusinessService } from '../business/business.service'
import { MenuService } from '../menu/menu.service'

@Controller('store')
export class PublicController {
  constructor(
    private businessService: BusinessService,
    private menuService: MenuService,
  ) {}

  // 🌐 PUBLIC STORE MENU
  @Get(':storeCode')
  async getStore(@Param('storeCode') storeCode: string) {
    const business = await this.businessService.findByStoreCode(storeCode)

    if (!business) {
      throw new Error('Store not found')
    }

    // ✅ FIXED METHOD NAME
    const menu = await this.menuService.getByBusiness(business.id)

    return {
      business,
      menu,
    }
  }
}