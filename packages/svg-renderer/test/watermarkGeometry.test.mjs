import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalWatermarkElementSize,
  signatureCornerWatermarkGeometry,
  signatureWatermarkBarGeometry,
  signatureWatermarkBarViewportGeometry,
  tiledWatermarkPlacements,
  watermarkCornerTextPoint,
  watermarkPositionPoint,
} from '@yonxao/mindmap-svg-renderer';

const bounds = { minX: 10, minY: 20, maxX: 410, maxY: 320 };

test('watermark position and corner text geometry preserve position semantics', () => {
  assert.deepEqual(watermarkPositionPoint(bounds, 'top-left', 100, 40, 16, 12), {
    x: 26,
    y: 32,
  });
  assert.deepEqual(watermarkPositionPoint(bounds, 'bottom-right', 100, 40, 16), {
    x: 294,
    y: 264,
  });
  assert.deepEqual(watermarkPositionPoint(bounds, 'center', 100, 40, 0), {
    x: 160,
    y: 150,
  });
  assert.deepEqual(
    watermarkCornerTextPoint({ x: 26, y: 32 }, { width: 100, height: 40 }, 'top-left'),
    {
      x: 26,
      y: 32,
      anchor: 'start',
      baseline: 'text-before-edge',
    }
  );
});

test('signature corner geometry derives its box and aligned text from content', () => {
  const geometry = signatureCornerWatermarkGeometry(bounds, {
    text: 'Signed',
    position: 'bottom-right',
    fontSize: 14,
    paddingX: 16,
    paddingY: 12,
  });

  assert.deepEqual(geometry.size, { width: 56, height: 21 });
  assert.deepEqual(geometry.point, { x: 338, y: 287 });
  assert.equal(geometry.radius, 7);
  assert.deepEqual(geometry.text, {
    x: 394,
    y: 308,
    anchor: 'end',
    baseline: 'text-after-edge',
  });
});

test('signature bar geometry expands map bounds and follows the live viewport', () => {
  const top = signatureWatermarkBarGeometry(bounds, {
    position: 'top-right',
    barHeight: 36,
    paddingX: 16,
  });
  assert.deepEqual(top.bar, { x: 10, y: -16, width: 400, height: 36 });
  assert.deepEqual(top.bounds, { minX: 10, minY: -16, maxX: 410, maxY: 320 });
  assert.deepEqual(top.text, { x: 394, y: 2 });

  const bottom = signatureWatermarkBarViewportGeometry(
    { x: 100, y: 200, width: 800, height: 600 },
    { position: 'bottom-right', barHeight: 36, paddingX: 16 }
  );
  assert.deepEqual(bottom.bar, { x: 100, y: 764, width: 800, height: 36 });
  assert.deepEqual(bottom.contentClip, { x: 100, y: 200, width: 800, height: 564 });
  assert.deepEqual(bottom.text, { x: 884, y: 782 });
});

test('normal watermark sizing uses explicit image dimensions and estimated text dimensions', () => {
  assert.deepEqual(
    normalWatermarkElementSize({
      type: 'image',
      arrangement: 'single',
      text: '',
      fontSize: 24,
      width: 160,
      height: 80,
    }),
    { width: 160, height: 80 }
  );
  assert.deepEqual(
    normalWatermarkElementSize({
      type: 'text',
      arrangement: 'single',
      text: 'abcd',
      fontSize: 20,
      width: 160,
      height: 80,
    }),
    { width: 49.6, height: 27 }
  );
});

test('tiled watermark placement is deterministic and bounded for dense maps', () => {
  const config = {
    type: 'text',
    arrangement: 'tiled',
    position: 'center',
    text: 'watermark',
    fontSize: 24,
    width: 20,
    height: 10,
    gapX: 0,
    gapY: 0,
    offsetX: 0,
    offsetY: 0,
  };
  const placements = tiledWatermarkPlacements(bounds, config);
  const densePlacements = tiledWatermarkPlacements(
    { minX: 0, minY: 0, maxX: 100000, maxY: 100000 },
    { ...config, width: 1, height: 1 }
  );

  assert.deepEqual(placements.slice(0, 3), [
    { x: -40, y: 5 },
    { x: 0, y: 5 },
    { x: 40, y: 5 },
  ]);
  assert.ok(placements.length <= 500);
  assert.equal(densePlacements.length, 500);
});
