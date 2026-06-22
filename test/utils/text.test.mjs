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

test('normalizeTopicTextForStorage trims each line and preserves hard breaks', () => {
  assert.equal(normalizeTopicTextForStorage('  A  \n  B  '), 'A\nB');
});
