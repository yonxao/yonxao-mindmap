import assert from 'node:assert/strict';
import test from 'node:test';

import { layoutTree } from '../../src/layout/layoutTree.js';
import {
  placeRadialDescendants,
  resolveRadialRootBranchCollisions,
} from '../../src/layout/radialLayout.js';
import {
  radialConnectorObstaclePush,
  radialSegmentIntersectsBounds,
  radialTopicBounds,
  radialVisibleSubtreeTopics,
} from '../../src/layout/radialGeometry.js';
import { nearestRelationAnchorForAngle } from '../../src/model/relationAnchors.js';
import { parseMindDocument } from '../../src/parser/parseMind.js';

function createTopic(id, subtopics = []) {
  return {
    id,
    subtopics,
    _layout: { x: 0, y: 0, width: 80, height: 40 },
  };
}

test('placeRadialDescendants preserves the child outlet angle when expanded or collapsed', () => {
  const child = createTopic('child');
  const parent = createTopic('parent', [child]);
  const angle = Math.PI / 3;

  placeRadialDescendants(parent, angle, new Set());
  assert.equal(parent._layout.radialChildAngle, angle);
  assert.equal(child._layout.radialAngle, angle);

  delete parent._layout.radialChildAngle;
  placeRadialDescendants(parent, angle, new Set([parent.id]));
  assert.equal(parent._layout.radialChildAngle, angle);
});

test('radialConnectorObstaclePush moves a branch out of a connector corridor', () => {
  const start = { x: 0, y: 0 };
  const end = { x: 0, y: -300 };
  const obstacleBox = { x: 0, y: -150, width: 80, height: 40 };

  assert.equal(radialSegmentIntersectsBounds(start, end, radialTopicBounds(obstacleBox)), true);
  assert.deepEqual(
    radialConnectorObstaclePush(start, end, [obstacleBox], { x: 100, y: -100 }, 10),
    { dx: 51, dy: 0 }
  );
});

test('resolveRadialRootBranchCollisions keeps root connectors out of other branches', () => {
  const root = createTopic('root');
  const connectorBranch = createTopic('connector');
  const obstacleChild = createTopic('obstacle-child');
  const obstacleBranch = createTopic('obstacle', [obstacleChild]);
  root.subtopics = [connectorBranch, obstacleBranch];

  Object.assign(root._layout, { x: 0, y: 0 });
  Object.assign(connectorBranch._layout, {
    x: 0,
    y: -300,
    radialAngle: -Math.PI / 2,
  });
  Object.assign(obstacleBranch._layout, { x: 100, y: -100, radialAngle: -Math.PI / 4 });
  Object.assign(obstacleChild._layout, { x: 0, y: -150, radialAngle: -Math.PI / 4 });

  resolveRadialRootBranchCollisions(root, root.subtopics, new Set());

  const connectorStart = { x: 0, y: -20 };
  const connectorEnd = { x: 0, y: -280 };
  assert.equal(
    radialSegmentIntersectsBounds(
      connectorStart,
      connectorEnd,
      radialTopicBounds(obstacleChild._layout, 10)
    ),
    false
  );
});

test('radial layout keeps dense root spokes out of neighboring branch topics', () => {
  const document = parseMindDocument(`---
structure:
  layout: radial
---

# 放射密集图
## 分支一
### 普通主题一
#### 下级主题一
#### 下级主题二
### 普通主题二
## 分支二
### 侧向内容
## 分支三
### 主题三一
### 主题三二
## 分支四
### 主题四一
#### 主题四一一
### 主题四二
## 分支五
### 主题五一
### 主题五二
## 分支六
### 主题六一
#### 主题六一一
#### 主题六一二
## 分支七
### 主题七一
## 分支八
### 主题八一
### 主题八二`);

  const result = layoutTree(document.root, new Set(), document.config);

  assert.deepEqual(findOverlappingTopicPairs(result.topics), []);
  assert.deepEqual(findRootConnectorTopicHits(document.root), []);
});

function findOverlappingTopicPairs(topics) {
  const overlaps = [];
  for (let firstIndex = 0; firstIndex < topics.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < topics.length; secondIndex += 1) {
      const first = radialTopicBounds(topics[firstIndex]._layout);
      const second = radialTopicBounds(topics[secondIndex]._layout);
      if (
        first.left < second.right &&
        first.right > second.left &&
        first.top < second.bottom &&
        first.bottom > second.top
      ) {
        overlaps.push(`${topics[firstIndex].text} <-> ${topics[secondIndex].text}`);
      }
    }
  }
  return overlaps;
}

function findRootConnectorTopicHits(root) {
  const hits = [];
  for (const connectorTopic of root.subtopics) {
    const angle = connectorTopic._layout.radialAngle;
    const start = nearestRelationAnchorForAngle(root._layout, angle);
    const end = nearestRelationAnchorForAngle(connectorTopic._layout, angle + Math.PI);

    for (const obstacleBranch of root.subtopics) {
      if (obstacleBranch === connectorTopic) continue;
      for (const obstacleTopic of radialVisibleSubtreeTopics(obstacleBranch, new Set())) {
        if (radialSegmentIntersectsBounds(start, end, radialTopicBounds(obstacleTopic._layout))) {
          hits.push(`${connectorTopic.text} -> ${obstacleTopic.text}`);
        }
      }
    }
  }
  return hits;
}
