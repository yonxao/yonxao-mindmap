import assert from 'node:assert/strict';
import test from 'node:test';

import {
  adjustTopicLevel,
  adjustTopicLevelSelectionText,
  collapseTopicDescendants,
  createMindTopic,
  createTopicFromText,
  expandTopicDescendants,
  formatFencedMindMapSource,
  insertCodeBlockAfterSource,
  parseTopicsFromClipboardText,
  plainBodyToIndentedText,
  replaceCodeBlockSource,
  resetCollapsedTopics,
  serializePlainBody,
  serializePlainTopic,
  toggleTopicCollapsed,
  toggleTopicTaskItemText,
} from '@yonxao/mindmap-core';
import {
  adjustTopicLevel as adjustPluginTopicLevel,
  adjustTopicLevelSelection,
} from '../../../src/source/topicLevelKeys.js';
import { formatFencedMindMapSource as formatPluginFencedSource } from '../../../src/renderer/export/sourceFence.js';

test('public core owns topic level line and selection editing', () => {
  assert.equal(adjustTopicLevel('  ## Child', false), '  ### Child');
  assert.equal(adjustTopicLevel('# Root', true), '# Root');

  const edit = adjustTopicLevelSelectionText('# Root\nplain\n## Child', 0, 22, false);
  assert.equal(edit.changed, true);
  assert.equal(edit.value, '## Root\nplain\n### Child');
  assert.deepEqual(
    [edit.replacementStart, edit.replacementEnd, edit.replacementText],
    [0, 21, '## Root\nplain\n### Child']
  );
});

test('public core toggles only valid task source lines', () => {
  const source = 'Intro\n  - [ ] todo\n- [X] done\n- normal';

  assert.equal(toggleTopicTaskItemText(source, 1), 'Intro\n  - [x] todo\n- [X] done\n- normal');
  assert.equal(toggleTopicTaskItemText(source, 2), 'Intro\n  - [ ] todo\n- [ ] done\n- normal');
  assert.equal(toggleTopicTaskItemText(source, 3), null);
  assert.equal(toggleTopicTaskItemText(source, 99), null);
});

test('public core owns collapsed topic set transitions', () => {
  const leaf = createMindTopic('Leaf');
  leaf.id = 'leaf';
  const child = createMindTopic('Child', {}, [leaf]);
  child.id = 'child';
  const root = createMindTopic('Root', {}, [child]);
  root.id = 'root';
  const collapsedIds = new Set();

  assert.equal(toggleTopicCollapsed(collapsedIds, root), true);
  assert.deepEqual([...collapsedIds], ['root']);
  assert.equal(collapseTopicDescendants(collapsedIds, root), true);
  assert.deepEqual([...collapsedIds], ['root', 'child']);
  assert.equal(expandTopicDescendants(collapsedIds, root), true);
  assert.equal(collapsedIds.size, 0);
  collapsedIds.add('root');
  assert.equal(resetCollapsedTopics(collapsedIds), true);
  assert.equal(resetCollapsedTopics(collapsedIds), false);
});

test('public core serializes plain and indented topic outlines', () => {
  const child = createMindTopic('Child\ncontinued');
  const root = createMindTopic('Root', {}, [child]);

  assert.equal(serializePlainTopic(root), '# Root\n## Child\ncontinued');
  assert.equal(serializePlainBody(root), '# Root\n## Child\ncontinued');
  assert.equal(plainBodyToIndentedText(serializePlainBody(root)), 'Root\n  Child\n  continued');
});

test('public core parses structured clipboard text without retaining stable ids', () => {
  const topics = parseTopicsFromClipboardText(
    '# A [id=a color=#ff0000]\n## A1 [id=a1]\n# B [id=b]',
    {
      includeAttributes: true,
      includeSubtopics: true,
    }
  );

  assert.equal(topics.length, 2);
  assert.equal(topics[0].attributes.color, '#ff0000');
  assert.equal(topics[0].attributes.id, undefined);
  assert.equal(topics[0].subtopics[0].attributes.id, undefined);
  assert.equal(createTopicFromText('  Plain topic  ', 3).text, 'Plain topic');
});

test('public core preserves Markdown fence targeting and platform line endings', () => {
  const markdown = ['```yxmm', '# A', '```', '', '```yxmm', '# A', '```'].join('\r\n');
  const replaced = replaceCodeBlockSource(markdown, 'yxmm', '# A', '# B', {
    lineStart: 4,
    lineEnd: 5,
  });
  const inserted = insertCodeBlockAfterSource(markdown, 'yxmm', '# A', '# Recovered', {
    lineStart: 4,
    lineEnd: 5,
  });

  assert.ok(replaced.includes('```yxmm\r\n# B\r\n```'));
  assert.ok(inserted.includes('```\r\n\r\n```yxmm\r\n# Recovered\r\n```'));
  assert.equal(
    formatFencedMindMapSource('# Root\r\n## Child\n\n'),
    '```yxmm\n# Root\n## Child\n```'
  );
});

test('plugin editing and fence adapters preserve the public core behavior', () => {
  const textarea = {
    value: '# Root\nplain\n## Child',
    selectionStart: 0,
    selectionEnd: 22,
    setRangeText(text, start, end) {
      this.value = `${this.value.slice(0, start)}${text}${this.value.slice(end)}`;
    },
  };

  assert.equal(adjustPluginTopicLevel('## Child', true), adjustTopicLevel('## Child', true));
  assert.equal(adjustTopicLevelSelection(textarea, false), true);
  assert.equal(textarea.value, '## Root\nplain\n### Child');
  assert.equal(formatPluginFencedSource('# Root'), formatFencedMindMapSource('# Root'));
});
