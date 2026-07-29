import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseMindDocument,
  parseSimpleYaml,
  serializeMindDocument,
  splitMindSourceConfig,
  stringifySimpleYaml,
} from '@yonxao/mindmap-core';

const SOURCE = `---
structure:
  layout: timeline-up
application:
  customFlag: true
---

# Root [id=root]
## Child [id=child]

@structures
@relation [from=root to=child text="Root to child"]
@end`;

test('public core parses complete documents without applying host config policy', () => {
  const document = parseMindDocument(SOURCE);

  assert.equal(document.hasConfig, true);
  assert.equal(document.rawConfig.structure.layout, 'timeline-up');
  assert.equal(document.rawConfig.application.customFlag, true);
  assert.equal(document.root.text, 'Root');
  assert.equal(document.structures.length, 1);
  assert.deepEqual(document.structures[0].topicIds, ['root', 'child']);
});

test('public core serializes complete documents and preserves raw config extensions', () => {
  const document = parseMindDocument(SOURCE);
  const serialized = serializeMindDocument(document.root, {
    rawConfig: document.rawConfig,
    forceConfig: true,
    structures: document.structures,
  });
  const reparsed = parseMindDocument(serialized);

  assert.deepEqual(reparsed.rawConfig, document.rawConfig);
  assert.deepEqual(reparsed.structures, document.structures);
  assert.equal(reparsed.root.text, document.root.text);
});

test('public core owns the YAML envelope and stable config ordering', () => {
  const config = parseSimpleYaml(['font:', '  size: 18', 'structure:', '  layout: tree-right']);
  const yaml = stringifySimpleYaml(config);
  const document = splitMindSourceConfig(`---\n${yaml}\n---\n\n# Root`);

  assert.equal(yaml, ['structure:', '  layout: tree-right', 'font:', '  size: 18'].join('\n'));
  assert.equal(document.body, '# Root');
  assert.deepEqual(document.rawConfig, config);
});

test('public core reports malformed YAML envelopes before topic parsing', () => {
  assert.throws(() => parseMindDocument('---\nstructure:\n  layout: tree\n# Root'), /缺少结束/);
  assert.throws(() => parseMindDocument('---\n structure:\n---\n# Root'), /缩进请使用 2 个空格/);
});
