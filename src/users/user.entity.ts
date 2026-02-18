import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm';
import { Wallet } from '../wallets/wallet.entity';
import { Transaction } from '../transactions/transaction.entity';
import { PaystackPayment } from '../paystack/paystack-payment.entity';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 20 })
  phone!: string;

  @Column({ type: 'varchar' })
  passwordHash!: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @OneToMany(() => Wallet, (wallet) => wallet.user)
  wallets!: Wallet[];

  @OneToMany(() => Transaction, (tx) => tx.initiatedByUser)
  initiatedTransactions!: Transaction[];

  @OneToMany(() => Transaction, (tx) => tx.approvedByAdmin)
  approvedTransactions!: Transaction[];

  @OneToMany(() => PaystackPayment, (payment) => payment.user)
  paystackPayments!: PaystackPayment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
