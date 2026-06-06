/*
 * 文件作用：
 * 这里负责源码模式里和 Markdown 标题层级有关的键盘操作与缩进辅助线计算。
 *
 * 执行逻辑：
 * - Tab：给选中标题增加一个 #，等价于下沉一级。
 * - Shift+Tab：删除一个 #，等价于上升一级。
 * - countHeadingGuideLevels：根据标题层级返回需要显示多少条级别辅助线。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer.createSourceView() -> keydown/updateSourceLevelGuides() -> headingKeys
 */

import { matchHeadingLine } from '../parser/parseMind.js';

/*
 * 作用：
 * 源码模式 Tab/Shift+Tab 的统一入口。
 *
 * 调用链：
 * Renderer.createSourceView() keydown -> applyHeadingLevelKey()。
 */
export function applyHeadingLevelKey(textarea, isOutdent) {
  adjustHeadingLevelSelection(textarea, isOutdent);
}

/*
 * 作用：
 * 调整 textarea 当前选区内所有标题行的层级。
 *
 * 实现逻辑：
 * 先把选区扩展到完整行，再逐行调用 adjustHeadingLevel。
 */
export function adjustHeadingLevelSelection(textarea, isOutdent) {
  const value = textarea.value;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const nextLineBreak = value.indexOf('\n', end);
  const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  const selected = value.slice(lineStart, lineEnd);
  const lines = selected.split('\n');
  const hasHeading = lines.some((line) => matchHeadingLine(line.trim()));

  // 如果选区里没有标题行，就不改变用户输入，避免 Tab 被误用为层级操作。
  if (!hasHeading) return false;

  const changed = lines.map((line) => adjustHeadingLevel(line, isOutdent)).join('\n');
  textarea.setRangeText(changed, lineStart, lineEnd, 'select');
  textarea.selectionStart = lineStart;
  textarea.selectionEnd = lineStart + changed.length;
  return true;
}

/*
 * 作用：
 * 调整单行 Markdown 标题层级。
 *
 * 实现逻辑：
 * 缩进时增加一个 #；反缩进时在至少二级标题的情况下删除一个 #。
 */
export function adjustHeadingLevel(line, isOutdent) {
  const match = String(line).match(/^(\s*)(#+)(\s+.*)$/);
  if (!match) return line;

  const prefix = match[1];
  const hashes = match[2];
  const rest = match[3];

  if (isOutdent) {
    return hashes.length > 1 ? `${prefix}${hashes.slice(1)}${rest}` : line;
  }

  return `${prefix}#${hashes}${rest}`;
}

/*
 * 作用：
 * 根据标题层级计算源码模式需要绘制多少条级别辅助线。
 */
export function countHeadingGuideLevels(line) {
  const heading = matchHeadingLine(String(line).trim());
  return heading ? Math.max(0, heading.level - 1) : 0;
}
