import {
  TREE_DESCENDANT_LEVEL_GAP,
  TREE_DESCENDANT_SIBLING_GAP,
  TREE_HANGING_SIBLING_GAP,
  TREE_TRUNK_BRANCH_GAP,
  TREE_TRUNK_LEVEL_GAP,
  TREE_TRUNK_ORDER_GAP,
  TREE_TRUNK_START_GAP,
} from './layoutConstants.js';
import {
  directSubtopicGroupCenterOffset,
  horizontalHangingStartOffset,
  normalizeVerticalExtent,
  shouldUseHangingExpansion,
  verticalExtentGroupHeight,
} from './layoutGeometry.js';
import type { BranchExpansion, VerticalExtent } from './layoutGeometry.js';
import type { LayoutTopic, TreeLayoutSide } from './layoutTypes.js';
import { visibleSubtopics } from '../model/topicTraversal.js';

export type OutlineTreeMode = 'tree' | 'tree-left' | 'tree-right';

export interface TreeTrunkEntry {
  subtopic: LayoutTopic;
  side: TreeLayoutSide;
  extent: VerticalExtent;
}

export function layoutOutlineTree(
  root: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  mode: OutlineTreeMode = 'tree-right',
  branchExpansion: BranchExpansion = 'side'
): void {
  const rootSubtopics = visibleSubtopics(root, collapsedIds);
  placeTreeTrunkSubtopics(root, rootSubtopics, mode, collapsedIds, branchExpansion);
}

export function placeTreeTrunkSubtopics(
  root: LayoutTopic,
  subtopics: readonly LayoutTopic[],
  mode: OutlineTreeMode,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): void {
  if (!subtopics.length) return;

  if (mode === 'tree') {
    const entries = subtopics.map((subtopic, index) => {
      const side = rootSubtopicTreeSide(index, mode);
      return {
        subtopic,
        side,
        extent: treeSubtreeExtent(subtopic, side, collapsedIds, branchExpansion),
      };
    });
    placeTreeTrunkSide(root, entries, collapsedIds, branchExpansion);
    return;
  }

  const sideEntries: Record<TreeLayoutSide, TreeTrunkEntry[]> = {
    'tree-left': [],
    'tree-right': [],
  };
  subtopics.forEach((subtopic, index) => {
    const side = rootSubtopicTreeSide(index, mode);
    sideEntries[side].push({
      subtopic,
      side,
      extent: treeSubtreeExtent(subtopic, side, collapsedIds, branchExpansion),
    });
  });

  placeTreeTrunkSide(root, sideEntries['tree-right'], collapsedIds, branchExpansion);
  placeTreeTrunkSide(root, sideEntries['tree-left'], collapsedIds, branchExpansion);
}

export function placeTreeTrunkSide(
  root: LayoutTopic,
  entries: readonly TreeTrunkEntry[],
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): void {
  if (!entries.length) return;

  const rootBox = root._layout;
  const firstAttachY = rootBox.y + rootBox.height / 2 + TREE_TRUNK_START_GAP;
  let nextOrderedAttachY = firstAttachY;
  const sideBottoms: Record<TreeLayoutSide, number> = {
    'tree-left': firstAttachY - TREE_TRUNK_BRANCH_GAP,
    'tree-right': firstAttachY - TREE_TRUNK_BRANCH_GAP,
  };

  for (const entry of entries) {
    const { subtopic, side, extent } = entry;
    const subtopicBox = subtopic._layout;
    const direction = side === 'tree-left' ? -1 : 1;
    const sideSafeAttachY = sideBottoms[side] + TREE_TRUNK_BRANCH_GAP + extent.above;
    const attachY = Math.max(nextOrderedAttachY, sideSafeAttachY);

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'side';
    subtopicBox.x = rootBox.x + direction * (TREE_TRUNK_LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = attachY;

    placeTreeDescendants(subtopic, side, collapsedIds, branchExpansion);
    sideBottoms[side] = attachY - extent.above + extent.height;
    nextOrderedAttachY = attachY + TREE_TRUNK_ORDER_GAP;
  }
}

export function rootSubtopicTreeSide(index: number, mode: OutlineTreeMode): TreeLayoutSide {
  if (mode === 'tree-left') return 'tree-left';
  if (mode === 'tree') return index % 2 === 0 ? 'tree-right' : 'tree-left';
  return 'tree-right';
}

export function placeTreeDescendants(
  parent: LayoutTopic,
  side: TreeLayoutSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): void {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (shouldUseTreeHangingExpansion(parent, collapsedIds, branchExpansion)) {
    placeTreeHangingDescendants(parent, side, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  const extents = subtopics.map((subtopic) =>
    treeSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const centerOffset = directSubtopicGroupCenterOffset(extents, TREE_DESCENDANT_SIBLING_GAP);
  const direction = side === 'tree-left' ? -1 : 1;
  let y = parentBox.y - centerOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const extent = extents[index];

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'side';
    subtopicBox.x =
      parentBox.x +
      direction * (parentBox.width / 2 + TREE_DESCENDANT_LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = y + extent.above;

    placeTreeDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += extent.height + TREE_DESCENDANT_SIBLING_GAP;
  }
}

export function placeTreeHangingDescendants(
  parent: LayoutTopic,
  side: TreeLayoutSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): void {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const extents = subtopics.map((subtopic) =>
    treeSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalHeight = verticalExtentGroupHeight(extents, TREE_HANGING_SIBLING_GAP);
  const direction = side === 'tree-left' ? -1 : 1;
  let y = parentBox.y + parentBox.height / 2 + TREE_HANGING_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x =
      parentBox.x +
      direction * (horizontalHangingStartOffset(parentBox, subtopicBox) + subtopicBox.width / 2);
    subtopicBox.y = y + extent.above;

    placeTreeDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += extent.height + TREE_HANGING_SIBLING_GAP;
  }

  parentBox.hangingSubtopicsHeight = totalHeight;
}

function shouldUseTreeHangingExpansion(
  parent: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): boolean {
  return (
    shouldUseHangingExpansion(parent, branchExpansion) &&
    visibleSubtopics(parent, collapsedIds).length > 1
  );
}

function treeSubtreeExtent(
  topic: LayoutTopic,
  side: TreeLayoutSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): VerticalExtent {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const ownAbove = box.height / 2;
  const ownBelow = box.height / 2;

  if (!subtopics.length) {
    return normalizeVerticalExtent({ above: ownAbove, below: ownBelow });
  }

  const subtopicExtents = subtopics.map((subtopic) =>
    treeSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );

  if (shouldUseTreeHangingExpansion(topic, collapsedIds, branchExpansion)) {
    const subtopicHeight = verticalExtentGroupHeight(subtopicExtents, TREE_HANGING_SIBLING_GAP);
    return normalizeVerticalExtent({
      above: ownAbove,
      below: ownBelow + TREE_HANGING_SIBLING_GAP + subtopicHeight,
    });
  }

  const subtopicHeight = verticalExtentGroupHeight(subtopicExtents, TREE_DESCENDANT_SIBLING_GAP);
  const subtopicCenterOffset = directSubtopicGroupCenterOffset(
    subtopicExtents,
    TREE_DESCENDANT_SIBLING_GAP
  );
  return normalizeVerticalExtent({
    above: Math.max(ownAbove, subtopicCenterOffset),
    below: Math.max(ownBelow, subtopicHeight - subtopicCenterOffset),
  });
}

export function treeSubtreeHeight(
  topic: LayoutTopic,
  side: TreeLayoutSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): number {
  return treeSubtreeExtent(topic, side, collapsedIds, branchExpansion).height;
}
