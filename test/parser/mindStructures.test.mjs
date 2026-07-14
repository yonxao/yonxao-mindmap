import assert from 'node:assert/strict';
import test from 'node:test';

import { parseMindDocument } from '../../src/parser/parseMind.js';
import { serializeMindDocument } from '../../src/parser/serializeMind.js';

const SOURCE = `# 功能列表 [id=root]
## 编辑能力 [id=edit]
### 新增主题 [id=add]
### 删除主题 [id=remove]
## 导出能力 [id=export]

@structures
@relation [id=r1 from=edit to=export text="编辑后导出" direction=forward]
@summary [id=s1 topics=add,remove text="主题操作"]
@boundary [id=b1 topics=edit text="编辑范围"]
@end`;

test('parseMindDocument separates advanced structures from topic content', () => {
  const document = parseMindDocument(SOURCE);
  assert.equal(document.root.text, '功能列表');
  assert.equal(document.root.subtopics.length, 2);
  assert.equal(document.structures.length, 3);
  assert.deepEqual(document.structures[0].topicIds, ['edit', 'export']);
  assert.equal(document.structures[0].attributes.direction, 'forward');
  assert.equal(document.structures[0].attributes.lineStyle, 'curve');
});

test('serializeMindDocument round-trips all advanced structure types', () => {
  const document = parseMindDocument(SOURCE);
  const serialized = serializeMindDocument(document.root, {}, false, {}, document.structures);
  const reparsed = parseMindDocument(serialized);
  assert.deepEqual(reparsed.structures, document.structures);
  assert.match(serialized, /@structures[\s\S]*@relation[\s\S]*@summary[\s\S]*@boundary[\s\S]*@end/);
  assert.doesNotMatch(serialized, /direction=forward/);
  assert.doesNotMatch(serialized, /lineStyle=curve/);
});

test('serializeMindDocument keeps default relation options when saving full config', () => {
  const document = parseMindDocument(SOURCE);
  const serialized = serializeMindDocument(
    document.root,
    { display: { saveFullConfig: true } },
    true,
    {},
    document.structures
  );
  assert.match(serialized, /direction=forward/);
  assert.match(serialized, /lineStyle=curve/);
});

test('serializeMindDocument keeps non-default relation options when pruning', () => {
  const document = parseMindDocument(SOURCE);
  document.structures[0].attributes.direction = 'both';
  document.structures[0].attributes.lineStyle = 'elbow';
  const serialized = serializeMindDocument(document.root, {}, false, {}, document.structures);
  assert.match(serialized, /direction=both/);
  assert.match(serialized, /lineStyle=elbow/);
});

test('relation text preserves manual line breaks', () => {
  const document = parseMindDocument(SOURCE);
  document.structures[0].text = '编辑后\n导出';
  const serialized = serializeMindDocument(document.root, {}, false, {}, document.structures);
  const reparsed = parseMindDocument(serialized);
  assert.match(serialized, /text="编辑后\\n导出"/);
  assert.equal(reparsed.structures[0].text, '编辑后\n导出');
});

test('relation endpoint anchors round-trip through structure syntax', () => {
  const document = parseMindDocument(SOURCE);
  document.structures[0].attributes.fromAnchor = 'bottom-right';
  document.structures[0].attributes.toAnchor = 'top-left';
  const serialized = serializeMindDocument(document.root, {}, false, {}, document.structures);
  const reparsed = parseMindDocument(serialized);
  assert.match(serialized, /fromAnchor=bottom-right/);
  assert.match(serialized, /toAnchor=top-left/);
  assert.equal(reparsed.structures[0].attributes.fromAnchor, 'bottom-right');
  assert.equal(reparsed.structures[0].attributes.toAnchor, 'top-left');
});

test('relation rejects unknown endpoint anchors', () => {
  assert.throws(
    () =>
      parseMindDocument(`# 根 [id=root]
## A [id=a]
@structures
@relation [id=r1 from=root to=a fromAnchor=center]
@end`),
    /fromAnchor 无效/
  );
});

test('summary rejects non-contiguous sibling topics', () => {
  assert.throws(
    () =>
      parseMindDocument(`# 根
## A [id=a]
## B [id=b]
## C [id=c]
@structures
@summary [id=s1 topics=a,c]
@end`),
    /连续的同级主题/
  );
});

test('structures reject missing topic references', () => {
  assert.throws(
    () =>
      parseMindDocument(`# 根 [id=root]
@structures
@relation [id=r1 from=root to=missing]
@end`),
    /不存在的主题/
  );
});

test('structures without ids use short type-prefixed ids', () => {
  const document = parseMindDocument(`# 根 [id=root]
## A [id=a]
## B [id=b]
@structures
@relation [from=a to=b]
@summary [topics=a,b]
@boundary [topics=a]
@end`);
  assert.deepEqual(
    document.structures.map((structure) => structure.id),
    ['r-001', 's-001', 'b-001']
  );
});
