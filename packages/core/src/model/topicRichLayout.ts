/*
 * 文件作用：
 * 兼容导出公共核心的主题内容语义，并提供插件布局测量和 SVG 渲染可复用的片段数据。
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

import {
  INLINE_TOPIC_COLOR_OPTIONS as CORE_INLINE_TOPIC_COLOR_OPTIONS,
  INLINE_TOPIC_COLOR_VALUES as CORE_INLINE_TOPIC_COLOR_VALUES,
  TOPIC_RICH_BLOCK_TYPES as CORE_TOPIC_RICH_BLOCK_TYPES,
  normalizeInlineTopicColor as normalizeCoreInlineTopicColor,
  parseTopicRichBlocks as parseCoreTopicRichBlocks,
  parseTopicRichText as parseCoreTopicRichText,
  topicRichTextLinkMarker as coreTopicRichTextLinkMarker,
  topicRichTextPreferredContentWidth as coreTopicRichTextPreferredContentWidth,
  topicRichTextToPlainText as coreTopicRichTextToPlainText,
} from './topicContent.js';
import type {
  TopicAttachmentBlock,
  TopicCodeBlock,
  TopicEquationBlock,
  TopicImageBlock,
  TopicListBlock,
  TopicListItem,
  TopicNoteBlock,
  TopicParagraphBlock,
  TopicRichBlock,
  TopicRichTextSegment,
  TopicRichTextStyle,
} from './topicContent.js';
import { CJK_OR_FULLWIDTH_RE, estimateTopicTextWidth, shouldWrapByWords } from './topicText.js';
import type { TopicFont } from './topicText.js';

export type TopicRichLine = TopicRichTextSegment[];

export interface TopicImageNaturalSize {
  width: number;
  height: number;
}

export interface TopicRichLayoutOptions {
  isImageResolved?: (block: TopicImageBlock) => boolean;
  resolveImageSize?: (block: TopicImageBlock) => TopicImageNaturalSize | null | undefined;
}

interface ResolvedTopicFont extends TopicFont {
  size: number;
  weight: number;
  lineHeight: number;
}

interface WrappedTopicRichBlockBase {
  gapBefore: number;
  width: number;
  height: number;
}

export interface WrappedTopicParagraphBlock extends WrappedTopicRichBlockBase {
  type: 'paragraph';
  lines: TopicRichLine[];
}

export interface WrappedTopicNoteBlock extends WrappedTopicRichBlockBase {
  type: 'note';
  text: string;
}

export interface WrappedTopicAttachmentBlock
  extends WrappedTopicRichBlockBase, TopicAttachmentBlock {
  title: string;
  text: string;
}

export interface WrappedTopicImageBlock extends WrappedTopicRichBlockBase, TopicImageBlock {
  imageMissing: boolean;
  imageWidth: number;
  imageHeight: number;
  captionLines: TopicRichLine[];
}

export interface WrappedTopicListItem extends TopicListItem {
  markerText: string;
  markerWidth: number;
  markerXOffset: number;
  textXOffset: number;
  lines: TopicRichLine[];
  width: number;
  height: number;
}

export interface WrappedTopicListBlock extends WrappedTopicRichBlockBase {
  type: 'list';
  items: WrappedTopicListItem[];
  lineHeight: number;
}

export interface WrappedTopicCodeBlock extends WrappedTopicRichBlockBase {
  type: 'code';
  language: string;
  lines: TopicRichLine[];
  font: TopicFont;
}

export interface WrappedTopicEquationBlock extends WrappedTopicRichBlockBase {
  type: 'equation';
  source: string;
  lines: TopicRichLine[];
  font: TopicFont;
}

export type WrappedTopicRichBlock =
  | WrappedTopicParagraphBlock
  | WrappedTopicNoteBlock
  | WrappedTopicAttachmentBlock
  | WrappedTopicImageBlock
  | WrappedTopicListBlock
  | WrappedTopicCodeBlock
  | WrappedTopicEquationBlock;

export type WrappedTopicAdornmentBlock = WrappedTopicNoteBlock | WrappedTopicAttachmentBlock;

export interface TopicRichContentLayout {
  blocks: WrappedTopicRichBlock[];
  adornments: WrappedTopicAdornmentBlock[];
  adornmentCount: number;
  lines: string[];
  richLines: TopicRichLine[];
  width: number;
  height: number;
}

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

export const TOPIC_RICH_BLOCK_TYPES = CORE_TOPIC_RICH_BLOCK_TYPES;

export const TOPIC_CODE_BLOCK_PADDING_X = CODE_BLOCK_PADDING_X;
export const TOPIC_CODE_BLOCK_PADDING_Y = CODE_BLOCK_PADDING_Y;
export const TOPIC_RICH_TEXT_CODE_FONT_FAMILY =
  'var(--font-monospace, var(--font-mono, monospace))';

export const INLINE_TOPIC_COLOR_VALUES = CORE_INLINE_TOPIC_COLOR_VALUES;
export const INLINE_TOPIC_COLOR_OPTIONS = CORE_INLINE_TOPIC_COLOR_OPTIONS;

/*
 * 将行内颜色值标准化为十六进制颜色。支持语义色名称和 #xxx/#xxxxxx 格式。
 * 未知语义色返回空字符串。
 */
