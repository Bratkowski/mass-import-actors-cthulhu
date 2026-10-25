import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const version = '5.4.624';
const integrity = 'sm6TxKTtWv1Oh6n3C6J6a8odejb5uO4A4zo/2dgkHuC0iu8ZMAXOezEODkVaoVp8nX1Xzr+0WxFJJmUr45hQzg==';
const cache = path.join(root, '.cache', `pdfjs-${version}`);
await mkdir(cache, { recursive: true });
const archive = path.join(cache, 'pdfjs.tgz');
let bytes;
try { bytes = await readFile(archive); } catch {
  const response = await fetch(`https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-${version}.tgz`);
  if (!response.ok) throw new Error(`Pobieranie PDF.js: HTTP ${response.status}`);
  bytes = Buffer.from(await response.arrayBuffer());
  await writeFile(archive, bytes);
}
if (createHash('sha512').update(bytes).digest('base64') !== integrity) throw new Error('Nieprawidłowa suma kontrolna PDF.js.');
execFileSync('tar', ['-xzf', archive, '-C', cache]);
const vendor = path.join(root, 'vendor', 'pdfjs');
await mkdir(path.join(vendor, 'build'), { recursive: true });
for (const name of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
  await cp(path.join(cache, 'package', 'build', name), path.join(vendor, 'build', name));
}
for (const name of ['cmaps', 'standard_fonts', 'wasm', 'LICENSE']) {
  await cp(path.join(cache, 'package', name), path.join(vendor, name), { recursive: true });
}
const manifest = JSON.parse(await readFile(path.join(root, 'module.json'), 'utf8'));
const output = path.join(root, 'dist', manifest.id);
await mkdir(output, { recursive: true });
for (const name of ['module.json', 'scripts', 'templates', 'styles', 'vendor', 'README.md', 'THIRD_PARTY_NOTICES.md']) {
  await cp(path.join(root, name), path.join(output, name), { recursive: true });
}
console.log(`Gotowy moduł: ${output}`);
