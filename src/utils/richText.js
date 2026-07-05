/*
 * 文件作用：
 * 解析主题内容中的局部文字样式标记，并提供布局测量和 SVG 渲染可复用的片段数据。
 *
 * 支持语法：
 * **加粗**、*斜体*、~~中划线~~、++下划线++、{red|语义色}、{#e11d48|十六进制颜色}、
 * #标签、[链接](https://example.com)、[[内部链接]]。
 * 行内样式允许跨硬换行，并允许不同样式区间交叉叠加。
 * 块级格式：
 * - 无序列表
 * - [ ] 任务
 * 1. 有序列表
 * > 备注
 * @[附件](path-or-url)
 * @[[Obsidian 附件.pdf]]
 * ![图片](path-or-url)
 * ![[Obsidian 附件.png]]
 * $$
 * E = mc^2
 * $$
 * ~~~js
 * const value = 1;
 * ~~~
 */

import { estimateTopicTextWidth } from './text.js';

const COLOR_MARKER_PATTERN = /^\{((?:#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)|[a-zA-Z][a-zA-Z0-9-]*)\|/;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const CJK_OR_FULLWIDTH_RE = /[\u2e80-\u9fff\uff00-\uffef]/;
const CODE_FENCE_PATTERN = /^~~~([a-zA-Z0-9_-]+)?\s*$/;
const EQUATION_FENCE_PATTERN = /^\$\$\s*$/;
const MARKDOWN_IMAGE_PATTERN = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
const OBSIDIAN_IMAGE_PATTERN = /^!\[\[([^\]]+)\]\]\s*$/;
const MARKDOWN_ATTACHMENT_PATTERN = /^@\[([^\]]*)\]\(([^)]+)\)\s*$/;
const OBSIDIAN_ATTACHMENT_PATTERN = /^@\[\[([^\]]+)\]\]\s*$/;
const NOTE_LINE_PATTERN = /^>\s?(.*)$/;
const TASK_LIST_PATTERN = /^(\s*)[-*+]\s+\[([ xX])\]\s+(.+)$/;
const UNORDERED_LIST_PATTERN = /^(\s*)[-*+]\s+(.+)$/;
const ORDERED_LIST_PATTERN = /^(\s*)(\d+)[.)]\s+(.+)$/;
const MARKDOWN_LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)/;
const OBSIDIAN_LINK_PATTERN = /^\[\[([^\]]+)\]\]/;
const TAG_PATTERN = /^#([\p{L}\p{N}_/-]+)/u;
const LINK_MARKERS = Object.freeze({
  external: '↗',
  obsidian: '◇',
});
// 主题内容不是完整 Markdown 解析器；列表缩进按编辑器常用的 2 空格一级折算。
const INDENT_TAB_WIDTH = 2;
const LIST_LEVEL_INDENT = 22;
const LIST_MARKER_GAP = 6;
const LIST_MIN_MARKER_WIDTH = 12;
const LIST_LINE_HEIGHT_RATIO = 1.45;
const UNORDERED_LIST_MARKERS = Object.freeze(['•', '◦', '▪']);
const CODE_BLOCK_PADDING_X = 10;
const CODE_BLOCK_PADDING_Y = 5;
const CODE_BLOCK_MIN_WIDTH = 48;
// 代码块允许比普通主题最大宽度更宽，但仍设上限，避免长代码把整张导图撑开。
const CODE_BLOCK_MAX_WIDTH = 420;
const CODE_BLOCK_COMFORT_WIDTH = 360;
const CODE_FONT_SIZE_RATIO = 0.82;
const CODE_LINE_HEIGHT_RATIO = 1.34;
// SVG 布局阶段无法真实测量 var(--font-monospace)，用等宽近似值避免标点被普通文本估宽低估。
const CODE_MONOSPACE_CHAR_WIDTH_RATIO = 0.62;
const EQUATION_FONT_SIZE_RATIO = 1.04;
const EQUATION_SIMPLE_HEIGHT_RATIO = 1.75;
const EQUATION_TALL_HEIGHT_RATIO = 2.55;
const EQUATION_EXTRA_TALL_HEIGHT_RATIO = 3.15;
const TOPIC_RICH_BLOCK_GAP_RATIO = 0.32;
const TOPIC_RICH_BLOCK_MIN_GAP = 4;
const IMAGE_BLOCK_DEFAULT_WIDTH = 220;
const IMAGE_BLOCK_MAX_WIDTH = 360;
const IMAGE_BLOCK_MIN_WIDTH = 96;
const MISSING_IMAGE_BLOCK_WIDTH = 118;
const MISSING_IMAGE_BLOCK_HEIGHT = 54;
const IMAGE_BLOCK_DEFAULT_ASPECT_RATIO = 0.62;
const IMAGE_BLOCK_CAPTION_GAP = 5;
const IMAGE_SIZE_ORIGINAL = 'original';
const IMAGE_SIZE_PERCENT_PATTERN = /^(\d+(?:\.\d+)?)%$/;

export const TOPIC_RICH_BLOCK_TYPES = Object.freeze({
  PARAGRAPH: 'paragraph',
  LIST: 'list',
  EQUATION: 'equation',
  CODE: 'code',
  NOTE: 'note',
  IMAGE: 'image',
  ATTACHMENT: 'attachment',
});

export const TOPIC_CODE_BLOCK_PADDING_X = CODE_BLOCK_PADDING_X;
export const TOPIC_CODE_BLOCK_PADDING_Y = CODE_BLOCK_PADDING_Y;
export const TOPIC_RICH_TEXT_CODE_FONT_FAMILY =
  'var(--font-monospace, var(--font-mono, monospace))';

export const INLINE_TOPIC_COLOR_VALUES = Object.freeze({
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  orange: '#f97316',
  purple: '#a855f7',
  pink: '#ec4899',
  gray: '#64748b',
  black: '#111827',
  white: '#f8fafc',
});

