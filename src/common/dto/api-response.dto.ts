import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorShape {
  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({ example: ['phone must be a valid phone number'] })
  details!: string[];
}

export class ApiResponseDto<T = unknown> {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ nullable: true })
  message!: string | null;

  @ApiProperty({ nullable: true })
  data!: T | null;

  @ApiProperty({ nullable: true, type: ApiErrorShape })
  error!: ApiErrorShape | null;

  @ApiProperty({ example: '2026-02-16T12:00:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/auth/login' })
  path!: string;
}
