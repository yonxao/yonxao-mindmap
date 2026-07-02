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
 * 英文优先按单词拆，中文和中英文混排按字符切分。
 */
export function wrapTopicText(text, maxUnits) {
  const hardLines = normalizeHardLines(text);
  if (!hardLines.length) return ['Untitled'];

  return hardLines.flatMap((line) => wrapSingleTopicLine(line, maxUnits));
}

/*
 * 作用：
 * 把单个硬换行段拆成视觉宽度合适的多行。
 */
function wrapSingleTopicLine(text, maxUnits) {
  const normalized = normalizeHorizontalWhitespace(text);
  if (!normalized) return [];

  // 英文优先按单词自动折行；中文或中英文混排时，空格只作为普通行内字符。
  const wrapByWords = shouldWrapByWords(normalized);
  const words = wrapByWords ? normalized.split(' ') : Array.from(normalized);
  const lines = [];
  let line = '';

  for (const word of words) {
    const separator = wrapByWords && line ? ' ' : '';
    const next = line ? `${line}${separator}${word}` : word;

    if (line && visualUnits(next) > maxUnits) {
      pushWrappedLine(lines, line);
      line = word;
    } else {
      line = next;
    }

    while (visualUnits(line) > maxUnits) {
      const split = splitByUnits(line, maxUnits);
      pushWrappedLine(lines, split.head);
      line = trimLineStart(split.tail);
    }
  }

  pushWrappedLine(lines, line);
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
  const hardLines = normalizeHardLines(text);
  if (!hardLines.length) return ['Untitled'];

  return hardLines.flatMap((line) => wrapSingleTopicLineByWidth(line, maxWidth, font));
}

/*
 * 作用：
 * 按像素宽度拆分单个硬换行段。
 */
function wrapSingleTopicLineByWidth(text, maxWidth, font) {
  const normalized = normalizeHorizontalWhitespace(text);
  if (!normalized) return [];

  const wrapByWords = shouldWrapByWords(normalized);
  const words = wrapByWords ? normalized.split(' ') : Array.from(normalized);
  const lines = [];
  let line = '';

  for (const word of words) {
    const separator = wrapByWords && line ? ' ' : '';
    const next = line ? `${line}${separator}${word}` : word;

    if (line && estimateTopicTextWidth(next, font) > maxWidth) {
      pushWrappedLine(lines, line);
      line = word;
    } else {
      line = next;
    }

    while (estimateTopicTextWidth(line, font) > maxWidth) {
      const split = splitByEstimatedWidth(line, maxWidth, font);
      pushWrappedLine(lines, split.head);
      line = trimLineStart(split.tail);
    }
  }

  pushWrappedLine(lines, line);
  return lines;
}

/*
 * 作用：
 * 只把真实换行作为硬换行；空格、两个空格或 Tab 都只算行内空白。
 */
function normalizeHardLines(text) {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => normalizeHorizontalWhitespace(line))
    .filter(Boolean);
}

/*
 * 作用：
 * 归一化行内空白，但不把空白当成换行语义。
 */
function normalizeHorizontalWhitespace(text) {
  return String(text || '')
    .replace(/[^\S\r\n]+/g, ' ')
    .trim();
}

/*
 * CJK（中日韩统一表意文字）与全角字符的范围正则，用于判断文本是否需要按字符折行。
 * 该正则覆盖了中文、日文、韩文以及全角标点字符。
 */
const CJK_OR_FULLWIDTH_RE = /[\u2e80-\u9fff\uff00-\uffef]/;

/*
 * 作用：
 * 只有纯英文/拉丁文本才按单词折行；中文文本里的空格不能提前截断一整行。
 */
function shouldWrapByWords(text) {
  return text.includes(' ') && !CJK_OR_FULLWIDTH_RE.test(text);
}

function pushWrappedLine(lines, line) {
  const normalized = trimLineEnd(line);
  if (normalized) lines.push(normalized);
}

function trimLineStart(text) {
  return String(text || '').replace(/^[^\S\r\n]+/, '');
}

function trimLineEnd(text) {
  return String(text || '').replace(/[^\S\r\n]+$/, '');
}

/*
 * 作用：
 * 把编辑器里的主题文本归一成 yxmm 正文区可安全保存的文本。
 */
export function normalizeTopicTextForStorage(text) {
  const lines = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd());

  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join('\n');
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
    count += CJK_OR_FULLWIDTH_RE.test(char) ? 2 : 1;
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
  let cjkWidth = 0;
  let otherWidth = 0;

  for (const char of Array.from(String(text))) {
    if (CJK_OR_FULLWIDTH_RE.test(char)) {
      cjkWidth += estimateTopicCharWidth(char, fontSize);
    } else {
      otherWidth += estimateTopicCharWidth(char, fontSize);
    }
  }

  // CJK 字符宽度不随字重变化（加粗不增宽），只有拉丁/数字等才受字重影响
  return cjkWidth + otherWidth * weightFactor;
}

function estimateTopicCharWidth(char, fontSize) {
  if (CJK_OR_FULLWIDTH_RE.test(char)) return fontSize * 1.0;
  if (/\s/.test(char)) return fontSize * 0.36;
  if (/[mwMW@#%&]/.test(char)) return fontSize * 0.86;
  if (/[A-Z0-9]/.test(char)) return fontSize * 0.68;
  if (/[.,;:!?'"`|()[\]{}]/.test(char)) return fontSize * 0.38;
  return fontSize * 0.58;
}
