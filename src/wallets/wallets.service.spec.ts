import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PAYSTACK_CLIENT, PaystackClient } from 'src/paystack/paystack.types';
import { TransactionStatus } from 'src/transactions/transaction.entity';
import { WalletsService } from './wallets.service';

describe('WalletsService', () => {
  const walletsRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn()
  };

  const transactionsRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn()
  };

  const paymentsRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn()
  };

  const paystackClient: jest.Mocked<PaystackClient> = {
    initializeTransaction: jest.fn(),
    verifyTransaction: jest.fn()
  };

  const manager = {
    findOne: jest.fn(),
    findOneByOrFail: jest.fn(),
    save: jest.fn()
  };

  const dataSource = {
    transaction: jest.fn(async (callback: (arg0: typeof manager) => Promise<unknown>) => callback(manager))
  } as unknown as DataSource;

  let service: WalletsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WalletsService(
      walletsRepository as any,
      transactionsRepository as any,
      paymentsRepository as any,
      dataSource,
      paystackClient
    );
  });

  it('prevents duplicate wallet currency per user', async () => {
    walletsRepository.findOne.mockResolvedValue({ id: 'wallet1' });

    await expect(service.createWallet('user1', { currency: 'NGN' })).rejects.toThrow(
      'Wallet with this currency already exists for user'
    );
  });

  it('verifyCredit is idempotent and does not double-credit', async () => {
    paymentsRepository.findOne.mockResolvedValue({
      id: 'payment1',
      userId: 'user1',
      walletId: 'wallet1'
    });

    paystackClient.verifyTransaction.mockResolvedValue({
      status: 'success',
      reference: 'ref1',
      amount: 1000,
      currency: 'NGN',
      raw: {}
    });

    const lockedPayment = {
      id: 'payment1',
      walletId: 'wallet1',
      amount: '1000.00',
      paystackStatus: 'success',
      rawResponse: null
    };
    const lockedTx = {
      id: 'tx1',
      status: TransactionStatus.SUCCESS,
      metadata: {}
    };

    manager.findOne
      .mockResolvedValueOnce(lockedPayment)
      .mockResolvedValueOnce(lockedTx);
    manager.findOneByOrFail.mockResolvedValue({ id: 'wallet1', balance: '1000.00' });

    const result = await service.verifyCredit('user1', { reference: 'ref1' });

    expect(result.status).toBe('already_verified');
    expect(manager.save).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'wallet1' }));
  });

  it('rejects verifyCredit for another user', async () => {
    paymentsRepository.findOne.mockResolvedValue({ id: 'payment1', userId: 'user2' });

    await expect(service.verifyCredit('user1', { reference: 'ref1' })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
