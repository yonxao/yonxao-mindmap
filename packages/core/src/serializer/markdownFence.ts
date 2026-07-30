export interface MarkdownSectionInfo {
  lineStart?: number | null;
  lineEnd?: number | null;
}

export interface MarkdownFenceRange {
  start: number;
  end: number;
}

export interface MarkdownOpeningFence {
  marker: string;
}

export function formatFencedMindMapSource(source: unknown, codeBlockName = 'yxmm'): string {
  const openingFence = `\`\`\`${codeBlockName}`;
  const normalizedSource = String(source ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n*$/, '');
  return normalizedSource
    ? `${openingFence}\n${normalizedSource}\n\`\`\``
    : `${openingFence}\n\`\`\``;
}

export function replaceCodeBlockSource(
  markdown: string,
  codeBlockName: string,
  oldSource: string,
  nextSource: string,
  sectionInfo?: MarkdownSectionInfo | null
): string | null {
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const lines = markdown.split(/\r?\n/);
  const fence =
    findFenceBySection(lines, codeBlockName, sectionInfo) ||
    findFenceBySource(lines, codeBlockName, oldSource, eol);
  return fence ? replaceFenceInnerLines(lines, fence, nextSource, eol) : null;
}

export function insertCodeBlockAfterSource(
  markdown: string,
  codeBlockName: string,
  currentSource: string,
  insertSource: string,
  sectionInfo?: MarkdownSectionInfo | null
): string | null {
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const lines = markdown.split(/\r?\n/);
  const fence =
    findFenceBySection(lines, codeBlockName, sectionInfo) ||
    findFenceBySource(lines, codeBlockName, currentSource, eol);
  if (!fence) return null;

  const indent = lines[fence.start]?.match(/^(\s*)/)?.[1] || '';
  const insertLines = [
    '',
    `${indent}\`\`\`${codeBlockName}`,
    ...String(insertSource || '').split(/\r?\n/),
    `${indent}\`\`\``,
  ];
  const nextLines = [...lines];
  nextLines.splice(fence.end + 1, 0, ...insertLines);
  return nextLines.join(eol);
}

export function findFenceBySection(
  lines: string[],
  codeBlockName: string,
  sectionInfo?: MarkdownSectionInfo | null
): MarkdownFenceRange | null {
  if (!sectionInfo || !lines.length) return null;
  const sectionStart = clampLineIndex(sectionInfo.lineStart, 0, lines.length - 1);
  const sectionEnd = clampLineIndex(sectionInfo.lineEnd, sectionStart, lines.length - 1);

  for (let start = sectionStart; start >= 0; start -= 1) {
    const opening = matchOpeningFence(lines[start], codeBlockName);
    if (!opening) continue;
    const end = findClosingFence(lines, start + 1, opening.marker);
    if (end !== -1 && end >= sectionEnd) return { start, end };
  }
  return null;
}

export function findFenceBySource(
  lines: string[],
  codeBlockName: string,
  oldSource: string,
  eol: string
): MarkdownFenceRange | null {
  const normalizedOldSource = normalizeEol(oldSource);
  for (let start = 0; start < lines.length; start += 1) {
    const opening = matchOpeningFence(lines[start], codeBlockName);
    if (!opening) continue;
    const end = findClosingFence(lines, start + 1, opening.marker);
    if (end === -1) continue;
    if (normalizeEol(lines.slice(start + 1, end).join(eol)) === normalizedOldSource) {
      return { start, end };
    }
    start = end;
  }
  return null;
}

export function replaceFenceInnerLines(
  lines: string[],
  fence: MarkdownFenceRange,
  nextSource: string,
  eol: string
): string {
  const replaced = [...lines];
  replaced.splice(fence.start + 1, fence.end - fence.start - 1, ...nextSource.split(/\r?\n/));
  return replaced.join(eol);
}

export function matchOpeningFence(
  line: unknown,
  codeBlockName: string
): MarkdownOpeningFence | null {
  const match = String(line ?? '').match(/^(\s*)(`{3,}|~{3,})\s*([^\s`~]*)/);
  if (!match || match[3] !== codeBlockName) return null;
  return { marker: match[2] || '' };
}

export function findClosingFence(
  lines: string[],
  fromIndex: number,
  openingMarker: string
): number {
  const fenceChar = openingMarker[0];
  const minLength = openingMarker.length;
  if (!fenceChar || minLength < 3) return -1;

  for (let index = Math.max(0, fromIndex); index < lines.length; index += 1) {
    const trimmed = String(lines[index] ?? '').trim();
    if (
      trimmed &&
      trimmed[0] === fenceChar &&
      trimmed.length >= minLength &&
      new RegExp(`^\\${fenceChar}{${minLength},}\\s*$`).test(trimmed)
    ) {
      return index;
    }
  }
  return -1;
}

export function normalizeEol(text: unknown): string {
  return String(text ?? '').replace(/\r\n/g, '\n');
}

function clampLineIndex(value: number | null | undefined, min: number, max: number): number {
  const normalized = Number.isFinite(value) ? Math.trunc(Number(value)) : min;
  return Math.min(max, Math.max(min, normalized));
}
