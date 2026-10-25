import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(await readFile(path.join(root, 'module.json'), 'utf8'));
const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const tag = process.argv[2];
assert.equal(tag, `v${manifest.version}`, 'Tag wydania musi odpowiadać wersji manifestu.');
assert.equal(packageJson.version, manifest.version, 'package.json i module.json muszą mieć tę samą wersję.');
assert.equal(manifest.manifest, `${manifest.url}/releases/latest/download/module.json`);
assert.equal(manifest.download, `${manifest.url}/releases/download/${tag}/module.zip`);
const output = path.join(root, 'dist', manifest.id);
const packaged = JSON.parse(await readFile(path.join(output, 'module.json'), 'utf8'));
assert.deepEqual(packaged, manifest, 'Paczka musi zawierać aktualny manifest.');
for (const file of [...manifest.esmodules, ...manifest.styles, 'templates/importer.hbs', 'scripts/json-import.js', 'scripts/world-items.js', 'examples/actors.json']) {
  const info = await stat(path.join(output, file));
  assert.ok(info.isFile() && info.size > 0, `Brak pliku w paczce: ${file}`);
}
assert.ok(!(await readdir(output)).includes('vendor'), 'Paczka nie może zawierać dawnych bibliotek.');
const scripts = await readdir(path.join(output, 'scripts'));
for (const removed of ['pdf.js', 'page-ranges.js', 'parser.js', 'item-references.js']) assert.ok(!scripts.includes(removed), `Usunięta funkcjonalność pozostała w paczce: ${removed}`);
console.log(`Sprawdzono wydanie ${tag}, manifest i pliki paczki.`);
