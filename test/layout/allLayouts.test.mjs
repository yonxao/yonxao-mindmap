import assert from 'node:assert/strict';
import test from 'node:test';

import { LAYOUT_TYPES } from '../../src/layout/layoutTypes.js';
import { layoutTree } from '../../src/layout/layoutTree.js';
import { parseMindDocument } from '../../src/parser/parseMind.js';

const REPRESENTATIVE_SOURCE = `# 根主题
## 左分支
### 左一
### 左二
## 右分支
### 右一
#### 右一子主题`;

for (const layout of LAYOUT_TYPES) {
  test(`${layout} produces finite geometry for every visible topic`, () => {
    const document = parseMindDocument(
      `---\nstructure:\n  layout: ${layout}\n---\n\n${REPRESENTATIVE_SOURCE}`
    );
    const result = layoutTree(document.root, new Set(), document.config);

    assert.equal(result.mode, layout);
    assert.equal(result.topics.length, 7);
    assert.equal(result.connectors.length, 6);
    assert.ok(result.bounds.maxX > result.bounds.minX);
    assert.ok(result.bounds.maxY > result.bounds.minY);

    for (const topic of result.topics) {
      for (const value of [
        topic._layout.x,
        topic._layout.y,
        topic._layout.width,
        topic._layout.height,
      ]) {
        assert.equal(Number.isFinite(value), true, `${layout} generated non-finite geometry`);
      }
      assert.ok(topic._layout.width > 0);
      assert.ok(topic._layout.height > 0);
    }
  });
}

test('all layouts honor collapsed topic state before collecting visible geometry', () => {
  for (const layout of LAYOUT_TYPES) {
    const document = parseMindDocument(
      `---\nstructure:\n  layout: ${layout}\n---\n\n${REPRESENTATIVE_SOURCE}`
    );
    const collapsedTopic = document.root.subtopics[1];
    const result = layoutTree(document.root, new Set([collapsedTopic.id]), document.config);

    assert.equal(result.topics.length, 5, `${layout} did not hide collapsed descendants`);
    assert.equal(result.connectors.length, 4, `${layout} kept connectors to hidden descendants`);
  }
});
