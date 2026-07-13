import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizePluginSettings } from '../../src/config/pluginSettings.js';

test('watermark unlock defaults to false and only accepts explicit true', () => {
  assert.equal(normalizePluginSettings({}).watermarkUnlocked, false);
  assert.equal(normalizePluginSettings({ watermarkUnlocked: 'true' }).watermarkUnlocked, false);
  assert.equal(normalizePluginSettings({ watermarkUnlocked: true }).watermarkUnlocked, true);
});
