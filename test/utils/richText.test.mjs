import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeInlineTopicColor,
  parseTopicRichText,
  richLineToPlainText,
  topicRichTextToPlainText,
  wrapTopicRichTextByWidth,
} from '../../src/utils/richText.js';

test('topicRichTextToPlainText removes inline style markers', () => {
  assert.equal(
    topicRichTextToPlainText('普通 **加粗** *斜体* ~~中划线~~ ++下划线++ {red|红色}'),
    '普通 加粗 斜体 中划线 下划线 红色'
  );
});

test('topicRichTextToPlainText keeps invalid color markers as text', () => {
  assert.equal(
    topicRichTextToPlainText('{unknown|文本} {#12|坏颜色}'),
    '{unknown|文本} {#12|坏颜色}'
  );
});

test('parseTopicRichText keeps nested inline styles', () => {
  assert.deepEqual(parseTopicRichText('**{green|重点}**'), [
    { text: '重点', bold: true, color: '#22c55e' },
  ]);
});

test('normalizeInlineTopicColor supports semantic and hex colors', () => {
  assert.equal(normalizeInlineTopicColor('red'), '#ef4444');
  assert.equal(normalizeInlineTopicColor('#abc'), '#aabbcc');
  assert.equal(normalizeInlineTopicColor('#AABBCC'), '#aabbcc');
});

test('wrapTopicRichTextByWidth preserves style segments after wrapping', () => {
  const lines = wrapTopicRichTextByWidth('alpha **boldword** omega', 86, {
    size: 16,
    weight: 400,
  });

  assert.deepEqual(
    lines.map((line) => richLineToPlainText(line)),
    ['alpha', 'boldword', 'omega']
  );
  assert.equal(lines[1][0].bold, true);
});
