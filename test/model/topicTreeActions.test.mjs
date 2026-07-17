import test from 'node:test';
import assert from 'node:assert/strict';

import { assignIds, createMindTopic } from '../../src/parser/parseMind.js';
import {
  cloneTopicSubtree,
  containsTopicId,
  countTopicDescendants,
  findTopicContext,
  insertSiblingTopic,
  moveTopicInTree,
  refreshTreeLevels,
  removeTopicById,
  setOptionalTopicAttribute,
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

test('cloneTopicSubtree copies selected data without retaining stable ids or references', () => {
  const root = sampleTree();
  root.subtopics[0].attributes = { id: 'stable-a', color: '#ff0000' };

  const clone = cloneTopicSubtree(root.subtopics[0], {
    includeAttributes: true,
    includeSubtopics: true,
  });

  assert.equal(clone.id, '');
  assert.deepEqual(clone.attributes, { color: '#ff0000' });
  assert.equal(clone.subtopics.length, 1);
  assert.notEqual(clone.subtopics[0], root.subtopics[0].subtopics[0]);
});

test('moveTopicInTree moves branches, refreshes levels, and restores failed moves', () => {
  const root = sampleTree();
  const movingId = root.subtopics[0].subtopics[0].id;
  const targetId = root.subtopics[1].id;

  assert.equal(moveTopicInTree(root, movingId, targetId, 'subtopic'), true);
  assert.equal(root.subtopics[1].subtopics[0].text, 'A1');
  assert.equal(root.subtopics[1].subtopics[0].level, 3);

  const orderBeforeFailure = root.subtopics.map((topic) => topic.text);
  assert.equal(moveTopicInTree(root, targetId, 'missing-topic', 'after'), false);
  assert.deepEqual(
    root.subtopics.map((topic) => topic.text),
    orderBeforeFailure
  );
});

test('tree helpers handle root context, optional attributes, levels, and descendants', () => {
  const root = sampleTree();
  assert.equal(findTopicContext(root, root.id).parent, null);
  assert.equal(findTopicContext(root, 'missing-topic'), null);
  assert.equal(countTopicDescendants(root), 3);

  const attributes = { color: '#ff0000' };
  setOptionalTopicAttribute(attributes, 'icon', ' star ');
  setOptionalTopicAttribute(attributes, 'color', '');
  assert.deepEqual(attributes, { icon: 'star' });

  root._virtual = true;
  refreshTreeLevels(root);
  assert.equal(root.level, 0);
  assert.equal(root.subtopics[0].level, 1);
  assert.equal(root.subtopics[0].subtopics[0].level, 2);
});
