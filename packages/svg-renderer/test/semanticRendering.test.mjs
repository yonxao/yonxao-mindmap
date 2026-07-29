import assert from 'node:assert/strict';
import test from 'node:test';

import {
  avoidSiblingInsertionPoint,
  boundaryGeometry,
  curveRouteGeometry,
  orthogonalRelationPoints,
  relationGeometry,
  relationRoute,
  resolveTopicControlPoints,
  summaryGeometry,
} from '@yonxao/mindmap-svg-renderer';
import { topicControlPointMethods } from '../../../src/renderer/draw/topicControlPoints.js';
import { reserveBoundaryLabelVerticalSpace } from '../../../src/renderer/draw/structureBounds.js';

function createTopic(id, x, y, side = 'right', subtopics = []) {
  return {
    id,
    level: 1,
    subtopics,
    _layout: { x, y, width: 100, height: 40, side },
  };
}

test('topic control semantics cover bidirectional roots and normal descendants', () => {
  const left = createTopic('left', -160, -30, 'left');
  const right = createTopic('right', 160, 30, 'right');
  const root = createTopic('root', 0, 0, 'root', [left, right]);

  const rootPoints = resolveTopicControlPoints(root, {
    root,
    layoutMode: 'mindmap-bidirectional',
    collapsedIds: new Set(),
  });
  assert.deepEqual(rootPoints.childConnectorOutlet, { side: 'bottom', x: 50, y: 40 });
  assert.deepEqual(rootPoints.parentConnectorInlet, { side: 'top', x: 50, y: 0 });

  const rightPoints = resolveTopicControlPoints(right, {
    root,
    layoutMode: 'mindmap-bidirectional',
    collapsedIds: new Set(),
  });
  assert.deepEqual(rightPoints.parentConnectorInlet, { side: 'left', x: 0, y: 20 });
  assert.deepEqual(rightPoints.childConnectorOutlet, { side: 'right', x: 100, y: 20 });
  assert.equal(rightPoints.previousSiblingInsertionPoint.side, 'top');
  assert.equal(rightPoints.nextSiblingInsertionPoint.side, 'bottom');
});

test('topic control semantics preserve timeline, fishbone and hanging connector rules', () => {
  const timelinePoint = createTopic('event', 160, -60, 'timeline-point');
  timelinePoint._layout.timelineBranchSide = 'timeline-top';
  const timelineRoot = createTopic('timeline-root', 0, 0, 'root', [timelinePoint]);
  const timelinePoints = resolveTopicControlPoints(timelinePoint, {
    root: timelineRoot,
    layoutMode: 'timeline-up',
  });
  assert.equal(timelinePoints.parentConnectorInlet.side, 'left');
  assert.equal(timelinePoints.childConnectorOutlet.side, 'top');
  assert.equal(timelinePoints.previousSiblingInsertionPoint.side, 'left');

  const fishbonePrimary = createTopic('bone', 180, -100, 'fishbone-top');
  fishbonePrimary._layout.fishboneDiagonalBoneEndX = 180;
  fishbonePrimary._layout.fishboneDiagonalBoneEndY = -80;
  const fishboneRoot = createTopic('fish-root', 0, 0, 'root', [fishbonePrimary]);
  const fishbonePoints = resolveTopicControlPoints(fishbonePrimary, {
    root: fishboneRoot,
    layoutMode: 'fishbone-right',
  });
  assert.equal(fishbonePoints.parentConnectorInlet.side, 'left');
  assert.equal(fishbonePoints.childConnectorOutlet.side, 'bottom');

  const hangingChild = createTopic('hanging-child', 180, 100, 'right');
  hangingChild._layout.branchExpansion = 'hanging';
  const hangingParent = createTopic('hanging-parent', 0, 0, 'right', [hangingChild]);
  const hangingRoot = createTopic('hanging-root', -160, 0, 'root', [hangingParent]);
  const hangingPoints = resolveTopicControlPoints(hangingParent, {
    root: hangingRoot,
    layoutMode: 'mindmap-right',
  });
  assert.deepEqual(hangingPoints.childConnectorOutlet.siblingAvoidVector, { x: -1, y: 0 });
});

