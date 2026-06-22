import test from 'node:test';
import assert from 'node:assert/strict';

import {
  mergeMindConfigObjects,
  normalizeMindConfig,
  parseSimpleYaml,
  stringifySimpleYaml,
} from '../../src/config/mindConfig.js';

test('normalizeMindConfig clamps numeric font values and keeps legal layout', () => {
  const config = normalizeMindConfig({
    layout: { type: 'timeline-up' },
    font: { size: 999, weight: 50, lineHeight: 999 },
  });

  assert.equal(config.layout, 'timeline-up');
  assert.equal(config.font.size, 96);
  assert.equal(config.font.weight, 100);
  assert.equal(config.font.lineHeight, 160);
});

test('normalizeMindConfig keeps legal topic control visibility', () => {
  const config = normalizeMindConfig({
    basic: { topicControlVisibility: 'hover' },
  });

  assert.equal(config.button.topicControlVisibility, 'hover');
});

test('mergeMindConfigObjects recursively merges plain objects', () => {
  assert.deepEqual(
    mergeMindConfigObjects(
      { font: { size: 16, level1: { weight: 700 } }, layout: { type: 'tree' } },
      { font: { level1: { size: 24 } } }
    ),
    { font: { size: 16, level1: { weight: 700, size: 24 } }, layout: { type: 'tree' } }
  );
});

test('simple YAML parser and stringifier round-trip nested config', () => {
  const config = parseSimpleYaml(['theme:', '  scheme: ocean', 'font:', '  size: 18']);

  assert.deepEqual(config, { theme: { scheme: 'ocean' }, font: { size: 18 } });
  assert.equal(
    stringifySimpleYaml(config),
    `theme:
  scheme: ocean
font:
  size: 18`
  );
});
