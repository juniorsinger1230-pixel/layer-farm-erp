import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

export default function globalSetup(): void {
  const result = spawnSync(process.execPath, [resolve('scripts/e2e-seed.mjs')], {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) throw new Error('E2E bootstrap data preparation failed');
}
