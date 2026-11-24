import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  evaluateCoverage,
  evaluateDependencies,
  findWaiver,
  loadPolicy,
  normalizeAuditVulnerabilities,
  validateWaivers,
} from '../scripts/quality-policy-lib.mjs';

const policy = {
  coverage: { statements: 95, branches: 65, functions: 90, lines: 95 },
  dependencyScan: { failOnSeverity: 'moderate' },
  waivers: [
    {
      package: 'blocked-lib',
      severity: 'high',
      expires: '2099-01-01T00:00:00.000Z',
      approver: 'security-lead',
      ticket: 'SEC-1',
      reason: 'compensating control',
      advisory: 'https://example.test/adv',
    },
  ],
};

test('低风险漏洞不会阻断 moderate 门禁，高风险进入跟踪', () => {
  const result = evaluateDependencies(policy, [
    { name: 'low-lib', severity: 'low', advisories: [] },
    { name: 'high-lib', severity: 'high', advisories: [] },
  ]);
  assert.equal(result.pass, false);
  assert.equal(result.highRiskTracking.length, 1);
  assert.equal(result.unresolved[0].name, 'high-lib');
});

test('具备审批和到期时间的高风险豁免可通过，过期豁免自动失效', () => {
  const vulnerability = {
    name: 'blocked-lib',
    severity: 'high',
    advisories: ['https://example.test/adv'],
  };
  assert.equal(findWaiver(policy, vulnerability, new Date('2026-01-01')).ticket, 'SEC-1');
  assert.equal(findWaiver(policy, vulnerability, new Date('2100-01-01')), undefined);
  assert.equal(evaluateDependencies(policy, [vulnerability], new Date('2026-01-01')).pass, true);
});

test('豁免缺少审批人、工单号或原因时不能通过校验', () => {
  const invalidPolicy = {
    ...policy,
    waivers: [{ package: 'x', severity: 'moderate', expires: '2099-01-01' }],
  };
  const errors = validateWaivers(invalidPolicy);
  assert.equal(errors.length, 3);
});

test('覆盖率逐指标判定，任一指标低于阈值即失败', () => {
  const passing = evaluateCoverage(policy, {
    statements: { pct: 95 },
    branches: { pct: 65 },
    functions: { pct: 90 },
    lines: { pct: 95 },
  });
  const failing = evaluateCoverage(policy, {
    statements: { pct: 94.99 },
    branches: { pct: 65 },
    functions: { pct: 90 },
    lines: { pct: 95 },
  });
  assert.equal(passing.pass, true);
  assert.equal(failing.pass, false);
});

test('npm audit 结果规范化并保留公告链接', () => {
  const result = normalizeAuditVulnerabilities({
    vulnerabilities: {
      lib: {
        severity: 'moderate',
        range: '<1.0.0',
        isDirect: true,
        fixAvailable: true,
        via: [{ source: '1001', url: 'https://example.test/1001' }],
      },
    },
  });
  assert.deepEqual(result[0].advisories, ['https://example.test/1001']);
});

test('合法策略阈值可以加载', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const loaded = loadPolicy(root);
  assert.equal(loaded.coverage.statements, 95);
});
