import { Injectable } from '@nestjs/common';
import { AuthUser } from 'src/common/types/auth-user.type';
import { TransfersService } from 'src/transfers/transfers.service';

@Injectable()
export class AdminService {
  constructor(private readonly transfersService: TransfersService) {}

  getPendingTransfers() {
    return this.transfersService.listPendingTransfers();
  }

  approveTransfer(user: AuthUser, transactionId: string) {
    return this.transfersService.approveTransfer(user.id, transactionId, user.role);
  }

  rejectTransfer(user: AuthUser, transactionId: string) {
    return this.transfersService.rejectTransfer(user.id, transactionId, user.role);
  }

  monthlySummary(year: number, month: number) {
    return this.transfersService.monthlySummary(year, month);
  }
}
