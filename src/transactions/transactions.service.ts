import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginationDto } from 'src/common/dto/pagination.dto';
import { Transaction } from './transaction.entity';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionsRepository: Repository<Transaction>
  ) {}

  async listForUser(userId: string, pagination: PaginationDto) {
    const skip = (pagination.page - 1) * pagination.limit;

    const [items, total] = await this.transactionsRepository.findAndCount({
      where: { initiatedByUserId: userId },
      order: { createdAt: 'DESC' },
      skip,
      take: pagination.limit
    });

    return {
      items,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }
}
