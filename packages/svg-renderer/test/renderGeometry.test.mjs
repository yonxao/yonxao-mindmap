import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONNECTOR_ROUND_CAP_EXTENSION,
  axisLinePath,
  canvasToMapX,
  canvasToMapY,
  connectorAnchors,
  connectorBendPoint,
  connectorPath,
  fitViewBox,
  fullscreenFitViewBox,
  globalPointToTopicPoint,
  oppositeTopicSide,
  originalSizeFocusRatio,
  originalSizeViewBox,
  pointToButtonPosition,
  projectTopicPointToBorder,
  rootFocusPoint,
  timelineDetailBranchX,
  topicBorderPoint,
  topicControlPointsConflict,
  trimConnectorAnchors,
  zoomViewBox,
} from '@yonxao/mindmap-svg-renderer';
import { connectorGeometryMethods } from '../../../src/renderer/draw/connectorGeometry.js';
import { connectorPathMethods } from '../../../src/renderer/draw/connectorPaths.js';
import { topicPointGeometryMethods } from '../../../src/renderer/draw/topicPointGeometry.js';
import { canvasToMapX as pluginCanvasToMapX } from '../../../src/renderer/viewport/viewportMath.js';

test('public svg renderer generates regular and layout-specific connector paths', () => {
  assert.equal(axisLinePath(0, 10, 100, 10), 'M 0 10 H 100');
  assert.equal(
    connectorPath({ startX: 0, startY: 0, endX: 100, endY: 40, axis: 'x', sign: 1 }, 'curve'),
    'M 0 0 C 46 0 54 40 100 40'
  );
  assert.equal(
    connectorPath({ startX: 0, startY: 0, endX: 100, endY: 40, axis: 'y' }, 'elbow'),
    'M 0 0 V 20 H 100 V 40'
  );
  assert.equal(
    connectorPath({
      kind: 'fishbone-rib-descendant',
      startX: 0,
      startY: 0,
      endX: 100,
      endY: 40,
    }),
    'M 0 0 H 50 V 40 H 100'
  );
  assert.equal(connectorPath({ kind: 'skip', startX: 0, startY: 0, endX: 0, endY: 0 }), '');
});

test('public svg renderer resolves connector anchors for tree, org, timeline and radial layouts', () => {
  const root = { x: 0, y: 0, width: 100, height: 40, side: 'root' };
  assert.deepEqual(
    connectorAnchors(root, {
      x: 200,
      y: 50,
      width: 80,
      height: 30,
      side: 'tree-right',
    }),
    {
      kind: 'tree-branch',
      startX: 0,
      startY: 50,
      endX: 160,
      endY: 50,
    }
  );

  const orgParent = { x: 180, y: 40, width: 100, height: 40, side: 'org-right' };
  assert.deepEqual(
    connectorAnchors(orgParent, {
      x: 320,
      y: 90,
      width: 80,
      height: 30,
      side: 'org-right',
    }),
    {
      kind: 'org-right-subtopic',
      startX: 180,
      startY: 90,
      endX: 280,
      endY: 90,
    }
  );

  const timelineParent = {
    x: 100,
    y: 40,
    width: 80,
    height: 40,
    side: 'timeline-detail-top',
  };
  const timelineChild = {
    x: 220,
    y: 80,
    width: 80,
    height: 30,
    side: 'timeline-detail-top',
  };
  assert.equal(timelineDetailBranchX(timelineParent, [timelineChild]), 156);
  assert.equal(connectorAnchors(timelineParent, timelineChild).startX, 156);

  assert.deepEqual(
    connectorAnchors(root, {
      x: 200,
      y: 0,
      width: 80,
      height: 40,
      side: 'right',
      radialAngle: 0,
    }),
    {
      kind: 'radial',
      startX: 50,
      startY: 0,
      endX: 160,
      endY: 0,
    }
  );
});

