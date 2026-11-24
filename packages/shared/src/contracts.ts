export const API_VERSION = 'v1' as const;
export const SERVICE_VERSION = '0.1.0' as const;

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNAUTHORIZED'
  | 'MFA_REQUIRED'
  | 'RATE_LIMITED'
  | 'FORBIDDEN'
  | 'AUTH_SCOPE_VIOLATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  };
}

export interface DependencyStatus {
  database: 'up' | 'down' | 'not_configured';
  valkey: 'up' | 'down' | 'not_configured';
}

export interface HealthResponse {
  status: 'ok' | 'unavailable';
  service: 'layer-farm-erp-api';
  version: string;
  requestId: string;
  dependencies?: DependencyStatus;
}

export const ROLES = [
  'admin', 'boss', 'finance_manager', 'finance_cashier', 'purchase_manager',
  'purchase_staff', 'sales_manager', 'sales_staff', 'layer_farm_manager', 'vet',
  'feeder', 'warehouse', 'external_affairs', 'driver', 'engineering',
] as const;

export type Role = (typeof ROLES)[number];
