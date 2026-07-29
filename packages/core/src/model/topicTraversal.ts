import type { MindTopic } from './types.js';

export function forEachTopicWithSubtopics(
  topic: MindTopic | null | undefined,
  callback: (topic: MindTopic) => void
): void {
  if (!topic || !topic.subtopics.length) return;

  callback(topic);
  for (const subtopic of topic.subtopics) {
    forEachTopicWithSubtopics(subtopic, callback);
  }
}

export function visibleSubtopics<TTopic extends { id: string; subtopics: TTopic[] }>(
  topic: TTopic,
  collapsedIds: ReadonlySet<string>
): TTopic[] {
  if (collapsedIds.has(topic.id)) return [];
  return topic.subtopics;
}
