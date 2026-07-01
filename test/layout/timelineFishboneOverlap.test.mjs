import test from 'node:test';
import assert from 'node:assert/strict';

import { layoutTree } from '../../src/layout/layoutTree.js';
import { parseMindDocument } from '../../src/parser/parseMind.js';
import { TOPIC_PADDING_X } from '../../src/constants.js';

// 和渲染层 TIMELINE_MIN_TRUNK_X 保持一致，用于测试时间轴详情主干的几何位置。
const TIMELINE_TEST_MIN_TRUNK_X = 6;

const OVERLAP_SAMPLE_BODY = `# yonxao
-
mindmap
## 好的
### 放在
### 放大
#### 新主题
#### 放大
到撒
## 这个
现在
是长不错
### 饭打
看看了
### 大粉啊
房东啊
## 发大水
到撒
发动
### 放在
#### 新主题
#### 新主题
##### 新主题
##### 新主题
###### 新主题
###### 新主题
### 兰陵
发动机
#### 新主题
##### 饭打
看看了
## 发大水
房东发
### 大分
#### 新主题
### 发大水
### 新主题
## 新主题
## 新主题
## 哈哈哈
这个可是真的太好笑了`;

for (const layout of ['timeline-up', 'timeline-down', 'fishbone-left', 'fishbone-right']) {
  test(`${layout} keeps visible topic cards from overlapping`, () => {
    const document = parseMindDocument(`---
structure:
  layout: ${layout}
---

${OVERLAP_SAMPLE_BODY}`);
    const result = layoutTree(document.root, new Set(), document.config);

    assert.deepEqual(findOverlappingTopicTexts(result.topics), []);
    if (layout.startsWith('timeline')) {
      assert.deepEqual(findTimelineDetailTrunkHits(result), []);
    }
  });
}

function findOverlappingTopicTexts(topics) {
  const overlaps = [];

  for (let firstIndex = 0; firstIndex < topics.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < topics.length; secondIndex += 1) {
      const firstTopic = topics[firstIndex];
      const secondTopic = topics[secondIndex];

      if (topicBoxesOverlap(firstTopic, secondTopic)) {
        overlaps.push(`${firstTopic.text} <-> ${secondTopic.text}`);
      }
    }
  }

  return overlaps;
}

function topicBoxesOverlap(firstTopic, secondTopic) {
  const first = topicBounds(firstTopic);
  const second = topicBounds(secondTopic);

  return (
    first.left < second.right &&
    first.right > second.left &&
    first.top < second.bottom &&
    first.bottom > second.top
  );
}

function topicBounds(topic) {
  const box = topic._layout;
  return {
    left: box.x - box.width / 2,
    right: box.x + box.width / 2,
    top: box.y - box.height / 2,
    bottom: box.y + box.height / 2,
  };
}

function findTimelineDetailTrunkHits(layoutResult) {
  const connectorGroups = new Map();

  for (const connector of layoutResult.connectors) {
    const side = connector.subtopic?._layout?.side;
    if (side !== 'timeline-detail-top' && side !== 'timeline-detail-bottom') continue;
    if (connector.subtopic?._layout?.branchExpansion === 'side') continue;
    if (connector.subtopic?._layout?.branchExpansion === 'hanging') continue;
    if (!connectorGroups.has(connector.parentTopic.id)) {
      connectorGroups.set(connector.parentTopic.id, []);
    }
    connectorGroups.get(connector.parentTopic.id).push(connector);
  }

  const hits = [];
  for (const connectors of connectorGroups.values()) {
    const parentTopic = connectors[0]?.parentTopic;
    const parentBox = parentTopic?._layout;
    if (!parentTopic || !parentBox) continue;

    const subtopicBoxes = connectors.map((connector) => connector.subtopic._layout);
    const trunkX = timelineDetailBranchX(parentBox, subtopicBoxes);
    const firstSide = connectors[0].subtopic._layout.side;
    const isDetailParent =
      parentBox.side === 'timeline-detail-top' || parentBox.side === 'timeline-detail-bottom';
    const startY = isDetailParent
      ? parentBox.y
      : firstSide === 'timeline-detail-top'
        ? parentBox.y - parentBox.height / 2
        : parentBox.y + parentBox.height / 2;
    const subtopicYs = connectors.map((connector) => connector.subtopic._layout.y);
    const trunkStartY = isDetailParent ? Math.min(...subtopicYs) : startY;
    const trunkEndY = isDetailParent
      ? Math.max(...subtopicYs)
      : firstSide === 'timeline-detail-top'
        ? Math.min(...subtopicYs)
        : Math.max(...subtopicYs);

    for (const topic of layoutResult.topics) {
      if (topic === parentTopic) continue;
      if (connectors.some((connector) => connector.subtopic === topic)) continue;
      if (verticalLineIntersectsTopic(trunkX, trunkStartY, trunkEndY, topic)) {
        hits.push(`${parentTopic.text} trunk <-> ${topic.text}`);
      }
    }
  }

  return hits;
}

function timelineDetailBranchX(parentBox, subtopicBoxes = []) {
  if (parentBox.side !== 'timeline-detail-top' && parentBox.side !== 'timeline-detail-bottom') {
    return parentBox.x;
  }

  const parentRight = parentBox.x + parentBox.width / 2;
  const preferredX = parentRight + TOPIC_PADDING_X;
  if (!subtopicBoxes.length) return preferredX;

  const firstSubtopicLeft = Math.min(...subtopicBoxes.map((box) => box.x - box.width / 2));
  const available = firstSubtopicLeft - parentRight;
  if (available <= TOPIC_PADDING_X) {
    return parentRight + Math.max(TIMELINE_TEST_MIN_TRUNK_X, available / 2);
  }

  return Math.min(preferredX, firstSubtopicLeft - TOPIC_PADDING_X / 2);
}

function verticalLineIntersectsTopic(x, startY, endY, topic) {
  const bounds = topicBounds(topic);
  const top = Math.min(startY, endY);
  const bottom = Math.max(startY, endY);

  return x > bounds.left && x < bounds.right && bottom > bounds.top && top < bounds.bottom;
}
