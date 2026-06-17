/*
 * 文件作用：
 * 这里负责主题文本的视觉宽度估算和换行。
 *
 * 执行逻辑：
 * SVG text 默认不会自动换行，所以渲染前必须先把长标题切成多行。
 * estimateTopicTextWidth 会按当前字号估算文本像素宽度，
 * wrapTopicTextByWidth 再根据可用像素宽度拆行，让中英文混排和粗体字体都不容易溢出。
 *
 * 调用链位置：
 * layoutTree.measureTopic() -> wrapTopicTextByWidth()/estimateTopicTextWidth() -> renderer.renderTopic()
 */

/*
 * 作用：
 * 把主题标题拆成适合 SVG 渲染的多行文本。
 *
 * 实现逻辑：
 * 英文优先按单词拆，中文或无空格文本按字符切分。
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
  return lines;
}

/*
 * 作用：
 * 把主题标题拆成不超过指定像素宽度的多行文本。
 *
 * 为什么不用 SVG 真实测量：
 * 布局阶段需要先知道主题框宽高，才能摆放主题和连线；真实 SVG text 只有渲染后才能测量。
 * 这里使用偏保守的字体宽度估算，避免宋体、粗体、大字号时文字溢出主题框。
 */
export function wrapTopicTextByWidth(text, maxWidth, font) {
  const normalized = String(text).replace(/\s+/g, ' ').trim();
  if (!normalized) return ['Untitled'];

  const words = normalized.includes(' ') ? normalized.split(' ') : Array.from(normalized);
  const lines = [];
  let line = '';

  for (const word of words) {
    const separator = normalized.includes(' ') && line ? ' ' : '';
    const next = line ? `${line}${separator}${word}` : word;

    if (line && estimateTopicTextWidth(next, font) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }

    while (estimateTopicTextWidth(line, font) > maxWidth) {
      const split = splitByEstimatedWidth(line, maxWidth, font);
      lines.push(split.head);
      line = split.tail;
    }
  }

  if (line) lines.push(line);
  return lines;
}

/*
 * 作用：
 * 把编辑器里的多行输入归一成 yxmm 主题级别标记可安全保存的一行文本。
 */
export function normalizeTopicTextForStorage(text) {
  return String(text || '')
    .replace(/\s*\r?\n+\s*/g, ' ')
    .trim();
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
 * 按估算像素宽度把一段文本拆成 head/tail 两段。
 */
export function splitByEstimatedWidth(text, maxWidth, font) {
  let width = 0;
  let index = 0;

  for (const char of Array.from(text)) {
    const charWidth = estimateTopicTextWidth(char, font);
    if (width + charWidth > maxWidth) break;
    width += charWidth;
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

/*
 * 作用：
 * 估算主题文本在当前字体下的像素宽度。
 *
 * 说明：
 * CJK 字体在不同系统和字重下实际 advance 差异明显。这里故意略保守，
 * 用少量宽度换取不会穿出主题框的稳定显示。
 */
export function estimateTopicTextWidth(text, font = {}) {
  const fontSize = Number(font.size) || 14;
  const weight = Number(font.weight) || 400;
  const weightFactor = weight >= 800 ? 1.08 : weight >= 650 ? 1.05 : 1;
  let width = 0;

  for (const char of Array.from(String(text))) {
    width += estimateTopicCharWidth(char, fontSize);
  }

  return width * weightFactor;
}

function estimateTopicCharWidth(char, fontSize) {
  if (/[\u2e80-\u9fff\uff00-\uffef]/.test(char)) return fontSize * 1.12;
  if (/\s/.test(char)) return fontSize * 0.36;
  if (/[mwMW@#%&]/.test(char)) return fontSize * 0.86;
  if (/[A-Z0-9]/.test(char)) return fontSize * 0.68;
  if (/[.,;:!?'"`|()[\]{}]/.test(char)) return fontSize * 0.38;
  return fontSize * 0.58;
}
