/*
 * 文件作用：
 * 这里负责主题文本的视觉宽度估算和换行。
 *
 * 执行逻辑：
 * SVG text 默认不会自动换行，所以渲染前必须先把长标题切成多行。
 * visualUnits 会把中文/全角字符按 2 个单位估算，英文按 1 个单位估算，
 * wrapTopicText 再根据最大单位数拆行，让中英文混排的主题宽度更稳定。
 *
 * 调用链位置：
 * layoutTree.measureTopic() -> wrapTopicText()/visualUnits() -> renderer.renderTopic()
 */

/*
 * 作用：
 * 把主题标题拆成适合 SVG 渲染的多行文本。
 *
 * 实现逻辑：
 * 英文优先按单词拆，中文或无空格文本按字符拆，并限制最多 4 行。
 */
export function wrapTopicText(text, maxUnits) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return ['Untitled'];

  // 英文优先按单词换行；没有空格的中文文本则按字符切分。
  const words = normalized.includes(' ') ? normalized.split(' ') : Array.from(normalized);
  const lines = [];
  let line = '';

  for (const word of words) {
    const separator = normalized.includes(' ') && line ? ' ' : '';
    const next = line ? `${line}${separator}${word}` : word;

    if (line && visualUnits(next) > maxUnits) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }

    while (visualUnits(line) > maxUnits) {
      const split = splitByUnits(line, maxUnits);
      lines.push(split.head);
      line = split.tail;
    }
  }

  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/*
 * 作用：
 * 按视觉单位把一段文本拆成 head/tail 两段。
 *
 * 调用链：
 * wrapTopicText() 在单行仍超过 maxUnits 时调用本函数。
 */
export function splitByUnits(text, maxUnits) {
  let units = 0;
  let index = 0;

  for (const char of Array.from(text)) {
    const charUnits = visualUnits(char);
    if (units + charUnits > maxUnits) break;
    units += charUnits;
    index += char.length;
  }

  return {
    head: text.slice(0, Math.max(1, index)),
    tail: text.slice(Math.max(1, index)),
  };
}

/*
 * 作用：
 * 估算文本视觉宽度单位。
 *
 * 实现逻辑：
 * CJK 与全角字符按 2 个单位，普通字符按 1 个单位。
 */
export function visualUnits(text) {
  let count = 0;
  for (const char of Array.from(String(text))) {
    // CJK 与全角字符通常更宽，这里按 2 个单位估算显示宽度。
    count += /[\u2e80-\u9fff\uff00-\uffef]/.test(char) ? 2 : 1;
  }
  return count;
}
