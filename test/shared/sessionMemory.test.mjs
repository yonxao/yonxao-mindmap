import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getSessionMemory,
  setSessionMemory,
  sweepSessionMemory,
} from '../../src/shared/sessionMemory.js';

test('session memory expires stale records during reads', () => {
  const memory = new Map();

  setSessionMemory(memory, 'old', 'value', { ttlMs: 10, now: 100 });

  assert.equal(getSessionMemory(memory, 'old', { now: 111 }), null);
  assert.equal(memory.has('old'), false);
});

test('session memory evicts least recently used records by entry limit', () => {
  const memory = new Map();

  setSessionMemory(memory, 'a', 'A', { ttlMs: 1000, now: 100, maxEntries: 3 });
  setSessionMemory(memory, 'b', 'B', { ttlMs: 1000, now: 101, maxEntries: 3 });
  setSessionMemory(memory, 'c', 'C', { ttlMs: 1000, now: 102, maxEntries: 3 });
  assert.equal(getSessionMemory(memory, 'a', { now: 200 }), 'A');

  setSessionMemory(memory, 'd', 'D', { ttlMs: 1000, now: 201, maxEntries: 3 });

  assert.deepEqual([...memory.keys()].sort(), ['a', 'c', 'd']);
});

test('session memory evicts least recently used records by byte budget', () => {
  const memory = new Map();

  setSessionMemory(memory, 'a', '1111', { ttlMs: 1000, now: 100, maxBytes: 12 });
  setSessionMemory(memory, 'b', '22', { ttlMs: 1000, now: 101, maxBytes: 12 });
  setSessionMemory(memory, 'c', '33', { ttlMs: 1000, now: 102, maxBytes: 12 });

  assert.deepEqual([...memory.keys()].sort(), ['b', 'c']);
});

test('session memory keeps the protected write when sweeping over budget', () => {
  const memory = new Map();

  setSessionMemory(memory, 'a', '1111', { ttlMs: 1000, now: 100 });
  setSessionMemory(memory, 'b', '22222222', { ttlMs: 1000, now: 101, maxBytes: 4 });

  assert.deepEqual([...memory.keys()], ['b']);
});

test('session memory explicit sweep removes expired records', () => {
  const memory = new Map();

  setSessionMemory(memory, 'a', 'A', { ttlMs: 10, now: 100 });
  setSessionMemory(memory, 'b', 'B', { ttlMs: 100, now: 100 });

  sweepSessionMemory(memory, { now: 111 });

  assert.deepEqual([...memory.keys()], ['b']);
});
