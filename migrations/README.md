# 迁移入口

- `000_migration_registry.sql` 仅建立技术迁移登记表，不包含 75 张业务表。
- `apps/api/src/migration-runner.ts` 提供排序、唯一性、跳过已执行版本和适配器调用入口。
- PostgreSQL 实际连接、事务、锁、checksum 和回滚演练属于 WP-01，本工作包未声称已执行数据库迁移。
- 执行迁移前必须备份、确认目标环境、使用最小权限迁移账号并核对数据库基线。
