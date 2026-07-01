/*
 * 文件作用：
 * 解析主题内容中的局部文字样式标记，并提供布局测量和 SVG 渲染可复用的片段数据。
 *
 * 支持语法：
 * **加粗**、*斜体*、~~中划线~~、++下划线++、{red|语义色}、{#e11d48|十六进制颜色}。
 */

import { estimateTopicTextWidth } from './text.js';

const COLOR_MARKER_PATTERN = /^\{((?:#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?)|[a-zA-Z][a-zA-Z0-9-]*)\|/;
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const CJK_OR_FULLWIDTH_RE = /[\u2e80-\u9fff\uff00-\uffef]/;

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

export function normalizeInlineTopicColor(value) {
  const color = String(value || '').trim();
  if (!color) return '';
  if (HEX_COLOR_PATTERN.test(color)) return normalizeHexColor(color);
  return INLINE_TOPIC_COLOR_VALUES[color.toLowerCase()] || '';
}

export function topicRichTextToPlainText(source) {
  return joinSegmentsText(parseTopicRichText(source));
}

export function parseTopicRichText(source, baseStyle = {}) {
  return mergeAdjacentRichSegments(parseRichTextRange(String(source || ''), baseStyle));
}

export function wrapTopicRichTextByWidth(source, maxWidth, font) {
  const hardLines = normalizeRichHardLines(parseTopicRichText(source));
  if (!hardLines.length) return [[{ text: 'Untitled' }]];

  return hardLines.flatMap((line) => wrapRichLineByWidth(line, maxWidth, font));
}

export function richLineToPlainText(line) {
  return joinSegmentsText(line);
}

export function estimateRichLineWidth(line, font = {}) {
  return line.reduce((sum, segment) => {
    const segmentFont = segment.bold
      ? { ...font, weight: Math.max(Number(font?.weight) || 400, 700) }
      : font;
    return sum + estimateTopicTextWidth(segment.text, segmentFont);
  }, 0);
}

function parseRichTextRange(source, baseStyle) {
  const segments = [];
  let index = 0;
  let buffer = '';

  const flush = () => {
    if (!buffer) return;
    segments.push(createRichSegment(buffer, baseStyle));
    buffer = '';
  };

  while (index < source.length) {
    const colorMatch = source.slice(index).match(COLOR_MARKER_PATTERN);
    if (colorMatch) {
      const color = normalizeInlineTopicColor(colorMatch[1]);
      const contentStart = index + colorMatch[0].length;
      const contentEnd = findClosingBrace(source, contentStart);
      if (color && contentEnd !== -1) {
        flush();
        segments.push(
          ...parseRichTextRange(source.slice(contentStart, contentEnd), {
            ...baseStyle,
            color,
          })
        );
        index = contentEnd + 1;
        continue;
      }
    }

    const styleMarker = STYLE_MARKERS.find(({ marker }) => source.startsWith(marker, index));
    if (styleMarker) {
      const contentStart = index + styleMarker.marker.length;
      const contentEnd = source.indexOf(styleMarker.marker, contentStart);
      if (contentEnd !== -1) {
        flush();
        segments.push(
          ...parseRichTextRange(source.slice(contentStart, contentEnd), {
            ...baseStyle,
            [styleMarker.key]: true,
          })
        );
        index = contentEnd + styleMarker.marker.length;
        continue;
      }
    }

    // 非法颜色、未知语义色、未闭合标记都按普通文本保留，避免用户输入被静默吞掉。
    buffer += source[index];
    index += 1;
  }

  flush();
  return segments;
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

function splitRichLineIntoChars(line) {
  return line.flatMap((segment) =>
    Array.from(segment.text || '').map((char) => createRichSegment(char, segment))
  );
}

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

function createRichSegment(text, style = {}) {
  const segment = { text };
  if (style.bold) segment.bold = true;
  if (style.italic) segment.italic = true;
  if (style.strike) segment.strike = true;
  if (style.underline) segment.underline = true;
  if (style.color) segment.color = style.color;
  return segment;
}

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

function hasSameStyle(left, right) {
  return (
    Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.strike) === Boolean(right.strike) &&
    Boolean(left.underline) === Boolean(right.underline) &&
    String(left.color || '') === String(right.color || '')
  );
}

function normalizeHexColor(color) {
  const hex = color.toLowerCase();
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex;
}
