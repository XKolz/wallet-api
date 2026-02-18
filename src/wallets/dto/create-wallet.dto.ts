import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

const SUPPORTED_CURRENCIES = ['NGN', 'USD', 'EUR', 'GBP'];

export class CreateWalletDto {
  @ApiProperty({ enum: SUPPORTED_CURRENCIES, example: 'NGN' })
  @IsString()
  @IsIn(SUPPORTED_CURRENCIES)
  currency!: string;
}
