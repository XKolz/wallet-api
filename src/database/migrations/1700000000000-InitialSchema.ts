import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await queryRunner.query(`
      CREATE TYPE users_role_enum AS ENUM ('USER', 'ADMIN');
      CREATE TYPE wallets_status_enum AS ENUM ('ACTIVE');
      CREATE TYPE transactions_type_enum AS ENUM ('CREDIT','TRANSFER','TRANSFER_PENDING','TRANSFER_APPROVED','TRANSFER_REJECTED');
      CREATE TYPE transactions_status_enum AS ENUM ('PENDING','SUCCESS','FAILED','REQUIRES_APPROVAL');

      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        phone varchar(20) NOT NULL UNIQUE,
        "passwordHash" varchar NOT NULL,
        role users_role_enum NOT NULL DEFAULT 'USER',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX IDX_users_phone ON users (phone);

      CREATE TABLE wallets (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        currency varchar(10) NOT NULL,
        balance numeric(18,2) NOT NULL DEFAULT '0.00',
        status wallets_status_enum NOT NULL DEFAULT 'ACTIVE',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT FK_wallet_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT UQ_wallet_user_currency UNIQUE ("userId", currency)
      );
      CREATE UNIQUE INDEX IDX_wallet_user_currency ON wallets ("userId", currency);

      CREATE TABLE transactions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        type transactions_type_enum NOT NULL,
        amount numeric(18,2) NOT NULL,
        currency varchar(10) NOT NULL,
        reference varchar(128) NOT NULL UNIQUE,
        status transactions_status_enum NOT NULL DEFAULT 'PENDING',
        metadata jsonb,
        "fromWalletId" uuid,
        "toWalletId" uuid,
        "initiatedByUserId" uuid,
        "approvedByAdminId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT FK_tx_from_wallet FOREIGN KEY ("fromWalletId") REFERENCES wallets(id) ON DELETE SET NULL,
        CONSTRAINT FK_tx_to_wallet FOREIGN KEY ("toWalletId") REFERENCES wallets(id) ON DELETE SET NULL,
        CONSTRAINT FK_tx_initiated_user FOREIGN KEY ("initiatedByUserId") REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT FK_tx_approved_user FOREIGN KEY ("approvedByAdminId") REFERENCES users(id) ON DELETE SET NULL
      );
      CREATE UNIQUE INDEX IDX_tx_reference ON transactions(reference);

      CREATE TABLE paystack_payments (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "walletId" uuid NOT NULL,
        amount numeric(18,2) NOT NULL,
        currency varchar(10) NOT NULL,
        reference varchar(128) NOT NULL UNIQUE,
        "authorizationUrl" text,
        "paystackStatus" varchar(30) NOT NULL DEFAULT 'PENDING',
        "rawResponse" jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT FK_payment_user FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT FK_payment_wallet FOREIGN KEY ("walletId") REFERENCES wallets(id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IDX_paystack_reference ON paystack_payments(reference);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_paystack_reference;
      DROP TABLE IF EXISTS paystack_payments;

      DROP INDEX IF EXISTS IDX_tx_reference;
      DROP TABLE IF EXISTS transactions;

      DROP INDEX IF EXISTS IDX_wallet_user_currency;
      DROP TABLE IF EXISTS wallets;

      DROP INDEX IF EXISTS IDX_users_phone;
      DROP TABLE IF EXISTS users;

      DROP TYPE IF EXISTS transactions_status_enum;
      DROP TYPE IF EXISTS transactions_type_enum;
      DROP TYPE IF EXISTS wallets_status_enum;
      DROP TYPE IF EXISTS users_role_enum;
    `);
  }
}
