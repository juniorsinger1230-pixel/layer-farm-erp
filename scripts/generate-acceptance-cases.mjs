import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const baseline = JSON.parse(readFileSync(new URL('../acceptance-baseline.json', import.meta.url)));
const pages = JSON.parse(readFileSync(new URL('../apps/web/src/data/pageRegistry.json', import.meta.url)));
const formSchemas = JSON.parse(readFileSync(new URL('../apps/web/src/generated/form-schemas.json', import.meta.url)));
const pageApiMap = JSON.parse(readFileSync(new URL('../apps/web/src/generated/page-api-map.json', import.meta.url)));

const sha = baseline.git.sha;
const formPageIds = Object.keys(formSchemas.pages);
const pageMap = Object.fromEntries(pages.map((page) => [page.pageId, page]));
const apiMap = pageApiMap.mapped;

const cases = [];
function addCase(stage, pageId, pageType, operation, precondition, steps, expected, apiPath) {
  const id = `TC-${String(cases.length + 1).padStart(3, '0')}`;
  cases.push({
    id,
    stage,
    pageId,
    pageType,
    operation,
    precondition,
    steps,
    expected,
    apiPath: apiPath ?? '',
    sha,
    actualResult: '待执行',
    evidencePath: '待填写',
    defectId: '无',
    regression: '待回归',
  });
}

// S0：环境与准入，20条
const s0Items = [
  ['S0-01', 'Compose 配置文件存在且语法有效', 'docker compose config 校验通过', 'deploy/compose/docker-compose.yml'],
  ['S0-02', '环境变量文件存在且端口配置完整', 'Web/API/PostgreSQL/Valkey 端口均已配置', 'deploy/compose/.env'],
  ['S0-03', 'PostgreSQL 容器启动并健康', '容器状态为 healthy', 'postgres'],
  ['S0-04', 'Valkey 容器启动并健康', '容器状态为 healthy', 'valkey'],
  ['S0-05', '数据库迁移容器执行成功', '迁移退出码为 0', 'migrate'],
  ['S0-06', 'API 容器启动并健康', '容器状态为 healthy', 'api'],
  ['S0-07', 'Web 容器启动并可访问', 'HTTP 200', 'web'],
  ['S0-08', '存活探针返回正常', 'GET /health/live 返回 ok', '/health/live'],
  ['S0-09', '就绪探针返回正常', 'GET /health/ready 返回 ok 且依赖为 up', '/health/ready'],
  ['S0-10', '演示数据重置脚本可执行', 'npm run demo:seed 退出码为 0', 'demo:seed'],
  ['S0-11', '演示公司 THL 已创建', '公司代码为 THL', 'THL'],
  ['S0-12', '演示部门已创建', '至少 7 个部门', 'organization_unit'],
  ['S0-13', '演示员工已创建', '8 名员工', 'employee'],
  ['S0-14', '演示打印模板已创建', '3 个模板', 'print_template'],
  ['S0-15', '演示客户已创建', '马尼拉生鲜超市存在', 'customer'],
  ['S0-16', '演示价格已创建', '鲜鸡蛋价格存在', 'price_list'],
  ['S0-17', '管理员账号可登录', 'admin.zhang 登录成功并返回令牌', '/api/v1/auth/login'],
  ['S0-18', '登录后可获取当前用户信息', 'GET /api/v1/auth/me 返回用户资料', '/api/v1/auth/me'],
  ['S0-19', '工作区无未提交改动', 'git status 为空', 'git'],
  ['S0-20', '基线文件与当前代码一致', 'acceptance-baseline.json 记录 SHA 与代码一致', 'baseline'],
];
for (const [, title, expected, apiPath] of s0Items) {
  addCase('S0', '环境/基线', '环境准入', title, '当前 Compose 环境已启动', '按检查项执行并记录结果', expected, apiPath);
}

