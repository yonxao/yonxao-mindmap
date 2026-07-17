/*
 * 文件作用：
 * 构造主题剪贴板快照，并根据复制方式决定普通粘贴是否恢复完整子树。
 */

import { createMindTopic } from '../parser/parseMind.js';
import { serializeTopic } from '../parser/serializeMind.js';
import { cloneTopicSubtree } from './topicTreeActions.js';

export const TOPIC_CLIPBOARD_MODE = Object.freeze({
  TEXT: 'text',
  CUT_SUBTREE: 'cut-subtree',
  COPY_WITH_ATTRIBUTES: 'copy-with-attributes',
});

/*
 * 普通复制只保存主题文字；剪切和带属性复制保存完整子树。
 * 完整子树写入系统剪贴板时使用 yxmm 主题语法，避免属性和子主题丢失。
 */
export function createTopicClipboardEntry(topic, mode = TOPIC_CLIPBOARD_MODE.TEXT) {
  if (!topic) return null;

  const includeTree = mode !== TOPIC_CLIPBOARD_MODE.TEXT;
  const topicSnapshot = cloneTopicSubtree(topic, {
    includeAttributes: includeTree,
    includeSubtopics: includeTree,
  });
  const text = topic.text || '';

  return {
    mode,
    text,
    systemText: includeTree ? serializeTopic(topicSnapshot, 0) : text,
    topicSnapshot,
  };
}

/*
 * Ctrl/Cmd+V 在剪切后恢复完整子树；在普通复制或带属性复制后仍保持纯文字粘贴。
 */
export function cloneTopicForStandardPaste(clipboardEntry, level) {
  if (!clipboardEntry) return null;
  if (clipboardEntry.mode === TOPIC_CLIPBOARD_MODE.CUT_SUBTREE) {
    return cloneTopicClipboardSnapshot(clipboardEntry, {
      includeAttributes: true,
      includeSubtopics: true,
    });
  }
  return createMindTopic(String(clipboardEntry.text || '').trim(), {}, [], 0, level);
}

/* 带属性粘贴始终按剪贴板快照恢复当前可用的属性和子主题。 */
export function cloneTopicForAttributedPaste(clipboardEntry) {
  return cloneTopicClipboardSnapshot(clipboardEntry, {
    includeAttributes: true,
    includeSubtopics: true,
  });
}

function cloneTopicClipboardSnapshot(clipboardEntry, options) {
  if (!clipboardEntry?.topicSnapshot) return null;
  return cloneTopicSubtree(clipboardEntry.topicSnapshot, options);
}
