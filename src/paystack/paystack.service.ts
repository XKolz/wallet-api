import { HttpService } from '@nestjs/axios';
import { HttpException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import {
  InitializeTransactionPayload,
  InitializeTransactionResult,
  PaystackClient,
  VerifyTransactionResult
} from './paystack.types';

@Injectable()
export class PaystackService implements PaystackClient {
  private readonly logger = new Logger(PaystackService.name);
  private readonly baseUrl: string;
  private readonly secretKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.baseUrl = this.configService.getOrThrow<string>('PAYSTACK_BASE_URL');
    this.secretKey = this.configService.getOrThrow<string>('PAYSTACK_SECRET_KEY');
  }

  async initializeTransaction(payload: InitializeTransactionPayload): Promise<InitializeTransactionResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.baseUrl}/transaction/initialize`, payload, {
          headers: {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json'
          }
        })
      );

      return {
        authorizationUrl: response.data.data.authorization_url,
        accessCode: response.data.data.access_code,
        reference: response.data.data.reference,
        raw: response.data
      };
    } catch (error) {
      this.handlePaystackError(error, 'initialize');
    }
  }

  async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/transaction/verify/${reference}`, {
          headers: {
            Authorization: `Bearer ${this.secretKey}`
          }
        })
      );

      return {
        status: response.data.data.status,
        reference: response.data.data.reference,
        amount: Number(response.data.data.amount),
        currency: response.data.data.currency,
        raw: response.data
      };
    } catch (error) {
      this.handlePaystackError(error, 'verify');
    }
  }

  private handlePaystackError(error: unknown, operation: 'initialize' | 'verify'): never {
    if (error instanceof AxiosError) {
      const statusCode = error.response?.status ?? 502;
      const paystackMessage =
        (error.response?.data as { message?: string } | undefined)?.message ??
        error.message ??
        `Paystack ${operation} failed`;

      this.logger.error(`Paystack ${operation} failed`, {
        statusCode,
        paystackMessage,
        response: error.response?.data
      });

      throw new HttpException(`Paystack ${operation} failed: ${paystackMessage}`, statusCode);
    }

    this.logger.error(`Paystack ${operation} failed`, error as Error);
    throw new HttpException(`Paystack ${operation} failed`, 502);
  }
}
