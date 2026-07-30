import assert from 'node:assert/strict';
import test from 'node:test';

import {
  cleanupMindStructures,
  createMindStructureId,
  createMindTopic,
  ensureStableTopicId,
} from '@yonxao/mindmap-core';

function topic(text, stableId, subtopics = []) {
  return createMindTopic(text, stableId ? { id: stableId } : {}, subtopics);
}

test('public core allocates stable topic and structure ids without host state', () => {
  const childWithoutId = topic('No ID');
  const root = topic('Root', 'root', [topic('Existing', 't-000'), childWithoutId]);

  assert.equal(
    ensureStableTopicId(root, childWithoutId, {
      random: () => 0,
    }),
    't-001'
  );
  assert.equal(childWithoutId.attributes.id, 't-001');
  assert.equal(
    createMindStructureId([{ id: 'r-000' }], 'relation', {
      random: () => 0,
    }),
    'r-001'
  );
});

test('public core reports exhausted structure id ranges deterministically', () => {
  assert.throws(
    () =>
      createMindStructureId([{ id: 'b-000' }, { id: 'b-001' }], 'boundary', {
        limit: 2,
        random: () => 0,
      }),
    /ID 已用完/
  );
});

test('public core removes invalid structure references after topic changes', () => {
  const root = topic('Root', 'root', [topic('A', 'a'), topic('B', 'b'), topic('C', 'c')]);
  const structures = [
    {
      id: 'r-001',
      type: 'relation',
      topicIds: ['a', 'b'],
      text: '',
      attributes: { direction: 'forward', lineStyle: 'curve' },
    },
    {
      id: 'r-002',
      type: 'relation',
      topicIds: ['a', 'missing'],
      text: '',
      attributes: { direction: 'forward', lineStyle: 'curve' },
    },
    {
      id: 'b-001',
      type: 'boundary',
      topicIds: ['missing', 'b'],
      text: '',
      attributes: {},
    },
    {
      id: 's-001',
      type: 'summary',
      topicIds: ['a', 'c'],
      text: '',
      attributes: {},
    },
  ];

  assert.deepEqual(cleanupMindStructures(root, structures), [
    structures[0],
    {
      ...structures[2],
      topicIds: ['b'],
    },
  ]);
  assert.deepEqual(structures[2].topicIds, ['missing', 'b']);
});
