/*
 * 文件作用：
 * 生成可直接粘贴到 Markdown 中的完整 yxmm 代码块文本。
 *
 * 调用链：
 * copyTextMethods.copyFullSource() -> formatFencedMindMapSource() -> Clipboard API。
 */

import { CODE_BLOCK_NAME } from '../../constants.js';

export function formatFencedMindMapSource(source) {
  const openingFence = `\`\`\`${CODE_BLOCK_NAME}`;
  const normalizedSource = String(source || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n*$/, '');

  if (!normalizedSource) {
    return `${openingFence}\n\`\`\``;
  }

  return `${openingFence}\n${normalizedSource}\n\`\`\``;
}
