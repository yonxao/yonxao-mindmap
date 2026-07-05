import test from 'node:test';
import assert from 'node:assert/strict';

import { TOPIC_PADDING_X } from '../../src/constants.js';
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

test('explicit image width can expand a topic beyond the default text width', () => {
  const document = parseMindDocument(`# 图片宽度
## 默认图片
![规则类型](testpng.png)
## 指定宽度
![规则类型](testpng.png|320)`);

  const result = layoutTree(document.root, new Set(), document.config);
  const defaultTopic = findTopicByText(result.topics, '默认图片\n![规则类型](testpng.png)');
  const wideTopic = findTopicByText(result.topics, '指定宽度\n![规则类型](testpng.png|320)');

  assert.ok(defaultTopic, 'expected default image topic to be visible');
  assert.ok(wideTopic, 'expected explicit-width image topic to be visible');
  assert.equal(findImageBlock(wideTopic).imageWidth, 320);
  assert.ok(wideTopic._layout.width >= 320 + TOPIC_PADDING_X * 2);
  assert.ok(wideTopic._layout.width > defaultTopic._layout.width);
});

function findTopicByText(topics, text) {
  return topics.find((topic) => topic.text === text);
}

function findImageBlock(topic) {
  return topic._layout.richBlocks.find((block) => block.type === 'image');
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
