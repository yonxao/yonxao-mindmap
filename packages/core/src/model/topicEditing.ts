import { matchTopicLevelLine } from '../parser/topicParser.js';

const TASK_LIST_TOGGLE_PATTERN = /^(\s*[-*+]\s+\[)([ xX])(\]\s+.+)$/;

export interface TopicLevelSelectionEdit {
  changed: boolean;
  value: string;
  selectionStart: number;
  selectionEnd: number;
  replacementStart: number;
  replacementEnd: number;
  replacementText: string;
}

/*
 * 调整单行主题级别标记。反缩进时至少保留一级主题。
 */
export function adjustTopicLevel(line: unknown, isOutdent: boolean): string {
  const source = String(line ?? '');
  const match = source.match(/^(\s*)(#+)(\s+.*)$/);
  if (!match) return source;

  const prefix = match[1] || '';
  const hashes = match[2] || '';
  const rest = match[3] || '';
  if (isOutdent) {
    return hashes.length > 1 ? `${prefix}${hashes.slice(1)}${rest}` : source;
  }
  return `${prefix}#${hashes}${rest}`;
}

/*
 * 纯文本版本的选区层级调整。宿主只负责把返回值写回 textarea、CodeMirror
 * 或原生编辑器，选区扩展和主题行识别规则在所有端保持一致。
 */
export function adjustTopicLevelSelectionText(
  value: unknown,
  selectionStart: number,
  selectionEnd: number,
  isOutdent: boolean
): TopicLevelSelectionEdit {
  const source = String(value ?? '');
  const safeStart = clampSelectionIndex(selectionStart, source.length);
  const safeEnd = clampSelectionIndex(selectionEnd, source.length);
  const rangeStart = Math.min(safeStart, safeEnd);
  const rangeEnd = Math.max(safeStart, safeEnd);
  const lineStart = source.lastIndexOf('\n', rangeStart - 1) + 1;
  const nextLineBreak = source.indexOf('\n', rangeEnd);
  const lineEnd = nextLineBreak === -1 ? source.length : nextLineBreak;
  const selected = source.slice(lineStart, lineEnd);
  const lines = selected.split('\n');

  if (!lines.some((line) => matchTopicLevelLine(line.trim()))) {
    return {
      changed: false,
      value: source,
      selectionStart: safeStart,
      selectionEnd: safeEnd,
      replacementStart: safeStart,
      replacementEnd: safeEnd,
      replacementText: '',
    };
  }

  const changedText = lines.map((line) => adjustTopicLevel(line, isOutdent)).join('\n');
  return {
    changed: true,
    value: `${source.slice(0, lineStart)}${changedText}${source.slice(lineEnd)}`,
    selectionStart: lineStart,
    selectionEnd: lineStart + changedText.length,
    replacementStart: lineStart,
    replacementEnd: lineEnd,
    replacementText: changedText,
  };
}

/*
 * 只切换任务列表方括号中的状态字符，保留缩进、列表符号、空格和正文。
 * 无效行号或非任务行返回 null，调用方据此避免写回。
 */
export function toggleTopicTaskItemText(text: unknown, sourceLineIndex: unknown): string | null {
  const lineIndex = Number(sourceLineIndex);
  if (!Number.isInteger(lineIndex) || lineIndex < 0) return null;

  const lines = String(text ?? '').split('\n');
  const line = lines[lineIndex];
  if (line === undefined) return null;
  const match = line.match(TASK_LIST_TOGGLE_PATTERN);
  if (!match) return null;

  const nextMarker = (match[2] || '').toLowerCase() === 'x' ? ' ' : 'x';
  lines[lineIndex] = `${match[1] || ''}${nextMarker}${match[3] || ''}`;
  return lines.join('\n');
}

function clampSelectionIndex(value: number, length: number): number {
  const normalized = Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.min(length, Math.max(0, normalized));
}
