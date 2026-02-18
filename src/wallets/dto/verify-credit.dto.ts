import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class VerifyCreditDto {
  @ApiProperty({ example: 'credit_89a79916-c5ab-49dc-96e2-29b4706d28ba' })
  @IsString()
  reference!: string;
}
