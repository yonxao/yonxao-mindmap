import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canonicalizeMindConfig,
  deleteMindConfigPath,
  mergeMindConfigSources,
  pruneInactiveMindConfig,
  serializeCanonicalMindSource,
  splitCanonicalMindSourceConfig,
} from '@yonxao/mindmap-core';
import { canonicalizeMindConfig as canonicalizePluginMindConfig } from '../../../src/config/configCanonicalize.js';
import { pruneInactiveMindConfig as prunePluginMindConfig } from '../../../src/config/configSerialize.js';

test('public core canonicalizes the complete document config contract', () => {
  assert.deepEqual(
    canonicalizeMindConfig({
      display: { canvasHeight: 480, unknown: true },
      structure: {
        layout: 'tree-right',
        topicMaxWidth: { global: 320, level2: 260, level4: 220 },
      },
      color: {
        scheme: 'forest',
        advancedStructure: { relation: '#123456', unknown: '#ffffff' },
      },
      font: {
        family: 'system-ui',
        level2: { size: 18, align: 'right' },
      },
      interaction: { toolbar: { corner: 'bottom-left', unknown: true } },
      removedGroup: { enabled: true },
    }),
    {
      display: { canvasHeight: 480 },
      structure: {
        layout: 'tree-right',
        topicMaxWidth: { global: 320, level2: 260 },
      },
      color: {
        scheme: 'forest',
        advancedStructure: { relation: '#123456' },
      },
      interaction: { toolbar: { corner: 'bottom-left' } },
      font: {
        family: 'system-ui',
        level2: { size: 18 },
      },
    }
  );
});

test('public core preserves source-level inheritance when merging document config', () => {
  const merged = mergeMindConfigSources(
    {
      structure: { topicMaxWidth: { global: 240, level2: 200 } },
      font: { size: 16, weight: 500, level2: { size: 14, weight: 700 } },
    },
    {
      structure: { topicMaxWidth: { global: 360 } },
      font: { size: 20 },
    }
  );

  assert.deepEqual(merged.structure.topicMaxWidth, { global: 360 });
  assert.deepEqual(merged.font, {
    size: 20,
    weight: 500,
    level2: { weight: 700 },
  });
  assert.deepEqual(deleteMindConfigPath(merged, ['font', 'level2', 'weight']).font, {
    size: 20,
    weight: 500,
  });
});

test('public core prunes config fields that are inactive in the effective product mode', () => {
  assert.deepEqual(
    pruneInactiveMindConfig({
      display: {
        viewFit: 'original',
        fitViewNoUpscale: false,
        fitViewMaxScale: 2,
      },
      structure: {
        layout: 'mindmap-right',
        connectorStyle: 'curve',
        branchExpansion: 'hanging',
      },
      color: {
        buttonColorMode: 'topic',
        buttonColor: '#123456',
      },
    }),
    {
      display: { viewFit: 'original' },
      structure: {
        layout: 'mindmap-right',
        connectorStyle: 'curve',
      },
      color: { buttonColorMode: 'topic' },
    }
  );

  assert.deepEqual(
    pruneInactiveMindConfig(
      {
        display: { fitViewNoUpscale: false, fitViewMaxScale: 1.2 },
        structure: { branchExpansion: 'hanging' },
        color: { buttonColor: '#123456' },
      },
      {
        display: { viewFit: 'fit' },
        structure: { layout: 'mindmap-left', connectorStyle: 'elbow' },
        color: { buttonColorMode: 'custom' },
      }
    ),
    {
      display: { fitViewNoUpscale: false, fitViewMaxScale: 1.2 },
      structure: { branchExpansion: 'hanging' },
      color: { buttonColor: '#123456' },
    }
  );
});

test('canonical document source helpers round-trip only supported config fields', () => {
  const source = serializeCanonicalMindSource(
    {
      structure: { layout: 'timeline-up' },
      unknown: { value: true },
    },
    '# Root'
  );

  assert.equal(
    source,
    ['---', 'structure:', '  layout: timeline-up', '---', '', '# Root'].join('\n')
  );
  assert.deepEqual(splitCanonicalMindSourceConfig(source), {
    hasConfig: true,
    rawConfig: { structure: { layout: 'timeline-up' } },
    body: '# Root',
  });
});

test('plugin config adapters preserve the public core contract', () => {
  const raw = {
    structure: {
      layout: 'radial',
      branchExpansion: 'hanging',
    },
    color: {
      buttonColorMode: 'subtle',
      buttonColor: '#abcdef',
    },
  };

  assert.deepEqual(canonicalizePluginMindConfig(raw), canonicalizeMindConfig(raw));
  assert.deepEqual(prunePluginMindConfig(raw), pruneInactiveMindConfig(raw));
});
