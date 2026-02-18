import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { DataType, newDb } from 'pg-mem';
import { DataSource, DataSourceOptions } from 'typeorm';
import { randomUUID } from 'crypto';
import { AuthModule } from 'src/auth/auth.module';
import { HttpExceptionFilter } from 'src/common/filters/http-exception.filter';
import { ResponseInterceptor } from 'src/common/interceptors/response.interceptor';
import { PAYSTACK_CLIENT } from 'src/paystack/paystack.types';
import { PaystackPayment } from 'src/paystack/paystack-payment.entity';
import { PaystackModule } from 'src/paystack/paystack.module';
import { Transaction } from 'src/transactions/transaction.entity';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { TransfersModule } from 'src/transfers/transfers.module';
import { User, UserRole } from 'src/users/user.entity';
import { UsersModule } from 'src/users/users.module';
import { Wallet } from 'src/wallets/wallet.entity';
import { WalletsModule } from 'src/wallets/wallets.module';
import { AdminModule } from 'src/admin/admin.module';

describe('Wallet API E2E', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let dataSource: DataSource;

  const paystackMock = {
    initializeTransaction: jest.fn(async (payload: { reference: string }) => ({
      authorizationUrl: `https://paystack.test/authorize/${payload.reference}`,
      accessCode: 'access-code',
      reference: payload.reference,
      raw: { status: true }
    })),
    verifyTransaction: jest.fn(async (reference: string) => ({
      status: 'success',
      reference,
      amount: 150000000,
      currency: 'NGN',
      raw: { status: true }
    }))
  };

  beforeAll(async () => {
    const db = newDb({ autoCreateForeignKeyIndices: true });
    db.public.registerFunction({
      name: 'current_database',
      returns: DataType.text,
      implementation: () => 'wallet_test'
    });
    db.public.registerFunction({
      name: 'uuid_generate_v4',
      returns: DataType.uuid,
      implementation: randomUUID,
      impure: true
    });
    db.public.registerFunction({
      name: 'version',
      returns: DataType.text,
      implementation: () => 'PostgreSQL 16.0'
    });

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: 'test-secret',
              JWT_EXPIRES_IN: '1d',
              PAYSTACK_BASE_URL: 'https://api.paystack.co',
              PAYSTACK_SECRET_KEY: 'sk_test_mock',
              DB_HOST: 'localhost',
              DB_PORT: 5432,
              DB_USERNAME: 'test',
              DB_PASSWORD: 'test',
              DB_NAME: 'test'
            })
          ]
        }),
        TypeOrmModule.forRootAsync({
          useFactory: () => ({
            type: 'postgres',
            entities: [User, Wallet, Transaction, PaystackPayment],
            synchronize: true,
            logging: false,
            retryAttempts: 1,
            retryDelay: 0
          }),
          dataSourceFactory: async (options) => {
            const ds = await db.adapters.createTypeormDataSource(options as DataSourceOptions);
            return ds.initialize();
          }
        }),
        UsersModule,
        AuthModule,
        WalletsModule,
        TransfersModule,
        TransactionsModule,
        PaystackModule,
        AdminModule
      ]
    })
      .overrideProvider(PAYSTACK_CLIENT)
      .useValue(paystackMock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
      })
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    await app.init();

    dataSource = app.get(DataSource);

    const userRepo = dataSource.getRepository(User);
    const admin = userRepo.create({
      phone: '+2348000000001',
      passwordHash: await bcrypt.hash('AdminPass123', 10),
      role: UserRole.ADMIN
    });
    await userRepo.save(admin);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('runs full transfer approval flow from user and admin perspectives', async () => {
    const registerUser1 = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: '+2348012345001', password: 'StrongPass123' })
      .expect(201);

    const registerUser2 = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ phone: '+2348012345002', password: 'StrongPass123' })
      .expect(201);

    const user1Token = registerUser1.body.data.accessToken;
    const user2Token = registerUser2.body.data.accessToken;

    const loginAdmin = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ phone: '+2348000000001', password: 'AdminPass123' })
      .expect(201);
    const adminToken = loginAdmin.body.data.accessToken;

    const user1Wallet = await request(app.getHttpServer())
      .post('/api/wallets')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ currency: 'NGN' })
      .expect(201);

    const user2Wallet = await request(app.getHttpServer())
      .post('/api/wallets')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ currency: 'NGN' })
      .expect(201);

    const fromWalletId = user1Wallet.body.data.id;
    const toWalletId = user2Wallet.body.data.id;

    const initializeCredit = await request(app.getHttpServer())
      .post(`/api/wallets/${fromWalletId}/credit/initialize`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ amount: 1500000 })
      .expect(201);

    const reference = initializeCredit.body.data.reference;

    await request(app.getHttpServer())
      .post('/api/wallets/credit/verify')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ reference })
      .expect(201);

    const pendingTransfer = await request(app.getHttpServer())
      .post('/api/transfers')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        fromWalletId,
        toWalletId,
        amount: 1000001
      })
      .expect(201);

    expect(pendingTransfer.body.data.status).toBe('REQUIRES_APPROVAL');

    const adminPending = await request(app.getHttpServer())
      .get('/api/admin/transfers/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(adminPending.body.data).toHaveLength(1);

    const transactionId = adminPending.body.data[0].id;

    await request(app.getHttpServer())
      .post(`/api/admin/transfers/${transactionId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const noPending = await request(app.getHttpServer())
      .get('/api/admin/transfers/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(noPending.body.data).toHaveLength(0);

    const report = await request(app.getHttpServer())
      .get('/api/admin/reports/monthly?year=2026&month=2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(report.body.data.countCredits).toBe(1);
    expect(report.body.data.countTransfers).toBe(1);
  });
});
