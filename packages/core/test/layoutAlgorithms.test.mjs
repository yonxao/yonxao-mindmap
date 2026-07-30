import assert from 'node:assert/strict';
import test from 'node:test';

import {
  LAYOUT_MODES,
  isLayoutMode,
  layoutFishbone,
  layoutHorizontalMind,
  layoutOrgChart,
  layoutOutlineTree,
  layoutRadial,
  layoutTimeline,
  layoutTree as layoutMeasuredTree,
  layoutTreeTable,
  layoutVerticalMind,
  normalizeLayoutMode,
  radialBranchDirectionPlans,
} from '@yonxao/mindmap-core';

function createTopic(id, level, subtopics = []) {
  return {
    id,
    level,
    subtopics,
    _layout: {
      x: 0,
      y: 0,
      width: 92,
      height: 42,
      lines: [id],
      font: { size: 14, lineHeight: 18 },
      textY: 0,
    },
  };
}

function createTree() {
  return createTopic('root', 1, [
    createTopic('a', 2, [createTopic('a1', 3)]),
    createTopic('b', 2),
    createTopic('c', 2),
  ]);
}

test('public core dispatches every supported layout from measured topics', () => {
  assert.equal(LAYOUT_MODES.length, 19);

  for (const mode of LAYOUT_MODES) {
    const root = createTree();
    const result = layoutMeasuredTree(root, new Set(), {
      mode,
      branchExpansion: 'side',
    });

    assert.equal(result.mode, mode);
    assert.equal(result.topics.length, 5);
    assert.equal(result.connectors.length, 4);
    assert.ok(result.bounds.maxX > result.bounds.minX);
    assert.ok(result.bounds.maxY > result.bounds.minY);
    for (const topic of result.topics) {
      assert.equal(Number.isFinite(topic._layout.x), true, `${mode} produced invalid x`);
      assert.equal(Number.isFinite(topic._layout.y), true, `${mode} produced invalid y`);
    }
  }
});

test('public core normalizes layout modes and filters collapsed descendants', () => {
  assert.equal(isLayoutMode('tree-right'), true);
  assert.equal(isLayoutMode('unknown'), false);
  assert.equal(normalizeLayoutMode(' TREE-RIGHT '), 'tree-right');
  assert.equal(normalizeLayoutMode('unknown'), 'mindmap-right');

  const root = createTree();
  const result = layoutMeasuredTree(root, new Set(['a']), { mode: 'mindmap-right' });

  assert.deepEqual(
    result.topics.map((topic) => topic.id),
    ['root', 'a', 'b', 'c']
  );
  assert.equal(result.connectors.length, 3);
});

test('public core lays out horizontal and vertical mind maps from measured topics', () => {
  const horizontalRoot = createTree();
  layoutHorizontalMind(horizontalRoot, new Set(), 'mindmap-bidirectional', 'side');

  assert.equal(horizontalRoot.subtopics[0]._layout.side, 'right');
  assert.equal(horizontalRoot.subtopics[1]._layout.side, 'left');
  assert.ok(horizontalRoot.subtopics[0]._layout.x > horizontalRoot._layout.x);
  assert.ok(horizontalRoot.subtopics[1]._layout.x < horizontalRoot._layout.x);

  const verticalRoot = createTree();
  layoutVerticalMind(verticalRoot, new Set(), 'mindmap-vertical', 'side');

  assert.equal(verticalRoot.subtopics[0]._layout.side, 'bottom');
  assert.equal(verticalRoot.subtopics[1]._layout.side, 'top');
  assert.ok(verticalRoot.subtopics[0]._layout.y > verticalRoot._layout.y);
  assert.ok(verticalRoot.subtopics[1]._layout.y < verticalRoot._layout.y);
});

test('public core assigns and places radial branches without host adapters', () => {
  const root = createTree();
  const plans = radialBranchDirectionPlans(root.subtopics, new Set());

  assert.equal(plans.length, 3);
  assert.equal(new Set(plans.map((plan) => plan.angle)).size, 3);

  layoutRadial(root, new Set());
  for (const topic of root.subtopics) {
    assert.equal(Number.isFinite(topic._layout.x), true);
    assert.equal(Number.isFinite(topic._layout.y), true);
    assert.equal(Number.isFinite(topic._layout.radialAngle), true);
  }
});

