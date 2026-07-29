import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const coreRoot = path.join(projectRoot, 'packages/core');
const packageJson = JSON.parse(fs.readFileSync(path.join(coreRoot, 'package.json'), 'utf8'));
const forbiddenCoreImports =
  /^(?:node:|obsidian$|electron$|react$|react-dom(?:\/|$)|@yonxao\/mindmap-svg-renderer$)/;
const staticImportPattern =
  /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;

function collectFiles(directory, extension) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(entryPath, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [entryPath] : [];
  });
}

test('core package metadata describes a buildable dependency-free ESM package', () => {
  assert.equal(packageJson.type, 'module');
  assert.equal(packageJson.main, './dist/index.js');
  assert.equal(packageJson.types, './dist/index.d.ts');
  assert.equal(packageJson.exports['.'].import, './dist/index.js');
  assert.equal(packageJson.exports['.'].types, './dist/index.d.ts');
  assert.deepEqual(packageJson.files, ['dist']);
  assert.equal(packageJson.scripts.prepack, 'npm run build');
  assert.equal(packageJson.sideEffects, false);
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.peerDependencies, undefined);
});

test('core source has no static host or Node runtime imports', () => {
  const violations = [];

  for (const file of collectFiles(path.join(coreRoot, 'src'), '.ts')) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(staticImportPattern)) {
      if (forbiddenCoreImports.test(match[1])) {
        violations.push(`${path.relative(projectRoot, file)} -> ${match[1]}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});

test('built core exports load directly with declarations and source maps present', async () => {
  const entryPath = path.join(coreRoot, 'dist/index.js');
  const declarationsPath = path.join(coreRoot, 'dist/index.d.ts');

  assert.equal(fs.existsSync(entryPath), true);
  assert.equal(fs.existsSync(declarationsPath), true);
  assert.equal(fs.existsSync(`${entryPath}.map`), true);
  assert.equal(fs.existsSync(`${declarationsPath}.map`), true);

  const core = await import(`${pathToFileURL(entryPath).href}?boundary-test=${Date.now()}`);
  assert.equal(typeof core.parseMindDocument, 'function');
  assert.equal(typeof core.layoutTree, 'function');
  assert.equal(typeof core.adjustTopicLevelSelectionText, 'function');
  assert.equal(core.signatureCornerWatermarkGeometry, undefined);
});