test('sibling insertion avoidance and plugin adapter preserve the public semantic result', () => {
  const blockedPoint = {
    side: 'bottom',
    x: 50,
    y: 40,
    siblingAvoidVector: { x: -1, y: 0 },
  };
  assert.deepEqual(
    avoidSiblingInsertionPoint({ side: 'bottom', x: 50, y: 40 }, 'after', [blockedPoint]),
    { side: 'bottom', x: 31, y: 40 }
  );

  const child = createTopic('child', 160, 0, 'right');
  const root = createTopic('root', 0, 0, 'root', [child]);
  const renderer = {
    root,
    config: { layout: 'mindmap-right' },
    collapsedIds: new Set(),
  };
  assert.deepEqual(
    topicControlPointMethods.resolveTopicControlPoints.call(renderer, child),
    resolveTopicControlPoints(child, {
      root,
      layoutMode: 'mindmap-right',
      collapsedIds: new Set(),
    })
  );
});

test('boundary and summary geometry include measured labels and neighbor clearance', () => {
  const included = createTopic('included', 100, 100);
  const neighbor = createTopic('neighbor', 205, 100);
  const boundary = boundaryGeometry([included], [included, neighbor], 70);

  assert.equal(boundary.frame.maxX, 152);
  assert.equal(boundary.padding.right, 2);
  assert.deepEqual(boundary.labelBox, {
    minX: 48,
    minY: 46,
    maxX: 130,
    maxY: 68,
  });
  assert.equal(boundary.bounds.maxX, 152);

  const summary = summaryGeometry([included], 0, 80, 2);
  assert.equal(summary.side, 1);
  assert.match(summary.path, /^M 166 80 Q 176 80/);
  assert.deepEqual(summary.labelPoint, { x: 190, y: 100 });
  assert.deepEqual(summary.labelBox, {
    minX: 182,
    minY: 79,
    maxX: 278,
    maxY: 121,
  });
});

test('relation geometry routes around obstacles and supports anchors and curve controls', () => {
  const from = createTopic('from', 0, 0);
  const obstacle = createTopic('obstacle', 150, 0);
  const to = createTopic('to', 300, 0);
  const route = relationRoute(from, to, [from, obstacle, to], 'mindmap-right');

  assert.equal(route.collisions, 0);
  assert.equal(route.points.length, 4);
  assert.ok(route.points.some((point) => Math.abs(point.y) > 40));

  assert.deepEqual(
    orthogonalRelationPoints(
      [
        { x: 0, y: 0 },
        { x: 100, y: 80 },
      ],
      'top',
      'right'
    ),
    [
      { x: 0, y: 0 },
      { x: 0, y: 80 },
      { x: 100, y: 80 },
    ]
  );

  const curve = curveRouteGeometry(
    [
      { x: 0, y: 0 },
      { x: 120, y: 0 },
    ],
    { control1: '0.25,20', control2: '0.75,20' }
  );
  assert.deepEqual(curve.controls, [
    { x: 30, y: 20 },
    { x: 90, y: 20 },
  ]);

  const geometry = relationGeometry(from, to, [from, to], 'mindmap-left', 'curve', {}, 30, 1);
  assert.match(geometry.path, /^M 50 0 C /);
  assert.equal(geometry.controls.length, 2);
  assert.ok(geometry.bounds.minY < 0);
  assert.ok(geometry.bounds.maxX >= 250);
});

test('boundary label compatibility export still shifts aligned layout rows together', () => {
  const previous = createTopic('previous', 220, 50);
  const included = createTopic('included', 220, 100);
  const laterParent = createTopic('later-parent', 80, 220);
  const laterChild = createTopic('later-child', 220, 220);

  const shift = reserveBoundaryLabelVerticalSpace(
    [previous, included, laterParent, laterChild],
    [included],
    { minX: 170, minY: 80, maxX: 270, maxY: 120 },
    { minX: 180, minY: 45, maxX: 250, maxY: 67 },
    8
  );
  assert.equal(shift, 33);
  assert.equal(previous._layout.y, 50);
  assert.equal(included._layout.y, 133);
  assert.equal(laterParent._layout.y, 253);
  assert.equal(laterChild._layout.y, 253);
});
