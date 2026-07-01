import test from 'node:test';
import assert from 'node:assert/strict';

import {
  insertCodeBlockAfterSource,
  replaceCodeBlockSource,
} from '../../src/markdown/codeBlock.js';

test('replaceCodeBlockSource uses sectionInfo to replace only the current block', () => {
  const markdown = ['```yxmm', '# A', '```', '', '```yxmm', '# A', '```'].join('\n');

  const replaced = replaceCodeBlockSource(markdown, 'yxmm', '# A', '# B', {
    lineStart: 4,
    lineEnd: 5,
  });

  assert.equal(replaced, ['```yxmm', '# A', '```', '', '```yxmm', '# B', '```'].join('\n'));
});

test('replaceCodeBlockSource returns null when no matching block exists', () => {
  assert.equal(replaceCodeBlockSource('```js\n# A\n```', 'yxmm', '# A', '# B', null), null);
});

test('insertCodeBlockAfterSource inserts after the section matched block', () => {
  const markdown = ['```yxmm', '# A', '```', '', '```yxmm', '# A', '```'].join('\n');

  const inserted = insertCodeBlockAfterSource(markdown, 'yxmm', '# A', '# Recovered', {
    lineStart: 4,
    lineEnd: 5,
  });

  assert.equal(
    inserted,
    [
      '```yxmm',
      '# A',
      '```',
      '',
      '```yxmm',
      '# A',
      '```',
      '',
      '```yxmm',
      '# Recovered',
      '```',
    ].join('\n')
  );
});

test('insertCodeBlockAfterSource preserves fence indentation', () => {
  const markdown = ['  ```yxmm', '# A', '  ```'].join('\n');

  const inserted = insertCodeBlockAfterSource(markdown, 'yxmm', '# A', '# Recovered', {
    lineStart: 0,
    lineEnd: 2,
  });

  assert.equal(
    inserted,
    ['  ```yxmm', '# A', '  ```', '', '  ```yxmm', '# Recovered', '  ```'].join('\n')
  );
});
