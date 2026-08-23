import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

export enum RefundReason {
  ORDER_NOT_DELIVERED = 'ORDER_NOT_DELIVERED',
  DUPLICATE_PAYMENT = 'DUPLICATE_PAYMENT',
  KITCHEN_DID_NOT_RECEIVE = 'KITCHEN_DID_NOT_RECEIVE',
  INCORRECT_CHARGE = 'INCORRECT_CHARGE',
  OTHER = 'OTHER',
}

export class CreateRefundDto {
  @IsEnum(RefundReason)
  reason: RefundReason

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string
}
