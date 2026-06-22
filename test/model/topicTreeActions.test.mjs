import test from 'node:test';
import assert from 'node:assert/strict';

import { assignIds, createMindTopic } from '../../src/parser/parseMind.js';
import {
  containsTopicId,
  insertSiblingTopic,
  moveTopicInTree,
  removeTopicById,
} from '../../src/model/topicTreeActions.js';

function sampleTree() {
  const root = createMindTopic('Root', {}, [
    createMindTopic('A', {}, [createMindTopic('A1', {}, [], 0, 3)], 0, 2),
    createMindTopic('B', {}, [], 0, 2),
  ]);
  assignIds(root, '0');
  return root;
}

test('insertSiblingTopic inserts before and after target topic', () => {
  const root = sampleTree();
  assert.equal(insertSiblingTopic(root, '0.1', createMindTopic('C', {}, [], 0, 2), 'before'), true);
  assert.deepEqual(
    root.subtopics.map((topic) => topic.text),
    ['A', 'C', 'B']
  );
});

test('moveTopicInTree prevents moving a topic into its own descendant', () => {
  const root = sampleTree();
  assert.equal(containsTopicId(root.subtopics[0], '0.0.0'), true);
  assert.equal(moveTopicInTree(root, '0.0', '0.0.0', 'subtopic'), false);
});

test('removeTopicById removes nested topics', () => {
  const root = sampleTree();
  assert.equal(removeTopicById(root, '0.0.0'), true);
  assert.equal(root.subtopics[0].subtopics.length, 0);
});
