import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deleteMindConfigPath,
  mergeMindConfigObjects,
  mergeMindConfigSources,
  normalizeMindConfig,
  parseSimpleYaml,
  pruneInactiveMindConfig,
  stringifySimpleYaml,
} from '../../src/config/mindConfig.js';

test('normalizeMindConfig clamps numeric font values and keeps legal layout', () => {
  const config = normalizeMindConfig({
    structure: { layout: 'timeline-up' },
    font: { size: 999, weight: 50, lineHeight: 999 },
  });

  assert.equal(config.layout, 'timeline-up');
  assert.equal(config.font.size, 96);
  assert.equal(config.font.weight, 100);
  assert.equal(config.font.lineHeight, 160);
});

test('normalizeMindConfig keeps legal topic control visibility', () => {
  const config = normalizeMindConfig({
    interaction: { topicControlVisibility: 'hover' },
  });

  assert.equal(config.button.topicControlVisibility, 'hover');
});

test('mergeMindConfigObjects recursively merges plain objects', () => {
  assert.deepEqual(
    mergeMindConfigObjects(
      { font: { size: 16, level1: { weight: 700 } }, structure: { layout: 'tree' } },
      { font: { level1: { size: 24 } } }
    ),
    { font: { size: 16, level1: { weight: 700, size: 24 } }, structure: { layout: 'tree' } }
  );
});

test('mergeMindConfigSources lets document topic global shadow global-default levels', () => {
  const config = normalizeMindConfig(
    mergeMindConfigSources(
      {
        structure: {
          topicMaxWidth: {
            global: 300,
            level2: 240,
          },
        },
      },
      {
        structure: {
          topicMaxWidth: {
            global: 360,
          },
        },
      }
    )
  );

  assert.equal(config.topic.maxWidth, 360);
  assert.deepEqual(config.topic.levels, {});
});

test('mergeMindConfigSources keeps document topic level widths over document global width', () => {
  const config = normalizeMindConfig(
    mergeMindConfigSources(
      {
        structure: {
          topicMaxWidth: {
            global: 300,
            level2: 240,
          },
        },
      },
      {
        structure: {
          topicMaxWidth: {
            global: 360,
            level2: 240,
          },
        },
      }
    )
  );

  assert.equal(config.topic.maxWidth, 360);
  assert.equal(config.topic.levels['2'].maxWidth, 240);
});

test('mergeMindConfigSources resolves topic level inheritance after document level width is cleared', () => {
  const globalDefaultConfig = {
    structure: {
      topicMaxWidth: {
        global: 240,
        level1: 260,
      },
    },
  };
  const documentConfigAfterClearingGlobal = {
    structure: {
      topicMaxWidth: {
        level1: 200,
      },
    },
  };
  const documentConfigAfterClearingLevel = deleteMindConfigPath(documentConfigAfterClearingGlobal, [
    'structure',
    'topicMaxWidth',
    'level1',
  ]);
  const config = normalizeMindConfig(
    mergeMindConfigSources(globalDefaultConfig, documentConfigAfterClearingLevel)
  );

  assert.equal(config.topic.maxWidth, 240);
  assert.equal(config.topic.levels['1'].maxWidth, 260);
});

test('mergeMindConfigSources shadows global-default font level fields per document global field', () => {
  const config = normalizeMindConfig(
    mergeMindConfigSources(
      {
        font: {
          size: 18,
          weight: 500,
          level2: {
            size: 16,
            weight: 700,
          },
        },
      },
      {
        font: {
          size: 20,
        },
      }
    )
  );

  assert.equal(config.font.size, 20);
  assert.equal(config.font.weight, 500);
  assert.equal(config.font.levels['2'].size, null);
  assert.equal(config.font.levels['2'].weight, 700);
});

test('mergeMindConfigSources keeps document font level fields over document global fields', () => {
  const config = normalizeMindConfig(
    mergeMindConfigSources(
      {
        font: {
          size: 18,
          weight: 500,
          lineHeight: 24,
          level2: {
            size: 16,
            weight: 700,
            lineHeight: 28,
          },
        },
      },
      {
        font: {
          size: 20,
          level2: {
            size: 16,
          },
        },
      }
    )
  );

  assert.equal(config.font.size, 20);
  assert.equal(config.font.levels['2'].size, 16);
  assert.equal(config.font.levels['2'].weight, 700);
  assert.equal(config.font.levels['2'].lineHeight, 28);
});

