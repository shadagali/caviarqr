import {
  Module,
} from '@nestjs/common'

import {
  TypeOrmModule,
} from '@nestjs/typeorm'

import {
  DemoRequestController,
} from './demo-request.controller'

import {
  DemoRequest,
} from './demo-request.entity'

import {
  DemoRequestService,
} from './demo-request.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DemoRequest,
    ]),
  ],
  controllers: [
    DemoRequestController,
  ],
  providers: [
    DemoRequestService,
  ],
  exports: [
    DemoRequestService,
  ],
})
export class DemoRequestModule {}
