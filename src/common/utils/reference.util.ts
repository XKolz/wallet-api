import { randomUUID } from 'crypto';

export const buildReference = (prefix: string): string => `${prefix}_${randomUUID()}`;
