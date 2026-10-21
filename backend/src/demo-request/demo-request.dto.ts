import {
  IsEmail,
  IsIn,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator'

export class CreateDemoRequestDto {
  @IsEmail()
  @MaxLength(320)
  email: string

  @IsString()
  @MinLength(7)
  @MaxLength(40)
  phone: string

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  message: string
}

export class UpdateDemoRequestStatusDto {
  @IsIn([
    'NEW',
    'CONTACTED',
    'CLOSED',
  ])
  status:
    | 'NEW'
    | 'CONTACTED'
    | 'CLOSED'
}
