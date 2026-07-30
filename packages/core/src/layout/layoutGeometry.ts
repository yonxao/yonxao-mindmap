import {
  HANGING_EXPANSION_LEVEL_THRESHOLD,
  HANGING_LEVEL_GAP,
  HANGING_SIBLING_GAP,
  HORIZONTAL_HANGING_EDGE_GAP,
  SIBLING_GAP,
  TIMELINE_DETAIL_HANGING_SIBLING_GAP,
  TIMELINE_DETAIL_SIBLING_GAP,
  VERTICAL_HANGING_EDGE_GAP,
} from './layoutConstants.js';
import type { LayoutBox, LayoutSide, LayoutTopic } from './layoutTypes.js';
import { visibleSubtopics } from '../model/topicTraversal.js';

export type BranchExpansion = 'side' | 'hanging';

export interface VerticalExtent {
  above: number;
  below: number;
  height: number;
}

export interface HorizontalExtent {
  left: number;
  right: number;
  width: number;
}

export function shouldUseHangingExpansion(
  parent: { level?: number } | null | undefined,
  branchExpansion: string
): boolean {
  return (
    branchExpansion === 'hanging' && Number(parent?.level || 1) >= HANGING_EXPANSION_LEVEL_THRESHOLD
  );
}

export function verticalBlockTopicY(
  blockTop: number,
  blockHeight: number,
  topic: LayoutTopic,
  branchExpansion: string
): number {
  const box = topic._layout;
  return (
    blockTop +
    (shouldUseHangingExpansion(topic, branchExpansion) ? box.height / 2 : blockHeight / 2)
  );
}

export function horizontalHangingSubtreeWidth(
  box: LayoutBox,
  subtopicWidth: number,
  firstSubtopicBox: LayoutBox | null = null
): number {
  const startOffset = horizontalHangingStartOffset(box, firstSubtopicBox);
  return Math.max(box.width, box.width / 2 + startOffset + subtopicWidth);
}

export function horizontalHangingStartOffset(
  box: LayoutBox,
  firstSubtopicBox: LayoutBox | null | undefined
): number {
  const firstSubtopicHalfWidth =
    firstSubtopicBox && Number.isFinite(firstSubtopicBox.width) ? firstSubtopicBox.width / 2 : 0;
  return Math.max(
    HANGING_LEVEL_GAP,
    box.width / 2 + HORIZONTAL_HANGING_EDGE_GAP - firstSubtopicHalfWidth
  );
}

export function verticalHangingStartOffset(
  box: LayoutBox,
  firstSubtopicExtent: Partial<HorizontalExtent> | null | undefined,
  hangingDirection: number
): number {
  const firstInnerExtent =
    hangingDirection > 0 ? firstSubtopicExtent?.left || 0 : firstSubtopicExtent?.right || 0;
  return Math.max(HANGING_LEVEL_GAP, box.width / 2 + VERTICAL_HANGING_EDGE_GAP - firstInnerExtent);
}

export function horizontalSubtreeExtent(
  topic: LayoutTopic,
  side: LayoutSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): VerticalExtent {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const ownAbove = box.height / 2;
  const ownBelow = box.height / 2;

  if (!subtopics.length) {
    return { above: ownAbove, below: ownBelow, height: box.height };
  }

  const subtopicExtents = subtopics.map((subtopic) =>
    horizontalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    const subtopicHeight = verticalExtentGroupHeight(subtopicExtents, HANGING_SIBLING_GAP);
    return normalizeVerticalExtent({
      above: ownAbove,
      below: ownBelow + HANGING_SIBLING_GAP + subtopicHeight,
    });
  }

  const subtopicHeight = verticalExtentGroupHeight(subtopicExtents, SIBLING_GAP);
  const subtopicCenterOffset = directSubtopicGroupCenterOffset(subtopicExtents, SIBLING_GAP);
  return normalizeVerticalExtent({
    above: Math.max(ownAbove, subtopicCenterOffset),
    below: Math.max(ownBelow, subtopicHeight - subtopicCenterOffset),
  });
}

