import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ngnApprovalThreshold, toFixedAmount, toDecimal } from 'src/common/utils/amount.util';
import { buildReference } from 'src/common/utils/reference.util';
import { UserRole } from 'src/users/user.entity';
import { Transaction, TransactionStatus, TransactionType } from 'src/transactions/transaction.entity';
import { Wallet } from 'src/wallets/wallet.entity';
import { CreateTransferDto } from './dto/create-transfer.dto';

@Injectable()
export class TransfersService {
  constructor(
    @InjectRepository(Wallet)
    private readonly walletsRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>,
    @InjectDataSource()
    private readonly dataSource: DataSource
  ) {}

  async createTransfer(userId: string, dto: CreateTransferDto) {
    if (dto.fromWalletId === dto.toWalletId) {
      throw new BadRequestException('Cannot transfer to the same wallet');
    }

    return this.dataSource.transaction(async (manager) => {
      const fromWallet = await manager.findOne(Wallet, {
        where: { id: dto.fromWalletId },
        lock: { mode: 'pessimistic_write' }
      });
      const toWallet = await manager.findOne(Wallet, {
        where: { id: dto.toWalletId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!fromWallet || !toWallet) {
        throw new NotFoundException('Wallet not found');
      }
      if (fromWallet.userId !== userId) {
        throw new ForbiddenException('Cannot transfer from a wallet you do not own');
      }
      if (fromWallet.currency !== toWallet.currency) {
        throw new BadRequestException('Wallet currencies must match');
      }

      const amount = toDecimal(dto.amount);
      const fromBalance = toDecimal(fromWallet.balance);

      if (fromBalance.lessThan(amount)) {
        throw new BadRequestException('Insufficient funds');
      }

      const isApprovalRequired = fromWallet.currency === 'NGN' && amount.greaterThan(ngnApprovalThreshold);
      const reference = buildReference('transfer');

      if (isApprovalRequired) {
        const pendingTransaction = manager.create(Transaction, {
          type: TransactionType.TRANSFER_PENDING,
          amount: toFixedAmount(dto.amount),
          currency: fromWallet.currency,
          reference,
          status: TransactionStatus.REQUIRES_APPROVAL,
          fromWalletId: fromWallet.id,
          toWalletId: toWallet.id,
          initiatedByUserId: userId,
          metadata: {
            reason: 'AMOUNT_ABOVE_THRESHOLD'
          }
        });

        await manager.save(pendingTransaction);
        return pendingTransaction;
      }

      fromWallet.balance = fromBalance.minus(amount).toFixed(2);
      toWallet.balance = toDecimal(toWallet.balance).plus(amount).toFixed(2);

      await manager.save(fromWallet);
      await manager.save(toWallet);

      const transaction = manager.create(Transaction, {
        type: TransactionType.TRANSFER,
        amount: toFixedAmount(dto.amount),
        currency: fromWallet.currency,
        reference,
        status: TransactionStatus.SUCCESS,
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        initiatedByUserId: userId,
        metadata: null
      });

      return manager.save(transaction);
    });
  }

  async listPendingTransfers() {
    return this.transactionsRepository.find({
      where: {
        type: TransactionType.TRANSFER_PENDING,
        status: TransactionStatus.REQUIRES_APPROVAL
      },
      order: { createdAt: 'ASC' }
    });
  }

  async approveTransfer(adminUserId: string, transactionId: string, role: UserRole) {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can approve transfers');
    }

    return this.dataSource.transaction(async (manager) => {
      const transaction = await manager.findOne(Transaction, {
        where: { id: transactionId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!transaction) {
        throw new NotFoundException('Pending transfer not found');
      }
      if (transaction.status !== TransactionStatus.REQUIRES_APPROVAL) {
        throw new BadRequestException('Transfer is not pending approval');
      }
      if (!transaction.fromWalletId || !transaction.toWalletId) {
        throw new BadRequestException('Invalid pending transfer wallets');
      }

      const fromWallet = await manager.findOne(Wallet, {
        where: { id: transaction.fromWalletId },
        lock: { mode: 'pessimistic_write' }
      });
      const toWallet = await manager.findOne(Wallet, {
        where: { id: transaction.toWalletId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!fromWallet || !toWallet) {
        throw new NotFoundException('Wallet not found for pending transfer');
      }

      const amount = toDecimal(transaction.amount);
      if (toDecimal(fromWallet.balance).lessThan(amount)) {
        throw new BadRequestException('Insufficient funds at approval time');
      }

      fromWallet.balance = toDecimal(fromWallet.balance).minus(amount).toFixed(2);
      toWallet.balance = toDecimal(toWallet.balance).plus(amount).toFixed(2);

      transaction.status = TransactionStatus.SUCCESS;
      transaction.type = TransactionType.TRANSFER_APPROVED;
      transaction.approvedByAdminId = adminUserId;

      await manager.save(fromWallet);
      await manager.save(toWallet);

      return manager.save(transaction);
    });
  }

  async rejectTransfer(adminUserId: string, transactionId: string, role: UserRole) {
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only admins can reject transfers');
    }

    const transaction = await this.transactionsRepository.findOne({ where: { id: transactionId } });

    if (!transaction) {
      throw new NotFoundException('Pending transfer not found');
    }

    if (transaction.status !== TransactionStatus.REQUIRES_APPROVAL) {
      throw new BadRequestException('Transfer is not pending approval');
    }

    transaction.type = TransactionType.TRANSFER_REJECTED;
    transaction.status = TransactionStatus.FAILED;
    transaction.approvedByAdminId = adminUserId;

    return this.transactionsRepository.save(transaction);
  }

  async monthlySummary(year: number, month: number) {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));

    const rows = await this.transactionsRepository
      .createQueryBuilder('tx')
      .select('tx.currency', 'currency')
      .addSelect(
        `COALESCE(SUM(CASE WHEN tx.type = :creditType AND tx.status = :successStatus THEN tx.amount ELSE 0 END), 0)`,
        'totalCredits'
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN tx.type IN (:...transferTypes) AND tx.status = :successStatus THEN tx.amount ELSE 0 END), 0)`,
        'totalTransfers'
      )
      .addSelect(
        `COUNT(CASE WHEN tx.type = :creditType AND tx.status = :successStatus THEN 1 END)`,
        'countCredits'
      )
      .addSelect(
        `COUNT(CASE WHEN tx.type IN (:...transferTypes) AND tx.status = :successStatus THEN 1 END)`,
        'countTransfers'
      )
      .where('tx.createdAt >= :start AND tx.createdAt < :end', { start, end })
      .groupBy('tx.currency')
      .setParameters({
        creditType: TransactionType.CREDIT,
        transferTypes: [TransactionType.TRANSFER, TransactionType.TRANSFER_APPROVED],
        successStatus: TransactionStatus.SUCCESS
      })
      .getRawMany();

    const aggregate = rows.reduce(
      (acc, item) => {
        acc.totalCredits = toDecimal(acc.totalCredits).plus(item.totalcredits ?? item.totalCredits).toFixed(2);
        acc.totalTransfers = toDecimal(acc.totalTransfers)
          .plus(item.totaltransfers ?? item.totalTransfers)
          .toFixed(2);
        acc.countCredits += Number(item.countcredits ?? item.countCredits ?? 0);
        acc.countTransfers += Number(item.counttransfers ?? item.countTransfers ?? 0);
        return acc;
      },
      {
        totalCredits: '0.00',
        totalTransfers: '0.00',
        countCredits: 0,
        countTransfers: 0
      }
    );

    return {
      year,
      month,
      ...aggregate,
      breakdown: rows.map((item) => ({
        currency: item.currency,
        totalCredits: toFixedAmount(item.totalcredits ?? item.totalCredits),
        totalTransfers: toFixedAmount(item.totaltransfers ?? item.totalTransfers),
        countCredits: Number(item.countcredits ?? item.countCredits ?? 0),
        countTransfers: Number(item.counttransfers ?? item.countTransfers ?? 0)
      }))
    };
  }
}
