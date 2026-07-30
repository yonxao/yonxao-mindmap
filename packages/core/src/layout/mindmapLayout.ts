import {
  BRANCH_GAP,
  HANGING_LEVEL_GAP,
  HANGING_SIBLING_GAP,
  LEVEL_GAP,
  SIBLING_GAP,
} from './layoutConstants.js';
import {
  directSubtopicGroupCenterOffset,
  directSubtopicGroupCenterXOffset,
  horizontalExtentGroupWidth,
  horizontalSubtreeExtent,
  shouldUseHangingExpansion,
  verticalExtentGroupHeight,
  verticalHangingDirection,
  verticalHangingStartOffset,
  verticalSubtreeExtent,
} from './layoutGeometry.js';
import type { BranchExpansion } from './layoutGeometry.js';
import type { LayoutTopic } from './layoutTypes.js';
import { visibleSubtopics } from '../model/topicTraversal.js';

export type HorizontalMindMapMode = 'mindmap-left' | 'mindmap-right' | 'mindmap-bidirectional';
export type VerticalMindMapMode = 'mindmap-up' | 'mindmap-down' | 'mindmap-vertical';
export type HorizontalMindMapSide = 'left' | 'right';
export type VerticalMindMapSide = 'top' | 'bottom';

export function layoutHorizontalMind(
  root: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  mode: HorizontalMindMapMode,
  branchExpansion: BranchExpansion = 'side'
): void {
  const visibleRootSubtopics = visibleSubtopics(root, collapsedIds);
  const rightSubtopics: LayoutTopic[] = [];
  const leftSubtopics: LayoutTopic[] = [];

  visibleRootSubtopics.forEach((subtopic, index) => {
    const side = rootSubtopicHorizontalSide(index, mode);
    if (side === 'left') {
      leftSubtopics.push(subtopic);
    } else {
      rightSubtopics.push(subtopic);
    }
  });

  placeHorizontalRootSide(root, rightSubtopics, 'right', collapsedIds, branchExpansion);
  placeHorizontalRootSide(root, leftSubtopics, 'left', collapsedIds, branchExpansion);
}

export function rootSubtopicHorizontalSide(
  index: number,
  mode: HorizontalMindMapMode
): HorizontalMindMapSide {
  if (mode === 'mindmap-left') return 'left';
  if (mode === 'mindmap-right') return 'right';
  return index % 2 === 0 ? 'right' : 'left';
}

