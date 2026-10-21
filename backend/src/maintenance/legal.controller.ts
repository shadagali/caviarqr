import {
  Controller,
  Get,
  Param,
} from '@nestjs/common'

import {
  LegalDocumentService,
} from './legal-document.service'

@Controller('legal')
export class LegalController {
  constructor(
    private readonly legalDocumentService:
      LegalDocumentService,
  ) {}

  @Get(':documentType')
  async current(
    @Param(
      'documentType',
    )
    documentType:
      string,
  ) {
    return this
      .legalDocumentService
      .getPublished(
        documentType,
      )
  }
}
