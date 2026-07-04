import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMindDocument } from '../../src/parser/parseMind.js';
import { serializeMind, serializeTopicAttributes } from '../../src/parser/serializeMind.js';

test('serializeMind preserves multi-line topic text', () => {
  const document = parseMindDocument(`# Root
## Child
continued line`);

  assert.equal(
    serializeMind(document.root),
    `# Root
## Child
continued line`
  );
});

test('serializeMind preserves indentation in nested list content', () => {
  const document = parseMindDocument(`# 高级格式
## 无序列表
- abc
  - a
  - b
- ddd`);

  assert.equal(
    serializeMind(document.root),
    `# 高级格式
## 无序列表
- abc
  - a
  - b
- ddd`
  );
});

test('serializeTopicAttributes uses stable common attribute order', () => {
  assert.equal(
    serializeTopicAttributes({
      lineHeight: 24,
      icon: 'book',
      color: '#3b82f6',
      fontSize: 18,
      align: 'center',
      custom: 'x',
    }),
    ' [color=#3b82f6 icon=book fontSize=18 lineHeight=24 align=center custom=x]'
  );
});
