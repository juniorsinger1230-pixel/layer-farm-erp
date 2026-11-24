import { writeFileSync } from 'node:fs';

const now = Date.now() / 1000;
const rules = [
  { alert: 'LayerFarmAPIDown', severity: 'critical', trigger: (metric) => metric.name === 'up' && metric.labels.job === 'layer-farm-api' && metric.value === 0 },
  { alert: 'HighHTTP5xxRate', severity: 'critical', trigger: (metric) => metric.name === 'http_5xx_rate' && metric.value > 1 },
  { alert: 'HighHTTPLatencyP95', severity: 'warning', trigger: (metric) => metric.name === 'http_p95_seconds' && metric.value > 1 },
  { alert: 'BackupStale', severity: 'critical', trigger: (metric) => metric.name === 'backup_age_seconds' && metric.value > 86400 },
  { alert: 'DiskSpaceCritical', severity: 'critical', trigger: (metric) => metric.name === 'filesystem_free_ratio' && metric.value < 0.08 },
  { alert: 'CertificateExpiringSoon', severity: 'warning', trigger: (metric) => metric.name === 'certificate_ttl_seconds' && metric.value < 2592000 },
  { alert: 'PodRestartLoop', severity: 'warning', trigger: (metric) => metric.name === 'pod_restarts_30m' && metric.value > 3 },
];

const scenarios = [
  {
    name: 'healthy',
    metrics: [
      { name: 'up', labels: { job: 'layer-farm-api' }, value: 1 },
      { name: 'http_5xx_rate', labels: { service: 'api' }, value: 0 },
      { name: 'http_p95_seconds', labels: { service: 'api' }, value: 0.24 },
      { name: 'backup_age_seconds', value: 3600 },
      { name: 'filesystem_free_ratio', value: 0.42 },
      { name: 'certificate_ttl_seconds', value: 7776000 },
      { name: 'pod_restarts_30m', labels: { pod: 'api' }, value: 0 },
    ],
    expected: [],
  },
  {
    name: 'production_incident',
    metrics: [
      { name: 'up', labels: { job: 'layer-farm-api' }, value: 0 },
      { name: 'http_5xx_rate', labels: { service: 'api' }, value: 4.2 },
      { name: 'http_p95_seconds', labels: { service: 'api' }, value: 1.8 },
      { name: 'backup_age_seconds', value: 93600 },
      { name: 'filesystem_free_ratio', value: 0.06 },
      { name: 'certificate_ttl_seconds', value: 1209600 },
      { name: 'pod_restarts_30m', labels: { pod: 'api' }, value: 5 },
    ],
    expected: ['LayerFarmAPIDown', 'HighHTTP5xxRate', 'HighHTTPLatencyP95', 'BackupStale', 'DiskSpaceCritical', 'CertificateExpiringSoon', 'PodRestartLoop'],
  },
];

const results = scenarios.map((scenario) => {
  const triggered = rules.filter((rule) => scenario.metrics.some((metric) => rule.trigger(metric))).map((rule) => ({ alert: rule.alert, severity: rule.severity }));
  const actual = triggered.map((item) => item.alert).sort();
  const expected = [...scenario.expected].sort();
  return {
    name: scenario.name,
    triggered,
    expected: scenario.expected,
    passed: actual.length === expected.length && actual.every((value, index) => value === expected[index]),
  };
});

const result = {
  event: 'p2_alert_simulation_completed',
  checkedAt: new Date().toISOString(),
  now,
  routing: { critical: 'oncall-webhook', warning: 'engineering-webhook', data: 'data-platform-webhook' },
  results,
  productionBoundary: 'This validates rule logic and routing design. Production Alertmanager, receiver authentication and escalation ownership must be verified in the target environment.',
};
writeFileSync('p2-alert-simulation-result.json', `${JSON.stringify(result, null, 2)}\n`);
if (results.some((item) => !item.passed)) process.exitCode = 1;
console.log(JSON.stringify({ event: result.event, scenarios: results.length, passed: results.every((item) => item.passed) }));
