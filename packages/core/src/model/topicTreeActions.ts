import type { MindTopic, TopicAttributes } from './types.js';

export interface TopicContext {
  topic: MindTopic;
  parent: MindTopic | null;
  index: number;
}

export interface CloneTopicSubtreeOptions {
  includeAttributes?: boolean;
  includeSubtopics?: boolean;
}

export type TopicMovePlacement = 'subtopic' | 'before' | 'after';

export function setOptionalTopicAttribute(
  attributes: TopicAttributes,
  key: string,
  value: unknown
): void {
  const normalized = String(value || '').trim();
  if (normalized) {
    attributes[key] = normalized;
  } else {
    delete attributes[key];
  }
}

export function removeTopicById(root: MindTopic, id: string): boolean {
  for (let index = 0; index < root.subtopics.length; index += 1) {
    const subtopic = root.subtopics[index];
    if (subtopic.id === id) {
      root.subtopics.splice(index, 1);
      return true;
    }

    if (removeTopicById(subtopic, id)) return true;
  }

  return false;
}

export function findTopicContext(
  root: MindTopic | null | undefined,
  id: string,
  parent: MindTopic | null = null
): TopicContext | null {
  if (!root) return null;
  if (root.id === id) {
    return {
      topic: root,
      parent,
      index: -1,
    };
  }

  for (let index = 0; index < root.subtopics.length; index += 1) {
    const subtopic = root.subtopics[index];
    if (subtopic.id === id) {
      return {
        topic: subtopic,
        parent: root,
        index,
      };
    }

    const found = findTopicContext(subtopic, id, subtopic);
    if (found) return found;
  }

  return null;
}

export function insertSiblingTopic(
  root: MindTopic,
  targetId: string,
  sibling: MindTopic,
  position: 'before' | 'after' = 'after'
): boolean {
  const context = findTopicContext(root, targetId);
  if (!context?.parent || context.index < 0) return false;

  const insertIndex = position === 'before' ? context.index : context.index + 1;
  context.parent.subtopics.splice(insertIndex, 0, sibling);
  return true;
}

export function cloneTopicSubtree(
  topic: MindTopic | null | undefined,
  options: CloneTopicSubtreeOptions = {}
): MindTopic | null {
  if (!topic) return null;

  const includeAttributes = Boolean(options.includeAttributes);
  const includeSubtopics = Boolean(options.includeSubtopics);
  const attributes = includeAttributes ? { ...(topic.attributes || {}) } : {};
  // 稳定主题 ID 只标识原主题；复制子树时必须移除，避免粘贴后出现重复引用目标。
  delete attributes.id;
  const subtopics = includeSubtopics
    ? topic.subtopics
        .map((subtopic) => cloneTopicSubtree(subtopic, options))
        .filter((subtopic): subtopic is MindTopic => Boolean(subtopic))
    : [];

  return {
    id: '',
    text: topic.text || '',
    attributes,
    subtopics,
    line: 0,
    level: topic.level || 1,
    _layout: null,
    _virtual: false,
  };
}

export function containsTopicId(
  parentTopic: MindTopic | null | undefined,
  targetId: string
): boolean {
  if (!parentTopic || !parentTopic.subtopics.length) return false;

  for (const subtopic of parentTopic.subtopics) {
    if (subtopic.id === targetId || containsTopicId(subtopic, targetId)) {
      return true;
    }
  }

  return false;
}

export function moveTopicInTree(
  root: MindTopic,
  movingTopicId: string,
  targetId: string,
  placement: TopicMovePlacement
): boolean {
  const movingTopicContext = findTopicContext(root, movingTopicId);
  if (!movingTopicContext?.parent || movingTopicContext.index < 0) {
    return false;
  }
  if (movingTopicId === targetId || containsTopicId(movingTopicContext.topic, targetId)) {
    return false;
  }

  const movingTopic = movingTopicContext.topic;
  movingTopicContext.parent.subtopics.splice(movingTopicContext.index, 1);

  if (placement === 'subtopic') {
    const targetTopicContext = findTopicContext(root, targetId);
    if (!targetTopicContext) {
      movingTopicContext.parent.subtopics.splice(movingTopicContext.index, 0, movingTopic);
      return false;
    }

    targetTopicContext.topic.subtopics.push(movingTopic);
    refreshTreeLevels(root);
    return true;
  }

  const targetTopicContext = findTopicContext(root, targetId);
  if (!targetTopicContext?.parent || targetTopicContext.index < 0) {
    movingTopicContext.parent.subtopics.splice(movingTopicContext.index, 0, movingTopic);
    return false;
  }

  const insertIndex =
    placement === 'before' ? targetTopicContext.index : targetTopicContext.index + 1;
  targetTopicContext.parent.subtopics.splice(insertIndex, 0, movingTopic);
  refreshTreeLevels(root);
  return true;
}

export function refreshTreeLevels(
  root: MindTopic | null | undefined,
  level = root?._virtual ? 0 : 1
): void {
  if (!root) return;

  root.level = level;
  for (const subtopic of root.subtopics) {
    refreshTreeLevels(subtopic, level + 1);
  }
}

export function countTopicDescendants(topic: MindTopic | null | undefined): number {
  if (!topic || !topic.subtopics.length) return 0;

  return topic.subtopics.reduce(
    (total, subtopic) => total + 1 + countTopicDescendants(subtopic),
    0
  );
}