export function verticalExtentGroupHeight(extents: readonly VerticalExtent[], gap: number): number {
  if (!extents.length) return 0;
  return (
    extents.reduce((sum, extent) => sum + extent.above + extent.below, 0) +
    Math.max(0, extents.length - 1) * gap
  );
}

export function normalizeVerticalExtent(
  extent: Pick<VerticalExtent, 'above' | 'below'>
): VerticalExtent {
  return {
    above: extent.above,
    below: extent.below,
    height: extent.above + extent.below,
  };
}

export function directExtentGroupCenterOffset<
  TExtent,
  TCenterKey extends keyof TExtent,
  TSizeKey extends keyof TExtent,
>(extents: readonly TExtent[], gap: number, centerKey: TCenterKey, sizeKey: TSizeKey): number {
  if (!extents.length) return 0;
  if (extents.length === 1) return Number(extents[0][centerKey]);

  const firstCenter = Number(extents[0][centerKey]);
  const lastBeforeStart =
    extents.slice(0, -1).reduce((sum, extent) => sum + Number(extent[sizeKey]), 0) +
    Math.max(0, extents.length - 1) * gap;
  const lastCenter = lastBeforeStart + Number(extents[extents.length - 1][centerKey]);
  return (firstCenter + lastCenter) / 2;
}

export function directSubtopicGroupCenterOffset(
  extents: readonly VerticalExtent[],
  gap: number
): number {
  return directExtentGroupCenterOffset(extents, gap, 'above', 'height');
}

export function verticalSubtreeExtent(
  topic: LayoutTopic,
  side: LayoutSide,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): HorizontalExtent {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const ownLeft = box.width / 2;
  const ownRight = box.width / 2;

  if (!subtopics.length) {
    return { left: ownLeft, right: ownRight, width: box.width };
  }

  const subtopicExtents = subtopics.map((subtopic) =>
    verticalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    const subtopicWidth = horizontalExtentGroupWidth(subtopicExtents, HANGING_SIBLING_GAP);
    const direction = verticalHangingDirection();
    const startOffset = verticalHangingStartOffset(box, subtopicExtents[0], direction);
    return normalizeHorizontalExtent({
      left: direction < 0 ? Math.max(ownLeft, startOffset + subtopicWidth) : ownLeft,
      right: direction > 0 ? Math.max(ownRight, startOffset + subtopicWidth) : ownRight,
    });
  }

  const subtopicWidth = horizontalExtentGroupWidth(subtopicExtents, SIBLING_GAP);
  const subtopicCenterOffset = directSubtopicGroupCenterXOffset(subtopicExtents, SIBLING_GAP);
  return normalizeHorizontalExtent({
    left: Math.max(ownLeft, subtopicCenterOffset),
    right: Math.max(ownRight, subtopicWidth - subtopicCenterOffset),
  });
}

export function horizontalExtentGroupWidth(
  extents: readonly HorizontalExtent[],
  gap: number
): number {
  if (!extents.length) return 0;
  return (
    extents.reduce((sum, extent) => sum + extent.left + extent.right, 0) +
    Math.max(0, extents.length - 1) * gap
  );
}

export function normalizeHorizontalExtent(
  extent: Pick<HorizontalExtent, 'left' | 'right'>
): HorizontalExtent {
  return {
    left: extent.left,
    right: extent.right,
    width: extent.left + extent.right,
  };
}

export function directSubtopicGroupCenterXOffset(
  extents: readonly HorizontalExtent[],
  gap: number
): number {
  return directExtentGroupCenterOffset(extents, gap, 'left', 'width');
}

export function verticalHangingDirection(): 1 {
  return 1;
}

export function timelineDetailSiblingGapForParent(
  parent: { level?: number } | null | undefined,
  branchExpansion: string
): number {
  return shouldUseHangingExpansion(parent, branchExpansion)
    ? TIMELINE_DETAIL_HANGING_SIBLING_GAP
    : TIMELINE_DETAIL_SIBLING_GAP;
}
