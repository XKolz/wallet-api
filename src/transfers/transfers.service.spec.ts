import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserRole } from 'src/users/user.entity';
import { TransactionStatus, TransactionType } from 'src/transactions/transaction.entity';
import { TransfersService } from './transfers.service';

describe('TransfersService', () => {
  const walletsRepository = {};
  const transactionsRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn()
  };

  const manager = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn()
  };

  const dataSource = {
    transaction: jest.fn(async (callback: (arg0: typeof manager) => Promise<unknown>) => callback(manager))
  } as unknown as DataSource;

  let service: TransfersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TransfersService(walletsRepository as any, transactionsRepository as any, dataSource);
  });

  it('completes normal transfer successfully', async () => {
    const fromWallet = { id: 'from', userId: 'user1', currency: 'NGN', balance: '5000.00' };
    const toWallet = { id: 'to', userId: 'user2', currency: 'NGN', balance: '1000.00' };

    manager.findOne.mockResolvedValueOnce(fromWallet).mockResolvedValueOnce(toWallet);
    manager.create.mockReturnValue({ id: 'tx1', status: TransactionStatus.SUCCESS, type: TransactionType.TRANSFER });
    manager.save.mockResolvedValue({ id: 'tx1', status: TransactionStatus.SUCCESS });

    const result = await service.createTransfer('user1', {
      fromWalletId: 'from',
      toWalletId: 'to',
      amount: 1000
    });

    expect(result.status).toBe(TransactionStatus.SUCCESS);
    expect(fromWallet.balance).toBe('4000.00');
    expect(toWallet.balance).toBe('2000.00');
  });

  it('throws insufficient funds', async () => {
    const fromWallet = { id: 'from', userId: 'user1', currency: 'NGN', balance: '500.00' };
    const toWallet = { id: 'to', userId: 'user2', currency: 'NGN', balance: '1000.00' };

    manager.findOne.mockResolvedValueOnce(fromWallet).mockResolvedValueOnce(toWallet);

    await expect(
      service.createTransfer('user1', {
        fromWalletId: 'from',
        toWalletId: 'to',
        amount: 1000
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates pending transfer when above NGN threshold', async () => {
    const fromWallet = { id: 'from', userId: 'user1', currency: 'NGN', balance: '2000000.00' };
    const toWallet = { id: 'to', userId: 'user2', currency: 'NGN', balance: '1000.00' };

    manager.findOne.mockResolvedValueOnce(fromWallet).mockResolvedValueOnce(toWallet);
    manager.create.mockReturnValue({ status: TransactionStatus.REQUIRES_APPROVAL });
    manager.save.mockResolvedValue({ status: TransactionStatus.REQUIRES_APPROVAL });

    const result = await service.createTransfer('user1', {
      fromWalletId: 'from',
      toWalletId: 'to',
      amount: 1000001
    });

    expect(result.status).toBe(TransactionStatus.REQUIRES_APPROVAL);
  });

  it('approval moves balances and marks success', async () => {
    const pendingTx = {
      id: 'tx1',
      status: TransactionStatus.REQUIRES_APPROVAL,
      amount: '1200000.00',
      fromWalletId: 'from',
      toWalletId: 'to'
    };
    const fromWallet = { id: 'from', balance: '2000000.00' };
    const toWallet = { id: 'to', balance: '500.00' };

    manager.findOne
      .mockResolvedValueOnce(pendingTx)
      .mockResolvedValueOnce(fromWallet)
      .mockResolvedValueOnce(toWallet);
    manager.save.mockResolvedValue({ id: 'tx1', status: TransactionStatus.SUCCESS });

    const result = await service.approveTransfer('admin1', 'tx1', UserRole.ADMIN);

    expect(result.status).toBe(TransactionStatus.SUCCESS);
    expect(fromWallet.balance).toBe('800000.00');
    expect(toWallet.balance).toBe('1200500.00');
  });
});
