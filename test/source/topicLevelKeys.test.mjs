import test from 'node:test';
import assert from 'node:assert/strict';

import { adjustTopicLevel, adjustTopicLevelSelection } from '../../src/source/topicLevelKeys.js';

test('adjustTopicLevel indents and outdents topic level markers', () => {
  assert.equal(adjustTopicLevel('## Topic', false), '### Topic');
  assert.equal(adjustTopicLevel('## Topic', true), '# Topic');
  assert.equal(adjustTopicLevel('# Topic', true), '# Topic');
});

test('adjustTopicLevelSelection updates only selected topic lines', () => {
  const textarea = {
    value: '# Root\nplain\n## Child',
    selectionStart: 0,
    selectionEnd: 22,
    setRangeText(text, start, end) {
      this.value = `${this.value.slice(0, start)}${text}${this.value.slice(end)}`;
    },
  };

  assert.equal(adjustTopicLevelSelection(textarea, false), true);
  assert.equal(textarea.value, '## Root\nplain\n### Child');
});