export const INLINE_TOPIC_COLOR_OPTIONS = Object.freeze([
  ['red', INLINE_TOPIC_COLOR_VALUES.red],
  ['green', INLINE_TOPIC_COLOR_VALUES.green],
  ['blue', INLINE_TOPIC_COLOR_VALUES.blue],
  ['yellow', INLINE_TOPIC_COLOR_VALUES.yellow],
  ['orange', INLINE_TOPIC_COLOR_VALUES.orange],
  ['purple', INLINE_TOPIC_COLOR_VALUES.purple],
  ['pink', INLINE_TOPIC_COLOR_VALUES.pink],
  ['gray', INLINE_TOPIC_COLOR_VALUES.gray],
  ['black', INLINE_TOPIC_COLOR_VALUES.black],
  ['white', INLINE_TOPIC_COLOR_VALUES.white],
]);

const STYLE_MARKERS = Object.freeze([
  { marker: '**', key: 'bold' },
  { marker: '~~', key: 'strike' },
  { marker: '++', key: 'underline' },
  { marker: '*', key: 'italic' },
]);

/*
 * 将行内颜色值标准化为十六进制颜色。支持语义色名称和 #xxx/#xxxxxx 格式。
 * 未知语义色返回空字符串。
 */
export function normalizeInlineTopicColor(value) {
  const color = String(value || '').trim();
  if (!color) return '';
  if (HEX_COLOR_PATTERN.test(color)) return normalizeHexColor(color);
  return INLINE_TOPIC_COLOR_VALUES[color.toLowerCase()] || '';
}

/*
 * 将富文本源码中的样式标记全部剥离，返回纯文本。
 */
export function topicRichTextToPlainText(source) {
  return joinSegmentsText(parseTopicRichText(source));
}

/*
 * 解析富文本源码为样式片段数组，合并相邻同风格片段。
 */
export function parseTopicRichText(source, baseStyle = {}) {
  return mergeAdjacentRichSegments(parseRichTextRange(String(source || ''), baseStyle));
}

/*
 * 将主题内容文本解析为块级格式（段落/列表/代码/公式/图片/备注/附件）的数组。
 * 按行扫描，优先级依次为：
 * 1. ~~~ 代码块 fence
 * 2. $$ 公式 fence
 * 3. 图片（Markdown 和 Obsidian 风格）
 * 4. 附件（Markdown 和 Obsidian 风格）
 * 5. > 备注行（连续多行合并为一个备注块）
 * 6. 列表行（- / 1. 等，连续合并为一个列表块）
 * 7. 普通段落
 * 没有匹配任何格式时兜底返回一个 "Untitled" 段落块。
 */
