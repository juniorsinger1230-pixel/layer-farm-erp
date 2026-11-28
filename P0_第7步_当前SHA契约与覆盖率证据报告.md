# P0 第 7 步：当前 SHA 契约与覆盖率证据报告

## 1. 结论

本步已在固定源码 SHA 上重新执行 OpenAPI 契约检查、生产构建、Node 全量测试和 c8 覆盖率门禁，结果全部通过。

- **被测源码 SHA：`0be074655eb444ccb36ba03aabbaf06cc6abfbed`**
- Tree：`7ad638ee58421a36fb894624df1bceeea5dd6895`
- 分支：`chore/baseline-sync`
- 证据生成时间：2026-11-27T11:27:00.436Z
- 被测已跟踪源码工作树：干净；仅排除本步生成的契约结果、契约报告和 `current-sha-evidence/`
- 契约：479/479，100.00%，差异为 0
- 测试：137/137，失败 0、取消 0、跳过 0
- 覆盖率：语句 95.71%、行 95.71%、分支 68.57%、函数 93.39%，均通过既定阈值

> 本报告中的“当前 SHA”是被测源码提交，不是后续保存证据文件的文档提交。证据提交只保存本报告和生成结果，不会反向改变被测源码 SHA。

## 2. 实际执行命令

```powershell
npm run contract:check
npm run contract:report
npm run test:coverage
npm run evidence:current-sha -- --test-log=gate-local-step7.txt
npm run lint
```

各命令退出码均为 0。`test:coverage` 包含 TypeScript 构建和 Web 生产构建；构建成功。Vite 仍有大于 500 kB 的 chunk 警告，该警告未被隐藏，也不等于构建失败。

## 3. OpenAPI 契约证据

检查时间：2026-11-27T11:18:54.007Z。

| 指标 | 当前 SHA 实测结果 |
|---|---:|
| OpenAPI 路径 | 321 |
| 权威操作 | 479 |
| 实现操作 | 479 |
| 双向匹配操作 | 479 |
| 契约覆盖率 | 100.00% |
| 缺失实现 | 0 |
| 未文档化操作 | 0 |
| 只读资源写暴露 | 0 |
| 字段 Schema 错误 | 0 |
| 查询参数错误 | 0 |
| 状态码错误 | 0 |

核对范围包括路由和 HTTP 方法双向一致性、请求字段 Schema、查询参数、显式状态码及只读资源写暴露。原始结果中的 `sourceRevision.sha` 与本报告被测 SHA 完全一致。

契约输入已记录 SHA-256，详见 `current-sha-evidence/openapi-contract-check-result.json`；人类可读汇总见 `OpenAPI双向核对报告.md`。

## 4. 测试与覆盖率证据

| 指标 | 覆盖/总数 | 当前 SHA 工具输出 | 门禁阈值 | 判定 |
|---|---:|---:|---:|---|
| 语句 | 16851/17606 | 95.71% | ≥95% | 通过 |
| 行 | 16851/17606 | 95.71% | ≥95% | 通过 |
| 分支 | 1381/2014 | 68.57% | ≥65% | 通过 |
| 函数 | 297/318 | 93.39% | ≥90% | 通过 |

独立按覆盖数/总数复算，语句和行约为 95.7117%，分支约为 68.5700%，函数约为 93.3962%；与 c8 输出一致。函数比例按 c8 两位显示为 93.39%。

测试原始 TAP 汇总为：tests=137、pass=137、fail=0、cancelled=0、skipped=0、todo=0。

**覆盖率边界：**仅统计测试实际加载的 `apps/api/src` 与 `packages` 文件；不包含 `apps/web`，也不把未加载文件计入分母。因此这些数值不是全系统代码覆盖率，更不是 74＋2 页面或 S0～S6 共 234 条用例的功能覆盖率。功能验收仍由独立逐条台账证明。

## 5. 旧指标隔离

| 旧内容 | 本步处置 |
|---|---|
| 58 REAL＋29 GAP | 不进入当前结果；页面口径继续使用 74 个人工创建页＋2 个系统只读页 |
| 481 操作 | 不进入当前结果；契约只使用当前 SHA 实测的 479/479 |
| 旧覆盖率快照 | 不作为证据引用；本报告数字来自本次 `coverage-summary.json` 和 TAP 原始输出 |
| 旧 402 操作、69.65% 契约覆盖率 | 已由当前 SHA 报告覆盖，不再作为当前结论 |

历史文档中保留的旧数字只能用于说明历史或作废原因，不得与本表并列为当前结果。

## 6. 证据清单与复核方式

| 文件 | 用途 |
|---|---|
| `current-sha-evidence/manifest.json` | 唯一当前汇总；绑定 SHA、Tree、测试实数、覆盖率和契约实数 |
| `current-sha-evidence/coverage-summary.json` | c8 机器可读覆盖率原始摘要 |
| `current-sha-evidence/test-coverage-output.txt` | 构建、137 项测试及 c8 原始输出 |
| `current-sha-evidence/openapi-contract-check-result.json` | 契约原始结果、源码 SHA 和输入哈希 |
| `OpenAPI双向核对报告.md` | 当前 SHA 契约人类可读报告 |
| `P0_第7步_当前SHA契约与覆盖率证据报告.md` | 本步结论、边界和旧指标隔离说明 |

复核时应同时满足：manifest 状态为 `pass`；manifest、契约结果和被测提交三者 SHA 相同；复制件哈希与 manifest 一致；测试总数等于通过数且失败/取消均为 0；契约和覆盖率差异均未超门禁。

## 7. 未由本步关闭的事项

- 本步不是对全部 234 条功能用例在新提交上的再次全量重跑，不替代 G5 功能验收台账。
- 未重跑安全扫描、依赖漏洞、许可证或 SBOM，因此不引用这些项目的历史结果作为当前 SHA 结论。
- 未覆盖 Firefox/WebKit、移动实机、实体 M421 出纸、生产性能、阿里云生产资源及独立 GitHub Approve。
