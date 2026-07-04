/*
 * 富文本解析和布局功能的单元测试。
 * 覆盖：样式标记剥离、颜色标准化、嵌套样式解析、换行保留样式、块级格式解析。
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeInlineTopicColor,
  parseTopicRichBlocks,
  parseTopicRichText,
  richLineToPlainText,
  topicRichTextToPlainText,
  wrapTopicRichBlocksByWidth,
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

test('wrapTopicRichBlocksByWidth preserves paragraph styles across hard line breaks', () => {
  const content = wrapTopicRichBlocksByWidth('**第一行\n第二行**', 180, {
    size: 16,
    weight: 400,
    lineHeight: 20,
  });

  assert.deepEqual(content.lines, ['第一行', '第二行']);
  assert.equal(content.blocks[0].lines[0][0].bold, true);
  assert.equal(content.blocks[0].lines[1][0].bold, true);
});

test('wrapTopicRichBlocksByWidth parses nested styles inside multi-line wrappers', () => {
  const content = wrapTopicRichBlocksByWidth(
    `~~++发{red|文本}大水++
**{green|到*撒*}**
发动~~`,
    220,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    }
  );
  const lines = content.blocks[0].lines;

  assert.deepEqual(content.lines, ['发文本大水', '到撒', '发动']);
  assert.equal(lines[0][0].strike, true);
  assert.equal(lines[0][0].underline, true);
  assert.equal(lines[0][1].color, '#ef4444');
  assert.equal(lines[1][0].strike, true);
  assert.equal(lines[1][0].bold, true);
  assert.equal(lines[1][0].color, '#22c55e');
  assert.equal(lines[1][1].italic, true);
  assert.equal(lines[2][0].strike, true);
});

test('parseTopicRichText supports overlapping inline style ranges', () => {
  assert.deepEqual(parseTopicRichText('这**是一~~段特别**长~~文本'), [
    { text: '这' },
    { text: '是一', bold: true },
    { text: '段特别', bold: true, strike: true },
    { text: '长', strike: true },
    { text: '文本' },
  ]);
});

test('parseTopicRichBlocks recognizes lists equations and code blocks', () => {
  const blocks = parseTopicRichBlocks(`Intro
- item
  1. nested
$$
E = mc^2
$$
~~~js
const answer = 42;
~~~`);

  assert.equal(blocks[0].type, 'paragraph');
  assert.equal(blocks[1].type, 'list');
  assert.equal(blocks[1].items[0].ordered, false);
  assert.equal(blocks[1].items[1].ordered, true);
  assert.equal(blocks[1].items[1].level, 1);
  assert.equal(blocks[2].type, 'equation');
  assert.equal(blocks[2].source, 'E = mc^2');
  assert.equal(blocks[3].type, 'code');
  assert.equal(blocks[3].language, 'js');
});

test('wrapTopicRichBlocksByWidth returns measurable rich blocks', () => {
  const content = wrapTopicRichBlocksByWidth(
    `- **bold** item
$$
a^2 + b^2 = c^2
$$
~~~
const value = 1;
~~~`,
    180,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    }
  );

  assert.deepEqual(
    content.blocks.map((block) => block.type),
    ['list', 'equation', 'code']
  );
  assert.ok(content.width > 0);
  assert.ok(content.height > 0);
  assert.equal(content.blocks[0].items[0].lines[0][0].bold, true);
  assert.match(content.lines.join('\n'), /a\^2/);
});

test('wrapTopicRichBlocksByWidth increments ordered list markers by level', () => {
  const content = wrapTopicRichBlocksByWidth(
    `1. 新主题
1. 文本
1. 发动
  3. 子项
  3. 子项`,
    180,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    }
  );

  assert.deepEqual(
    content.blocks[0].items.map((item) => item.markerText),
    ['1.', '2.', '3.', '3.', '4.']
  );
});

test('wrapTopicRichBlocksByWidth uses distinct unordered markers for nested levels', () => {
  const content = wrapTopicRichBlocksByWidth(
    `- abc
  - a
  - b
- 123
  - 1
  - 2
- ddd`,
    180,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    }
  );

  assert.deepEqual(
    content.blocks[0].items.map((item) => item.markerText),
    ['•', '◦', '◦', '•', '◦', '◦', '•']
  );
  assert.ok(content.blocks[0].items[1].textXOffset > content.blocks[0].items[0].textXOffset);
});

test('wrapTopicRichBlocksByWidth caps code block width for long lines', () => {
  const content = wrapTopicRichBlocksByWidth(
    `~~~
public static void main(String[] args){ System.out.println("Hello world!"); }
~~~`,
    800,
    {
      size: 24,
      weight: 400,
      lineHeight: 32,
    }
  );

  assert.equal(content.blocks[0].type, 'code');
  assert.ok(content.blocks[0].width <= 420);
  assert.ok(content.blocks[0].lines.length > 1);
});

test('wrapTopicRichBlocksByWidth gives code blocks a comfortable minimum width', () => {
  const content = wrapTopicRichBlocksByWidth(
    `~~~java
public static void main(String[] args) {
  System.out.println("Hello world!");
}
~~~`,
    208,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    }
  );

  assert.equal(content.blocks[0].type, 'code');
  assert.ok(content.blocks[0].width > 208);
  assert.equal(content.blocks[0].lines.length, 3);
});

test('wrapTopicRichBlocksByWidth uses relaxed line height for lists', () => {
  const content = wrapTopicRichBlocksByWidth(
    `1. 新主题
1. 单价
2. dd
3. 文本`,
    180,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    }
  );

  assert.equal(content.blocks[0].type, 'list');
  assert.equal(content.blocks[0].lineHeight, 23);
  assert.equal(content.blocks[0].height, 4 * 23);
});

test('wrapTopicRichBlocksByWidth reserves taller blocks for display equations', () => {
  const simple = wrapTopicRichBlocksByWidth(
    `$$
E = mc^2
$$`,
    220,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    }
  );
  const fraction = wrapTopicRichBlocksByWidth(
    `$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$`,
    220,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    }
  );

  assert.equal(simple.blocks[0].type, 'equation');
  assert.equal(fraction.blocks[0].type, 'equation');
  assert.ok(simple.blocks[0].height > 20);
  assert.ok(fraction.blocks[0].height > simple.blocks[0].height);
});
