import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from 'typeorm';
import { User } from 'src/users/user.entity';
import { Transaction } from 'src/transactions/transaction.entity';
import { PaystackPayment } from 'src/paystack/paystack-payment.entity';

export enum WalletStatus {
  ACTIVE = 'ACTIVE'
}

@Entity('wallets')
@Unique(['userId', 'currency'])
@Index(['userId', 'currency'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (user) => user.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 10 })
  currency!: string;

  @Column({ type: 'numeric', precision: 18, scale: 2, default: '0.00' })
  balance!: string;

  @Column({ type: 'enum', enum: WalletStatus, default: WalletStatus.ACTIVE })
  status!: WalletStatus;

  @OneToMany(() => Transaction, (transaction) => transaction.fromWallet)
  outgoingTransactions!: Transaction[];

  @OneToMany(() => Transaction, (transaction) => transaction.toWallet)
  incomingTransactions!: Transaction[];

  @OneToMany(() => PaystackPayment, (payment) => payment.wallet)
  paystackPayments!: PaystackPayment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
