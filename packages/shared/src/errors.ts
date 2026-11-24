import type { ErrorCode } from './contracts.js';

export type ErrorStatus = 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 503;

/** 仅允许把经过审查的公开错误码和消息返回给客户端。 */
export class AppError extends Error {
  public constructor(
    public readonly status: ErrorStatus,
    public readonly code: ErrorCode,
    public readonly publicMessage: string,
  ) {
    super(publicMessage);
    this.name = 'AppError';
  }
}

export function validationError(): AppError {
  return new AppError(400, 'VALIDATION_ERROR', '请求参数不符合要求');
}

export function internalError(): AppError {
  return new AppError(500, 'INTERNAL_ERROR', '服务暂时无法处理请求');
}
