import test from 'node:test';
import assert from 'node:assert/strict';

import { parseMindDocument, parseTopicLine } from '../../src/parser/parseMind.js';

test('parseMindDocument parses config block and multi-line topics', () => {
  const document = parseMindDocument(`---
structure:
  layout: mindmap-left
font:
  size: 18
---
# Root [color=#3b82f6]
## Child
continued line
### Leaf`);

  assert.equal(document.rawConfig.structure.layout, 'mindmap-left');
  assert.equal(document.config.layout, 'mindmap-left');
  assert.equal(document.root.text, 'Root');
  assert.equal(document.root.attributes.color, '#3b82f6');
  assert.equal(document.root.subtopics[0].text, 'Child\ncontinued line');
  assert.equal(document.root.subtopics[0].subtopics[0].text, 'Leaf');
});

test('parseMindDocument creates a virtual root for multiple top-level topics', () => {
  const document = parseMindDocument(`# A
# B`);

  assert.equal(document.root._virtual, true);
  assert.equal(document.root.subtopics.length, 2);
  assert.equal(document.root.attributes.layout, 'mindmap-bidirectional');
});

test('parseTopicLine supports quoted topic attributes', () => {
  const parsed = parseTopicLine('Topic [icon=book fontFamily="LXGW WenKai" maxWidth=320]');

  assert.equal(parsed.text, 'Topic');
  assert.deepEqual(parsed.attributes, {
    icon: 'book',
    fontFamily: 'LXGW WenKai',
    maxWidth: '320',
  });
});