test('mergeMindConfigSources resolves font level inheritance after document level field is cleared', () => {
  const globalDefaultConfig = {
    font: {
      size: 16,
      weight: 500,
      level1: {
        size: 18,
        weight: 700,
      },
    },
  };
  const documentConfigAfterClearingGlobal = {
    font: {
      level1: {
        size: 20,
      },
    },
  };
  const documentConfigAfterClearingLevel = deleteMindConfigPath(documentConfigAfterClearingGlobal, [
    'font',
    'level1',
    'size',
  ]);
  const config = normalizeMindConfig(
    mergeMindConfigSources(globalDefaultConfig, documentConfigAfterClearingLevel)
  );

  assert.equal(config.font.size, 16);
  assert.equal(config.font.levels['1'].size, 18);
  assert.equal(config.font.levels['1'].weight, 700);
});

test('simple YAML parser and stringifier round-trip nested config', () => {
  const config = parseSimpleYaml(['color:', '  scheme: ocean', 'font:', '  size: 18']);

  assert.deepEqual(config, { color: { scheme: 'ocean' }, font: { size: 18 } });
  assert.equal(
    stringifySimpleYaml(config),
    `color:
  scheme: ocean
font:
  size: 18`
  );
});

test('normalizeMindConfig ignores removed draft-era YAML groups', () => {
  const config = normalizeMindConfig({
    layout: { type: 'timeline-up' },
    theme: { scheme: 'ocean' },
    basic: { topicControlVisibility: 'hover' },
  });

  assert.equal(config.layout, 'mindmap-right');
  assert.equal(config.theme, 'default');
  assert.equal(config.button.topicControlVisibility, 'toggle-always');
});

test('normalizeMindConfig lets topic max width levels inherit global unless explicitly set', () => {
  const inheritedConfig = normalizeMindConfig({
    structure: {
      topicMaxWidth: {
        global: 300,
      },
    },
  });
  const explicitConfig = normalizeMindConfig({
    structure: {
      topicMaxWidth: {
        global: 300,
        level2: 240,
      },
    },
  });

  assert.deepEqual(inheritedConfig.topic.levels, {});
  assert.equal(inheritedConfig.topic.maxWidth, 300);
  assert.equal(explicitConfig.topic.levels['2'].maxWidth, 240);
});

test('normalizeMindConfig lets font levels inherit global unless explicitly set', () => {
  const inheritedConfig = normalizeMindConfig({
    font: {
      size: 18,
    },
  });
  const explicitConfig = normalizeMindConfig({
    font: {
      size: 18,
      level2: {
        size: 16,
      },
    },
  });

  assert.deepEqual(inheritedConfig.font.levels, {});
  assert.equal(inheritedConfig.font.size, 18);
  assert.equal(explicitConfig.font.levels['2'].size, 16);
});

test('pruneInactiveMindConfig keeps fit view child config when fit is inherited', () => {
  const config = pruneInactiveMindConfig(
    {
      display: {
        fitViewNoUpscale: false,
        fitViewMaxScale: 1.2,
      },
    },
    {
      display: {
        viewFit: 'fit',
      },
    }
  );

  assert.deepEqual(config, {
    display: {
      fitViewNoUpscale: false,
      fitViewMaxScale: 1.2,
    },
  });
});

test('pruneInactiveMindConfig removes fit view child config when fit is not effective', () => {
  const config = pruneInactiveMindConfig(
    {
      display: {
        fitViewNoUpscale: false,
        fitViewMaxScale: 1.2,
      },
    },
    {
      display: {
        viewFit: 'original',
      },
    }
  );

  assert.deepEqual(config, {});
});

test('pruneInactiveMindConfig keeps branch expansion when elbow connector is inherited', () => {
  const config = pruneInactiveMindConfig(
    {
      structure: {
        branchExpansion: 'hanging',
      },
    },
    {
      structure: {
        layout: 'mindmap-right',
        connectorStyle: 'elbow',
      },
    }
  );

  assert.deepEqual(config, {
    structure: {
      branchExpansion: 'hanging',
    },
  });
});
