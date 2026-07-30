import { createMindTopic } from '../parser/topicParser.js';
import { serializeTopic } from '../serializer/topicSerializer.js';
import { cloneTopicSubtree } from './topicTreeActions.js';
import { parseMindDocument } from '../parser/mindDocument.js';
import type { MindTopic } from './types.js';

export const TOPIC_CLIPBOARD_MODE = {
  TEXT: 'text',
  CUT_SUBTREE: 'cut-subtree',
  COPY_WITH_ATTRIBUTES: 'copy-with-attributes',
} as const;

export type TopicClipboardMode = (typeof TOPIC_CLIPBOARD_MODE)[keyof typeof TOPIC_CLIPBOARD_MODE];

export interface TopicClipboardEntry {
  mode: TopicClipboardMode;
  text: string;
  systemText: string;
  topicSnapshot: MindTopic;
}

export interface ParseClipboardTopicsOptions {
  includeAttributes?: boolean;
  includeSubtopics?: boolean;
}

export function createTopicClipboardEntry(
  topic: MindTopic | null | undefined,
  mode: TopicClipboardMode = TOPIC_CLIPBOARD_MODE.TEXT
): TopicClipboardEntry | null {
  if (!topic) return null;

  const includeTree = mode !== TOPIC_CLIPBOARD_MODE.TEXT;
  const topicSnapshot = cloneTopicSubtree(topic, {
    includeAttributes: includeTree,
    includeSubtopics: includeTree,
  });
  if (!topicSnapshot) return null;

  const text = topic.text || '';
  return {
    mode,
    text,
    systemText: includeTree ? serializeTopic(topicSnapshot, 0) : text,
    topicSnapshot,
  };
}

export function cloneTopicForStandardPaste(
  clipboardEntry: TopicClipboardEntry | null | undefined,
  level: number
): MindTopic | null {
  if (!clipboardEntry) return null;
  if (clipboardEntry.mode === TOPIC_CLIPBOARD_MODE.CUT_SUBTREE) {
    return cloneTopicClipboardSnapshot(clipboardEntry, {
      includeAttributes: true,
      includeSubtopics: true,
    });
  }
  return createMindTopic(String(clipboardEntry.text || '').trim(), {}, [], 0, level);
}

export function cloneTopicForAttributedPaste(
  clipboardEntry: TopicClipboardEntry | null | undefined
): MindTopic | null {
  return cloneTopicClipboardSnapshot(clipboardEntry, {
    includeAttributes: true,
    includeSubtopics: true,
  });
}

export function createTopicFromText(text: unknown, level: number): MindTopic {
  return createMindTopic(String(text ?? '').trim(), {}, [], 0, level);
}

/*
 * 系统剪贴板可能包含完整 yxmm、多个一级主题或普通文字。
 * 这里只解析合法 yxmm；普通文字由宿主按目标层级调用 createTopicFromText() 兜底。
 */
export function parseTopicsFromClipboardText(
  text: unknown,
  options: ParseClipboardTopicsOptions = {}
): MindTopic[] {
  const source = String(text ?? '').trim();
  if (!source) return [];

  try {
    const document = parseMindDocument(source);
    if (!document.root) return [];
    const topics = document.root._virtual ? document.root.subtopics : [document.root];
    return topics
      .map((topic) =>
        cloneTopicSubtree(topic, {
          includeAttributes: Boolean(options.includeAttributes),
          includeSubtopics: Boolean(options.includeSubtopics),
        })
      )
      .filter((topic): topic is MindTopic => Boolean(topic));
  } catch (_error) {
    return [];
  }
}

function cloneTopicClipboardSnapshot(
  clipboardEntry: TopicClipboardEntry | null | undefined,
  options: { includeAttributes: boolean; includeSubtopics: boolean }
): MindTopic | null {
  if (!clipboardEntry?.topicSnapshot) return null;
  return cloneTopicSubtree(clipboardEntry.topicSnapshot, options);
}
