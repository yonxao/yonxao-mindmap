/*
 * 文件作用：
 * 这里负责在完整 Markdown 文档中定位当前 yxmm 代码块，并只替换代码块内部源码。
 *
 * 为什么独立成文件：
 * 保存源码时最怕误改同一篇文档里的另一个代码块。
 * 因此这里优先使用 Obsidian sectionInfo 提供的行号范围；如果拿不到范围，再用旧源码内容兜底匹配。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer.saveSourceToMarkdownFile() -> replaceCodeBlockSource() -> vault.modify()
 */

import { clamp } from '../utils/math.js';

/*
 * 作用：
 * 在完整 Markdown 文本中替换当前 yxmm 代码块内部源码。
 *
 * 调用链：
 * YonxaoMindmapRenderer.saveSourceToMarkdownFile() -> replaceCodeBlockSource() -> vault.modify()。
 *
 * 实现逻辑：
 * 优先通过 Obsidian sectionInfo 定位代码块；失败后再用旧源码内容匹配，降低误替换风险。
 */
export function replaceCodeBlockSource(
  markdown,
  codeBlockName,
  oldSource,
  nextSource,
  sectionInfo
) {
  // 这个函数只做一件事：在完整 Markdown 文件里，找到当前 ```yxmm 代码块，
  // 然后只替换围栏中间的源码内容，保留 ```yxmm 和结尾 ``` 不变。
  //
  // 为什么不直接用 markdown.replace(oldSource, nextSource)？
  // 因为同一个文件里可能有多个一模一样的 yxmm 代码块，直接 replace 可能改错位置。
  // 所以优先使用 Obsidian 提供的 sectionInfo 行号定位；定位不到时才退回到源码匹配。
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n';
  const lines = markdown.split(/\r?\n/);

  const fenceBySection = findFenceBySection(lines, codeBlockName, sectionInfo);
  if (fenceBySection) {
    return replaceFenceInnerLines(lines, fenceBySection, nextSource, eol);
  }

  const fenceBySource = findFenceBySource(lines, codeBlockName, oldSource, eol);
  if (fenceBySource) {
    return replaceFenceInnerLines(lines, fenceBySource, nextSource, eol);
  }

  return null;
}

/*
 * 作用：
 * 根据 Obsidian 提供的 sectionInfo 行号范围，向上查找当前代码块的 opening fence。
 *
 * 调用链：
 * replaceCodeBlockSource() -> findFenceBySection() -> findClosingFence()。
 */
export function findFenceBySection(lines, codeBlockName, sectionInfo) {
  if (!sectionInfo) return null;

  const sectionStart = clamp(sectionInfo.lineStart || 0, 0, lines.length - 1);
  const sectionEnd = clamp(sectionInfo.lineEnd || sectionStart, sectionStart, lines.length - 1);

  // 从 section 起点向上找 opening fence。Obsidian 的 sectionInfo 通常包含代码块行号，
  // 但不同版本里 lineStart 可能指向开头 fence，也可能指向代码块内容，所以这里向上兼容查找。
  for (let start = sectionStart; start >= 0; start -= 1) {
    const opening = matchOpeningFence(lines[start], codeBlockName);
    if (!opening) continue;

    const end = findClosingFence(lines, start + 1, opening.marker);
    if (end !== -1 && end >= sectionEnd) {
      return { start, end };
    }
  }

  return null;
}

/*
 * 作用：
 * 当 sectionInfo 不可用时，通过旧源码内容扫描并定位目标代码块。
 *
 * 实现逻辑：
 * 遍历所有同语言 fence，把内部文本标准化换行后与 oldSource 比较。
 */
export function findFenceBySource(lines, codeBlockName, oldSource, eol) {
  // 兜底策略：扫描文件里所有 yxmm 代码块，找内部源码和当前渲染源码一致的那一个。
  const normalizedOldSource = normalizeEol(oldSource);

  for (let start = 0; start < lines.length; start += 1) {
    const opening = matchOpeningFence(lines[start], codeBlockName);
    if (!opening) continue;

    const end = findClosingFence(lines, start + 1, opening.marker);
    if (end === -1) continue;

    const inner = lines.slice(start + 1, end).join(eol);
    if (normalizeEol(inner) === normalizedOldSource) {
      return { start, end };
    }

    // 已经处理过这个 fence，直接跳到 closing fence 后面继续扫描。
    start = end;
  }

  return null;
}

/*
 * 作用：
 * 替换 fence.start 与 fence.end 中间的源码行，并保留代码块围栏本身。
 *
 * 调用链：
 * findFenceBySection/findFenceBySource 找到范围后，由 replaceCodeBlockSource 调用。
 */
export function replaceFenceInnerLines(lines, fence, nextSource, eol) {
  const nextLines = nextSource.split(/\r?\n/);
  const replaced = [...lines];
  replaced.splice(fence.start + 1, fence.end - fence.start - 1, ...nextLines);
  return replaced.join(eol);
}

/*
 * 作用：
 * 判断某一行是否是指定语言的 opening fence，例如 ```yxmm 或 ~~~yxmm。
 */
export function matchOpeningFence(line, codeBlockName) {
  const match = String(line).match(/^(\s*)(`{3,}|~{3,})\s*([^\s`~]*)/);
  if (!match || match[3] !== codeBlockName) return null;
  return { marker: match[2] };
}

/*
 * 作用：
 * 从 opening fence 后面查找 matching closing fence。
 *
 * 实现逻辑：
 * closing fence 必须使用相同字符，并且长度不小于 opening fence。
 */
export function findClosingFence(lines, fromIndex, openingMarker) {
  const fenceChar = openingMarker[0];
  const minLength = openingMarker.length;

  for (let index = fromIndex; index < lines.length; index += 1) {
    const trimmed = String(lines[index]).trim();
    if (!trimmed) continue;
    if (trimmed[0] !== fenceChar) continue;
    if (trimmed.length < minLength) continue;
    if (new RegExp(`^\\${fenceChar}{${minLength},}\\s*$`).test(trimmed)) {
      return index;
    }
  }

  return -1;
}

/*
 * 作用：
 * 把 CRLF 统一成 LF，确保不同系统换行符不会影响源码匹配。
 */
export function normalizeEol(text) {
  return String(text || '').replace(/\r\n/g, '\n');
}
