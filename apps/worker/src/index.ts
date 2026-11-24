// WP-00 仅保留 Worker 包边界；BullMQ/Valkey 连接与消费在 WP-09 实现。
export const WORKER_STATUS = 'NOT_CONFIGURED' as const;