test('public svg renderer trims round caps and identifies connector entry bends', () => {
  const trimmed = trimConnectorAnchors(
    { startX: 0, startY: 10, endX: 20, endY: 10, axis: 'x', sign: 1 },
    'straight'
  );
  assert.deepEqual(trimmed, {
    startX: CONNECTOR_ROUND_CAP_EXTENSION,
    startY: 10,
    endX: 20 - CONNECTOR_ROUND_CAP_EXTENSION,
    endY: 10,
    axis: 'x',
    sign: 1,
  });
  assert.deepEqual(
    connectorBendPoint({
      kind: 'hanging-horizontal',
      startX: 10,
      startY: 20,
      endX: 60,
      endY: 80,
    }),
    { x: 10, y: 80 }
  );
});

test('public svg renderer owns topic border points and control collision geometry', () => {
  const box = { x: 100, y: 100, width: 80, height: 40 };
  assert.deepEqual(topicBorderPoint(box, 'right'), { side: 'right', x: 80, y: 20 });
  assert.deepEqual(globalPointToTopicPoint(box, 140, 110), {
    side: 'right',
    x: 80,
    y: 30,
  });
  assert.deepEqual(projectTopicPointToBorder(box, 30, -5), {
    side: 'top',
    x: 30,
    y: 0,
  });
  assert.equal(oppositeTopicSide('bottom'), 'top');
  assert.deepEqual(pointToButtonPosition({ side: 'left', x: 10, y: 20 }, { width: 8, height: 6 }), {
    side: 'left',
    x: 6,
    y: 17,
  });
  assert.equal(
    topicControlPointsConflict({ side: 'right', x: 10, y: 10 }, { side: 'bottom', x: 28, y: 10 }),
    true
  );
});

test('public svg renderer converts coordinates and computes original, fit, fullscreen and zoom view boxes', () => {
  const viewBox = { x: 10, y: 20, width: 200, height: 100 };
  assert.equal(canvasToMapX(50, viewBox, 100), 110);
  assert.equal(canvasToMapY(25, viewBox, 50), 70);

  const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  assert.deepEqual(rootFocusPoint(bounds), { x: 50, y: 50 });
  assert.deepEqual(rootFocusPoint(bounds, { x: 0, y: 0, width: 100, height: 40 }), {
    x: 50,
    y: 20,
  });
  assert.equal(originalSizeFocusRatio(10, 20), 0.32);
  assert.deepEqual(originalSizeViewBox(bounds, { width: 200, height: 100 }, 50, 50), {
    x: -50,
    y: 0,
    width: 200,
    height: 100,
  });
  assert.deepEqual(fitViewBox({ x: 0, y: 0, width: 100, height: 80 }, 300, 2), {
    x: -25,
    y: 0,
    width: 150,
    height: 80,
  });
  assert.deepEqual(
    fullscreenFitViewBox(
      { x: 0, y: 0, width: 100, height: 100 },
      {
        width: 200,
        height: 100,
      }
    ),
    {
      x: -50,
      y: 0,
      width: 200,
      height: 100,
    }
  );
  assert.deepEqual(zoomViewBox({ x: 0, y: 0, width: 200, height: 100 }, 0.5, 100, 50), {
    x: 50,
    y: 10,
    width: 100,
    height: 80,
  });
});

test('plugin compatibility exports preserve renderer method contracts', () => {
  const renderer = {
    effectiveConnectorStyle() {
      return 'straight';
    },
  };
  const anchors = { startX: 0, startY: 0, endX: 20, endY: 10, axis: 'x', sign: 1 };

  assert.equal(
    connectorPathMethods.connectorPath.call(renderer, anchors, 'mindmap-right'),
    'M 0 0 L 20 10'
  );
  const trimmed = connectorGeometryMethods.trimConnectorAnchors.call(
    renderer,
    anchors,
    'mindmap-right'
  );
  assert.ok(
    Math.abs(trimmed.startX - (CONNECTOR_ROUND_CAP_EXTENSION * 20) / Math.hypot(20, 10)) < 1e-12
  );
  assert.deepEqual(topicPointGeometryMethods.topicBorderPoint({ width: 80, height: 40 }, 'top'), {
    side: 'top',
    x: 40,
    y: 0,
  });
  assert.equal(pluginCanvasToMapX(50, { x: 10, y: 20, width: 200, height: 100 }, 100), 110);
});
