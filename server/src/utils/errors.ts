export class AppError extends Error {
  readonly statusCode: number;
  readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    isOperational = true,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
