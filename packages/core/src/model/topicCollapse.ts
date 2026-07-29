import { forEachTopicWithSubtopics } from './topicTraversal.js';
import type { MindTopic } from './types.js';

export function toggleTopicCollapsed(
  collapsedIds: Set<string>,
  topic: MindTopic | null | undefined
): boolean {
  if (!topic?.subtopics.length) return false;
  if (collapsedIds.has(topic.id)) collapsedIds.delete(topic.id);
  else collapsedIds.add(topic.id);
  return true;
}

export function collapseTopicDescendants(
  collapsedIds: Set<string>,
  topic: MindTopic | null | undefined
): boolean {
  let changed = false;
  forEachTopicWithSubtopics(topic, (current) => {
    if (!collapsedIds.has(current.id)) {
      collapsedIds.add(current.id);
      changed = true;
    }
  });
  return changed;
}

export function expandTopicDescendants(
  collapsedIds: Set<string>,
  topic: MindTopic | null | undefined
): boolean {
  let changed = false;
  forEachTopicWithSubtopics(topic, (current) => {
    if (collapsedIds.delete(current.id)) changed = true;
  });
  return changed;
}

export function resetCollapsedTopics(collapsedIds: Set<string>): boolean {
  if (!collapsedIds.size) return false;
  collapsedIds.clear();
  return true;
}
