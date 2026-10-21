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

export class CheckoutCustomizationSelectionDto {
  @IsString()
  @MaxLength(100)
  groupId: string

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({
    each: true,
  })
  @MaxLength(
    100,
    {
      each: true,
    },
  )
  optionIds: string[]
}

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

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({
    each: true,
  })
  @Type(
    () =>
      CheckoutCustomizationSelectionDto,
  )
  customizations?:
    CheckoutCustomizationSelectionDto[]
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