// S1：认证、RBAC与数据隔离，35条
const s1Items = [
  ['S1-01', '未登录访问业务页面被重定向', '跳转至登录页', '/app'],
  ['S1-02', '错误密码登录被拒绝', '返回统一错误，不泄露账号是否存在', '/api/v1/auth/login'],
  ['S1-03', '错误公司代码登录被拒绝', '返回账号或凭据无效', '/api/v1/auth/login'],
  ['S1-04', '空账号登录被表单阻断', '前端提示必填', 'login'],
  ['S1-05', '空密码登录被表单阻断', '前端提示必填', 'login'],
  ['S1-06', '登录成功返回访问令牌和刷新令牌', '两个令牌均存在', '/api/v1/auth/login'],
  ['S1-07', '无令牌访问受保护 API 返回 401', 'HTTP 401', '/api/v1/auth/me'],
  ['S1-08', '篡改令牌访问被拒绝', 'HTTP 401', '/api/v1/auth/me'],
  ['S1-09', '过期令牌访问被拒绝', 'HTTP 401', '/api/v1/auth/me'],
  ['S1-10', '刷新令牌可换取新访问令牌', '返回新令牌', '/api/v1/auth/refresh'],
  ['S1-11', '退出登录后令牌立即失效', '再次使用返回 401', '/api/v1/auth/logout'],
  ['S1-12', '普通员工不能访问 RBAC 管理页', 'HTTP 403 或无入口', '/api/v1/org/system-roles'],
  ['S1-13', '普通员工不能创建组织主数据', 'HTTP 403 或无新建按钮', '/api/v1/org/organizations'],
  ['S1-14', '仓库员工不能审批财务凭证', 'HTTP 403', '/api/v1/fin'],
  ['S1-15', '养殖员工可读取授权业务页面', 'HTTP 200 且页面可进入', 'farm'],
  ['S1-16', '管理员拥有全部业务读权限', '授权页面均可访问', '*'],
  ['S1-17', '管理员拥有业务创建权限', '新建按钮可见且 POST 成功', 'create'],
  ['S1-18', '管理员拥有业务更新权限', '编辑入口可见且 PATCH 成功', 'update'],
  ['S1-19', '跨公司数据访问被 RLS 阻断', '无法查询其他公司数据', 'RLS'],
  ['S1-20', '公司字段自动注入当前公司', '创建数据时 company_code 正确', 'company_scope'],
  ['S1-21', '字段级权限隐藏价格字段', '受限岗位响应中无价格/成本', 'field_projection'],
  ['S1-22', '字段级权限隐藏薪资字段', '受限岗位响应中无薪资', 'field_projection'],
  ['S1-23', '字段级权限隐藏凭据字段', '响应中无密码哈希或密钥', 'field_projection'],
  ['S1-24', '连续登录失败触发账号锁定', '后续登录被锁定策略阻断', 'lockout'],
  ['S1-25', '高权限角色 MFA 校验生效', 'MFA 未通过时拒绝登录', 'MFA'],
  ['S1-26', 'MFA 时钟相邻窗口可接受', '相邻时间窗口验证通过', 'MFA'],
  ['S1-27', '多角色权限取并集', '任一角色授权即允许访问', 'RBAC'],
  ['S1-28', '限时角色到期后权限失效', '到期后访问被拒绝', 'RBAC'],
  ['S1-29', '角色 scope_config 可覆盖默认范围', '按配置范围生效', 'RBAC'],
  ['S1-30', '出纳角色剥离审批权限', '审批操作被拒绝', 'RBAC'],
  ['S1-31', '未授权页面菜单不渲染', '侧边栏无对应入口', 'menu'],
  ['S1-32', '直接输入未授权 URL 显示无权限', '展示访问拒绝页', 'access-denied'],
  ['S1-33', '刷新页面后权限状态保持', '仍按当前角色控制', 'session'],
  ['S1-34', '供应商账号仅见本供应商订单', '其他供应商数据不可见', 'supplier_scope'],
  ['S1-35', '系统页面不暴露通用写入口', '写操作返回 404 或 403', 'read_only'],
];
for (const [, title, expected, apiPath] of s1Items) {
  addCase('S1', '认证/权限', '安全权限', title, '已准备不同角色账号', '按权限矩阵执行并记录结果', expected, apiPath);
}

// S2：74个人工创建页空表单与必填校验，74条
for (const pageId of formPageIds) {
  const page = pageMap[pageId];
  const contract = apiMap[pageId];
  const schema = formSchemas.pages[pageId];
  const requiredFields = schema.fields.filter((field) => field.required).map((field) => field.name);
  addCase(
    'S2',
    pageId,
    '人工创建页',
    '空表单加载与必填校验',
    '已登录且具备页面创建权限',
    `进入 ${page.title}，打开新建抽屉，不填写任何字段直接提交`,
    `表单正常加载，字段标签为中文；必填字段（${requiredFields.join('、') || '无'}）触发校验，请求不提交`,
    contract.path,
  );
}

