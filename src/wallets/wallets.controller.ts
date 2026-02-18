import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { TransactionsService } from 'src/transactions/transactions.service';
import { AuthUser } from 'src/common/types/auth-user.type';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { InitializeCreditDto } from './dto/initialize-credit.dto';
import { VerifyCreditDto } from './dto/verify-credit.dto';
import { WalletsService } from './wallets.service';

@ApiTags('Wallets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class WalletsController {
  constructor(
    private readonly walletsService: WalletsService,
    private readonly transactionsService: TransactionsService
  ) {}

  @Post('wallets')
  @ApiOperation({ summary: 'Create a wallet for authenticated user' })
  createWallet(@Req() req: { user: AuthUser }, @Body() dto: CreateWalletDto) {
    return this.walletsService.createWallet(req.user.id, dto);
  }

  @Get('wallets')
  @ApiOperation({ summary: 'List authenticated user wallets' })
  listWallets(@Req() req: { user: AuthUser }) {
    return this.walletsService.listWallets(req.user.id);
  }

  @Get('wallets/:id')
  @ApiOperation({ summary: 'Get wallet by id for authenticated user' })
  getWallet(@Req() req: { user: AuthUser }, @Param('id') id: string) {
    return this.walletsService.getWalletById(req.user.id, id);
  }

  @Post('wallets/:walletId/credit/initialize')
  @ApiOperation({ summary: 'Initialize wallet credit payment with Paystack' })
  initializeCredit(
    @Req() req: { user: AuthUser },
    @Param('walletId') walletId: string,
    @Body() dto: InitializeCreditDto
  ) {
    return this.walletsService.initializeCredit(req.user.id, walletId, dto);
  }

  @Post('wallets/credit/verify')
  @ApiOperation({ summary: 'Verify Paystack credit reference and credit wallet idempotently' })
  verifyCredit(@Req() req: { user: AuthUser }, @Body() dto: VerifyCreditDto) {
    return this.walletsService.verifyCredit(req.user.id, dto);
  }

  @Get('transfers')
  @ApiOperation({ summary: 'List user initiated transactions (credits and transfers)' })
  listTransactions(@Req() req: { user: AuthUser }, @Query() pagination: PaginationDto) {
    return this.transactionsService.listForUser(req.user.id, pagination);
  }
}
