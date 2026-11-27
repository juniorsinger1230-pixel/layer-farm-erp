import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argumentsList = process.argv.slice(2);
function getOption(name) {
  const inline = argumentsList.find((argument) => argument.startsWith(`--${name}=`));
  if (inline) return inline.split('=').slice(1).join('=');
  const index = argumentsList.indexOf(`--${name}`);
  return index >= 0 ? argumentsList[index + 1] : null;
}
const runInput = getOption('run');
if (!runInput) {
  console.error('必须提供 --run=<严格运行目录>');
  process.exit(1);
}
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runDirectory = path.resolve(projectRoot, runInput);
if (!existsSync(runDirectory)) {
  console.error(`严格运行目录不存在：${runDirectory}`);
  process.exit(1);
}
const runName = path.basename(runDirectory);
const archiveDirectory = path.join(projectRoot, 'strict-acceptance-archives');
mkdirSync(archiveDirectory, { recursive: true });
const archivePath = path.join(archiveDirectory, `${runName}.zip`);
const command = `Compress-Archive -LiteralPath '${runDirectory}' -DestinationPath '${archivePath}' -Force`;
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { stdio: 'inherit' });
const sha256 = createHash('sha256').update(readFileSync(archivePath)).digest('hex');
const hashPath = `${archivePath}.sha256`;
writeFileSync(hashPath, `${sha256}  ${path.basename(archivePath)}\n`);
console.log(JSON.stringify({ status: 'pass', archivePath: path.relative(projectRoot, archivePath), sha256 }, null, 2));
