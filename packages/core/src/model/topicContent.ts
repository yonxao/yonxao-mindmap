export const TOPIC_RICH_BLOCK_TYPES = Object.freeze({
  PARAGRAPH: 'paragraph',
  LIST: 'list',
  EQUATION: 'equation',
  CODE: 'code',
  NOTE: 'note',
  IMAGE: 'image',
  ATTACHMENT: 'attachment',
} as const);

export type TopicRichBlockType =
  (typeof TOPIC_RICH_BLOCK_TYPES)[keyof typeof TOPIC_RICH_BLOCK_TYPES];
export type TopicLinkKind = 'external' | 'obsidian';
export type TopicImageSizeMode = '' | 'original' | 'percent';

export interface TopicRichTextStyle {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  color?: string;
  tag?: boolean;
  tagName?: string;
  link?: boolean;
  href?: string;
  linkKind?: TopicLinkKind;
  linkMarker?: boolean;
}

export interface TopicRichTextSegment extends TopicRichTextStyle {
  text: string;
}

export interface TopicListItem {
  ordered: boolean;
  number: string;
  level: number;
  text: string;
  sourceLineIndex: number;
  task?: boolean;
  checked?: boolean;
}

export interface TopicParagraphBlock {
  type: 'paragraph';
  lines: string[];
}

export interface TopicListBlock {
  type: 'list';
  items: TopicListItem[];
}

export interface TopicEquationBlock {
  type: 'equation';
  source: string;
}

export interface TopicCodeBlock {
  type: 'code';
  language: string;
  lines: string[];
}

export interface TopicNoteBlock {
  type: 'note';
  lines: string[];
}

export interface TopicImageBlock {
  type: 'image';
  alt: string;
  source: string;
  width: number;
  height: number;
  sizeMode: TopicImageSizeMode;
  scale: number;
  obsidian: boolean;
}

export interface TopicAttachmentBlock {
  type: 'attachment';
  label: string;
  source: string;
  obsidian: boolean;
}

export type TopicRichBlock =
  | TopicParagraphBlock
  | TopicListBlock
  | TopicEquationBlock
  | TopicCodeBlock
  | TopicNoteBlock
  | TopicImageBlock
  | TopicAttachmentBlock;

