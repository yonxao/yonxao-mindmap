import assert from 'node:assert/strict';
import test from 'node:test';

import {
  estimateTopicTextWidth,
  normalizeInlineTopicColor,
  normalizeTopicTextForStorage,
  parseTopicRichBlocks,
  parseTopicRichText,
  topicRichTextPreferredContentWidth,
  topicRichTextToPlainText,
  wrapTopicRichBlocksByWidth,
  wrapTopicRichTextByWidth,
  wrapTopicTextByWidth,
} from '@yonxao/mindmap-core';
import {
  parseTopicRichBlocks as parsePluginTopicRichBlocks,
  parseTopicRichText as parsePluginTopicRichText,
  wrapTopicRichBlocksByWidth as wrapPluginTopicRichBlocksByWidth,
} from '../../../src/utils/richText.js';

test('public core parses overlapping inline styles and links', () => {
  const segments = parseTopicRichText(
    '**粗体~~删除**仍删除~~ [官网](https://example.com) [[文档|别名]] #项目'
  );

  assert.equal(topicRichTextToPlainText('**粗体** {red|红色}'), '粗体 红色');
  assert.deepEqual(segments.slice(0, 3), [
    { text: '粗体', bold: true },
    { text: '删除', bold: true, strike: true },
    { text: '仍删除', strike: true },
  ]);
  assert.ok(segments.some((segment) => segment.href === 'https://example.com'));
  assert.ok(segments.some((segment) => segment.href === '文档' && segment.text === '别名'));
  assert.ok(segments.some((segment) => segment.tagName === '#项目'));
});

test('public core owns semantic colors and text normalization', () => {
  assert.equal(normalizeInlineTopicColor('RED'), '#ef4444');
  assert.equal(normalizeInlineTopicColor('#AbC'), '#aabbcc');
  assert.equal(normalizeInlineTopicColor('unknown'), '');
  assert.equal(normalizeTopicTextForStorage('\n  first  \n\tsecond\n\n'), '  first\n\tsecond');
});

test('public core recognizes every rich block kind and source line indexes', () => {
  const blocks = parseTopicRichBlocks(`Intro

- [ ] todo
  1. nested
> note
![cover](cover.png|180x120)
@[[spec.pdf|Specification]]
$$
E = mc^2
$$
~~~js
const answer = 42;
~~~`);

  assert.deepEqual(
    blocks.map((block) => block.type),
    ['paragraph', 'list', 'note', 'image', 'attachment', 'equation', 'code']
  );
  assert.equal(blocks[1].items[0].sourceLineIndex, 2);
  assert.equal(blocks[1].items[1].level, 1);
  assert.equal(blocks[3].width, 180);
  assert.equal(blocks[3].height, 120);
  assert.equal(blocks[4].source, 'spec.pdf');
});

test('public core exposes image width preference without host resolution', () => {
  assert.equal(topicRichTextPreferredContentWidth('![cover](cover.png|320x180)'), 320);
  assert.equal(topicRichTextPreferredContentWidth('![cover](cover.png|50%)'), 0);
});

test('public core provides deterministic cross-platform text measurement', () => {
  const font = { size: 16, weight: 700 };
  assert.ok(estimateTopicTextWidth('中文', font) > estimateTopicTextWidth('ab', font));
  assert.deepEqual(wrapTopicTextByWidth('alpha beta\ngamma', 60, font), ['alpha', 'beta', 'gamma']);
});

test('public core lays out rich paragraphs lists equations code and adornments', () => {
  const content = wrapTopicRichBlocksByWidth(
    `**Intro**
> note
1. first
1. second
$$
x = \\frac{1}{2}
$$
~~~js
const answer = 42;
~~~
@[Spec](spec.pdf)`,
    180,
    { size: 16, weight: 400, lineHeight: 20 }
  );

  assert.deepEqual(
    content.blocks.map((block) => block.type),
    ['paragraph', 'note', 'list', 'equation', 'code', 'attachment']
  );
  assert.deepEqual(
    content.adornments.map((block) => block.type),
    ['note', 'attachment']
  );
  assert.deepEqual(
    content.blocks[2].items.map((item) => item.markerText),
    ['1.', '2.']
  );
  assert.ok(content.blocks[3].height > 20);
  assert.ok(content.blocks[4].font.family.includes('monospace'));
  assert.ok(content.width > 0);
  assert.ok(content.height > 0);
});

test('public core keeps image resource knowledge behind host callbacks', () => {
  const resolved = wrapTopicRichBlocksByWidth(
    '![cover](cover.png|50%)',
    300,
    { size: 16, lineHeight: 20 },
    {
      isImageResolved: (block) => block.source === 'cover.png',
      resolveImageSize: () => ({ width: 400, height: 240 }),
    }
  );
  const missing = wrapTopicRichBlocksByWidth(
    '![missing](missing.png)',
    300,
    { size: 16, lineHeight: 20 },
    { isImageResolved: () => false }
  );

  assert.equal(resolved.blocks[0].imageWidth, 200);
  assert.equal(resolved.blocks[0].imageHeight, 120);
  assert.equal(resolved.blocks[0].imageMissing, false);
  assert.equal(missing.blocks[0].imageWidth, 118);
  assert.equal(missing.blocks[0].imageHeight, 54);
  assert.equal(missing.blocks[0].imageMissing, true);
});

test('public core preserves link marker state across wrapped lines', () => {
  const lines = wrapTopicRichTextByWidth('[[项目笔记|打开项目笔记]]', 42, {
    size: 16,
    weight: 400,
  });
  const linkedSegments = lines.flat().filter((segment) => segment.link);

  assert.ok(lines.length > 1);
  assert.equal(linkedSegments.filter((segment) => segment.linkMarker !== false).length, 1);
});

test('plugin compatibility entry delegates semantic parsing to public core', () => {
  const source = '**bold**\n- [x] task\n![cover](cover.png|50%)';
  const font = { size: 16, weight: 400, lineHeight: 20 };
  assert.deepEqual(parsePluginTopicRichText(source), parseTopicRichText(source));
  assert.deepEqual(parsePluginTopicRichBlocks(source), parseTopicRichBlocks(source));
  assert.deepEqual(
    wrapPluginTopicRichBlocksByWidth(source, 180, font),
    wrapTopicRichBlocksByWidth(source, 180, font)
  );
});
