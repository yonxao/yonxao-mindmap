import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TOPIC_HISTORY_MEMORY_MAX_ENTRIES,
  topicHistoryStacksByteSize,
  trimTopicHistoryStacksForMemoryBudget,
} from '../../src/model/topicHistoryMemory.js';
import { setSessionMemory } from '../../src/shared/sessionMemory.js';

test('topic history session records keep a bounded number of code block entries', () => {
  const memory = new Map();

  for (let index = 0; index < TOPIC_HISTORY_MEMORY_MAX_ENTRIES + 5; index += 1) {
    setSessionMemory(
      memory,
      `note.md:history:${index}`,
      { undoStack: [`# Topic ${index}`] },
      {
        ttlMs: 1000,
        now: 100 + index,
        maxEntries: TOPIC_HISTORY_MEMORY_MAX_ENTRIES,
      }
    );
  }

  assert.equal(memory.size, TOPIC_HISTORY_MEMORY_MAX_ENTRIES);
  assert.equal(memory.has('note.md:history:0'), false);
  assert.equal(memory.has(`note.md:history:${TOPIC_HISTORY_MEMORY_MAX_ENTRIES + 4}`), true);
});

test('topic history trims old undo snapshots to keep one code block within budget', () => {
  const largeSource = 'x'.repeat(600_000);
  const undoStack = Array.from({ length: 5 }, (_, index) => `${largeSource}${index}`);
  const redoStack = [];

  trimTopicHistoryStacksForMemoryBudget(undoStack, redoStack);

  assert.ok(undoStack.length < 5);
  assert.equal(undoStack.at(-1), `${largeSource}4`);
});

test('topic history byte estimate counts source snapshots as UTF-16 strings', () => {
  assert.equal(topicHistoryStacksByteSize(['abcd'], ['xy']), 12);
});
