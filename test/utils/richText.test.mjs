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
  topicRichTextLinkMarker,
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

test('wrapTopicRichBlocksByWidth marks wrapped link continuations without duplicate icon markers', () => {
  const content = wrapTopicRichBlocksByWidth('[[测试用例|打开项目笔记]]', 42, {
    size: 16,
    weight: 400,
    lineHeight: 20,
  });
  const linkSegments = content.blocks[0].lines.flat().filter((segment) => segment.link);

  assert.ok(content.blocks[0].lines.length > 1);
  assert.notEqual(linkSegments[0]?.linkMarker, false);
  assert.equal(
    linkSegments.slice(1).every((segment) => segment.linkMarker === false),
    true
  );
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

test('parseTopicRichText recognizes tags and links as styled segments', () => {
  assert.deepEqual(
    parseTopicRichText('查看 [官网](https://example.com) #project [[内部笔记|别名]]'),
    [
      { text: '查看 ' },
      { text: '官网', link: true, href: 'https://example.com', linkKind: 'external' },
      { text: ' ' },
      { text: '#project', tag: true, tagName: '#project' },
      { text: ' ' },
      { text: '别名', link: true, href: '内部笔记', linkKind: 'obsidian' },
    ]
  );
  assert.equal(
    topicRichTextToPlainText('查看 [官网](https://example.com) #project [[内部笔记|别名]]'),
    '查看 官网 #project 别名'
  );
});

test('topicRichTextLinkMarker distinguishes external and obsidian links', () => {
  assert.equal(topicRichTextLinkMarker('external'), '↗');
  assert.equal(topicRichTextLinkMarker('obsidian'), '◇');
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

test('parseTopicRichBlocks recognizes tasks notes and images', () => {
  const blocks = parseTopicRichBlocks(`- [ ] todo
- [x] done
> note line
> second line
![cover](cover.png|180x120)
![[vault image.png|封面]]
@[Spec](spec.pdf)
@[[design.fig|Design file]]`);

  assert.equal(blocks[0].type, 'list');
  assert.equal(blocks[0].items[0].task, true);
  assert.equal(blocks[0].items[0].checked, false);
  assert.equal(blocks[0].items[0].sourceLineIndex, 0);
  assert.equal(blocks[0].items[1].checked, true);
  assert.equal(blocks[0].items[1].sourceLineIndex, 1);
  assert.equal(blocks[1].type, 'note');
  assert.deepEqual(blocks[1].lines, ['note line', 'second line']);
  assert.equal(blocks[2].type, 'image');
  assert.equal(blocks[2].source, 'cover.png');
  assert.equal(blocks[2].width, 180);
  assert.equal(blocks[2].height, 120);
  assert.equal(blocks[3].type, 'image');
  assert.equal(blocks[3].obsidian, true);
  assert.equal(blocks[3].alt, '封面');
  assert.equal(blocks[4].type, 'attachment');
  assert.equal(blocks[4].label, 'Spec');
  assert.equal(blocks[4].source, 'spec.pdf');
  assert.equal(blocks[5].type, 'attachment');
  assert.equal(blocks[5].obsidian, true);
  assert.equal(blocks[5].label, 'Design file');
});

test('parseTopicRichBlocks keeps original source line index for task items', () => {
  const blocks = parseTopicRichBlocks(`Intro

- [ ] first
- [x] second`);

  assert.equal(blocks[1].type, 'list');
  assert.deepEqual(
    blocks[1].items.map((item) => item.sourceLineIndex),
    [2, 3]
  );
});

test('parseTopicRichBlocks ignores markdown attachment pipe suffix as display metadata', () => {
  const [block] = parseTopicRichBlocks('@[规格文档](spec.pdf|备用名称)');

  assert.equal(block.type, 'attachment');
  assert.equal(block.label, '规格文档');
  assert.equal(block.source, 'spec.pdf');
});

test('parseTopicRichBlocks keeps media and notes separate after paragraphs', () => {
  const blocks = parseTopicRichBlocks(`This is a #tag
![cover](cover.png)
> note
@[Spec](spec.pdf)`);

  assert.deepEqual(
    blocks.map((block) => block.type),
    ['paragraph', 'image', 'note', 'attachment']
  );
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

test('wrapTopicRichBlocksByWidth measures images task lists and adornments', () => {
  const content = wrapTopicRichBlocksByWidth(
    `> **备注**
- [x] 完成任务
![说明](image.png|160x90)
@[资料](file.pdf)`,
    220,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    }
  );

  assert.deepEqual(
    content.blocks.map((block) => block.type),
    ['note', 'list', 'image', 'attachment']
  );
  assert.deepEqual(
    content.adornments.map((block) => block.type),
    ['note', 'attachment']
  );
  assert.equal(content.adornmentCount, 2);
  assert.equal(content.blocks[1].items[0].task, true);
  assert.equal(content.blocks[1].items[0].checked, true);
  assert.equal(content.blocks[2].imageWidth, 160);
  assert.equal(content.blocks[2].imageHeight, 90);
  assert.ok(content.height > 0);
});

test('wrapTopicRichBlocksByWidth falls back to topic width for pending percent image width', () => {
  const content = wrapTopicRichBlocksByWidth('![半宽](image.png|50%)', 240, {
    size: 16,
    weight: 400,
    lineHeight: 20,
  });

  assert.equal(content.blocks[0].type, 'image');
  assert.equal(content.blocks[0].sizeMode, 'percent');
  assert.equal(content.blocks[0].scale, 0.5);
  assert.equal(content.blocks[0].imageWidth, 120);
});

test('wrapTopicRichBlocksByWidth keeps explicit image size within topic width', () => {
  const content = wrapTopicRichBlocksByWidth('![规则类型](testpng.png|400X300)', 560, {
    size: 16,
    weight: 400,
    lineHeight: 20,
  });

  assert.equal(content.blocks[0].type, 'image');
  assert.equal(content.blocks[0].imageWidth, 400);
  assert.equal(content.blocks[0].imageHeight, 300);
});

test('wrapTopicRichBlocksByWidth uses natural image ratio when available', () => {
  const content = wrapTopicRichBlocksByWidth(
    '![规则类型](testpng.png|400X300)',
    560,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    },
    {
      resolveImageSize: () => ({ width: 800, height: 500 }),
    }
  );

  assert.equal(content.blocks[0].imageWidth, 400);
  assert.equal(content.blocks[0].imageHeight, 250);
});

test('wrapTopicRichBlocksByWidth uses natural ratio for percent image width', () => {
  const content = wrapTopicRichBlocksByWidth(
    '![半宽](image.png|50%)',
    240,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    },
    {
      resolveImageSize: () => ({ width: 400, height: 300 }),
    }
  );

  assert.equal(content.blocks[0].imageWidth, 200);
  assert.equal(content.blocks[0].imageHeight, 150);
});

test('wrapTopicRichBlocksByWidth does not upscale percent image width beyond natural size', () => {
  const content = wrapTopicRichBlocksByWidth(
    '![原图](image.png|100%)',
    2000,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    },
    {
      resolveImageSize: () => ({ width: 800, height: 500 }),
    }
  );

  assert.equal(content.blocks[0].imageWidth, 800);
  assert.equal(content.blocks[0].imageHeight, 500);
});

test('wrapTopicRichBlocksByWidth uses compact blocks for unresolved images', () => {
  const content = wrapTopicRichBlocksByWidth(
    '![缺失](missing.png)',
    240,
    {
      size: 16,
      weight: 400,
      lineHeight: 20,
    },
    {
      isImageResolved: () => false,
    }
  );

  assert.equal(content.blocks[0].type, 'image');
  assert.equal(content.blocks[0].imageMissing, true);
  assert.equal(content.blocks[0].imageWidth, 118);
  assert.equal(content.blocks[0].imageHeight, 54);
  assert.ok(content.height < 90);
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
