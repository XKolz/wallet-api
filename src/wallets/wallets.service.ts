import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { toFixedAmount, toDecimal } from 'src/common/utils/amount.util';
import { buildReference } from 'src/common/utils/reference.util';
import { PaystackPayment } from 'src/paystack/paystack-payment.entity';
import { PAYSTACK_CLIENT, PaystackClient } from 'src/paystack/paystack.types';
import { Transaction, TransactionStatus, TransactionType } from 'src/transactions/transaction.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { InitializeCreditDto } from './dto/initialize-credit.dto';
import { VerifyCreditDto } from './dto/verify-credit.dto';
import { Wallet } from './wallet.entity';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    @InjectRepository(PaystackPayment)
    private readonly paymentsRepository: Repository<PaystackPayment>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(PAYSTACK_CLIENT)
    private readonly paystackClient: PaystackClient
  ) {}

  async createWallet(userId: string, dto: CreateWalletDto) {
    const existing = await this.walletsRepository.findOne({ where: { userId, currency: dto.currency } });
    if (existing) {
      throw new BadRequestException('Wallet with this currency already exists for user');
    }

    const wallet = this.walletsRepository.create({
      userId,
      currency: dto.currency,
      balance: '0.00'
    });

    return this.walletsRepository.save(wallet);
  }

  listWallets(userId: string) {
    return this.walletsRepository.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async getWalletById(userId: string, walletId: string) {
    const wallet = await this.walletsRepository.findOne({ where: { id: walletId } });
    if (!wallet) {
      throw new NotFoundException('Wallet not found');
    }
    if (wallet.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }
    return wallet;
  }

  async initializeCredit(userId: string, walletId: string, dto: InitializeCreditDto) {
    const wallet = await this.getWalletById(userId, walletId);
    const reference = buildReference('credit');

    const initialized = await this.paystackClient.initializeTransaction({
      email: `user-${userId.replace(/-/g, '')}@example.com`,
      amount: Math.round(dto.amount * 100),
      reference,
      currency: wallet.currency,
      callback_url: process.env.PAYSTACK_CALLBACK_URL,
      metadata: {
        walletId: wallet.id,
        userId
      }
    });

    const payment = this.paymentsRepository.create({
      userId,
      walletId: wallet.id,
      amount: toFixedAmount(dto.amount),
      currency: wallet.currency,
      reference,
      authorizationUrl: initialized.authorizationUrl,
      paystackStatus: 'PENDING',
      rawResponse: initialized.raw
    });

    const transaction = this.transactionsRepository.create({
      type: TransactionType.CREDIT,
      amount: toFixedAmount(dto.amount),
      currency: wallet.currency,
      reference,
      status: TransactionStatus.PENDING,
      toWalletId: wallet.id,
      initiatedByUserId: userId,
      metadata: {
        provider: 'paystack'
      }
    });

    await this.paymentsRepository.save(payment);
    await this.transactionsRepository.save(transaction);

    return {
      authorizationUrl: initialized.authorizationUrl,
      reference
    };
  }

  async verifyCredit(userId: string, dto: VerifyCreditDto) {
    const payment = await this.paymentsRepository.findOne({ where: { reference: dto.reference } });
    if (!payment) {
      throw new NotFoundException('Payment reference not found');
    }
    if (payment.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    const verifyResult = await this.paystackClient.verifyTransaction(dto.reference);

    const result = await this.dataSource.transaction(async (manager) => {
      const lockedPayment = await manager.findOne(PaystackPayment, {
        where: { id: payment.id },
        lock: { mode: 'pessimistic_write' }
      });

      if (!lockedPayment) {
        throw new NotFoundException('Payment not found');
      }

      const tx = await manager.findOne(Transaction, {
        where: { reference: dto.reference },
        lock: { mode: 'pessimistic_write' }
      });

      if (!tx) {
        throw new NotFoundException('Transaction not found for reference');
      }

      if (lockedPayment.paystackStatus === 'success' && tx.status === TransactionStatus.SUCCESS) {
        const existingWallet = await manager.findOneByOrFail(Wallet, { id: lockedPayment.walletId });
        return {
          status: 'already_verified',
          walletBalance: existingWallet.balance,
          reference: dto.reference
        };
      }

      if (verifyResult.status !== 'success') {
        lockedPayment.paystackStatus = verifyResult.status;
        lockedPayment.rawResponse = verifyResult.raw;
        tx.status = TransactionStatus.FAILED;
        tx.metadata = {
          ...tx.metadata,
          verifyStatus: verifyResult.status
        };

        await manager.save(lockedPayment);
        await manager.save(tx);

        return {
          status: 'failed',
          reference: dto.reference
        };
      }

      const wallet = await manager.findOne(Wallet, {
        where: { id: lockedPayment.walletId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!wallet) {
        throw new NotFoundException('Wallet not found');
      }

      wallet.balance = toDecimal(wallet.balance).plus(lockedPayment.amount).toFixed(2);
      tx.status = TransactionStatus.SUCCESS;
      tx.metadata = {
        ...tx.metadata,
        verifyStatus: verifyResult.status
      };

      lockedPayment.paystackStatus = 'success';
      lockedPayment.rawResponse = verifyResult.raw;

      await manager.save(wallet);
      await manager.save(tx);
      await manager.save(lockedPayment);

      return {
        status: 'success',
        walletBalance: wallet.balance,
        reference: dto.reference
      };
    });

    return result;
  }
}
