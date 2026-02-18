import Decimal from 'decimal.js';

export const toDecimal = (value: string | number): Decimal => new Decimal(value);

export const toFixedAmount = (value: string | number): string => toDecimal(value).toFixed(2);

export const ngnApprovalThreshold = new Decimal('1000000');
