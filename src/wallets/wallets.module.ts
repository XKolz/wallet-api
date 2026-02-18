import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaystackModule } from 'src/paystack/paystack.module';
import { PaystackPayment } from 'src/paystack/paystack-payment.entity';
import { Transaction } from 'src/transactions/transaction.entity';
import { TransactionsModule } from 'src/transactions/transactions.module';
import { Wallet } from './wallet.entity';
import { WalletsController } from './wallets.controller';
import { WalletsService } from './wallets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, Transaction, PaystackPayment]),
    PaystackModule,
    TransactionsModule
  ],
  controllers: [WalletsController],
  providers: [WalletsService],
  exports: [WalletsService, TypeOrmModule]
})
export class WalletsModule {}