// S3：74个人工创建页真实创建与查询，74条
for (const pageId of formPageIds) {
  const page = pageMap[pageId];
  const contract = apiMap[pageId];
  addCase(
    'S3',
    pageId,
    '人工创建页',
    '真实创建与创建后查询',
    '已登录、具备创建权限且准备合法表单数据',
    `打开 ${page.title} 新建表单，填写合法数据并提交，随后查询列表或详情`,
    'POST 返回成功；GET 可查询到新记录；页面展示中文标签和正确状态',
    contract.path,
  );
}

// S4：详情、编辑、状态与操作，15条
const s4Items = [
  ['S4-01', '列表页查看详情按钮可点击', '详情抽屉打开', 'detail'],
  ['S4-02', '详情抽屉展示全部业务字段', '字段标签为中文且值正确', 'detail'],
  ['S4-03', '详情抽屉可关闭', '关闭后返回列表', 'detail'],
  ['S4-04', '更多操作下拉可展开', '展示编辑和刷新记录', 'dropdown'],
  ['S4-05', '编辑入口按权限显示', '无权限时不显示编辑', 'edit'],
  ['S4-06', '编辑表单可回填当前记录', '字段值与记录一致', 'edit'],
  ['S4-07', '编辑提交后数据更新', 'PATCH 成功且列表刷新', 'edit'],
  ['S4-08', '状态标签使用中文文案', '不显示原始英文状态值', 'status'],
  ['S4-09', '状态标签颜色与状态匹配', '不同状态颜色区分正确', 'status'],
  ['S4-10', '列表分页可切换页码', '数据按页加载', 'pagination'],
  ['S4-11', '列表分页可切换每页条数', 'pageSize 生效', 'pagination'],
  ['S4-12', '列表总条数显示正确', '共 N 条与接口 total 一致', 'pagination'],
  ['S4-13', '刷新记录可重新加载数据', 'loading 后数据刷新', 'refresh'],
  ['S4-14', '数据加载失败显示错误和重试', '错误提示可见且重试可点击', 'error'],
  ['S4-15', '未开放功能显示功能暂未开放', '不展示模拟数据或研发内容', 'unavailable'],
];
for (const [, title, expected, apiPath] of s4Items) {
  addCase('S4', '业务页面', '通用组件', title, '存在至少一条业务记录', '在列表、详情和编辑中执行操作', expected, apiPath);
}

// S5：移动端与关键业务链路，10条
const s5Items = [
  ['S5-01', 'H5 登录后进入移动工作台', '移动壳层和底部导航正常', '/h5/workbench'],
  ['S5-02', 'H5 业务列表以卡片展示', '卡片字段为中文', '/h5'],
  ['S5-03', 'H5 点击卡片打开详情', '移动详情抽屉正常', '/h5'],
  ['S5-04', 'H5 新建表单可提交', '移动表单保存成功', '/h5'],
  ['S5-05', 'H5 编辑入口和表单正常', '更新成功', '/h5'],
  ['S5-06', '采购入库业务链路闭环', '采购、收货、库存记录一致', 'procurement'],
  ['S5-07', '生产集蛋业务链路闭环', '集蛋记录和库存联动正确', 'egg_collection'],
  ['S5-08', '销售出库业务链路闭环', '订单、出库、FEFO 库存一致', 'sales'],
  ['S5-09', '财务留痕业务链路闭环', '凭证和账务记录正确', 'finance'],
  ['S5-10', '打印设计与打印入口可用', '模板和打印任务正常', 'print'],
];
for (const [, title, expected, apiPath] of s5Items) {
  addCase('S5', '移动端/业务链路', '多端业务', title, '移动视口或业务数据已准备', '按 H5 流程和业务链路执行', expected, apiPath);
}

