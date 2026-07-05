import assert from 'node:assert/strict';
import test from 'node:test';

import { formatFencedMindMapSource } from '../../src/renderer/export/sourceFence.js';

test('formatFencedMindMapSource wraps source in a yxmm fenced code block', () => {
  assert.equal(formatFencedMindMapSource('# Root'), ['```yxmm', '# Root', '```'].join('\n'));
});

test('formatFencedMindMapSource keeps the closing fence on its own line', () => {
  assert.equal(
    formatFencedMindMapSource('# Root\n## Child\n\n'),
    ['```yxmm', '# Root', '## Child', '```'].join('\n')
  );
});

test('formatFencedMindMapSource supports empty source', () => {
  assert.equal(formatFencedMindMapSource(''), ['```yxmm', '```'].join('\n'));
});
