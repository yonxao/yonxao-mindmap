/*
 * 插件兼容出口：Markdown 围栏定位、替换和恢复插入由公共核心统一实现。
 */
export {
  findClosingFence,
  findFenceBySection,
  findFenceBySource,
  insertCodeBlockAfterSource,
  matchOpeningFence,
  normalizeEol,
  replaceCodeBlockSource,
  replaceFenceInnerLines,
} from '@yonxao/mindmap-core';