export const INLINE_TOPIC_COLOR_VALUES: Readonly<Record<string, string>> = Object.freeze({
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

export const INLINE_TOPIC_COLOR_OPTIONS: ReadonlyArray<readonly [string, string]> = Object.freeze(
  Object.entries(INLINE_TOPIC_COLOR_VALUES)
);

const COLOR_MARKER_PATTERN = /^\{((?:#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)|[a-zA-Z][a-zA-Z0-9-]*)\|/;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
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
const IMAGE_SIZE_PERCENT_PATTERN = /^(\d+(?:\.\d+)?)%$/;
const IMAGE_SIZE_ORIGINAL = 'original';
const INDENT_TAB_WIDTH = 2;
const LINK_MARKERS: Readonly<Record<string, string>> = Object.freeze({
  external: '↗',
  obsidian: '◇',
});
const STYLE_MARKERS = Object.freeze([
  { marker: '**', key: 'bold' },
  { marker: '~~', key: 'strike' },
  { marker: '++', key: 'underline' },
  { marker: '*', key: 'italic' },
] as const);

type TopicStyleKey = (typeof STYLE_MARKERS)[number]['key'];

interface StyleRange {
  start: number;
  end: number;
  style: TopicRichTextStyle;
}

interface StyleRanges {
  styles: StyleRange[];
  removals: Array<[number, number]>;
}

export function normalizeInlineTopicColor(value: unknown): string {
  const color = String(value || '').trim();
  if (!color) return '';
  if (HEX_COLOR_PATTERN.test(color)) return normalizeHexColor(color);
  return INLINE_TOPIC_COLOR_VALUES[color.toLowerCase()] || '';
}

export function topicRichTextToPlainText(source: unknown): string {
  return parseTopicRichText(source)
    .map((segment) => segment.text)
    .join('');
}

export function parseTopicRichText(
  source: unknown,
  baseStyle: TopicRichTextStyle = {}
): TopicRichTextSegment[] {
  const text = String(source || '');
  const ranges = collectInlineStyleRanges(text);
  const isRemovedIndex = createInlineStyleRemovalCursor(ranges.removals);
  const segments: TopicRichTextSegment[] = [];
  let buffer = '';
  let bufferStyle: TopicRichTextStyle | null = null;

  const flush = (): void => {
    if (!buffer) return;
    segments.push(createRichSegment(buffer, bufferStyle || baseStyle));
    buffer = '';
    bufferStyle = null;
  };

  for (let index = 0; index < text.length; index += 1) {
    if (isRemovedIndex(index)) continue;
    const style = inlineStyleAtIndex(ranges.styles, index, baseStyle);
    if (!bufferStyle || !hasSameStyle(bufferStyle, style)) {
      flush();
      bufferStyle = style;
    }
    buffer += text[index];
  }

  flush();
  return mergeAdjacentRichSegments(segments);
}

export function parseTopicRichBlocks(source: unknown): TopicRichBlock[] {
  const rawLines = String(source || '')
    .replace(/\r\n/g, '\n')
    .split('\n');
  const blocks: TopicRichBlock[] = [];
  let index = 0;

  while (index < rawLines.length) {
    const line = rawLines[index] || '';
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    const codeFence = trimmed.match(CODE_FENCE_PATTERN);
    if (codeFence) {
      const lines: string[] = [];
      index += 1;
      while (index < rawLines.length && !CODE_FENCE_PATTERN.test((rawLines[index] || '').trim())) {
        lines.push(rawLines[index] || '');
        index += 1;
      }
      if (index < rawLines.length) index += 1;
      blocks.push({
        type: 'code',
        language: codeFence[1] || '',
        lines: lines.length ? lines : [''],
      });
      continue;
    }

    if (EQUATION_FENCE_PATTERN.test(trimmed)) {
      const lines: string[] = [];
      index += 1;
      while (
        index < rawLines.length &&
        !EQUATION_FENCE_PATTERN.test((rawLines[index] || '').trim())
      ) {
        lines.push(rawLines[index] || '');
        index += 1;
      }
      if (index < rawLines.length) index += 1;
      blocks.push({ type: 'equation', source: lines.join('\n').trim() || trimmed });
      continue;
    }

    const image = parseTopicImageBlock(trimmed);
    if (image) {
      blocks.push(image);
      index += 1;
      continue;
    }

    const attachment = parseTopicAttachmentBlock(trimmed);
    if (attachment) {
      blocks.push(attachment);
      index += 1;
      continue;
    }

    if (NOTE_LINE_PATTERN.test(line)) {
      const lines: string[] = [];
      while (index < rawLines.length && NOTE_LINE_PATTERN.test(rawLines[index] || '')) {
        lines.push((rawLines[index] || '').match(NOTE_LINE_PATTERN)?.[1] || '');
        index += 1;
      }
      blocks.push({ type: 'note', lines: lines.length ? lines : [''] });
      continue;
    }

    if (isTopicListLine(line)) {
      const items: TopicListItem[] = [];
      while (index < rawLines.length && isTopicListLine(rawLines[index] || '')) {
        items.push(parseTopicListItem(rawLines[index] || '', index));
        index += 1;
      }
      blocks.push({ type: 'list', items });
      continue;
    }

    const lines: string[] = [];
    while (
      index < rawLines.length &&
      (rawLines[index] || '').trim() &&
      !isTopicStandaloneBlockLine(rawLines[index] || '')
    ) {
      lines.push(rawLines[index] || '');
      index += 1;
    }
    blocks.push({ type: 'paragraph', lines });
  }

  return blocks.length ? blocks : [{ type: 'paragraph', lines: ['Untitled'] }];
}

export function topicRichTextLinkMarker(linkKind: unknown): string {
  return LINK_MARKERS[String(linkKind || '').toLowerCase()] || LINK_MARKERS.external || '↗';
}

export function topicRichTextPreferredContentWidth(source: unknown): number {
  return parseTopicRichBlocks(source).reduce((width, block) => {
    if (block.type !== 'image' || block.sizeMode === 'percent') return width;
    return Math.max(width, block.width);
  }, 0);
}

function collectInlineStyleRanges(source: string): StyleRanges {
  const styles: StyleRange[] = [];
  const removals: Array<[number, number]> = [];
  const openMarkers = new Map<string, Array<{ start: number; end: number }>>();
  let index = 0;

  while (index < source.length) {
    const colorMatch = source.slice(index).match(COLOR_MARKER_PATTERN);
    if (colorMatch) {
      const color = normalizeInlineTopicColor(colorMatch[1]);
      const contentStart = index + colorMatch[0].length;
      const contentEnd = findClosingBrace(source, contentStart);
      if (color && contentEnd !== -1) {
        styles.push({ start: contentStart, end: contentEnd, style: { color } });
        removals.push([index, contentStart], [contentEnd, contentEnd + 1]);
        index = contentStart;
        continue;
      }
    }

    const markdownLink = source.slice(index).match(MARKDOWN_LINK_PATTERN);
    if (markdownLink) {
      const label = markdownLink[1] || '';
      const labelStart = index + 1;
      const labelEnd = labelStart + label.length;
      const markerEnd = index + markdownLink[0].length;
      styles.push({
        start: labelStart,
        end: labelEnd,
        style: { link: true, href: markdownLink[2] || '', linkKind: 'external' },
      });
      removals.push([index, labelStart], [labelEnd, markerEnd]);
      index = labelStart;
      continue;
    }

    const obsidianLink = source.slice(index).match(OBSIDIAN_LINK_PATTERN);
    if (obsidianLink) {
      const link = parseObsidianLinkText(obsidianLink[1] || '');
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

    const marker = STYLE_MARKERS.find((entry) => source.startsWith(entry.marker, index));
    if (marker) {
      const openings = openMarkers.get(marker.marker) || [];
      const markerEnd = index + marker.marker.length;
      if (openings.length) {
        const opening = openings.pop();
        if (opening) {
          styles.push({
            start: opening.end,
            end: index,
            style: { [marker.key as TopicStyleKey]: true },
          });
          removals.push([opening.start, opening.end], [index, markerEnd]);
        }
      } else {
        openings.push({ start: index, end: markerEnd });
        openMarkers.set(marker.marker, openings);
      }
      index = markerEnd;
      continue;
    }
    index += 1;
  }
  return { styles, removals };
}

function createInlineStyleRemovalCursor(
  removals: Array<[number, number]>
): (index: number) => boolean {
  const ranges = mergeRemovalRanges(removals);
  let rangeIndex = 0;
  return (index) => {
    while (rangeIndex < ranges.length && index >= (ranges[rangeIndex]?.[1] ?? 0)) rangeIndex += 1;
    const range = ranges[rangeIndex];
    return Boolean(range && index >= range[0] && index < range[1]);
  };
}

function mergeRemovalRanges(removals: Array<[number, number]>): Array<[number, number]> {
  const sorted = removals
    .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start)
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const merged: Array<[number, number]> = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range[0] <= previous[1]) previous[1] = Math.max(previous[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

function inlineStyleAtIndex(
  ranges: StyleRange[],
  index: number,
  baseStyle: TopicRichTextStyle
): TopicRichTextStyle {
  const style = { ...baseStyle };
  for (const range of ranges) {
    if (index >= range.start && index < range.end) Object.assign(style, range.style);
  }
  return style;
}

function parseObsidianLinkText(text: string): {
  target: string;
  label: string;
  visibleOffset: number;
} {
  const pipeIndex = text.lastIndexOf('|');
  if (pipeIndex === -1) return { target: text.trim(), label: text.trim(), visibleOffset: 0 };
  const target = text.slice(0, pipeIndex).trim();
  const alias = text.slice(pipeIndex + 1);
  const label = alias.trim();
  if (!label) return { target, label: target, visibleOffset: 0 };
  return { target, label, visibleOffset: pipeIndex + 1 + alias.search(/\S|$/) };
}

function isTagBoundaryBefore(source: string, index: number): boolean {
  return index <= 0 || /[\s([{，。；：、,.!?;:]/.test(source[index - 1] || '');
}

function isTopicListLine(line: string): boolean {
  return (
    TASK_LIST_PATTERN.test(line) ||
    UNORDERED_LIST_PATTERN.test(line) ||
    ORDERED_LIST_PATTERN.test(line)
  );
}

function isTopicStandaloneBlockLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    CODE_FENCE_PATTERN.test(trimmed) ||
    EQUATION_FENCE_PATTERN.test(trimmed) ||
    isTopicListLine(line) ||
    NOTE_LINE_PATTERN.test(line) ||
    Boolean(parseTopicImageBlock(trimmed)) ||
    Boolean(parseTopicAttachmentBlock(trimmed))
  );
}

function parseTopicListItem(line: string, sourceLineIndex: number): TopicListItem {
  const task = line.match(TASK_LIST_PATTERN);
  if (task) {
    return {
      ordered: false,
      task: true,
      checked: (task[2] || '').toLowerCase() === 'x',
      number: '',
      level: listIndentLevel(task[1] || ''),
      text: task[3] || '',
      sourceLineIndex,
    };
  }
  const ordered = line.match(ORDERED_LIST_PATTERN);
  if (ordered) {
    return {
      ordered: true,
      number: ordered[2] || '',
      level: listIndentLevel(ordered[1] || ''),
      text: ordered[3] || '',
      sourceLineIndex,
    };
  }
  const unordered = line.match(UNORDERED_LIST_PATTERN);
  return {
    ordered: false,
    number: '',
    level: listIndentLevel(unordered?.[1] || ''),
    text: unordered?.[2] || '',
    sourceLineIndex,
  };
}

function parseTopicImageBlock(line: string): TopicImageBlock | null {
  const markdown = line.match(MARKDOWN_IMAGE_PATTERN);
  if (markdown) {
    const target = parseTopicImageTarget(markdown[2] || '');
    return {
      type: 'image',
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
  const target = parseTopicImageTarget(obsidian[1] || '');
  return {
    type: 'image',
    alt: target.caption || target.source || 'Image',
    source: target.source,
    width: target.width,
    height: target.height,
    sizeMode: target.sizeMode,
    scale: target.scale,
    obsidian: true,
  };
}

function parseTopicAttachmentBlock(line: string): TopicAttachmentBlock | null {
  const markdown = line.match(MARKDOWN_ATTACHMENT_PATTERN);
  if (markdown) {
    const target = parseTopicAttachmentTarget(markdown[2] || '');
    return {
      type: 'attachment',
      label: markdown[1] || target.source || 'Attachment',
      source: target.source,
      obsidian: false,
    };
  }
  const obsidian = line.match(OBSIDIAN_ATTACHMENT_PATTERN);
  if (!obsidian) return null;
  const target = parseTopicAttachmentTarget(obsidian[1] || '');
  return {
    type: 'attachment',
    label: target.caption || target.source || 'Attachment',
    source: target.source,
    obsidian: true,
  };
}

function parseTopicAttachmentTarget(rawTarget: string): { source: string; caption: string } {
  const [source = '', ...captions] = rawTarget.split('|').map((part) => part.trim());
  return { source, caption: captions.find(Boolean) || '' };
}

function parseTopicImageTarget(rawTarget: string): Omit<
  TopicImageBlock,
  'type' | 'alt' | 'obsidian'
> & {
  caption: string;
} {
  const parts = rawTarget.split('|').map((part) => part.trim());
  const source = parts[0] || '';
  const size = parts.find((part, index) => index > 0 && /^\d+(?:x\d+)?$/i.test(part));
  const percent = parts.find((part, index) => index > 0 && IMAGE_SIZE_PERCENT_PATTERN.test(part));
  const original = parts.find(
    (part, index) => index > 0 && part.toLowerCase() === IMAGE_SIZE_ORIGINAL
  );
  const dimensions = size ? size.toLowerCase().split('x').map(Number) : [];
  const width = dimensions[0];
  const height = dimensions[1];
  const caption =
    parts.find((part, index) => index > 0 && ![size, percent, original].includes(part)) || '';
  const scale = percent ? Number(percent.match(IMAGE_SIZE_PERCENT_PATTERN)?.[1]) / 100 : 0;
  return {
    source,
    width: Number.isFinite(width) ? Number(width) : 0,
    height: Number.isFinite(height) ? Number(height) : 0,
    sizeMode: original ? 'original' : percent ? 'percent' : '',
    scale: Number.isFinite(scale) ? scale : 0,
    caption,
  };
}

function listIndentLevel(indent: string): number {
  const units = Array.from(indent).reduce((sum, char) => sum + (char === '\t' ? 2 : 1), 0);
  return Math.max(0, Math.floor(units / INDENT_TAB_WIDTH));
}

function findClosingBrace(source: string, startIndex: number): number {
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

function createRichSegment(text: string, style: TopicRichTextStyle): TopicRichTextSegment {
  const segment: TopicRichTextSegment = { text };
  if (style.bold) segment.bold = true;
  if (style.italic) segment.italic = true;
  if (style.strike) segment.strike = true;
  if (style.underline) segment.underline = true;
  if (style.color) segment.color = style.color;
  if (style.tag) {
    segment.tag = true;
    segment.tagName = String(style.tagName || text).toLowerCase();
  }
  if (style.link) {
    segment.link = true;
    segment.href = String(style.href || '');
    segment.linkKind = style.linkKind || 'external';
    if (style.linkMarker === false) segment.linkMarker = false;
  }
  return segment;
}

function mergeAdjacentRichSegments(segments: TopicRichTextSegment[]): TopicRichTextSegment[] {
  const merged: TopicRichTextSegment[] = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    const previous = merged[merged.length - 1];
    if (previous && hasSameStyle(previous, segment)) previous.text += segment.text;
    else merged.push({ ...segment });
  }
  return merged;
}

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

function normalizeHexColor(color: string): string {
  const hex = color.toLowerCase();
  return hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;
}
