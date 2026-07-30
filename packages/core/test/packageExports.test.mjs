import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TOPIC_CLIPBOARD_MODE,
  applyRelationAnchorEndpoints,
  cloneTopicForAttributedPaste,
  countTopicDescendants,
  createMindTopic,
  createTopicClipboardEntry,
  forEachTopicWithSubtopics,
  moveTopicInTree,
  parseMindStructures,
  parseTopicMind,
  relationAnchorPoints,
  serializeMind,
  serializeMindStructures,
  topicHistoryStacksByteSize,
  validateMindStructures,
} from '@yonxao/mindmap-core';

test('public core parses and serializes a topic tree without host dependencies', () => {
  const root = parseTopicMind(['# Root [id=root]', '## Child [color=#3b82f6]']);

  assert.equal(root.text, 'Root');
  assert.equal(root.subtopics[0].attributes.color, '#3b82f6');
  assert.equal(serializeMind(root), '# Root [id=root]\n## Child [color=#3b82f6]');
});

test('public core keeps JavaScript null fallbacks during the TypeScript migration', () => {
  const topic = createMindTopic('Root', null, null, null, null);

  assert.deepEqual(topic.attributes, {});
  assert.deepEqual(topic.subtopics, []);
  assert.equal(topic.line, 0);
  assert.equal(topic.level, 1);
  assert.equal(serializeMindStructures(null), '');
  assert.doesNotThrow(() => validateMindStructures(topic, null));
});

test('public core advanced structures validate and round-trip', () => {
  const root = createMindTopic('Root', { id: 'root' }, [
    createMindTopic('A', { id: 'a' }),
    createMindTopic('B', { id: 'b' }),
  ]);
  const structures = parseMindStructures([
    '@relation [from=a to=b text="A to B"]',
    '@summary [topics=a,b text="Children"]',
  ]);

  assert.doesNotThrow(() => validateMindStructures(root, structures));
  assert.equal(
    serializeMindStructures(structures),
    [
      '@structures',
      '@relation [id=r-001 from=a to=b text="A to B"]',
      '@summary [id=s-001 topics=a,b text=Children]',
      '@end',
    ].join('\n')
  );
});

test('public core exposes reusable topic model and geometry operations', () => {
  const root = createMindTopic('Root', {}, [
    createMindTopic('A', { color: '#ff0000' }, [createMindTopic('A1')]),
    createMindTopic('B'),
  ]);
  root.id = '0';
  root.subtopics[0].id = '0.0';
  root.subtopics[0].subtopics[0].id = '0.0.0';
  root.subtopics[1].id = '0.1';

  assert.equal(moveTopicInTree(root, '0.0.0', '0.1', 'subtopic'), true);
  assert.equal(countTopicDescendants(root), 3);

  const visited = [];
  forEachTopicWithSubtopics(root, (topic) => visited.push(topic.text));
  assert.deepEqual(visited, ['Root', 'B']);

  const clipboardEntry = createTopicClipboardEntry(
    root.subtopics[0],
    TOPIC_CLIPBOARD_MODE.COPY_WITH_ATTRIBUTES
  );
  assert.deepEqual(cloneTopicForAttributedPaste(clipboardEntry).attributes, {
    color: '#ff0000',
  });

  const layout = { x: 100, y: 80, width: 120, height: 60 };
  assert.equal(relationAnchorPoints(layout).length, 8);
  assert.deepEqual(
    applyRelationAnchorEndpoints(
      [
        { x: 0, y: 0 },
        { x: 200, y: 200 },
      ],
      layout,
      layout,
      { fromAnchor: 'right', toAnchor: 'bottom' }
    ),
    [
      { x: 160, y: 80 },
      { x: 100, y: 110 },
    ]
  );
  assert.equal(topicHistoryStacksByteSize(['abcd'], ['xy']), 12);
});
