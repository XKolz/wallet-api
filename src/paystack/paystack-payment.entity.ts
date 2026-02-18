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
import { User } from 'src/users/user.entity';
import { Wallet } from 'src/wallets/wallet.entity';

@Entity('paystack_payments')
export class PaystackPayment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @Column({ type: 'uuid' })
  walletId!: string;

  @Column({ type: 'numeric', precision: 18, scale: 2 })
  amount!: string;

  @Column({ type: 'varchar', length: 10 })
  currency!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128 })
  reference!: string;

  @Column({ type: 'text', nullable: true })
  authorizationUrl!: string | null;

  @Column({ type: 'varchar', length: 30, default: 'PENDING' })
  paystackStatus!: string;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse!: Record<string, unknown> | null;

  @ManyToOne(() => User, (user) => user.paystackPayments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @ManyToOne(() => Wallet, (wallet) => wallet.paystackPayments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'walletId' })
  wallet!: Wallet;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
