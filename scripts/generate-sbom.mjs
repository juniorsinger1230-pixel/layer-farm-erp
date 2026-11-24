import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const lock = JSON.parse(readFileSync(join(root, 'package-lock.json'), 'utf8'));
const components = [];
for (const [path, meta] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/') || meta.link || !meta.version) continue;
  const manifestPath = join(root, path, 'package.json');
  let manifest;
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } else if (meta.optional && meta.version && meta.license) {
    manifest = { name: path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length), version: meta.version, license: meta.license };
  } else {
    throw new Error(`Missing required package manifest: ${path}`);
  }
  let licenses = manifest.license
    ? [Array.isArray(manifest.license) ? manifest.license.map((item) => item.type).join(' OR ') : typeof manifest.license === 'object' ? manifest.license.type : manifest.license]
    : [];
  const licenseFile = join(root, path, 'LICENSE');
  if (licenses.filter(Boolean).length === 0 && existsSync(licenseFile) && readFileSync(licenseFile, 'utf8').startsWith('MIT License')) licenses = ['MIT'];
  components.push({
    type: 'library',
    'bom-ref': `pkg:npm/${manifest.name}@${manifest.version}`,
    name: manifest.name,
    version: manifest.version,
    purl: `pkg:npm/${manifest.name}@${manifest.version}`,
    licenses: licenses.filter(Boolean).map((name) => ({ license: { name } })),
    hashes: meta.integrity?.startsWith('sha512-') ? [{ alg: 'SHA-512', content: meta.integrity.slice(8) }] : [],
    externalReferences: meta.resolved ? [{ type: 'distribution', url: meta.resolved }] : [],
  });
}
const sbom = {
  bomFormat: 'CycloneDX', specVersion: '1.5', serialNumber: `urn:uuid:${randomUUID()}`, version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: { type: 'application', name: 'layer-farm-erp', version: '0.1.0', 'bom-ref': 'pkg:npm/layer-farm-erp@0.1.0' },
    properties: [{ name: 'source', value: 'package-lock.json' }, { name: 'scope', value: 'all-locked-npm-dependencies-including-optional-platform-packages' }],
  },
  components,
};
mkdirSync(join(root, 'sbom'), { recursive: true });
writeFileSync(join(root, 'sbom', 'sbom.cdx.json'), JSON.stringify(sbom, null, 2));
console.log(JSON.stringify({ components: components.length, output: 'sbom/sbom.cdx.json' }, null, 2));