export function parseTopicRichBlocks(source) {
  const rawLines = String(source || '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const blocks = [];
  let index = 0;

  while (index < rawLines.length) {
    const line = rawLines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    // 检测代码块 fence（~~~）
    const codeFence = trimmed.match(CODE_FENCE_PATTERN);
    if (codeFence) {
      const codeLines = [];
      index += 1;
      while (index < rawLines.length && !CODE_FENCE_PATTERN.test(rawLines[index].trim())) {
        codeLines.push(rawLines[index]);
        index += 1;
      }
      if (index < rawLines.length) index += 1;
      blocks.push({
        type: TOPIC_RICH_BLOCK_TYPES.CODE,
        language: codeFence[1] || '',
        lines: codeLines.length ? codeLines : [''],
      });
      continue;
    }

    // 检测公式 fence（$$）
    if (EQUATION_FENCE_PATTERN.test(trimmed)) {
      const equationLines = [];
      index += 1;
      while (index < rawLines.length && !EQUATION_FENCE_PATTERN.test(rawLines[index].trim())) {
        equationLines.push(rawLines[index]);
        index += 1;
      }
      if (index < rawLines.length) index += 1;
      blocks.push({
        type: TOPIC_RICH_BLOCK_TYPES.EQUATION,
        source: equationLines.join('\n').trim() || trimmed,
      });
      continue;
    }

    const imageBlock = parseTopicImageBlock(trimmed);
    if (imageBlock) {
      blocks.push(imageBlock);
      index += 1;
      continue;
    }

    const attachmentBlock = parseTopicAttachmentBlock(trimmed);
    if (attachmentBlock) {
      blocks.push(attachmentBlock);
      index += 1;
      continue;
    }

    if (NOTE_LINE_PATTERN.test(line)) {
      const lines = [];
      while (index < rawLines.length && NOTE_LINE_PATTERN.test(rawLines[index])) {
        lines.push(rawLines[index].match(NOTE_LINE_PATTERN)?.[1] || '');
        index += 1;
      }
      blocks.push({
        type: TOPIC_RICH_BLOCK_TYPES.NOTE,
        lines: lines.length ? lines : [''],
      });
      continue;
    }

    // 检测列表行（- / 1. 等）
    if (isTopicListLine(line)) {
      const items = [];
      while (index < rawLines.length && isTopicListLine(rawLines[index])) {
        items.push(parseTopicListItem(rawLines[index]));
        index += 1;
      }
      blocks.push({ type: TOPIC_RICH_BLOCK_TYPES.LIST, items });
      continue;
    }

    const paragraphLines = [];
    while (
      index < rawLines.length &&
      rawLines[index].trim() &&
      !isTopicStandaloneBlockLine(rawLines[index])
    ) {
      paragraphLines.push(rawLines[index]);
      index += 1;
    }
    blocks.push({
      type: TOPIC_RICH_BLOCK_TYPES.PARAGRAPH,
      lines: paragraphLines,
    });
  }

  return blocks.length ? blocks : [{ type: TOPIC_RICH_BLOCK_TYPES.PARAGRAPH, lines: ['Untitled'] }];
}

/*
 * 将富文本源码按最大宽度换行，返回分段后的样式片段行数组。
 * 每行是一组 style segment，供 SVG 渲染时逐个生成 <tspan>。
 */
export function wrapTopicRichTextByWidth(source, maxWidth, font) {
  const hardLines = normalizeRichHardLines(parseTopicRichText(source));
  if (!hardLines.length) return [[{ text: 'Untitled' }]];

  return hardLines.flatMap((line) => wrapRichLineByWidth(line, maxWidth, font));
}

/*
 * 将主题内容解析为块级格式并逐块按最大宽度换行，返回布局和渲染所需的结构化数据。
 *
 * 返回值包含：
 * - blocks: 所有格式化块（含装饰块）的布局数据
 * - adornments/adornmentCount: 装饰块（备注/附件）列表，供渲染器生成按钮列
 * - lines/richLines: 纯文本行和样式片段行的扁平数组，供旧版渲染回退
 * - width/height: 所有可见块的总宽高
 *
 * 装饰块单独统计不参与正文高度，但布局阶段需要提前预留右侧按钮列宽度；
 * 因此先按原始可用宽度统计装饰按钮数量，扣除其宽度后再重新换行正文内容。
 */
export function wrapTopicRichBlocksByWidth(source, maxWidth, font, options = {}) {
  const blockGap = Math.max(
    TOPIC_RICH_BLOCK_MIN_GAP,
    Math.round((Number(font?.lineHeight) || Number(font?.size) || 16) * TOPIC_RICH_BLOCK_GAP_RATIO)
  );
  const blocks = parseTopicRichBlocks(source).map((block, blockIndex) =>
    wrapTopicRichBlock(block, maxWidth, font, blockIndex === 0 ? 0 : blockGap, options)
  );
  const visibleBlocks = blocks.filter((block) => !isTopicAdornmentBlock(block) && block.height > 0);
  const adornmentBlocks = blocks.filter(isTopicAdornmentBlock);
  const lines = [];
  const richLines = [];
  let width = 0;
  let height = 0;

  for (const block of visibleBlocks) {
    width = Math.max(width, block.width);
    height += block.gapBefore + block.height;
    for (const line of flattenTopicRichBlockLines(block)) {
      lines.push(richLineToPlainText(line));
      richLines.push(line);
    }
  }

  if (!visibleBlocks.length) {
    const fallbackContent = wrapTopicRichBlocksByWidth('Untitled', maxWidth, font, options);
    return {
      ...fallbackContent,
      blocks: [...fallbackContent.blocks, ...adornmentBlocks],
      adornments: adornmentBlocks,
      adornmentCount: adornmentBlocks.length,
    };
  }

  return {
    blocks,
    adornments: adornmentBlocks,
    adornmentCount: adornmentBlocks.length,
    lines,
    richLines,
    width,
    height,
  };
}

export function richLineToPlainText(line) {
  return joinSegmentsText(line);
}

export function topicRichTextLinkMarker(linkKind) {
  return LINK_MARKERS[String(linkKind || '').toLowerCase()] || LINK_MARKERS.external;
}

/*
 * 计算主题内容中图片块的首选宽度（用于主题宽度估算）。
 * 只计入定宽图片（像素宽或宽高），百分比图片和缺失图片不计入。
 * 如果主题中所有图片的显式宽度都小于默认可用文本宽度，返回 0。
 */
export function topicRichTextPreferredContentWidth(source) {
  return parseTopicRichBlocks(source).reduce((width, block) => {
    if (block.type !== TOPIC_RICH_BLOCK_TYPES.IMAGE) return width;
    if (block.sizeMode === 'percent') return width;
    return Math.max(width, Number(block.width) || 0);
  }, 0);
}

function isTopicAdornmentBlock(block) {
  return (
    block?.type === TOPIC_RICH_BLOCK_TYPES.NOTE || block?.type === TOPIC_RICH_BLOCK_TYPES.ATTACHMENT
  );
}

/*
 * 估算一行富文本样式片段的显示宽度。
 * 每段样式独立测量宽度并累加；链接段额外计入前置标识符（↗/◇）的宽度。
 * 加粗段使用更大的字重估算宽度，因为加粗字形通常略宽。
 */
export function estimateRichLineWidth(line, font = {}) {
  return line.reduce((sum, segment) => {
    const segmentFont = segment.bold
      ? { ...font, weight: Math.max(Number(font?.weight) || 400, 700) }
      : font;
    const markerWidth =
      segment.link && segment.linkMarker !== false
        ? estimateTopicTextWidth(`${topicRichTextLinkMarker(segment.linkKind)} `, segmentFont)
        : 0;
    return sum + markerWidth + estimateTopicTextWidth(segment.text, segmentFont);
  }, 0);
}

function parseRichTextRange(source, baseStyle) {
  const ranges = collectInlineStyleRanges(source);
  const isRemovedIndex = createInlineStyleRemovalCursor(ranges.removals);
  const segments = [];
  let buffer = '';
  let bufferStyle = null;

  const flush = () => {
    if (!buffer) return;
    segments.push(createRichSegment(buffer, bufferStyle || baseStyle));
    buffer = '';
    bufferStyle = null;
  };

  for (let index = 0; index < source.length; index += 1) {
    if (isRemovedIndex(index)) continue;

    const style = inlineStyleAtIndex(ranges.styles, index, baseStyle);
    if (!bufferStyle || !hasSameStyle(bufferStyle, style)) {
      flush();
      bufferStyle = style;
    }
    buffer += source[index];
  }

  flush();
  return segments;
}

/*
 * 作用：
 * 收集行内样式区间，并记录需要从显示文本里移除的标记区间。
 *
 * 说明：
 * 主题内容不是完整 Markdown 解析器，但这里允许样式区间交叉叠加：
 * `**加粗~~加粗删除**删除~~` 会分别应用加粗和删除线，而不是把 `~~` 当普通文字。
 * 未闭合或非法颜色标记不进入 removals，因此会按用户输入原样显示。
 */
function collectInlineStyleRanges(source) {
  const styles = [];
  const removals = [];
  const openStyleMarkers = new Map();
  let index = 0;

  while (index < source.length) {
    const colorMatch = source.slice(index).match(COLOR_MARKER_PATTERN);
    if (colorMatch) {
      const color = normalizeInlineTopicColor(colorMatch[1]);
      const start = index;
      const contentStart = start + colorMatch[0].length;
      const contentEnd = findClosingBrace(source, contentStart);
      if (color && contentEnd !== -1) {
        styles.push({
          start: contentStart,
          end: contentEnd,
          style: { color },
        });
        removals.push([start, contentStart], [contentEnd, contentEnd + 1]);
        index = contentStart;
        continue;
      }
    }

    const markdownLink = source.slice(index).match(MARKDOWN_LINK_PATTERN);
    if (markdownLink) {
      const labelStart = index + 1;
      const labelEnd = labelStart + markdownLink[1].length;
      const markerEnd = index + markdownLink[0].length;
      styles.push({
        start: labelStart,
        end: labelEnd,
        style: { link: true, href: markdownLink[2], linkKind: 'external' },
      });
      removals.push([index, labelStart], [labelEnd, markerEnd]);
      index = labelStart;
      continue;
    }

    const obsidianLink = source.slice(index).match(OBSIDIAN_LINK_PATTERN);
    if (obsidianLink) {
      const link = parseObsidianLinkText(obsidianLink[1]);
      const contentStart = index + 2;
      const visibleStart = contentStart + link.visibleOffset;
      const visibleEnd = visibleStart + link.label.length;
      const markerEnd = index + obsidianLink[0].length;
      styles.push({
        start: visibleStart,
        end: visibleEnd,
        style: { link: true, href: link.target, linkKind: 'obsidian' },
      });
      removals.push([index, visibleStart], [visibleEnd, markerEnd]);
      index = visibleStart;
      continue;
    }

    const tagMatch = source.slice(index).match(TAG_PATTERN);
    if (tagMatch && isTagBoundaryBefore(source, index)) {
      const markerEnd = index + tagMatch[0].length;
      styles.push({
        start: index,
        end: markerEnd,
        style: { tag: true, tagName: tagMatch[0].toLowerCase() },
      });
      index = markerEnd;
      continue;
    }

    const styleMarker = STYLE_MARKERS.find(({ marker }) => source.startsWith(marker, index));
    if (styleMarker) {
      const openings = openStyleMarkers.get(styleMarker.marker) || [];
      const markerEnd = index + styleMarker.marker.length;
      if (openings.length) {
        const opening = openings.pop();
        styles.push({
          start: opening.end,
          end: index,
          style: { [styleMarker.key]: true },
        });
        removals.push([opening.start, opening.end], [index, markerEnd]);
      } else {
        openings.push({ start: index, end: markerEnd });
        openStyleMarkers.set(styleMarker.marker, openings);
      }
      index = markerEnd;
      continue;
    }

    index += 1;
  }

  return { styles, removals };
}

/*
 * 解析阶段会按字符顺序扫描 source。这里先把样式标记区间排序并合并，
 * 再用游标判断当前位置是否应从显示文本中移除，避免长文本中每个字符都重复遍历 removals。
 */
function createInlineStyleRemovalCursor(removals) {
  const ranges = mergeRemovalRanges(removals);
  let rangeIndex = 0;

  return (index) => {
    while (rangeIndex < ranges.length && index >= ranges[rangeIndex][1]) {
      rangeIndex += 1;
    }
    const range = ranges[rangeIndex];
    return Boolean(range && index >= range[0] && index < range[1]);
  };
}

function mergeRemovalRanges(removals) {
  const sorted = removals
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const merged = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range[0] <= previous[1]) {
      previous[1] = Math.max(previous[1], range[1]);
    } else {
      merged.push([...range]);
    }
  }

  return merged;
}

