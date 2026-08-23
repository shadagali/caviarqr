import {
  IsInt,
  Min,
} from 'class-validator'

import {
  Type,
} from 'class-transformer'

export class StripeBusinessDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  businessId: number
}