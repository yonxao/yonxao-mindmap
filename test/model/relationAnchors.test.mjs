import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyRelationAnchorEndpoints,
  nearestRelationAnchor,
  relationAnchorPoints,
  relationControlMapUnitsPerPixel,
} from '../../src/model/relationAnchors.js';

const LAYOUT = { x: 100, y: 80, width: 120, height: 60 };

test('relationAnchorPoints returns eight stable topic-border anchors', () => {
  assert.deepEqual(relationAnchorPoints(LAYOUT), [
    { name: 'top-left', x: 48, y: 50 },
    { name: 'top', x: 100, y: 50 },
    { name: 'top-right', x: 152, y: 50 },
    { name: 'left', x: 40, y: 80 },
    { name: 'right', x: 160, y: 80 },
    { name: 'bottom-left', x: 48, y: 110 },
    { name: 'bottom', x: 100, y: 110 },
    { name: 'bottom-right', x: 152, y: 110 },
  ]);
});

test('relationControlMapUnitsPerPixel keeps controls stable across viewBox zoom', () => {
  assert.equal(relationControlMapUnitsPerPixel({ width: 1200, height: 600 }, 600, 300), 2);
  assert.equal(relationControlMapUnitsPerPixel({ width: 300, height: 150 }, 600, 300), 0.5);
  assert.equal(relationControlMapUnitsPerPixel(null, 0, 0), 1);
});

test('nearestRelationAnchor snaps to the closest fixed anchor', () => {
  assert.equal(nearestRelationAnchor(LAYOUT, { x: 156, y: 52 }).name, 'top-right');
  assert.equal(nearestRelationAnchor(LAYOUT, { x: 42, y: 82 }).name, 'left');
});

test('applyRelationAnchorEndpoints only replaces manually configured endpoints', () => {
  assert.deepEqual(
    applyRelationAnchorEndpoints(
      [
        { x: 160, y: 80 },
        { x: 240, y: 80 },
      ],
      LAYOUT,
      { x: 260, y: 180, width: 80, height: 40 },
      { fromAnchor: 'bottom', toAnchor: 'top-left' }
    ),
    [
      { x: 100, y: 110 },
      { x: 228, y: 160 },
    ]
  );
});
