import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const severityRank = { low: 1, moderate: 2, high: 3, critical: 4 };

export function loadPolicy(root) {
  const policy = JSON.parse(readFileSync(join(root, 'quality-policy.json'), 'utf8'));
  const requiredCoverage = ['statements', 'branches', 'functions', 'lines'];
  for (const key of requiredCoverage) {
    const value = policy.coverage?.[key];
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      throw new Error(`coverage threshold ${key} must be between 1 and 100`);
    }
  }
  if (!severityRank[policy.dependencyScan?.failOnSeverity]) {
    throw new Error('dependencyScan.failOnSeverity is invalid');
  }
  return policy;
}

export function normalizeAuditVulnerabilities(audit) {
  const result = [];
  for (const [name, value] of Object.entries(audit.vulnerabilities ?? {})) {
    const references = Array.isArray(value.via)
      ? value.via.filter((item) => typeof item === 'object' && item !== null)
      : [];
    const advisories = references.map((item) => item.url ?? item.source ?? item.title).filter(Boolean);
    result.push({
      name,
      severity: value.severity,
      range: value.range ?? null,
      fixAvailable: Boolean(value.fixAvailable),
      advisories: [...new Set(advisories)],
      direct: Boolean(value.isDirect),
    });
  }
  return result;
}

export function findWaiver(policy, vulnerability, now = new Date()) {
  return (policy.waivers ?? []).find((waiver) => {
    if (waiver.package !== vulnerability.name) return false;
    if (waiver.severity !== vulnerability.severity) return false;
    if (new Date(waiver.expires).getTime() <= now.getTime()) return false;
    if (waiver.advisory && !vulnerability.advisories.includes(waiver.advisory)) return false;
    return true;
  });
}

export function validateWaivers(policy, now = new Date()) {
  const errors = [];
  for (const waiver of policy.waivers ?? []) {
    const required = ['package', 'severity', 'expires', 'approver', 'ticket', 'reason'];
    for (const key of required) {
      if (!waiver[key]) errors.push(`waiver ${waiver.package ?? '<unknown>'} missing ${key}`);
    }
    if (!severityRank[waiver.severity]) errors.push(`${waiver.package} has invalid severity`);
    if (new Date(waiver.expires).getTime() <= now.getTime()) {
      errors.push(`${waiver.package} waiver is expired`);
    }
  }
  return errors;
}

export function evaluateDependencies(policy, vulnerabilities, now = new Date()) {
  const threshold = severityRank[policy.dependencyScan.failOnSeverity];
  const unresolved = [];
  const waived = [];
  const highRiskTracking = [];
  for (const vulnerability of vulnerabilities) {
    const rank = severityRank[vulnerability.severity] ?? 0;
    if (rank >= 3) highRiskTracking.push(vulnerability);
    if (rank < threshold) continue;
    const waiver = findWaiver(policy, vulnerability, now);
    if (waiver) waived.push({ ...vulnerability, waiver: waiver.ticket });
    else unresolved.push(vulnerability);
  }
  return { unresolved, waived, highRiskTracking, pass: unresolved.length === 0 };
}

export function evaluateCoverage(policy, summary) {
  const metrics = {};
  for (const [key, threshold] of Object.entries(policy.coverage)) {
    const actual = summary[key]?.pct;
    if (!Number.isFinite(actual)) throw new Error(`coverage metric ${key} is missing`);
    metrics[key] = { threshold, actual, pass: actual >= threshold };
  }
  return { metrics, pass: Object.values(metrics).every((item) => item.pass) };
}
