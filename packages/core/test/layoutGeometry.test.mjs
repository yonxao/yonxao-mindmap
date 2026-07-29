import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HANGING_SIBLING_GAP,
  LEVEL_GAP,
  SIBLING_GAP,
  TOPIC_MIN_WIDTH,
  collectVisible,
  computeBounds,
  horizontalSubtreeExtent,
  radialCollisionPush,
  radialSegmentIntersectsBounds,
  radialTopicBounds,
  shouldUseHangingExpansion,
  translateRadialSubtree,
  verticalSubtreeExtent,
  visibleSubtopics,
} from '@yonxao/mindmap-core';

function createLayoutTopic(id, x, y, subtopics = []) {
  return {
    id,
    subtopics,
    _layout: { x, y, width: 80, height: 40 },
  };
}

test('public core collects visible layout topics and computes their bounds', () => {
  const hidden = createLayoutTopic('hidden', 240, 0);
  const child = createLayoutTopic('child', 120, 60, [hidden]);
  const root = createLayoutTopic('root', 0, 0, [child]);
  const topics = [];
  const connectors = [];

  collectVisible(root, new Set(['child']), topics, connectors);

  assert.deepEqual(
    topics.map((topic) => topic.id),
    ['root', 'child']
  );
  assert.deepEqual(
    connectors.map(({ parentTopic, subtopic }) => `${parentTopic.id}:${subtopic.id}`),
    ['root:child']
  );
  assert.deepEqual(computeBounds(topics), {
    minX: -40,
    minY: -20,
    maxX: 160,
    maxY: 80,
  });
  assert.deepEqual(visibleSubtopics(child, new Set(['child'])), []);
});

test('public core exposes deterministic radial collision and translation geometry', () => {
  const fixed = radialTopicBounds({ x: 0, y: 0, width: 100, height: 100 });
  const moving = radialTopicBounds({ x: 80, y: 0, width: 100, height: 100 });
  assert.deepEqual(radialCollisionPush(fixed, moving), { dx: 21, dy: 0 });
  assert.equal(radialSegmentIntersectsBounds({ x: -100, y: 0 }, { x: 100, y: 0 }, fixed), true);

  const child = createLayoutTopic('child', 20, 30);
  const root = createLayoutTopic('root', 0, 0, [child]);
  translateRadialSubtree(root, 10, -5, new Set());
  assert.deepEqual(
    [root._layout.x, root._layout.y, child._layout.x, child._layout.y],
    [10, -5, 30, 25]
  );
});

test('public core owns layout constants and asymmetric subtree extents', () => {
  assert.deepEqual(
    { LEVEL_GAP, SIBLING_GAP, TOPIC_MIN_WIDTH, HANGING_SIBLING_GAP },
    { LEVEL_GAP: 84, SIBLING_GAP: 18, TOPIC_MIN_WIDTH: 92, HANGING_SIBLING_GAP: 19 }
  );

  const grandchild = { ...createLayoutTopic('grandchild', 0, 0), level: 3 };
  const child = { ...createLayoutTopic('child', 0, 0, [grandchild]), level: 2 };
  const root = { ...createLayoutTopic('root', 0, 0, [child]), level: 1 };

  assert.equal(shouldUseHangingExpansion(grandchild, 'hanging'), true);
  assert.deepEqual(horizontalSubtreeExtent(root, 'right', new Set(), 'side'), {
    above: 20,
    below: 20,
    height: 40,
  });
  assert.deepEqual(verticalSubtreeExtent(root, 'bottom', new Set(['child']), 'side'), {
    left: 40,
    right: 40,
    width: 80,
  });
});