export function placeHorizontalRootSide(
  root: LayoutTopic,
  subtopics: readonly LayoutTopic[],
  side: HorizontalMindMapSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): void {
  if (!subtopics.length) return;

  const rootBox = root._layout;
  const extents = subtopics.map((subtopic) =>
    horizontalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalHeight = verticalExtentGroupHeight(extents, BRANCH_GAP);
  let y = rootBox.y - totalHeight / 2;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;
    const direction = side === 'left' ? -1 : 1;

    subtopicBox.side = side;
    subtopicBox.x = rootBox.x + direction * (rootBox.width / 2 + LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = y + extent.above;

    placeHorizontalDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += extent.height + BRANCH_GAP;
  }
}

export function placeHorizontalDescendants(
  parent: LayoutTopic,
  side: HorizontalMindMapSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): void {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (shouldUseHangingExpansion(parent, branchExpansion)) {
    placeHorizontalHangingDescendants(parent, side, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  const extents = subtopics.map((subtopic) =>
    horizontalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const groupCenterOffset = directSubtopicGroupCenterOffset(extents, SIBLING_GAP);
  let y = parentBox.y - groupCenterOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;
    const direction = side === 'left' ? -1 : 1;

    subtopicBox.side = side;
    subtopicBox.x =
      parentBox.x + direction * (parentBox.width / 2 + LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = y + extent.above;

    placeHorizontalDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += extent.height + SIBLING_GAP;
  }
}

export function placeHorizontalHangingDescendants(
  parent: LayoutTopic,
  side: HorizontalMindMapSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): void {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const extents = subtopics.map((subtopic) =>
    horizontalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalHeight = verticalExtentGroupHeight(extents, HANGING_SIBLING_GAP);
  const direction = side === 'left' ? -1 : 1;
  let y = parentBox.y + parentBox.height / 2 + HANGING_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x = parentBox.x + direction * (HANGING_LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = y + extent.above;

    placeHorizontalDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += extent.height + HANGING_SIBLING_GAP;
  }

  parentBox.hangingSubtopicsHeight = totalHeight;
}

export function layoutVerticalMind(
  root: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  mode: VerticalMindMapMode,
  branchExpansion: BranchExpansion = 'side'
): void {
  const visibleRootSubtopics = visibleSubtopics(root, collapsedIds);
  const bottomSubtopics: LayoutTopic[] = [];
  const topSubtopics: LayoutTopic[] = [];

  visibleRootSubtopics.forEach((subtopic, index) => {
    const side = rootSubtopicVerticalSide(index, mode);
    if (side === 'top') {
      topSubtopics.push(subtopic);
    } else {
      bottomSubtopics.push(subtopic);
    }
  });

  placeVerticalRootSide(root, bottomSubtopics, 'bottom', collapsedIds, branchExpansion);
  placeVerticalRootSide(root, topSubtopics, 'top', collapsedIds, branchExpansion);
}

export function rootSubtopicVerticalSide(
  index: number,
  mode: VerticalMindMapMode
): VerticalMindMapSide {
  if (mode === 'mindmap-up') return 'top';
  if (mode === 'mindmap-down') return 'bottom';
  return index % 2 === 0 ? 'bottom' : 'top';
}

export function placeVerticalRootSide(
  root: LayoutTopic,
  subtopics: readonly LayoutTopic[],
  side: VerticalMindMapSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): void {
  if (!subtopics.length) return;

  const rootBox = root._layout;
  const extents = subtopics.map((subtopic) =>
    verticalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const groupCenterOffset = directSubtopicGroupCenterXOffset(extents, BRANCH_GAP);
  const direction = side === 'top' ? -1 : 1;
  let x = rootBox.x - groupCenterOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.x = x + extent.left;
    subtopicBox.y =
      rootBox.y + direction * (rootBox.height / 2 + LEVEL_GAP + subtopicBox.height / 2);

    placeVerticalDescendants(subtopic, side, collapsedIds, branchExpansion);
    x += extent.width + BRANCH_GAP;
  }
}

export function placeVerticalDescendants(
  parent: LayoutTopic,
  side: VerticalMindMapSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): void {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (shouldUseHangingExpansion(parent, branchExpansion)) {
    placeVerticalHangingDescendants(parent, side, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  const extents = subtopics.map((subtopic) =>
    verticalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const groupCenterOffset = directSubtopicGroupCenterXOffset(extents, SIBLING_GAP);
  const direction = side === 'top' ? -1 : 1;
  let x = parentBox.x - groupCenterOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.x = x + extent.left;
    subtopicBox.y =
      parentBox.y + direction * (parentBox.height / 2 + LEVEL_GAP + subtopicBox.height / 2);

    placeVerticalDescendants(subtopic, side, collapsedIds, branchExpansion);
    x += extent.width + SIBLING_GAP;
  }
}

export function placeVerticalHangingDescendants(
  parent: LayoutTopic,
  side: VerticalMindMapSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): void {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-vertical';
  const extents = subtopics.map((subtopic) =>
    verticalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalWidth = horizontalExtentGroupWidth(extents, HANGING_SIBLING_GAP);
  const direction = side === 'top' ? -1 : 1;
  const hangingDirection = verticalHangingDirection();
  const startOffset = verticalHangingStartOffset(parentBox, extents[0], hangingDirection);
  let x = parentBox.x + hangingDirection * startOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x = hangingDirection > 0 ? x + extent.left : x - extent.right;
    subtopicBox.y = parentBox.y + direction * (HANGING_LEVEL_GAP + subtopicBox.height / 2);

    placeVerticalDescendants(subtopic, side, collapsedIds, branchExpansion);
    x += hangingDirection * (extent.width + HANGING_SIBLING_GAP);
  }

  parentBox.hangingSubtopicsWidth = totalWidth;
}
