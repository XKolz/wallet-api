export type InitializeTransactionPayload = {
  email: string;
  amount: number;
  reference: string;
  currency: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
};

export type InitializeTransactionResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
  raw: Record<string, unknown>;
};

export type VerifyTransactionResult = {
  status: 'success' | 'failed' | 'abandoned' | 'pending';
  reference: string;
  amount: number;
  currency: string;
  raw: Record<string, unknown>;
};

export interface PaystackClient {
  initializeTransaction(payload: InitializeTransactionPayload): Promise<InitializeTransactionResult>;
  verifyTransaction(reference: string): Promise<VerifyTransactionResult>;
}

export const PAYSTACK_CLIENT = Symbol('PAYSTACK_CLIENT');
