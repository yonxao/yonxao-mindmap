import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_MIND_CONFIG,
  normalizeBranchExpansion,
  normalizeConnectorStyle,
  normalizeLayoutType,
  normalizeMindConfig,
  normalizeOptionalNumber,
  resolveTopicFont,
  resolveTopicMaxWidth,
} from '@yonxao/mindmap-core';
import {
  normalizeMindConfig as normalizePluginMindConfig,
  resolveTopicFont as resolvePluginTopicFont,
  resolveTopicMaxWidth as resolvePluginTopicMaxWidth,
} from '../../../src/config/configNormalize.js';
import { DEFAULT_MIND_CONFIG as PLUGIN_DEFAULT_MIND_CONFIG } from '../../../src/config/defaultMindConfig.js';

test('public core owns stable product defaults', () => {
  assert.equal(DEFAULT_MIND_CONFIG.structure.layout, 'mindmap-right');
  assert.equal(DEFAULT_MIND_CONFIG.structure.connectorStyle, 'curve');
  assert.equal(DEFAULT_MIND_CONFIG.structure.topicMaxWidth.global, 240);
  assert.equal(DEFAULT_MIND_CONFIG.color.scheme, 'default');
  assert.equal(DEFAULT_MIND_CONFIG.font.family, 'var(--font-text)');
  assert.equal(DEFAULT_MIND_CONFIG.interaction.toolbar.corner, 'top-right');
  assert.equal(DEFAULT_MIND_CONFIG.watermark.enabled, false);
  assert.equal(PLUGIN_DEFAULT_MIND_CONFIG, DEFAULT_MIND_CONFIG);
});

test('public core maps a complete document config to stable runtime shape', () => {
  const config = normalizeMindConfig({
    display: {
      canvasHeight: 540,
      sourceHeight: 360,
      viewFit: 'original',
      fitViewNoUpscale: false,
      fitViewMaxScale: 4,
      saveFullConfig: true,
    },
    structure: {
      layout: 'timeline-up',
      connectorStyle: 'elbow',
      branchExpansion: 'hanging',
      topicMaxWidth: { global: 360, level2: 280 },
    },
    color: {
      scheme: 'forest',
      defaultTopicColor: '#123456',
      buttonColorMode: 'custom',
      buttonColor: '#abcdef',
      advancedStructure: { relation: '#111111' },
    },
    font: {
      family: 'system-ui',
      size: 18,
      weight: 500,
      lineHeight: 26,
      align: 'right',
      level2: { size: 16 },
    },
    interaction: {
      toolbar: { corner: 'bottom-left', placement: 'inside' },
      topicControlVisibility: 'hover',
      tabIndent: false,
      wheelZoom: true,
    },
  });

  assert.equal(config.canvas.height, 540);
  assert.equal(config.source.height, 360);
  assert.equal(config.view.fit, 'original');
  assert.equal(config.layout, 'timeline-up');
  assert.equal(config.branch.expansion, 'hanging');
  assert.equal(config.theme, 'forest');
  assert.equal(config.topic.maxWidth, 360);
  assert.equal(config.topic.levels['2'].maxWidth, 280);
  assert.equal(config.font.levels['2'].size, 16);
  assert.equal(config.button.colorMode, 'custom');
  assert.equal(config.toolbar.corner, 'bottom-left');
  assert.equal(config.interaction.wheelZoom, true);
});

test('runtime normalization is idempotent and clamps unsafe values', () => {
  const config = normalizeMindConfig({
    display: {
      canvasHeight: Number.MAX_VALUE,
      sourceHeight: -100,
      fitViewMaxScale: 99,
    },
    font: {
      size: 999,
      weight: 1,
      lineHeight: 999,
    },
    watermark: {
      normal: {
        opacity: 9,
        rotation: -999,
        width: 0,
        offsetX: Number.MAX_VALUE,
      },
    },
  });

  assert.equal(config.canvas.height, 1800);
  assert.equal(config.source.height, 96);
  assert.equal(config.view.fitMaxScale, 6);
  assert.equal(config.font.size, 96);
  assert.equal(config.font.weight, 100);
  assert.equal(config.font.lineHeight, 160);
  assert.equal(config.watermark.normal.opacity, 1);
  assert.equal(config.watermark.normal.rotation, -180);
  assert.equal(config.watermark.normal.width, 8);
  assert.equal(config.watermark.normal.offsetX, 2000);
  assert.deepEqual(normalizeMindConfig(config), config);
});

test('topic font and max width preserve attribute, level and global precedence', () => {
  const config = normalizeMindConfig({
    structure: {
      topicMaxWidth: { global: 400, level2: 320 },
    },
    font: {
      size: 18,
      weight: 500,
      level2: { size: 16, weight: 700 },
    },
  });
  const topic = {
    level: 2,
    attributes: {
      fontSize: 22,
      align: 'center',
      maxWidth: 280,
    },
  };

  assert.deepEqual(resolveTopicFont(topic, config), {
    family: 'var(--font-text)',
    size: 22,
    weight: 700,
    lineHeight: 20,
    align: 'center',
  });
  assert.equal(resolveTopicMaxWidth(topic, config), 280);
  assert.equal(resolveTopicMaxWidth({ level: 2, attributes: {} }, config), 320);
  assert.equal(resolveTopicMaxWidth({ level: 3, attributes: {} }, config), 400);
});

test('public runtime scalar normalizers reject aliases and clamp finite numbers', () => {
  assert.equal(normalizeLayoutType(' TREE-RIGHT '), 'tree-right');
  assert.equal(normalizeLayoutType('right'), '');
  assert.equal(normalizeConnectorStyle('ELBOW'), 'elbow');
  assert.equal(normalizeConnectorStyle('bezier'), '');
  assert.equal(normalizeBranchExpansion('hanging'), 'hanging');
  assert.equal(normalizeBranchExpansion('vertical'), '');
  assert.equal(normalizeOptionalNumber('12.5', 10, 20), 12.5);
  assert.equal(normalizeOptionalNumber(Number.POSITIVE_INFINITY, 10, 20), null);
});

test('plugin runtime config adapters preserve the public core contract', () => {
  const raw = {
    structure: {
      layout: 'radial',
      topicMaxWidth: { global: 420, level1: 300 },
    },
    color: { scheme: 'neon-rainbow' },
    font: { size: 20, align: 'left' },
  };
  const topic = {
    level: 1,
    attributes: { fontWeight: 800, maxWidth: 260 },
  };

  assert.deepEqual(normalizePluginMindConfig(raw), normalizeMindConfig(raw));
  assert.deepEqual(resolvePluginTopicFont(topic, raw), resolveTopicFont(topic, raw));
  assert.equal(resolvePluginTopicMaxWidth(topic, raw), resolveTopicMaxWidth(topic, raw));
});
