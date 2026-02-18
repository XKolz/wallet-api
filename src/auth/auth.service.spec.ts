import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { UserRole } from 'src/users/user.entity';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(() => {
    usersService = {
      findByPhone: jest.fn(),
      createUser: jest.fn()
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token')
    } as unknown as jest.Mocked<JwtService>;

    service = new AuthService(usersService, jwtService);
  });

  it('registers new user', async () => {
    usersService.findByPhone.mockResolvedValue(null);
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
    usersService.createUser.mockResolvedValue({
      id: 'user-1',
      phone: '+2348012345678',
      role: UserRole.USER
    } as any);

    const result = await service.register({
      phone: '+2348012345678',
      password: 'StrongPass123'
    });

    expect(result.accessToken).toBe('mock-token');
    expect(usersService.createUser).toHaveBeenCalled();
  });

  it('throws when registering duplicate phone', async () => {
    usersService.findByPhone.mockResolvedValue({ id: 'existing' } as any);

    await expect(
      service.register({ phone: '+2348012345678', password: 'StrongPass123' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('logs user in with valid credentials', async () => {
    usersService.findByPhone.mockResolvedValue({
      id: 'user-1',
      phone: '+2348012345678',
      role: UserRole.USER,
      passwordHash: 'hashed'
    } as any);
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.login({
      phone: '+2348012345678',
      password: 'StrongPass123'
    });

    expect(result.accessToken).toBe('mock-token');
  });

  it('throws on invalid password', async () => {
    usersService.findByPhone.mockResolvedValue({ passwordHash: 'hashed' } as any);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(service.login({ phone: '+2348012345678', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });
});
