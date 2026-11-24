# 持续质量门禁与 SCA/SBOM 闭环报告

报告日期：2026-11-23  
工程：Layer Farm ERP  
需求基线：REQ-BL-20261121-01  
设计基线：DESIGN-BL-20261123-01

## 1. 门禁结论

扩展后的持续质量门禁已在本机工程执行，命令 `npm run gate` 退出码 0，最终判定为 **PASS**。该结论只覆盖当前工程代码和合成测试数据，不代表全部 ERP 功能或生产上线验收完成。

## 2. 八项质量工作落实情况

| 序号 | 要求 | 落实结果 |
|---|---|---|
| 1 | 编写单元测试 | 新增 `tests/quality-policy.test.mjs`，当前全量测试 87/87 通过 |
| 2 | 统计覆盖率 | 生成 c8 文本、LCOV 与 JSON 摘要；语句/行 96.91%，分支 69.60%，函数 93.51% |
| 3 | 静态分析与依赖漏洞扫描 | typed ESLint、TypeScript、SAST 规则和机器可读 SCA 均通过 |
| 4 | 质量门禁判定 | 新增 `quality-gate-result.json`，对覆盖率、SCA、SBOM 和豁免统一判定 |
| 5 | 缺陷修复与复测 | 修复 Windows 下 `npm.cmd` 子进程 `EINVAL`，复测通过；完整门禁退出码 0 |
| 6 | 边界、异常、并发、幂等和安全测试 | 现有 87 项测试覆盖 RBAC、RLS、并发争抢、幂等、状态机、异常输入、投影脱敏和安全边界 |
| 7 | 覆盖率阈值纳入流水线并规范豁免 | 新增 `quality-policy.json`；CI 执行统一 gate；豁免必须含审批人、工单号、原因和到期时间 |
| 8 | 核验 SCA 与 SBOM 并跟踪高风险依赖 | 输出 `sca-scan-result.json` 和 `sbom/sbom.cdx.json`；当前漏洞 0、高风险 0、SBOM 组件 391/391 |

## 3. 阈值与豁免规则

覆盖率阈值：

- statements：95%
- branches：65%
- functions：90%
- lines：95%

SCA 默认阻断 moderate 及以上漏洞。任何漏洞豁免必须登记：

- package：包名
- severity：严重级别
- advisory：公告链接，可选但用于精确匹配
- expires：到期时间
- approver：审批人
- ticket：缺陷/风险工单号
- reason：豁免原因和补偿控制

已过期、缺字段或公告不匹配的豁免不会通过最终判定。

## 4. SCA 与 SBOM 结果

- SCA 输出：`sca-scan-result.json`
- 漏洞数量：0
- 未解决漏洞：0
- 已豁免漏洞：0
- 高风险/严重依赖跟踪：0
- SBOM 格式：CycloneDX 1.5
- SBOM 输出：`sbom/sbom.cdx.json`
- 锁定依赖组件：391
- SBOM 实际组件：391
- 组件数量核验：通过

## 5. 流水线更新

`.github/workflows/quality-gate.yml` 已更新：

- 使用 Node.js 22。
- 执行统一 `npm run gate`。
- 保存完整 `gate-output.txt`。
- 上传覆盖率、SCA、SBOM、质量判定、策略文件、SAST、许可证证据。
- 后续部署静态检查依赖 verify 门禁通过后才执行。

## 6. 仍未完成的质量边界

- 当前本机没有真实 Docker/K8s 执行环境，容器与编排文件未完成实跑验证。
- 性能证据仍主要覆盖认证组织列表接口，不能外推至复杂报表、库存竞争、ASN、饲喂或生产容量。
- 浏览器 E2E、物理打印、第三方沙箱、生产高可用、备份恢复和密钥管理未完成。
- 新增领域 API 尚未同步权威 OpenAPI，执行扩展仍需正式设计变更批准。
- 本报告不是生产上线批准，也不能替代现场验收。
