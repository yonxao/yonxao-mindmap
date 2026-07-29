/*
 * 插件兼容入口。文本归一化、宽度估算和自动换行属于跨端公共语义，
 * 唯一实现位于 TypeScript core；保留此文件避免现有插件导入路径发生变化。
 */
export {
  CJK_OR_FULLWIDTH_RE,
  estimateTopicTextWidth,
  normalizeTopicTextForStorage,
  shouldWrapByWords,
  splitByEstimatedWidth,
  splitByUnits,
  visualUnits,
  wrapTopicText,
  wrapTopicTextByWidth,
} from '@yonxao/mindmap-core';
