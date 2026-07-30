import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const packageRoot = path.join(projectRoot, 'packages/svg-renderer');
const packageJson = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));
const staticImportPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function collectFiles(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(entryPath, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [entryPath] : [];
  });
}

test('svg renderer is a buildable ESM package that depends only on core', () => {
  assert.equal(packageJson.type, 'module');
  assert.equal(packageJson.main, './dist/index.js');
  assert.equal(packageJson.types, './dist/index.d.ts');
  assert.deepEqual(packageJson.files, ['dist']);
  assert.equal(packageJson.scripts.prepack, 'npm run build');
  assert.equal(packageJson.sideEffects, false);
  assert.deepEqual(packageJson.dependencies, {
    '@yonxao/mindmap-core': packageJson.version,
  });
  assert.equal(packageJson.peerDependencies, undefined);
});

test('svg renderer source has no host, Node runtime, or UI framework imports', () => {
  const violations = [];

  for (const file of collectFiles(path.join(packageRoot, 'src'), '.ts')) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(staticImportPattern)) {
      const specifier = match[1];
      if (!specifier.startsWith('.') && specifier !== '@yonxao/mindmap-core') {
        violations.push(`${path.relative(projectRoot, file)} -> ${match[1]}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('built svg renderer loads directly with declarations and maps present', async () => {
  const entryPath = path.join(packageRoot, 'dist/index.js');
  const declarationsPath = path.join(packageRoot, 'dist/index.d.ts');

  assert.equal(fs.existsSync(entryPath), true);
  assert.equal(fs.existsSync(declarationsPath), true);
  assert.equal(fs.existsSync(`${entryPath}.map`), true);
  assert.equal(fs.existsSync(`${declarationsPath}.map`), true);

  const renderer = await import(`${pathToFileURL(entryPath).href}?boundary-test=${Date.now()}`);
  assert.equal(typeof renderer.connectorPath, 'function');
  assert.equal(typeof renderer.fitViewBox, 'function');
  assert.equal(typeof renderer.signatureCornerWatermarkGeometry, 'function');
});
