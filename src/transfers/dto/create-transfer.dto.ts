import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class CreateTransferDto {
  @ApiProperty()
  @IsUUID()
  fromWalletId!: string;

  @ApiProperty()
  @IsUUID()
  toWalletId!: string;

  @ApiProperty({ example: 4500 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount!: number;
}
