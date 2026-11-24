# Layer Farm ERP 实现工程

技术栈为 React 18 + Ant Design 5 + TypeScript + Vite、Hono + Node.js + TypeScript、PostgreSQL、BullMQ + Valkey 与 WebSocket。生猪繁育不属于本项目。

## 已实现代码

- 75 表权威迁移、执行扩展迁移、RLS、参数化 Repository、认证与 15 角色 RBAC。
- 生产/兽医/集蛋、批次库存、移动加权、FEFO、双计量、MRP、采购/销售退货、配送、收付款、总账、BIR 税务与经营报表。
- 供应商账号绑定、采购交期确认与限量 ASN；ASN 仓库收货在同一事务中完成质检、批次库存、移动加权、应付、订单/ASN 状态，拒收不增库存和应付。
- 禽苗/淘汰鸡销售、存栏扣减、信用和应收联动；鸡群成本快照自动核算销售成本；销售批次净收入、退货成本、毛利与中英 CSV。
- 饲喂记录按指定库位执行 FEFO 出库，排除销售预占，逐批次扣减库存/估值并按实际批次成本自动归集鸡群 feed 成本；同单据重复出库被阻断。
- Outbox、幂等消费、BullMQ 退避与 DLQ、管理员 HTTP 死信查询/重放、WebSocket 心跳和按序号补拉。
- 附件哈希与到期销毁、权威 7 台设备软件打印矩阵、PDF/ESC-P/TSPL、HMAC 回调防重放。
- React 登录、MFA、会话刷新、业务记录入口、MRP、供应商门户、ASN 收货、鸡群成本、FEFO 饲喂出库、禽苗/淘汰鸡销售、批次毛利与打印入口。
- Prometheus 指标、就绪/队列探针、非 root 容器、Compose/K8s 基线和 CI 质量门禁。

## 本地门禁

```powershell
npm ci
npm run gate
```

`gate` 包含 typed ESLint、TypeScript、全量后端测试与 c8 覆盖率、secrets/配置扫描、机器可读 SCA、许可证、SBOM 和最终质量判定。前端生产构建包含在测试前置构建中。当前门禁阈值为语句/行 95%、分支 65%、函数 90%；覆盖率阈值只针对被测试加载的文件，不能解释为全系统覆盖率。SCA 默认阻断 moderate 及以上漏洞，高风险/严重漏洞进入 `sca-scan-result.json` 跟踪。

覆盖率或漏洞豁免必须登记在 `quality-policy.json`，写明包名、严重级别、到期时间、审批人、工单号和原因；缺少字段或已到期的豁免自动失效。不能通过命令行参数、注释或临时配置绕过门禁。

## 启动

真实服务需要注入 `DATABASE_URL`、`VALKEY_URL`、至少 32 字节的 `JWT_SIGNING_KEY`。生产缺少任一配置会拒绝启动。

```powershell
npm start
```

Compose 和 Kubernetes 的启动、迁移、发布与回滚见 `deploy/RUNBOOK.md`。

## 验收边界

- PGlite 自动化测试不能替代真实 PostgreSQL、多连接并发或 50 并发性能验收。
- 当前未运行真实 Docker/K8s、第三方沙箱或物理打印机；真实 Valkey 停机/恢复探针已验证，完整故障恢复矩阵仍未完成。
- 真实性能结果仅覆盖认证组织列表接口与合成数据，不能外推至复杂报表、库存竞争、ASN、饲喂或生产容量。
- 7 台设备矩阵是软件规则/字节渲染验证，不是现场样张签认；M421 是独立标签扩展，不替代权威设备。
- 通用资源页面不等于 402 个 OpenAPI 操作全部完成；新增执行接口仍需同步契约和设计变更基线。
- `app_auth`/`app_ops` 及 005～012 执行扩展需要正式设计变更批准，不能视作原设计基线已覆盖。
- 当前尚未完成全部浏览器 E2E、完整业务页面、USB/蓝牙实测和生产上线批准。
