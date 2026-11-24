import { execFileSync, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function globalSetup(): void {
  const container = process.env.E2E_POSTGRES_CONTAINER ?? 'layer-farm-erp-p2-postgres-1';
  const containerId = execFileSync('docker', ['ps', '--filter', `name=${container}`, '--format', '{{.ID}}'], { encoding: 'utf8' }).trim();
  if (!containerId) throw new Error(`PostgreSQL container ${container} is not running`);
  const containerEnv = execFileSync('docker', ['inspect', '-f', '{{range .Config.Env}}{{println .}}{{end}}', containerId], { encoding: 'utf8' });
  const passwordLine = containerEnv.split(/\r?\n/).find((line) => line.startsWith('POSTGRES_PASSWORD='));
  if (passwordLine === undefined) throw new Error('PostgreSQL password is not configured');
  const password = passwordLine.slice('POSTGRES_PASSWORD='.length);
  const databaseUrl = process.env.DATABASE_URL ?? `postgresql://erp:${encodeURIComponent(password)}@127.0.0.1:55432/layer_farm`;
  const result = spawnSync(process.execPath, [resolve('scripts/e2e-seed.mjs')], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (result.status !== 0) throw new Error('E2E bootstrap data preparation failed');
}
