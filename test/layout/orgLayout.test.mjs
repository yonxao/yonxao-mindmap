import test from 'node:test';
import assert from 'node:assert/strict';

import { layoutTree } from '../../src/layout/layoutTree.js';
import { parseMindDocument } from '../../src/parser/parseMind.js';

test('org-right natural expansion keeps descendant subtrees from overlapping siblings', () => {
  const document = parseMindDocument(`---
display:
  canvasHeight: 805
color:
  scheme: rainbow
structure:
  layout: org-right
---

# AI学习 [color=#f97316]
## 基础
## 新主题1 [color=#9e3529 fontFamily="'KaiTi', 'Kaiti SC', 'STKaiti', 'LXGW WenKai', serif"]
道赛方式
### 111
#### 新主题111
#### 新主题112
#### 新主题113
### 222
#### 新主21
#### 新主22
#### 新主23
#### 新主24
## AI 框架2
ASD asd`);

  const result = layoutTree(document.root, new Set(), document.config);
  const upperTopic = findTopicByText(result.topics, '新主题113');
  const lowerTopic = findTopicByText(result.topics, '新主21');

  assert.ok(upperTopic, 'expected the upper descendant topic to be visible');
  assert.ok(lowerTopic, 'expected the lower descendant topic to be visible');
  assert.equal(topicBoxesOverlap(upperTopic, lowerTopic), false);
});

function findTopicByText(topics, text) {
  return topics.find((topic) => topic.text === text);
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