function inlineStyleAtIndex(styleRanges, index, baseStyle) {
  const style = { ...baseStyle };
  for (const range of styleRanges) {
    if (index >= range.start && index < range.end) {
      Object.assign(style, range.style);
    }
  }
  return style;
}

function parseObsidianLinkText(linkText) {
  const text = String(linkText || '');
  const pipeIndex = text.lastIndexOf('|');
  if (pipeIndex === -1) {
    return { target: text.trim(), label: text.trim(), visibleOffset: 0 };
  }

  const target = text.slice(0, pipeIndex).trim();
  const alias = text.slice(pipeIndex + 1);
  const label = alias.trim();
  if (!label) {
    return { target, label: target, visibleOffset: 0 };
  }

  return {
    target,
    label,
    visibleOffset: pipeIndex + 1 + alias.search(/\S|$/),
  };
}

function isTagBoundaryBefore(source, index) {
  if (index <= 0) return true;
  return /[\s([{，。；：、,.!?;:]/.test(source[index - 1]);
}

function wrapTopicRichBlock(block, maxWidth, font, gapBefore, options = {}) {
  if (block.type === TOPIC_RICH_BLOCK_TYPES.LIST) {
    return wrapTopicListBlock(block, maxWidth, font, gapBefore);
  }
  if (block.type === TOPIC_RICH_BLOCK_TYPES.IMAGE) {
    return wrapTopicImageBlock(block, maxWidth, font, gapBefore, options);
  }
  if (block.type === TOPIC_RICH_BLOCK_TYPES.NOTE) {
    return wrapTopicNoteBlock(block, gapBefore);
  }
  if (block.type === TOPIC_RICH_BLOCK_TYPES.ATTACHMENT) {
    return wrapTopicAttachmentBlock(block, gapBefore);
  }
  if (block.type === TOPIC_RICH_BLOCK_TYPES.CODE) {
    return wrapTopicCodeBlock(block, maxWidth, font, gapBefore);
  }
  if (block.type === TOPIC_RICH_BLOCK_TYPES.EQUATION) {
    return wrapTopicEquationBlock(block, maxWidth, font, gapBefore);
  }
  return wrapTopicParagraphBlock(block, maxWidth, font, gapBefore);
}

function wrapTopicParagraphBlock(block, maxWidth, font, gapBefore) {
  /*
   * 段落必须先整体解析再按硬换行拆回行。
   * 否则 **第一行\n第二行** 或 ~~多行内容~~ 会在逐行解析时被误判为未闭合标记。
   */
  const hardLines = normalizeRichHardLines(parseTopicRichText(block.lines.join('\n')));
  const richLines = hardLines
    .flatMap((line) => wrapRichLineByWidth(line, maxWidth, font))
    .filter((line) => joinSegmentsText(line));
  const lines = richLines.length ? richLines : [[{ text: 'Untitled' }]];
  const lineHeight = Number(font?.lineHeight) || Number(font?.size) * 1.3 || 20;
  return {
    type: TOPIC_RICH_BLOCK_TYPES.PARAGRAPH,
    gapBefore,
    lines,
    width: estimateRichLinesMaxWidth(lines, font),
    height: lines.length * lineHeight,
  };
}

function wrapTopicNoteBlock(block, gapBefore) {
  const text = String(block.lines?.join('\n') || '').trim() || 'Note';
  return {
    type: TOPIC_RICH_BLOCK_TYPES.NOTE,
    gapBefore,
    text,
    width: 0,
    height: 0,
  };
}

function wrapTopicAttachmentBlock(block, gapBefore) {
  return {
    ...block,
    type: TOPIC_RICH_BLOCK_TYPES.ATTACHMENT,
    gapBefore,
    title: block.label || block.source || 'Attachment',
    text: block.source || '',
    width: 0,
    height: 0,
  };
}

function wrapTopicImageBlock(block, maxWidth, font, gapBefore, options = {}) {
  const isImageResolved =
    typeof options.isImageResolved === 'function' ? options.isImageResolved(block) : true;
  const naturalSize =
    typeof options.resolveImageSize === 'function' ? options.resolveImageSize(block) : null;
  const naturalAspectRatio =
    Number(naturalSize?.width) > 0 && Number(naturalSize?.height) > 0
      ? Number(naturalSize.height) / Number(naturalSize.width)
      : 0;
  const hasRequestedWidth =
    (block.sizeMode === 'percent' && Number(block.scale) > 0) || Number(block.width) > 0;
  const requestedWidth =
    block.sizeMode === 'percent' && Number(block.scale) > 0
      ? Math.round(maxWidth * Number(block.scale))
      : Number(block.width) || 0;
  const fallbackWidth = Math.min(
    IMAGE_BLOCK_DEFAULT_WIDTH,
    Math.max(IMAGE_BLOCK_MIN_WIDTH, maxWidth)
  );
  const imageWidth = isImageResolved
    ? Math.round(
        Math.min(
          hasRequestedWidth ? maxWidth : IMAGE_BLOCK_MAX_WIDTH,
          Math.max(IMAGE_BLOCK_MIN_WIDTH, requestedWidth || fallbackWidth)
        )
      )
    : Math.min(MISSING_IMAGE_BLOCK_WIDTH, maxWidth);
  const requestedHeight = Number(block.height) || 0;
  const scaledRequestedHeight =
    requestedHeight && requestedWidth
      ? Math.round(requestedHeight * (imageWidth / requestedWidth))
      : 0;
  const imageHeight = isImageResolved
    ? Math.round(
        (naturalAspectRatio ? imageWidth * naturalAspectRatio : 0) ||
          scaledRequestedHeight ||
          Math.max(
            60,
            Math.min(IMAGE_BLOCK_MAX_WIDTH, imageWidth * IMAGE_BLOCK_DEFAULT_ASPECT_RATIO)
          )
      )
    : MISSING_IMAGE_BLOCK_HEIGHT;
  const captionLines = block.alt
    ? wrapRichLineByWidth(parseTopicRichText(block.alt), imageWidth, font)
    : [];
  const captionLineHeight = captionLines.length
    ? Number(font?.lineHeight) || Number(font?.size) * 1.3 || 20
    : 0;
  return {
    ...block,
    type: TOPIC_RICH_BLOCK_TYPES.IMAGE,
    gapBefore,
    imageMissing: !isImageResolved,
    imageWidth,
    imageHeight,
    captionLines,
    width: imageWidth,
    height:
      imageHeight +
      (captionLines.length ? IMAGE_BLOCK_CAPTION_GAP + captionLines.length * captionLineHeight : 0),
  };
}

/*
 * 计算列表块每个列表项的布局：编号/符号宽度、缩进偏移、文本换行后的宽高。
 * 有序列表编号按层级自动递增。
 */
function wrapTopicListBlock(block, maxWidth, font, gapBefore) {
  const lineHeight = resolveTopicListLineHeight(font);
  const orderedCounters = [];
  const levelKinds = [];
  const items = block.items.map((item) => {
    const markerText = topicListMarkerText(item, orderedCounters, levelKinds);
    const markerWidth = item.task
      ? Math.max(LIST_MIN_MARKER_WIDTH, Math.round((Number(font?.size) || 16) * 1.05))
      : Math.max(LIST_MIN_MARKER_WIDTH, Math.ceil(estimateTopicTextWidth(markerText, font)));
    const markerXOffset = item.level * LIST_LEVEL_INDENT;
    const textXOffset = markerXOffset + markerWidth + LIST_MARKER_GAP;
    const lineMaxWidth = Math.max(24, maxWidth - textXOffset);
    const lines = wrapRichLineByWidth(
      normalizeRichLineWhitespace(parseTopicRichText(item.text || 'List item')),
      lineMaxWidth,
      font
    );
    const contentWidth = estimateRichLinesMaxWidth(lines, font);
    return {
      ...item,
      markerText,
      markerWidth,
      markerXOffset,
      textXOffset,
      lines,
      width: textXOffset + contentWidth,
      height: lines.length * lineHeight,
    };
  });

  return {
    type: TOPIC_RICH_BLOCK_TYPES.LIST,
    gapBefore,
    items,
    lineHeight,
    width: items.reduce((max, item) => Math.max(max, item.width), 0),
    height: items.reduce((sum, item) => sum + item.height, 0),
  };
}

function resolveTopicListLineHeight(font = {}) {
  const fontSize = Number(font.size) || 16;
  const configuredLineHeight = Number(font.lineHeight) || fontSize * 1.3;
  // 列表项前有编号/项目符号，视觉上比普通文本更容易挤，给它保留独立的最小行距。
  return Math.max(configuredLineHeight, Math.round(fontSize * LIST_LINE_HEIGHT_RATIO));
}

function topicListMarkerText(item, orderedCounters, levelKinds) {
  const level = Number(item.level) || 0;
  orderedCounters.length = Math.min(orderedCounters.length, level + 1);
  levelKinds.length = Math.min(levelKinds.length, level + 1);

  if (!item.ordered) {
    levelKinds[level] = 'unordered';
    return UNORDERED_LIST_MARKERS[level % UNORDERED_LIST_MARKERS.length];
  }

  const sourceNumber = Math.max(1, Number.parseInt(item.number, 10) || 1);
  /*
   * 有序列表展示时按层级自动递增，不信任用户输入的连续编号。
   * 这样编辑器按钮插入的多行 "1." 也能显示成 1/2/3。
   */
  if (levelKinds[level] === 'ordered' && Number.isFinite(orderedCounters[level])) {
    orderedCounters[level] += 1;
  } else {
    orderedCounters[level] = sourceNumber;
  }
  levelKinds[level] = 'ordered';
  return `${orderedCounters[level]}.`;
}

/*
 * 计算代码块的布局：使用等宽字体、设置独立的背景宽度和高度。
 * 代码块宽度在主题宽度和 CODE_BLOCK_MAX_WIDTH 之间取较大值，确保宽代码不被截断。
 */
function wrapTopicCodeBlock(block, maxWidth, font, gapBefore) {
  const codeFont = resolveTopicCodeFont(font);
  const codeBlockWidth = Math.min(
    Math.max(maxWidth, CODE_BLOCK_COMFORT_WIDTH),
    CODE_BLOCK_MAX_WIDTH
  );
  const innerWidth = Math.max(24, codeBlockWidth - CODE_BLOCK_PADDING_X * 2);
  const rawLines = block.lines.length ? block.lines : [''];
  const lines = rawLines.flatMap((line) =>
    wrapPlainPreservedLineByWidth(line, innerWidth, codeFont)
  );
  const safeLines = lines.length ? lines : [[{ text: ' ' }]];
  const contentWidth = estimateCodeRichLinesMaxWidth(safeLines, codeFont);
  return {
    type: TOPIC_RICH_BLOCK_TYPES.CODE,
    gapBefore,
    language: block.language || '',
    lines: safeLines,
    font: codeFont,
    width: Math.max(CODE_BLOCK_MIN_WIDTH, contentWidth + CODE_BLOCK_PADDING_X * 2),
    height: safeLines.length * codeFont.lineHeight + CODE_BLOCK_PADDING_Y * 2,
  };
}

/*
 * 计算公式块的布局：增大字号和字重，按 MathJax 结构预留高度。
 * 渲染阶段由异步 MathJax 完成，布局阶段只能做最佳估算。
 */
function wrapTopicEquationBlock(block, maxWidth, font, gapBefore) {
  const equationFont = {
    ...font,
    size: Math.max(10, Math.round((Number(font?.size) || 16) * EQUATION_FONT_SIZE_RATIO)),
    weight: Math.max(Number(font?.weight) || 400, 500),
  };
  const sourceLines = String(block.source || '').split('\n');
  const richLines = sourceLines.flatMap((line) =>
    wrapRichLineByWidth([{ text: line.trim() || ' ' }], maxWidth, equationFont)
  );
  const lines = richLines.length ? richLines : [[{ text: '$$' }]];
  const lineHeight = Number(font?.lineHeight) || Number(font?.size) * 1.3 || 20;
  const equationHeight = estimateTopicEquationHeight(block.source || '', lines.length, {
    ...equationFont,
    lineHeight,
  });
  return {
    type: TOPIC_RICH_BLOCK_TYPES.EQUATION,
    gapBefore,
    source: block.source || '',
    lines,
    font: equationFont,
    width: estimateRichLinesMaxWidth(lines, equationFont),
    height: equationHeight,
  };
}

function estimateTopicEquationHeight(source, lineCount, font) {
  const text = String(source || '');
  const fontSize = Number(font.size) || 16;
  const lineHeight = Number(font.lineHeight) || fontSize * 1.3;
  let ratio = EQUATION_SIMPLE_HEIGHT_RATIO;
  /*
   * MathJax 是异步渲染，布局阶段拿不到真实公式盒子高度。
   * 这里按 LaTeX 结构预留高度，渲染失败时也能用源码 fallback 保持主题不塌陷。
   */
  if (/\\(?:sqrt|sum|prod|int|lim|begin)\b|_\{|\^\{/.test(text)) {
    ratio = EQUATION_TALL_HEIGHT_RATIO;
  }
  if (/\\(?:frac|dfrac|tfrac|over|begin)\b/.test(text)) {
    ratio = EQUATION_EXTRA_TALL_HEIGHT_RATIO;
  }
  return Math.max(lineCount * lineHeight, Math.round(fontSize * ratio));
}

function flattenTopicRichBlockLines(block) {
  if (block.type === TOPIC_RICH_BLOCK_TYPES.LIST) {
    return block.items.flatMap((item) => item.lines);
  }
  if (block.type === TOPIC_RICH_BLOCK_TYPES.IMAGE) {
    return block.captionLines?.length
      ? block.captionLines
      : [[{ text: block.alt || block.source || 'Image' }]];
  }
  return block.lines || [];
}

function estimateRichLinesMaxWidth(lines, font) {
  return Math.ceil(
    lines.reduce((max, line) => Math.max(max, estimateRichLineWidth(line, font)), 0)
  );
}

function estimateCodeRichLinesMaxWidth(lines, font) {
  return Math.ceil(
    lines.reduce((max, line) => Math.max(max, estimateCodeRichLineWidth(line, font)), 0)
  );
}

function estimateCodeRichLineWidth(line, font = {}) {
  return line.reduce((sum, segment) => sum + estimateTopicCodeTextWidth(segment.text, font), 0);
}

function estimateTopicCodeTextWidth(text, font = {}) {
  const fontSize = Number(font.size) || 13;
  let width = 0;
  for (const char of Array.from(String(text))) {
    width += CJK_OR_FULLWIDTH_RE.test(char) ? fontSize : fontSize * CODE_MONOSPACE_CHAR_WIDTH_RATIO;
  }
  return width;
}

function wrapPlainPreservedLineByWidth(line, maxWidth, font) {
  const source = String(line || '').replace(/\t/g, '  ');
  if (!source) return [[{ text: ' ' }]];

  const lines = [];
  let current = [];
  let width = 0;
  for (const char of Array.from(source)) {
    const charWidth = estimateTopicCodeTextWidth(char, font);
    if (current.length && width + charWidth > maxWidth) {
      lines.push(current);
      current = [];
      width = 0;
    }
    current.push({ text: char });
    width += charWidth;
  }
  if (current.length) lines.push(current);
  return lines.map(mergeAdjacentRichSegments);
}

function resolveTopicCodeFont(font = {}) {
  const fontSize = Math.max(10, Math.round((Number(font.size) || 16) * CODE_FONT_SIZE_RATIO));
  return {
    family: TOPIC_RICH_TEXT_CODE_FONT_FAMILY,
    size: fontSize,
    weight: 400,
    lineHeight: Math.max(14, Math.round(fontSize * CODE_LINE_HEIGHT_RATIO)),
  };
}

function isTopicListLine(line) {
  return (
    TASK_LIST_PATTERN.test(line) ||
    UNORDERED_LIST_PATTERN.test(line) ||
    ORDERED_LIST_PATTERN.test(line)
  );
}

function isTopicStandaloneBlockLine(line) {
  const trimmed = String(line || '').trim();
  return (
    CODE_FENCE_PATTERN.test(trimmed) ||
    EQUATION_FENCE_PATTERN.test(trimmed) ||
    isTopicListLine(line) ||
    NOTE_LINE_PATTERN.test(line) ||
    Boolean(parseTopicImageBlock(trimmed)) ||
    Boolean(parseTopicAttachmentBlock(trimmed))
  );
}

function parseTopicListItem(line) {
  const task = line.match(TASK_LIST_PATTERN);
  if (task) {
    return {
      ordered: false,
      task: true,
      checked: task[2].toLowerCase() === 'x',
      number: '',
      level: listIndentLevel(task[1]),
      text: task[3],
    };
  }

  const ordered = line.match(ORDERED_LIST_PATTERN);
  if (ordered) {
    return {
      ordered: true,
      number: ordered[2],
      level: listIndentLevel(ordered[1]),
      text: ordered[3],
    };
  }

  const unordered = line.match(UNORDERED_LIST_PATTERN);
  return {
    ordered: false,
    number: '',
    level: listIndentLevel(unordered?.[1] || ''),
    text: unordered?.[2] || '',
  };
}

function parseTopicImageBlock(line) {
  const markdown = line.match(MARKDOWN_IMAGE_PATTERN);
  if (markdown) {
    const target = parseTopicImageTarget(markdown[2]);
    return {
      type: TOPIC_RICH_BLOCK_TYPES.IMAGE,
      alt: markdown[1] || target.caption || 'Image',
      source: target.source,
      width: target.width,
      height: target.height,
      sizeMode: target.sizeMode,
      scale: target.scale,
      obsidian: false,
    };
  }

  const obsidian = line.match(OBSIDIAN_IMAGE_PATTERN);
  if (!obsidian) return null;

  const target = parseTopicImageTarget(obsidian[1]);
  return {
    type: TOPIC_RICH_BLOCK_TYPES.IMAGE,
    alt: target.caption || target.source || 'Image',
    source: target.source,
    width: target.width,
    height: target.height,
    sizeMode: target.sizeMode,
    scale: target.scale,
    obsidian: true,
  };
}

function parseTopicAttachmentBlock(line) {
  const markdown = line.match(MARKDOWN_ATTACHMENT_PATTERN);
  if (markdown) {
    const target = parseTopicAttachmentTarget(markdown[2]);
    return {
      type: TOPIC_RICH_BLOCK_TYPES.ATTACHMENT,
      label: markdown[1] || target.source || 'Attachment',
      source: target.source,
      obsidian: false,
    };
  }

  const obsidian = line.match(OBSIDIAN_ATTACHMENT_PATTERN);
  if (!obsidian) return null;

  const target = parseTopicAttachmentTarget(obsidian[1]);
  return {
    type: TOPIC_RICH_BLOCK_TYPES.ATTACHMENT,
    label: target.caption || target.source || 'Attachment',
    source: target.source,
    obsidian: true,
  };
}

function parseTopicAttachmentTarget(rawTarget) {
  const [source = '', ...captionParts] = String(rawTarget || '')
    .split('|')
    .map((part) => part.trim());
  return {
    source,
    caption: captionParts.find(Boolean) || '',
  };
}

function parseTopicImageTarget(rawTarget) {
  const parts = String(rawTarget || '')
    .split('|')
    .map((part) => part.trim());
  const source = parts[0] || '';
  const size = parts.find((part, index) => index > 0 && /^\d+(?:x\d+)?$/i.test(part));
  const percent = parts.find((part, index) => index > 0 && IMAGE_SIZE_PERCENT_PATTERN.test(part));
  const original = parts.find(
    (part, index) => index > 0 && part.toLowerCase() === IMAGE_SIZE_ORIGINAL
  );
  const [width, height] = size ? size.toLowerCase().split('x').map(Number) : [];
  const caption =
    parts.find((part, index) => index > 0 && ![size, percent, original].includes(part)) || '';
  const scale = percent ? Number(percent.match(IMAGE_SIZE_PERCENT_PATTERN)?.[1]) / 100 : 0;

  return {
    source,
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
    sizeMode: original ? IMAGE_SIZE_ORIGINAL : percent ? 'percent' : '',
    scale: Number.isFinite(scale) ? scale : 0,
    caption,
  };
}

function listIndentLevel(indent) {
  const units = Array.from(String(indent || '')).reduce(
    (sum, char) => sum + (char === '\t' ? INDENT_TAB_WIDTH : 1),
    0
  );
  return Math.max(0, Math.floor(units / INDENT_TAB_WIDTH));
}

function findClosingBrace(source, startIndex) {
  let depth = 0;
  for (let index = startIndex; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') depth += 1;
    if (char === '}') {
      if (depth === 0) return index;
      depth -= 1;
    }
  }
  return -1;
}

/*
 * 将富文本按硬换行（\n）拆分成独立行，
 * 每行分别做空白规范化（合并空格、去掉首尾空白）。
 */
function normalizeRichHardLines(segments) {
  const lines = [[]];

  for (const segment of segments) {
    const parts = String(segment.text || '')
      .replace(/\r\n/g, '\n')
      .split('\n');
    for (let index = 0; index < parts.length; index += 1) {
      if (parts[index]) lines[lines.length - 1].push({ ...segment, text: parts[index] });
      if (index < parts.length - 1) lines.push([]);
    }
  }

  return lines.map(normalizeRichLineWhitespace).filter((line) => joinSegmentsText(line));
}

/*
 * 规范化一行富文本中的空白：连续空白合并为单个空格，
 * 去掉行首空格和行尾空格，保留中间样式。
 */
function normalizeRichLineWhitespace(line) {
  const chars = [];
  let pendingSpace = false;
  let pendingStyle = null;

  for (const segment of line) {
    for (const char of Array.from(segment.text || '')) {
      if (/[^\S\r\n]/.test(char)) {
        pendingSpace = chars.length > 0;
        pendingStyle = segment;
        continue;
      }

      if (pendingSpace) {
        chars.push(createRichSegment(' ', pendingStyle || segment));
      }
      pendingSpace = false;
      chars.push(createRichSegment(char, segment));
    }
  }

  while (chars.length && chars[chars.length - 1].text === ' ') chars.pop();
  return mergeAdjacentRichSegments(chars);
}

/*
 * 将一行富文本按最大宽度换行。根据文本类型选择换行策略：
 * - 英文/空格分隔的文本按单词换行
 * - 中日韩/全角文本按字符换行
 * 换行时保留每个字符的样式属性。
 */
function wrapRichLineByWidth(line, maxWidth, font) {
  if (!joinSegmentsText(line)) return [];

  const wrapByWords = shouldWrapByWords(joinSegmentsText(line));
  const tokens = wrapByWords
    ? splitRichLineByWords(line)
    : splitRichLineIntoChars(line).map((segment) => [segment]);
  const lines = [];
  let current = [];

  for (const token of tokens) {
    const separator = wrapByWords && current.length ? [createRichSegment(' ', token[0] || {})] : [];
    const next = mergeAdjacentRichSegments([...current, ...separator, ...token]);
    if (current.length && estimateRichLineWidth(next, font) > maxWidth) {
      pushRichLine(lines, current);
      current = token;
    } else {
      current = next;
    }

    while (estimateRichLineWidth(current, font) > maxWidth) {
      const split = splitRichLineByEstimatedWidth(current, maxWidth, font);
      pushRichLine(lines, split.head);
      current = split.tail;
    }
  }

  pushRichLine(lines, current);
  return lines;
}

/*
 * 按空格将一行富文本拆分为单词 token（用于英文按词换行）。
 */
function splitRichLineByWords(line) {
  const tokens = [];
  let current = [];

  for (const charSegment of splitRichLineIntoChars(line)) {
    if (charSegment.text === ' ') {
      if (current.length) {
        tokens.push(current);
        current = [];
      }
      continue;
    }

    current.push(charSegment);
  }

  if (current.length) tokens.push(current);
  return tokens;
}

/*
 * 将一行富文本拆分为单个字符的片段，每个保留原始样式。
 */
function splitRichLineIntoChars(line) {
  return line.flatMap((segment) =>
    Array.from(segment.text || '').map((char, index) =>
      createRichSegment(char, {
        ...segment,
        linkMarker: !segment.link || (index === 0 && segment.linkMarker !== false),
      })
    )
  );
}

/*
 * 按像素宽度估算将一行富文本拆分为 head 和 tail。
 * 从第一个超出最大宽度的字符处截断，确保 head 至少有一个字符。
 */
function splitRichLineByEstimatedWidth(line, maxWidth, font) {
  let width = 0;
  let head = [];
  const tail = [];
  let hasSplit = false;

  for (const segment of splitRichLineIntoChars(line)) {
    const segmentWidth = estimateRichLineWidth([segment], font);
    if (!hasSplit && head.length && width + segmentWidth > maxWidth) {
      hasSplit = true;
    }

    if (hasSplit) {
      tail.push(segment);
    } else {
      head.push(segment);
      width += segmentWidth;
    }
  }

  if (!head.length && tail.length) {
    head = [tail.shift()];
  }

  return {
    head: mergeAdjacentRichSegments(head),
    tail: trimRichLineStart(mergeAdjacentRichSegments(tail)),
  };
}

function pushRichLine(lines, line) {
  const trimmed = trimRichLineEnd(line);
  if (joinSegmentsText(trimmed)) lines.push(trimmed);
}

function trimRichLineStart(line) {
  const next = [...line];
  while (next.length && next[0].text === ' ') next.shift();
  return next;
}

function trimRichLineEnd(line) {
  const next = [...line];
  while (next.length && next[next.length - 1].text === ' ') next.pop();
  return next;
}

function shouldWrapByWords(text) {
  return text.includes(' ') && !CJK_OR_FULLWIDTH_RE.test(text);
}

function joinSegmentsText(segments) {
  return segments.map((segment) => segment.text).join('');
}

/*
 * 创建一个富文本样式片段。只复制有效的样式属性，
 * 确保 undefined/false 值不会被污染到片段上。
 */
function createRichSegment(text, style = {}) {
  const segment = { text };
  if (style.bold) segment.bold = true;
  if (style.italic) segment.italic = true;
  if (style.strike) segment.strike = true;
  if (style.underline) segment.underline = true;
  if (style.color) segment.color = style.color;
  if (style.tag) {
    segment.tag = true;
    segment.tagName = String(style.tagName || text || '').toLowerCase();
  }
  if (style.link) {
    segment.link = true;
    segment.href = String(style.href || '');
    segment.linkKind = String(style.linkKind || 'external');
    if (style.linkMarker === false) segment.linkMarker = false;
  }
  return segment;
}

/*
 * 合并相邻的相同样式片段，减少片段数量（如 "**ab**" → [{bold: true, text: 'ab'}]）。
 */
function mergeAdjacentRichSegments(segments) {
  const merged = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    const previous = merged[merged.length - 1];
    if (previous && hasSameStyle(previous, segment)) {
      previous.text += segment.text;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

/*
 * 判断两个样式片段是否有完全相同的样式属性。
 */
function hasSameStyle(left, right) {
  return (
    Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.strike) === Boolean(right.strike) &&
    Boolean(left.underline) === Boolean(right.underline) &&
    String(left.color || '') === String(right.color || '') &&
    Boolean(left.tag) === Boolean(right.tag) &&
    String(left.tagName || '') === String(right.tagName || '') &&
    Boolean(left.link) === Boolean(right.link) &&
    String(left.href || '') === String(right.href || '') &&
    String(left.linkKind || '') === String(right.linkKind || '') &&
    Boolean(left.linkMarker !== false) === Boolean(right.linkMarker !== false)
  );
}

/*
 * 将十六进制颜色标准化为 6 位小写格式，
 * 处理 #abc → #aabbcc 的简写形式。
 */
function normalizeHexColor(color) {
  const hex = color.toLowerCase();
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}
