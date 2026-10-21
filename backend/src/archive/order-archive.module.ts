import {
  Module,
} from '@nestjs/common'

import {
  OrderArchiveService,
} from './order-archive.service'

@Module({
  providers: [
    OrderArchiveService,
  ],

  exports: [
    OrderArchiveService,
  ],
})
export class OrderArchiveModule {}
