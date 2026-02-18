import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaystackService } from './paystack.service';
import { PAYSTACK_CLIENT } from './paystack.types';
import { PaystackPayment } from './paystack-payment.entity';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([PaystackPayment])],
  providers: [
    PaystackService,
    {
      provide: PAYSTACK_CLIENT,
      useExisting: PaystackService
    }
  ],
  exports: [PAYSTACK_CLIENT, TypeOrmModule]
})
export class PaystackModule {}
