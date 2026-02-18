import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { Wallet } from 'src/wallets/wallet.entity';
import { User } from 'src/users/user.entity';

export enum TransactionType {
  CREDIT = 'CREDIT',
  TRANSFER = 'TRANSFER',
  TRANSFER_PENDING = 'TRANSFER_PENDING',
  TRANSFER_APPROVED = 'TRANSFER_APPROVED',
  TRANSFER_REJECTED = 'TRANSFER_REJECTED'
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REQUIRES_APPROVAL = 'REQUIRES_APPROVAL'
}

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: TransactionType
  })
  type!: TransactionType;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 10 })
  currency!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  reference!: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING
  })
  status!: TransactionStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: 'uuid', nullable: true })
  fromWalletId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  toWalletId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  initiatedByUserId!: string | null;

  @Column({ type: 'uuid', nullable: true })
  approvedByAdminId!: string | null;

  @ManyToOne(() => Wallet, (wallet) => wallet.outgoingTransactions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fromWalletId' })
  fromWallet!: Wallet | null;

  @ManyToOne(() => Wallet, (wallet) => wallet.incomingTransactions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'toWalletId' })
  toWallet!: Wallet | null;

  @ManyToOne(() => User, (user) => user.initiatedTransactions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'initiatedByUserId' })
  initiatedByUser!: User | null;

  @ManyToOne(() => User, (user) => user.approvedTransactions, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'approvedByAdminId' })
  approvedByAdmin!: User | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
