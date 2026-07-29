/*
 * 插件兼容出口：宿主无关的主题剪贴板数据转换实现在 @yonxao/mindmap-core。
 */
export {
  TOPIC_CLIPBOARD_MODE,
  cloneTopicForAttributedPaste,
  cloneTopicForStandardPaste,
  createTopicFromText,
  createTopicClipboardEntry,
  parseTopicsFromClipboardText,
} from '@yonxao/mindmap-core';
