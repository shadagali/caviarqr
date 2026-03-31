import { Controller, Get, Param } from '@nestjs/common'

@Controller('table')
export class TableController {

  @Get(':storeCode')
  getTables(@Param('storeCode') storeCode: string) {

    // 🔥 FIXED TYPE
    const tables: { tableNumber: number; url: string }[] = []

    for (let i = 1; i <= 50; i++) {
      tables.push({
        tableNumber: i,
        url: `/store/${storeCode}?table=${i}`,
      })
    }

    return tables
  }
}