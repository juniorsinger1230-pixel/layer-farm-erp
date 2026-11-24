# ERP 发布、回滚与运行手册

## 1. 发布阻断条件

以下任一项存在时不得发布：P0/P1 未关闭；`npm run gate` 失败；真实 PostgreSQL/Valkey 迁移与队列恢复未通过；50 并发性能未验收；权威 7 台打印机样张未签认；生产密钥、数据库最小权限、备份恢复或回滚演练无证据。

## 2. 发布前

1. 在干净工作区执行 `npm ci && npm run gate`，归档 `coverage/`、`sbom.json`、扫描结果和测试输出。
2. 构建 API/Web 镜像，以批准后的不可变 digest 替换 `deploy/k8s/base.yaml` 中的占位镜像；不得使用 `latest`。
3. 由密钥管理系统注入 `database-url`、`valkey-url`、`jwt-signing-key`，禁止写入清单或日志。
4. 对生产数据库执行全量备份，并在隔离环境完成恢复校验，记录备份时间、校验和、恢复耗时和操作者。
5. 核对附件存储类型。当前 Deployment 使用 RWO PVC，仅适合单节点/单写场景；多副本跨节点生产必须改为受控共享存储或对象存储后再发布。

## 3. Compose 集成环境

在工程根目录执行：

```powershell
$env:POSTGRES_PASSWORD='<本机合成密码，URL特殊字符需编码>'
$env:JWT_SIGNING_KEY='<至少32字节的本机合成密钥>'
docker compose -f deploy/compose/docker-compose.yml config
docker compose -f deploy/compose/docker-compose.yml up --build --detach
```

入口为 `http://127.0.0.1:8080`。数据库和 Valkey 不暴露宿主端口。打印字体通过 `PRINT_FONT_PATH` 挂载；空值不启用中文字体。

## 4. Kubernetes 发布

1. 创建命名空间及外部 Secret，替换镜像 digest 和存储类。
2. 先单独运行 `database-migrate` Job，并确认成功及迁移校验和；不得在多个副本中并发自发迁移。
3. 部署 API、Web、Service、PDB 和 HPA，等待 readiness 通过。
4. 验证 `/health/ready`、`/health/queue`、`/metrics`，执行登录、库存、销售、收付款、Outbox、WebSocket 补拉和打印合成冒烟。
5. 指标仅向监控网络开放；`/health/queue` 也应在生产入口增加内网限制。

## 5. 回滚

1. 停止新流量并保留故障现场、Pod 日志和 DLQ 计数。
2. 将 API/Web 回滚到上一批准镜像 digest，等待 readiness。
3. 009 及此前执行扩展采用加表/加列方式；只有在确认旧版本兼容新增结构时才可直接回滚镜像。存在不兼容变更时，按已演练的备份恢复方案处理，禁止即兴删除生产表列。
4. 重放未发布 Outbox；DLQ 只在根因修复且确认事件业务未执行后逐条重放，消费者幂等键不得更换。
5. 完成财务余额、库存台账、应收应付和事件序号核对后恢复流量。

## 6. 日常运行

- 每小时检查 Outbox 失败、Valkey 主队列与 DLQ、WebSocket 断线和 API 5xx；告警必须包含公司维度时只能在受控日志中展示，不进入公开指标标签。
- 每日检查数据库/Valkey/附件备份、磁盘容量和连接池；按批准周期在隔离环境恢复演练。
- 附件到期销毁按公司执行授权接口；删除物理对象后仅保留审计元数据。到期时间、销毁结果与失败重试纳入审计。
- JWT 单密钥轮换会使既有访问令牌失效，应安排维护窗口并同步吊销刷新会话；双密钥/KMS 无缝轮换尚未实现。
- 真实打印失败保留任务为 `failed`，只有适配器确认成功才为 `completed`；不得人工把入队当成打印成功。

## 7. 当前未完成的现场证据

真实 Docker/K8s 启动、PostgreSQL 多连接并发、Valkey 崩溃恢复、50 并发性能、故障注入、备份恢复计时、第三方沙箱和 7 台物理样张均须由对应环境补证。本手册存在不等于这些动作已经执行。
