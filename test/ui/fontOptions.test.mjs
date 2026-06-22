import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidFontFamilyInput, normalizeFontFamilyInput } from '../../src/ui/fontOptions.js';

test('font family input accepts single-quoted CSS font family lists', () => {
  assert.equal(
    isValidFontFamilyInput("'LXGW WenKai GB', '霞鹜文楷 GB', 'LXGW WenKai', '霞鹜文楷', serif"),
    true
  );
});

test('font family input rejects double-quoted CSS font family lists', () => {
  const value = '"LXGW WenKai GB", "霞鹜文楷 GB", "LXGW WenKai", "霞鹜文楷", serif';

  assert.equal(normalizeFontFamilyInput(value), value);
  assert.equal(isValidFontFamilyInput(value), false);
});
