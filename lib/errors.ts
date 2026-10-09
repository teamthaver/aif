import type { ErrorCode } from '@/utils/types';

export class AppError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = 'CONFLICT',
  ) {
    super(message);
  }
}
