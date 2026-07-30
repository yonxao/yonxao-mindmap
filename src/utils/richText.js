/*
 * 插件兼容入口。主题内容语义、富文本折行和块级盒模型均由 TypeScript core
 * 统一实现；Obsidian 资源解析通过 wrapTopicRichBlocksByWidth() 的回调注入。
 */
export {
  INLINE_TOPIC_COLOR_OPTIONS,
  INLINE_TOPIC_COLOR_VALUES,
  TOPIC_CODE_BLOCK_PADDING_X,
  TOPIC_CODE_BLOCK_PADDING_Y,
  TOPIC_RICH_BLOCK_TYPES,
  TOPIC_RICH_TEXT_CODE_FONT_FAMILY,
  estimateRichLineWidth,
  normalizeInlineTopicColor,
  parseTopicRichBlocks,
  parseTopicRichText,
  richLineToPlainText,
  topicRichTextLinkMarker,
  topicRichTextPreferredContentWidth,
  topicRichTextToPlainText,
  wrapTopicRichBlocksByWidth,
  wrapTopicRichTextByWidth,
} from '@yonxao/mindmap-core';
