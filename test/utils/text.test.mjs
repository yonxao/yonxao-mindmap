import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeTopicTextForStorage,
  visualUnits,
  wrapTopicTextByWidth,
} from '../../src/utils/text.js';

test('visualUnits counts CJK characters as wider text units', () => {
  assert.equal(visualUnits('AI学习'), 6);
});

test('wrapTopicTextByWidth keeps hard line breaks', () => {
  assert.deepEqual(wrapTopicTextByWidth('第一行\n第二行', 240, { size: 16 }), ['第一行', '第二行']);
});

test('normalizeTopicTextForStorage preserves leading indentation in content lines', () => {
  assert.equal(normalizeTopicTextForStorage('\n- abc  \n  - a  \n  - b\n'), '- abc\n  - a\n  - b');
});