test('public core lays out outline trees on stable trunk sides', () => {
  const root = createTree();
  layoutOutlineTree(root, new Set(), 'tree', 'side');

  assert.equal(root.subtopics[0]._layout.side, 'tree-right');
  assert.equal(root.subtopics[1]._layout.side, 'tree-left');
  assert.ok(root.subtopics[0]._layout.x > root._layout.x);
  assert.ok(root.subtopics[1]._layout.x < root._layout.x);
  assert.ok(root.subtopics[2]._layout.y > root.subtopics[1]._layout.y);
});

test('public core lays out tree tables from measured text metrics', () => {
  const createTableTopic = (id, subtopics = []) => ({
    id,
    subtopics,
    _layout: {
      x: 0,
      y: 0,
      width: 92,
      height: 42,
      lines: [id],
      font: { size: 14, lineHeight: 18 },
      textY: 0,
    },
  });
  const deepLeaf = createTableTopic('a1');
  const first = createTableTopic('a', [deepLeaf]);
  const shallowLeaf = createTableTopic('b');
  const root = createTableTopic('root', [first, shallowLeaf]);

  layoutTreeTable(root, new Set(), { fillLeafRemainderColumns: true });

  assert.equal(root._layout.side, 'tree-table-root');
  assert.equal(root._layout.width, 240);
  assert.equal(first._layout.treeTableColumn, 0);
  assert.equal(deepLeaf._layout.treeTableColumn, 1);
  assert.equal(shallowLeaf._layout.treeTableColumnSpan, 2);
  assert.equal(Number.isFinite(root._layout.textY), true);
});

test('public core lays out standard and right-facing organization charts', () => {
  const standardRoot = createTree();
  standardRoot._layout.side = 'root';
  layoutOrgChart(standardRoot, new Set(), 'org', 'side');

  assert.equal(standardRoot.subtopics[0]._layout.side, 'org-bottom');
  assert.equal(standardRoot.subtopics[0]._layout.y, standardRoot.subtopics[1]._layout.y);

  const rightRoot = createTree();
  layoutOrgChart(rightRoot, new Set(), 'org-right', 'side');

  assert.equal(rightRoot.subtopics[0]._layout.side, 'org-right-branch');
  assert.equal(rightRoot.subtopics[0].subtopics[0]._layout.side, 'org-right');
  assert.ok(rightRoot.subtopics[0].subtopics[0]._layout.x > rightRoot.subtopics[0]._layout.x);
});

test('public core lays out balanced timelines with independent detail sides', () => {
  const root = createTree();

  layoutTimeline(root, new Set(), 'timeline', 'side');

  assert.equal(root.subtopics[0]._layout.timelineBranchSide, 'timeline-top');
  assert.equal(root.subtopics[1]._layout.timelineBranchSide, 'timeline-bottom');
  assert.equal(root.subtopics[0]._layout.side, 'timeline-point');
  assert.equal(root.subtopics[0].subtopics[0]._layout.side, 'timeline-detail-top');
  assert.equal(Number.isFinite(root._layout.timelineAxisY), true);
  assert.ok(root._layout.timelineAxisMaxX > root._layout.timelineAxisMinX);
});

test('public core lays out fishbone diagrams with complete spine metadata', () => {
  for (const [mode, direction] of [
    ['fishbone-left', -1],
    ['fishbone-right', 1],
  ]) {
    const root = createTree();

    layoutFishbone(root, new Set(), mode, 'side');

    const firstPrimary = root.subtopics[0];
    const firstRib = firstPrimary.subtopics[0];
    assert.equal(root._layout.fishboneDirection, direction);
    assert.equal(firstPrimary._layout.side, 'fishbone-top');
    assert.equal(root.subtopics[1]._layout.side, 'fishbone-bottom');
    assert.equal(Math.sign(firstPrimary._layout.x - root._layout.x), direction);
    assert.equal(firstRib._layout.side, 'fishbone-rib-topic');
    assert.equal(Number.isFinite(firstPrimary._layout.fishboneMainSpineAttachX), true);
    assert.equal(Number.isFinite(firstPrimary._layout.fishboneDiagonalBoneEndY), true);
    assert.equal(Number.isFinite(firstRib._layout.fishboneDiagonalBoneAttachX), true);
  }
});
