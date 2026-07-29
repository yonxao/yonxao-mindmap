import { visibleSubtopics } from '../model/topicTraversal.js';
import type { LayoutBounds, LayoutConnector, LayoutTopic } from './layoutTypes.js';

const DEFAULT_BOUNDS_MIN_X = -120;
const DEFAULT_BOUNDS_MIN_Y = -80;
const DEFAULT_BOUNDS_WIDTH = 240;
const DEFAULT_BOUNDS_HEIGHT = 160;

export function collectVisible<TTopic extends LayoutTopic & { subtopics: TTopic[] }>(
  topic: TTopic,
  collapsedIds: ReadonlySet<string>,
  topics: TTopic[],
  connectors: Array<LayoutConnector<TTopic>>
): void {
  topics.push(topic);
  for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
    connectors.push({ parentTopic: topic, subtopic });
    collectVisible(subtopic, collapsedIds, topics, connectors);
  }
}

export function computeBounds(topics: readonly LayoutTopic[]): LayoutBounds {
  if (!topics.length) {
    return {
      minX: DEFAULT_BOUNDS_MIN_X,
      minY: DEFAULT_BOUNDS_MIN_Y,
      maxX: DEFAULT_BOUNDS_MIN_X + DEFAULT_BOUNDS_WIDTH,
      maxY: DEFAULT_BOUNDS_MIN_Y + DEFAULT_BOUNDS_HEIGHT,
    };
  }

  return topics.reduce<LayoutBounds>(
    (bounds, topic) => {
      const box = topic._layout;
      bounds.minX = Math.min(bounds.minX, box.x - box.width / 2);
      bounds.maxX = Math.max(bounds.maxX, box.x + box.width / 2);
      bounds.minY = Math.min(bounds.minY, box.y - box.height / 2);
      bounds.maxY = Math.max(bounds.maxY, box.y + box.height / 2);
      return bounds;
    },
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    }
  );
}
