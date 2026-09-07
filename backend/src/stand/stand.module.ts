import {
  Module,
} from '@nestjs/common'

import {
  TypeOrmModule,
} from '@nestjs/typeorm'

import {
  StandCode,
} from './stand-code.entity'

import {
  StandService,
} from './stand.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StandCode,
    ]),
  ],

  providers: [
    StandService,
  ],

  exports: [
    StandService,
    TypeOrmModule,
  ],
})
export class StandModule {}
