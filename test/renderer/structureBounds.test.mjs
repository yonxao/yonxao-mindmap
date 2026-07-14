import test from 'node:test';
import assert from 'node:assert/strict';

import { reserveBoundaryLabelVerticalSpace } from '../../src/renderer/draw/structureBounds.js';

test('boundary label spacing keeps later parent and child topics aligned', () => {
  const previousTopic = createTopic('previous', 220, 50);
  const boundaryTopic = createTopic('boundary', 220, 100);
  const keyboardParent = createTopic('keyboard', 80, 220);
  const keyboardChild = createTopic('move-focus', 220, 220);
  const otherParent = createTopic('other', 80, 300);
  const watermarkChild = createTopic('watermark', 220, 300);
  const topics = [
    previousTopic,
    boundaryTopic,
    keyboardParent,
    keyboardChild,
    otherParent,
    watermarkChild,
  ];

  const shiftY = reserveBoundaryLabelVerticalSpace(
    topics,
    [boundaryTopic],
    { minX: 174, minY: 79, maxX: 266, maxY: 121 },
    { minX: 184, minY: 45, maxX: 250, maxY: 67 },
    8
  );

  assert.equal(shiftY, 34);
  assert.equal(previousTopic._layout.y, 50);
  assert.equal(boundaryTopic._layout.y, 134);
  assert.equal(keyboardParent._layout.y, 254);
  assert.equal(keyboardChild._layout.y, 254);
  assert.equal(otherParent._layout.y, 334);
  assert.equal(watermarkChild._layout.y, 334);
});

test('boundary label spacing leaves layout unchanged without a collision', () => {
  const boundaryTopic = createTopic('boundary', 220, 100);
  const laterTopic = createTopic('later', 80, 220);

  const shiftY = reserveBoundaryLabelVerticalSpace(
    [boundaryTopic, laterTopic],
    [boundaryTopic],
    { minX: 174, minY: 79, maxX: 266, maxY: 121 },
    { minX: 184, minY: 45, maxX: 250, maxY: 67 },
    8
  );

  assert.equal(shiftY, 0);
  assert.equal(boundaryTopic._layout.y, 100);
  assert.equal(laterTopic._layout.y, 220);
});

function createTopic(text, x, y) {
  return {
    text,
    _layout: {
      x,
      y,
      width: 92,
      height: 42,
    },
  };
}
