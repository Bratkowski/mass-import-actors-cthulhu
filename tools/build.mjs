import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'module.json'), 'utf8'));
if (!/^[a-z0-9-]+$/.test(manifest.id)) throw new Error('Nieprawidłowy identyfikator modułu.');
const dist = path.resolve(root, 'dist');
const output = path.resolve(dist, manifest.id);
if (path.dirname(output) !== dist) throw new Error('Katalog wynikowy wykracza poza dist.');
// Rebuild from an empty package directory so removed features cannot remain in a release.
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const name of ['module.json', 'scripts', 'templates', 'styles', 'examples', 'README.md', 'THIRD_PARTY_NOTICES.md']) {
  await cp(path.join(root, name), path.join(output, name), { recursive: true });
}
console.log(`Gotowy moduł: ${output}`);
