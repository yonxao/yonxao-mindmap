import assert from 'node:assert/strict';
import test from 'node:test';

import { isSourceSaveShortcut } from '../../src/ui/source/sourceShortcuts.js';

function keyboardEvent(overrides = {}) {
  return {
    key: 's',
    code: 'KeyS',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  };
}

test('source save accepts Ctrl+S and Cmd+S', () => {
  assert.equal(isSourceSaveShortcut(keyboardEvent({ ctrlKey: true })), true);
  assert.equal(isSourceSaveShortcut(keyboardEvent({ metaKey: true })), true);
});

test('source save rejects Alt+S, modified shortcuts, and composition input', () => {
  assert.equal(isSourceSaveShortcut(keyboardEvent({ altKey: true })), false);
  assert.equal(isSourceSaveShortcut(keyboardEvent({ ctrlKey: true, altKey: true })), false);
  assert.equal(isSourceSaveShortcut(keyboardEvent({ ctrlKey: true, shiftKey: true })), false);
  assert.equal(isSourceSaveShortcut(keyboardEvent({ ctrlKey: true, isComposing: true })), false);
});

test('source save falls back to the physical KeyS code for alternate keyboard layouts', () => {
  assert.equal(isSourceSaveShortcut(keyboardEvent({ ctrlKey: true, key: 'ß' })), true);
  assert.equal(
    isSourceSaveShortcut(keyboardEvent({ ctrlKey: true, key: 'x', code: 'KeyX' })),
    false
  );
});
