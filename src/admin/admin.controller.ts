import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { AuthUser } from 'src/common/types/auth-user.type';
import { UserRole } from 'src/users/user.entity';
import { MonthlyReportQueryDto } from './dto/monthly-report-query.dto';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('transfers/pending')
  @ApiOperation({ summary: 'Get transfers awaiting admin approval' })
  pendingTransfers() {
    return this.adminService.getPendingTransfers();
  }

  @Post('transfers/:id/approve')
  @ApiOperation({ summary: 'Approve a pending transfer' })
  approveTransfer(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.adminService.approveTransfer(req.user, id);
  }

  @Post('transfers/:id/reject')
  @ApiOperation({ summary: 'Reject a pending transfer' })
  rejectTransfer(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.adminService.rejectTransfer(req.user, id);
  }

  @Get('reports/monthly')
  @ApiOperation({ summary: 'Get monthly payment summary report' })
  monthlySummary(@Query() query: MonthlyReportQueryDto) {
    return this.adminService.monthlySummary(query.year, query.month);
  }
}
