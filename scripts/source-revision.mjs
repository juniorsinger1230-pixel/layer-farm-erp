import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export function getSourceRevision(root) {
  const git = (args) => execFileSync(process.env.GIT_PATH ?? 'git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  const generatedOutputs = ['openapi-contract-check-result.json', 'OpenAPI双向核对报告.md', 'current-sha-evidence'];
  const trackedChanges = git(['status', '--porcelain', '--untracked-files=no', '--', '.', ...generatedOutputs.map((path) => `:(exclude)${path}`)]);
  return {
    sha: git(['rev-parse', 'HEAD']),
    tree: git(['rev-parse', 'HEAD^{tree}']),
    branch: git(['branch', '--show-current']),
    trackedWorktreeClean: trackedChanges.length === 0,
    trackedChanges: trackedChanges ? trackedChanges.split(/\r?\n/) : [],
    cleanlinessExclusions: generatedOutputs,
  };
}

export function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}
