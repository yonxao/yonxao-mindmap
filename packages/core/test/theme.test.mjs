import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MIND_THEMES,
  MIND_THEME_NAMES,
  RAINBOW_THEME_NAMES,
  normalizeMindColor,
  normalizeMindThemeName,
  resolveConnectorColor,
  resolveTopicColor,
  themeColorForTopic,
  themeConnectorOpacity,
  themeTopicFillAlpha,
} from '@yonxao/mindmap-core';
import { themeColorForTopic as pluginThemeColorForTopic } from '../../../src/theme/mindThemes.js';
import {
  connectorColor as pluginConnectorColor,
  normalizeColor as pluginNormalizeColor,
  topicColor as pluginTopicColor,
  transparentColor,
} from '../../../src/utils/color.js';

test('public core exposes every stable built-in theme and normalizes names', () => {
  assert.deepEqual(MIND_THEME_NAMES, [
    'default',
    'ocean',
    'forest',
    'sunset',
    'mono',
    'rainbow',
    'pastel-rainbow',
    'neon-rainbow',
  ]);
  assert.deepEqual(Object.keys(MIND_THEMES), MIND_THEME_NAMES);
  assert.deepEqual(RAINBOW_THEME_NAMES, ['rainbow', 'pastel-rainbow', 'neon-rainbow']);
  assert.equal(normalizeMindThemeName(' OCEAN '), 'ocean');
  assert.equal(normalizeMindThemeName('unknown'), 'default');
});

test('branch themes keep a distinct center color and stable root-branch colors', () => {
  const config = { theme: 'rainbow' };

  assert.equal(themeColorForTopic({ id: '0', level: 1 }, config), '#2563eb');
  assert.equal(themeColorForTopic({ id: '0.0', level: 2 }, config), '#ef4444');
  assert.equal(themeColorForTopic({ id: '0.1.3', level: 3 }, config), '#f97316');
  assert.equal(themeColorForTopic({ id: '0.8.2', level: 3 }, config), '#ef4444');
});

test('level themes select colors by topic level and expose rendering opacity', () => {
  const config = { theme: 'mono' };

  assert.equal(themeColorForTopic({ id: '0.4', level: 2 }, config), '#71717a');
  assert.equal(themeColorForTopic({ id: '0.4.1', level: 3 }, config), '#3f3f46');
  assert.equal(themeTopicFillAlpha(config), 0.09);
  assert.equal(themeConnectorOpacity(config), 0.5);
});

test('topic and connector colors preserve product precedence', () => {
  const topic = {
    id: '0.2',
    level: 2,
    attributes: { color: '#abcdef' },
  };
  const customDefault = {
    theme: 'forest',
    topic: { defaultColor: '#123456' },
  };

  assert.equal(resolveTopicColor(topic, customDefault), '#abcdef');
  assert.equal(resolveConnectorColor(topic, customDefault), '#123456');
  assert.equal(resolveTopicColor(topic, { theme: 'forest', topic: {} }), '#abcdef');
  assert.equal(resolveConnectorColor(topic, { theme: 'forest', topic: {} }), '#059669');
});

test('public color validation and plugin adapters preserve existing behavior', () => {
  const topic = {
    id: '0.1',
    level: 2,
    attributes: { color: 'invalid color value' },
  };
  const config = { theme: 'ocean', topic: {} };

  assert.equal(normalizeMindColor('abc'), '#abc');
  assert.equal(normalizeMindColor('rebeccapurple'), 'rebeccapurple');
  assert.equal(normalizeMindColor('rgb(1, 2, 3)'), '');
  assert.equal(pluginNormalizeColor('abc'), normalizeMindColor('abc'));
  assert.equal(pluginThemeColorForTopic(topic, config), themeColorForTopic(topic, config));
  assert.equal(pluginTopicColor(topic, config), resolveTopicColor(topic, config));
  assert.equal(pluginConnectorColor(topic, config), resolveConnectorColor(topic, config));
  assert.equal(transparentColor('#abc', 0.25), 'rgba(170, 187, 204, 0.25)');
  assert.equal(transparentColor('red', 0.25), 'var(--background-primary)');
});
