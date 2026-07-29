/*
 * 源码编辑器适配：层级文本变换由公共核心统一，插件只负责 textarea 写回。
 */
import { adjustTopicLevel, adjustTopicLevelSelectionText } from '@yonxao/mindmap-core';

export { adjustTopicLevel };

export function applyTopicLevelKey(textarea, isOutdent) {
  adjustTopicLevelSelection(textarea, isOutdent);
}

export function adjustTopicLevelSelection(textarea, isOutdent) {
  const edit = adjustTopicLevelSelectionText(
    textarea.value,
    textarea.selectionStart,
    textarea.selectionEnd,
    isOutdent
  );
  if (!edit.changed) return false;

  textarea.setRangeText(edit.replacementText, edit.replacementStart, edit.replacementEnd, 'select');
  textarea.selectionStart = edit.selectionStart;
  textarea.selectionEnd = edit.selectionEnd;
  return true;
}
