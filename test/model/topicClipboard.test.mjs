import assert from 'node:assert/strict';
import test from 'node:test';

import { createMindTopic } from '../../src/parser/parseMind.js';
import {
  TOPIC_CLIPBOARD_MODE,
  cloneTopicForAttributedPaste,
  cloneTopicForStandardPaste,
  createTopicClipboardEntry,
} from '../../src/model/topicClipboard.js';

function topicWithAttributesAndSubtopics() {
  return createMindTopic(
    'Parent',
    { id: 'stable-parent', color: '#ff0000' },
    [createMindTopic('Child', { id: 'stable-child', icon: 'star' }, [], 0, 3)],
    0,
    2
  );
}

test('cut clipboard restores the complete topic subtree through standard paste', () => {
  const source = topicWithAttributesAndSubtopics();
  const entry = createTopicClipboardEntry(source, TOPIC_CLIPBOARD_MODE.CUT_SUBTREE);
  const pasted = cloneTopicForStandardPaste(entry, 4);

  assert.match(entry.systemText, /^# Parent \[color=#ff0000\]\n## Child \[icon=star\]$/);
  assert.doesNotMatch(entry.systemText, /\bid=/);
  assert.deepEqual(pasted.attributes, { color: '#ff0000' });
  assert.equal(pasted.subtopics[0].text, 'Child');
  assert.deepEqual(pasted.subtopics[0].attributes, { icon: 'star' });
  assert.notEqual(pasted, source);
  assert.notEqual(pasted.subtopics[0], source.subtopics[0]);
});

test('plain copy remains text-only through standard paste', () => {
  const entry = createTopicClipboardEntry(
    topicWithAttributesAndSubtopics(),
    TOPIC_CLIPBOARD_MODE.TEXT
  );
  const pasted = cloneTopicForStandardPaste(entry, 4);

  assert.equal(entry.systemText, 'Parent');
  assert.deepEqual(pasted.attributes, {});
  assert.deepEqual(pasted.subtopics, []);
  assert.equal(pasted.level, 4);
});

test('copy with attributes still requires attributed paste to restore the subtree', () => {
  const entry = createTopicClipboardEntry(
    topicWithAttributesAndSubtopics(),
    TOPIC_CLIPBOARD_MODE.COPY_WITH_ATTRIBUTES
  );

  assert.deepEqual(cloneTopicForStandardPaste(entry, 4).attributes, {});
  assert.equal(cloneTopicForStandardPaste(entry, 4).subtopics.length, 0);
  assert.deepEqual(cloneTopicForAttributedPaste(entry).attributes, { color: '#ff0000' });
  assert.equal(cloneTopicForAttributedPaste(entry).subtopics.length, 1);
});
