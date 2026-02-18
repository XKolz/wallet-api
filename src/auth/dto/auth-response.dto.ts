import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from 'src/users/user.entity';

export class AuthResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  user!: {
    id: string;
    phone: string;
    role: UserRole;
  };
}