// S6：契约、禁用词、异常与回归，6条
const s6Items = [
  ['S6-01', 'OpenAPI 契约 479/479 通过', '无缺失、无未登记、无 Schema 错误', 'contract:check'],
  ['S6-02', '源码可见文案禁用词扫描通过', '无 P0/SRS/Mock/GAP/测试等研发文案', 'forbidden-source'],
  ['S6-03', '运行页面禁用词扫描通过', '页面可见文本无禁用词', 'forbidden-runtime'],
  ['S6-04', '重复提交被幂等机制阻断', '同一业务不会重复创建', 'idempotency'],
  ['S6-05', '网络或服务异常有统一错误提示', '不泄露堆栈或内部信息', 'error_handling'],
  ['S6-06', '缺陷修复后回归验证通过', '原失败用例重新通过', 'regression'],
];
for (const [, title, expected, apiPath] of s6Items) {
  addCase('S6', '契约/异常', '最终回归', title, '全部功能用例已执行', '执行契约、禁用词和异常回归', expected, apiPath);
}

const stageCounts = {};
for (const item of cases) {
  stageCounts[item.stage] = (stageCounts[item.stage] ?? 0) + 1;
}

if (cases.length !== 234) {
  throw new Error(`Expected 234 cases, got ${cases.length}`);
}

function escapeCell(value) {
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderTable(rows) {
  const header = '| 用例编号 | 阶段 | 页面/对象 | 页面类型 | 操作类型 | 前置数据 | 操作步骤 | 预期结果 | 对应接口 | 提交SHA | 实际结果 | 证据路径 | 缺陷编号 | 回归状态 |';
  const separator = '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|';
  const body = rows.map((item) => `| ${item.id} | ${item.stage} | ${escapeCell(item.pageId)} | ${escapeCell(item.pageType)} | ${escapeCell(item.operation)} | ${escapeCell(item.precondition)} | ${escapeCell(item.steps)} | ${escapeCell(item.expected)} | ${escapeCell(item.apiPath)} | ${item.sha} | ${item.actualResult} | ${item.evidencePath} | ${item.defectId} | ${item.regression} |`);
  return [header, separator, ...body].join('\n');
}

const stages = ['S0', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
const markdown = [
  '# S0～S6 234 条用例唯一清单',
  '',
  '## 1. 基线信息',
  '',
  `- 代码基线 SHA：${sha}`,
  `- 分支：${baseline.git.branch}`,
  `- OpenAPI 操作：${baseline.authoritativeContract.operations}`,
  `- 人工创建页：${baseline.pageScope.manualCreatePages}`,
  `- 系统只读页：${baseline.pageScope.systemReadOnlyPages}`,
  `- 可见字段：${baseline.formScope.visibleFields}`,
  `- 引用字段：${baseline.formScope.referenceFields}`,
  '',
  '## 2. 阶段统计',
  '',
  '| 阶段 | 用例数 |',
  '|---|---:|',
  ...stages.map((stage) => `| ${stage} | ${stageCounts[stage]} |`),
  `| **合计** | **${cases.length}** |`,
  '',
  '## 3. 用例明细',
  '',
];

for (const stage of stages) {
  markdown.push(`### ${stage}（${stageCounts[stage]} 条）`, '', renderTable(cases.filter((item) => item.stage === stage)), '');
}

markdown.push(
  '## 4. 执行规则',
  '',
  '1. 每条用例必须逐条执行，实际结果只能填写通过、失败、阻断或需求差异。',
  '2. 每条用例必须保留可访问证据，证据路径填写实际截图、日志或响应文件。',
  '3. 失败用例必须登记缺陷编号，修复后在回归状态中记录复测结果。',
  '4. 系统只读页不得按人工创建页统计。',
  '5. 代码基线变更后，本清单必须重新生成并重新冻结。',
  '',
);

const jsonOutputPath = new URL('../acceptance-cases.json', import.meta.url);
writeFileSync(jsonOutputPath, JSON.stringify({
  baseline: {
    sha,
    branch: baseline.git.branch,
    operations: baseline.authoritativeContract.operations,
    manualCreatePages: baseline.pageScope.manualCreatePages,
    systemReadOnlyPages: baseline.pageScope.systemReadOnlyPages,
    visibleFields: baseline.formScope.visibleFields,
    referenceFields: baseline.formScope.referenceFields,
  },
  totalCases: cases.length,
  stageCounts,
  cases,
}, null, 2), 'utf8');
const outputPath = new URL('../S0-S6_234条用例唯一清单.md', import.meta.url);
writeFileSync(outputPath, markdown.join('\n'), 'utf8');
console.log(JSON.stringify({
  status: 'pass',
  totalCases: cases.length,
  stageCounts,
  jsonOutputPath: fileURLToPath(jsonOutputPath),
  outputPath: fileURLToPath(outputPath),
}, null, 2));
