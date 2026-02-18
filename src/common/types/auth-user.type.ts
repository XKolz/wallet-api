import { UserRole } from 'src/users/user.entity';

export type AuthUser = {
  id: string;
  phone: string;
  role: UserRole;
};
