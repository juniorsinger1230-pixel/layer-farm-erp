# OpenAPI 双向核对报告

- 检查时间：2026-11-27T11:18:54.007Z
- 被测源码 SHA：`0be074655eb444ccb36ba03aabbaf06cc6abfbed`
- 分支：`chore/baseline-sync`
- 已跟踪工作树干净：**是**
- 检查范围：route, HTTP method, field-level schema, query parameters and status-code contract
- 检查结论：**通过**
- 技术栈：Hono + Node.js + TypeScript，权威契约为 OpenAPI 3.1。

> 本报告只展示上述 SHA 的当次结果。旧 58 REAL＋29 GAP、481 操作及历史契约覆盖率均不作为当前结论。

## 1. 输入与追溯

| 输入 | 路径 | SHA-256 |
|---|---|---|
| openapiPath | contracts/openapi.json | `76b379649905996616060915b87e056e794bcb0dc32f516dd42b69e8acab3c0d` |
| mappingPath | contracts/api-operation-map.json | `4c30ba3046a9802cca6b240c0d2f49f418f93761add0823c4d054bf949429202` |
| appPath | apps/api/src/app.ts | `960e9fde2474e9895861d82f41874be17a669c0932adfdf205912133656b021c` |
| resourcesPath | packages/domain/src/generated/resources.ts | `81ee3e2487687229b82c4b0e8c0819b83041d4a21f6956e5496dfb56a1d3b3b5` |
| policyPath | packages/domain/src/generated/resource-route-policy.ts | `ca7f4886d47ef759dabcb2c7bc08f6765e841d66814f7f08c5931842867e9156` |
| contractProcessPath | packages/domain/src/contract-process.ts | `954785bb603251a206b40312b81559e8cb7cc0d29354e3b459edfc3152ce82f4` |

核对规则：OpenAPI 与 Hono 实现按路径和 HTTP 方法双向核对，同时检查请求字段、查询参数、状态码和只读资源写暴露。

## 2. 当前 SHA 汇总

| 指标 | 数量 |
|---|---:|
| OpenAPI 路径数 | 321 |
| OpenAPI 操作数 | 479 |
| API 映射数 | 100 |
| 实际 API 操作数 | 479 |
| 已匹配操作 | 479 |
| 契约覆盖率 | 100.00% |
| 缺失实现 | 0 |
| 未文档化操作 | 0 |
| 只读契约仍暴露写操作 | 0 |
| 字段 Schema 错误 | 0 |
| 查询参数错误 | 0 |
| 状态码错误 | 0 |

## 3. 差异明细

### 3.1 OpenAPI 已定义但未实现

无。

### 3.2 已实现但未文档化

无。

### 3.3 只读契约写暴露

无。

### 3.4 字段、参数和状态码错误

- 字段 Schema：0 项
- 查询参数：0 项
- 状态码：0 项

## 4. 复跑方式

```powershell
npm run contract:check
npm run contract:report
```

