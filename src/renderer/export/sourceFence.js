/*
 * 插件兼容出口：生成 Markdown yxmm 围栏文本的规则由公共核心统一。
 */
import { formatFencedMindMapSource as formatCoreFencedMindMapSource } from '@yonxao/mindmap-core';

import { CODE_BLOCK_NAME } from '../../constants.js';

export function formatFencedMindMapSource(source) {
  return formatCoreFencedMindMapSource(source, CODE_BLOCK_NAME);
}
