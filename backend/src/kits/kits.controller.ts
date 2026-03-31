import { Controller, Get, Post, Body, Param } from '@nestjs/common';

import { KitsService } from './kits.service';

@Controller('kits')
export class KitsController {

  constructor(
    private readonly kitsService: KitsService
  ) {}

  @Get()
  getAllKits() {
    return this.kitsService.listKits();
  }

  @Get(':kitCode')
  getKit(@Param('kitCode') kitCode: string) {
    return this.kitsService.findByCode(kitCode);
  }

  @Post()
  createKit(@Body() body: any) {
    return this.kitsService.createKit(body);
  }

  @Post('activate')
  activateKit(@Body() body: any) {

    const { kitCode, businessId } = body;

    return this.kitsService.activateKit(
      kitCode,
      businessId
    );

  }

}