import { Module } from '@nestjs/common';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { TransfersModule } from 'src/transfers/transfers.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [TransfersModule],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard]
})
export class AdminModule {}