export function normalizeInlineTopicColor(value: unknown): string {
  return normalizeCoreInlineTopicColor(value);
}

/*
 * 将富文本源码中的样式标记全部剥离，返回纯文本。
 */
export function topicRichTextToPlainText(source: unknown): string {
  return coreTopicRichTextToPlainText(source);
}

/*
 * 解析富文本源码为样式片段数组，合并相邻同风格片段。
 */
export function parseTopicRichText(
  source: unknown,
  baseStyle: TopicRichTextStyle = {}
): TopicRichTextSegment[] {
  return parseCoreTopicRichText(source, baseStyle);
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
export function parseTopicRichBlocks(source: unknown): TopicRichBlock[] {
  return parseCoreTopicRichBlocks(source);
}

/*
 * 将富文本源码按最大宽度换行，返回分段后的样式片段行数组。
 * 每行是一组 style segment，供 SVG 渲染时逐个生成 <tspan>。
 */
export function wrapTopicRichTextByWidth(
  source: unknown,
  maxWidth: number,
  font: TopicFont = {}
): TopicRichLine[] {
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
export function wrapTopicRichBlocksByWidth(
  source: unknown,
  maxWidth: number,
  font: TopicFont = {},
  options: TopicRichLayoutOptions = {}
): TopicRichContentLayout {
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

export function richLineToPlainText(line: TopicRichLine): string {
  return joinSegmentsText(line);
}

export function topicRichTextLinkMarker(linkKind: unknown): string {
  return coreTopicRichTextLinkMarker(linkKind);
}

/*
 * 计算主题内容中图片块的首选宽度（用于主题宽度估算）。
 * 只计入定宽图片（像素宽或宽高），百分比图片和缺失图片不计入。
 * 如果主题中所有图片的显式宽度都小于默认可用文本宽度，返回 0。
 */
export function topicRichTextPreferredContentWidth(source: unknown): number {
  return coreTopicRichTextPreferredContentWidth(source);
}

function isTopicAdornmentBlock(block: WrappedTopicRichBlock): block is WrappedTopicAdornmentBlock {
  return (
    block?.type === TOPIC_RICH_BLOCK_TYPES.NOTE || block?.type === TOPIC_RICH_BLOCK_TYPES.ATTACHMENT
  );
}

/*
 * 估算一行富文本样式片段的显示宽度。
 * 每段样式独立测量宽度并累加；链接段额外计入前置标识符（↗/◇）的宽度。
 * 加粗段使用更大的字重估算宽度，因为加粗字形通常略宽。
 */
export function estimateRichLineWidth(line: TopicRichLine, font: TopicFont = {}): number {
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

function wrapTopicRichBlock(
  block: TopicRichBlock,
  maxWidth: number,
  font: TopicFont,
  gapBefore: number,
  options: TopicRichLayoutOptions = {}
): WrappedTopicRichBlock {
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

function wrapTopicParagraphBlock(
  block: TopicParagraphBlock,
  maxWidth: number,
  font: TopicFont,
  gapBefore: number
): WrappedTopicParagraphBlock {
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

function wrapTopicNoteBlock(block: TopicNoteBlock, gapBefore: number): WrappedTopicNoteBlock {
  const text = String(block.lines?.join('\n') || '').trim() || 'Note';
  return {
    type: TOPIC_RICH_BLOCK_TYPES.NOTE,
    gapBefore,
    text,
    width: 0,
    height: 0,
  };
}

function wrapTopicAttachmentBlock(
  block: TopicAttachmentBlock,
  gapBefore: number
): WrappedTopicAttachmentBlock {
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

function wrapTopicImageBlock(
  block: TopicImageBlock,
  maxWidth: number,
  font: TopicFont,
  gapBefore: number,
  options: TopicRichLayoutOptions = {}
): WrappedTopicImageBlock {
  const isImageResolved =
    typeof options.isImageResolved === 'function' ? options.isImageResolved(block) : true;
  const naturalSize =
    typeof options.resolveImageSize === 'function' ? options.resolveImageSize(block) : null;
  const resolvedNaturalWidth = Number(naturalSize?.width);
  const resolvedNaturalHeight = Number(naturalSize?.height);
  const naturalWidth = resolvedNaturalWidth > 0 ? resolvedNaturalWidth : 0;
  const naturalHeight = resolvedNaturalHeight > 0 ? resolvedNaturalHeight : 0;
  const naturalAspectRatio =
    naturalWidth > 0 && naturalHeight > 0 ? naturalHeight / naturalWidth : 0;
  const percentScale =
    block.sizeMode === 'percent' && Number(block.scale) > 0 ? Number(block.scale) : 0;
  /*
   * 百分比尺寸语义跟 Markdown 图片更接近：`|50%` 表示原图自然宽度的 50%。
   * 首次布局如果还没有拿到自然宽度，先按当前主题宽度估算；图片加载完成后会缓存自然尺寸并触发重排。
   */
  const percentBaseWidth = naturalWidth || maxWidth;
  const hasRequestedWidth = percentScale > 0 || Number(block.width) > 0;
  const requestedWidth =
    percentScale > 0 ? Math.round(percentBaseWidth * percentScale) : Number(block.width) || 0;
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
function wrapTopicListBlock(
  block: TopicListBlock,
  maxWidth: number,
  font: TopicFont,
  gapBefore: number
): WrappedTopicListBlock {
  const lineHeight = resolveTopicListLineHeight(font);
  const orderedCounters: number[] = [];
  const levelKinds: Array<'ordered' | 'unordered' | undefined> = [];
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

function resolveTopicListLineHeight(font: TopicFont = {}): number {
  const fontSize = Number(font.size) || 16;
  const configuredLineHeight = Number(font.lineHeight) || fontSize * 1.3;
  // 列表项前有编号/项目符号，视觉上比普通文本更容易挤，给它保留独立的最小行距。
  return Math.max(configuredLineHeight, Math.round(fontSize * LIST_LINE_HEIGHT_RATIO));
}

function topicListMarkerText(
  item: TopicListItem,
  orderedCounters: number[],
  levelKinds: Array<'ordered' | 'unordered' | undefined>
): string {
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
function wrapTopicCodeBlock(
  block: TopicCodeBlock,
  maxWidth: number,
  font: TopicFont,
  gapBefore: number
): WrappedTopicCodeBlock {
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
function wrapTopicEquationBlock(
  block: TopicEquationBlock,
  maxWidth: number,
  font: TopicFont,
  gapBefore: number
): WrappedTopicEquationBlock {
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

function estimateTopicEquationHeight(source: unknown, lineCount: number, font: TopicFont): number {
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

function flattenTopicRichBlockLines(block: WrappedTopicRichBlock): TopicRichLine[] {
  if (block.type === TOPIC_RICH_BLOCK_TYPES.LIST) {
    return block.items.flatMap((item) => item.lines);
  }
  if (block.type === TOPIC_RICH_BLOCK_TYPES.IMAGE) {
    return block.captionLines?.length
      ? block.captionLines
      : [[{ text: block.alt || block.source || 'Image' }]];
  }
  if (
    block.type === TOPIC_RICH_BLOCK_TYPES.PARAGRAPH ||
    block.type === TOPIC_RICH_BLOCK_TYPES.CODE ||
    block.type === TOPIC_RICH_BLOCK_TYPES.EQUATION
  ) {
    return block.lines;
  }
  return [];
}

function estimateRichLinesMaxWidth(lines: TopicRichLine[], font: TopicFont): number {
  return Math.ceil(
    lines.reduce((max, line) => Math.max(max, estimateRichLineWidth(line, font)), 0)
  );
}

function estimateCodeRichLinesMaxWidth(lines: TopicRichLine[], font: TopicFont): number {
  return Math.ceil(
    lines.reduce((max, line) => Math.max(max, estimateCodeRichLineWidth(line, font)), 0)
  );
}

function estimateCodeRichLineWidth(line: TopicRichLine, font: TopicFont = {}): number {
  return line.reduce((sum, segment) => sum + estimateTopicCodeTextWidth(segment.text, font), 0);
}

function estimateTopicCodeTextWidth(text: unknown, font: TopicFont = {}): number {
  const fontSize = Number(font.size) || 13;
  let width = 0;
  for (const char of Array.from(String(text))) {
    width += CJK_OR_FULLWIDTH_RE.test(char) ? fontSize : fontSize * CODE_MONOSPACE_CHAR_WIDTH_RATIO;
  }
  return width;
}

function wrapPlainPreservedLineByWidth(
  line: unknown,
  maxWidth: number,
  font: TopicFont
): TopicRichLine[] {
  const source = String(line || '').replace(/\t/g, '  ');
  if (!source) return [[{ text: ' ' }]];

  const lines: TopicRichLine[] = [];
  let current: TopicRichLine = [];
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

function resolveTopicCodeFont(font: TopicFont = {}): ResolvedTopicFont {
  const fontSize = Math.max(10, Math.round((Number(font.size) || 16) * CODE_FONT_SIZE_RATIO));
  return {
    family: TOPIC_RICH_TEXT_CODE_FONT_FAMILY,
    size: fontSize,
    weight: 400,
    lineHeight: Math.max(14, Math.round(fontSize * CODE_LINE_HEIGHT_RATIO)),
  };
}

/*
 * 将富文本按硬换行（\n）拆分成独立行，
 * 每行分别做空白规范化（合并空格、去掉首尾空白）。
 */
function normalizeRichHardLines(segments: TopicRichTextSegment[]): TopicRichLine[] {
  const lines: TopicRichLine[] = [[]];

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
function normalizeRichLineWhitespace(line: TopicRichLine): TopicRichLine {
  const chars: TopicRichTextSegment[] = [];
  let pendingSpace = false;
  let pendingStyle: TopicRichTextStyle | null = null;

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
function wrapRichLineByWidth(
  line: TopicRichLine,
  maxWidth: number,
  font: TopicFont
): TopicRichLine[] {
  if (!joinSegmentsText(line)) return [];

  const wrapByWords = shouldWrapByWords(joinSegmentsText(line));
  const tokens = wrapByWords
    ? splitRichLineByWords(line)
    : splitRichLineIntoChars(line).map((segment) => [segment]);
  const lines: TopicRichLine[] = [];
  let current: TopicRichLine = [];

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
function splitRichLineByWords(line: TopicRichLine): TopicRichLine[] {
  const tokens: TopicRichLine[] = [];
  let current: TopicRichLine = [];

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
function splitRichLineIntoChars(line: TopicRichLine): TopicRichTextSegment[] {
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
function splitRichLineByEstimatedWidth(
  line: TopicRichLine,
  maxWidth: number,
  font: TopicFont
): { head: TopicRichLine; tail: TopicRichLine } {
  let width = 0;
  let head: TopicRichLine = [];
  const tail: TopicRichLine = [];
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
    const first = tail.shift();
    if (first) head = [first];
  }

  return {
    head: mergeAdjacentRichSegments(head),
    tail: trimRichLineStart(mergeAdjacentRichSegments(tail)),
  };
}

function pushRichLine(lines: TopicRichLine[], line: TopicRichLine): void {
  const trimmed = trimRichLineEnd(line);
  if (joinSegmentsText(trimmed)) lines.push(trimmed);
}

function trimRichLineStart(line: TopicRichLine): TopicRichLine {
  const next = [...line];
  while (next.length && next[0].text === ' ') next.shift();
  return next;
}

function trimRichLineEnd(line: TopicRichLine): TopicRichLine {
  const next = [...line];
  while (next.length && next[next.length - 1].text === ' ') next.pop();
  return next;
}

function joinSegmentsText(segments: TopicRichLine): string {
  return segments.map((segment) => segment.text).join('');
}

/*
 * 创建一个富文本样式片段。只复制有效的样式属性，
 * 确保 undefined/false 值不会被污染到片段上。
 */
function createRichSegment(text: string, style: TopicRichTextStyle = {}): TopicRichTextSegment {
  const segment: TopicRichTextSegment = { text };
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
    segment.linkKind = style.linkKind || 'external';
    if (style.linkMarker === false) segment.linkMarker = false;
  }
  return segment;
}

/*
 * 合并相邻的相同样式片段，减少片段数量（如 "**ab**" → [{bold: true, text: 'ab'}]）。
 */
function mergeAdjacentRichSegments(segments: TopicRichTextSegment[]): TopicRichTextSegment[] {
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
function hasSameStyle(left: TopicRichTextStyle, right: TopicRichTextStyle): boolean {
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
