import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator'

import {
  Type,
} from 'class-transformer'

export class CheckoutItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id: number

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  qty: number

  // =====================================
  // CUSTOMER COOKING / ALLERGY NOTE
  // =====================================

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string
}

export class CreateCheckoutDto {
  @IsString()
  @Matches(
    /^[a-zA-Z0-9_-]+$/,
    {
      message:
        'Invalid store code.',
    },
  )
  storeCode: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  tableNumber: number

  @IsUUID()
  checkoutRequestId: string

  /*
   * Explicit restaurant marketing consent.
   * Receipt email consent is completely separate.
   */
  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({
    each: true,
  })
  @Type(
    () => CheckoutItemDto,
  )
  items: CheckoutItemDto[]
}