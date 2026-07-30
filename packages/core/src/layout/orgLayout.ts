import {
  BRANCH_GAP,
  HANGING_EXPANSION_LEVEL_THRESHOLD,
  HANGING_SIBLING_GAP,
  LEVEL_GAP,
  ORG_RIGHT_DESCENDANT_LEVEL_GAP,
  ORG_RIGHT_DESCENDANT_SIBLING_GAP,
  SIBLING_GAP,
  TOPIC_MIN_HEIGHT,
} from './layoutConstants.js';
import {
  directSubtopicGroupCenterOffset,
  directSubtopicGroupCenterXOffset,
  horizontalExtentGroupWidth,
  horizontalHangingStartOffset,
  horizontalHangingSubtreeWidth,
  normalizeHorizontalExtent,
  normalizeVerticalExtent,
  shouldUseHangingExpansion,
  verticalBlockTopicY,
  verticalExtentGroupHeight,
} from './layoutGeometry.js';
import type { BranchExpansion, HorizontalExtent, VerticalExtent } from './layoutGeometry.js';
import type { LayoutTopic } from './layoutTypes.js';
import { visibleSubtopics } from '../model/topicTraversal.js';

export type OrgLayoutMode = 'org' | 'org-right';

export function layoutOrgChart(
  root: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  mode: OrgLayoutMode = 'org',
  branchExpansion: BranchExpansion = 'side'
): void {
  if (mode === 'org-right') {
    placeOrgRightRootSubtopics(
      root,
      visibleSubtopics(root, collapsedIds),
      collapsedIds,
      branchExpansion
    );
    return;
  }

  const levelTops = orgLevelTops(root, collapsedIds);
  placeOrgSubtree(root, 0, 0, levelTops, collapsedIds, branchExpansion);
}

export function placeOrgSubtree(
  topic: LayoutTopic,
  centerX: number,
  depth: number,
  levelTops: readonly number[],
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): number {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const subtreeExtent = orgSubtreeExtent(topic, collapsedIds, branchExpansion);

  box.side = box.side === 'root' ? 'root' : 'org-bottom';
  box.x = centerX;
  box.y = (levelTops[depth] || 0) + box.height / 2;

  if (!subtopics.length) return subtreeExtent.width;

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    placeOrgHangingDescendants(topic, collapsedIds, branchExpansion);
    return subtreeExtent.width;
  }

  const subtopicExtents = subtopics.map((subtopic) =>
    orgSubtreeExtent(subtopic, collapsedIds, branchExpansion)
  );
  const subtopicGroupCenterOffset = directSubtopicGroupCenterXOffset(subtopicExtents, SIBLING_GAP);
  let x = centerX - subtopicGroupCenterOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = subtopicExtents[index];
    placeOrgSubtree(subtopic, x + extent.left, depth + 1, levelTops, collapsedIds, branchExpansion);
    x += extent.width + SIBLING_GAP;
  }

  return subtreeExtent.width;
}

export function placeOrgHangingDescendants(
  parent: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): void {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const heights = subtopics.map((subtopic) =>
    orgHangingSubtreeHeight(subtopic, collapsedIds, branchExpansion)
  );
  let y = parentBox.y + parentBox.height / 2 + HANGING_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const height = heights[index];

    subtopicBox.side = 'org-hanging';
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x =
      parentBox.x + horizontalHangingStartOffset(parentBox, subtopicBox) + subtopicBox.width / 2;
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeOrgHangingDescendants(subtopic, collapsedIds, branchExpansion);
    y += height + HANGING_SIBLING_GAP;
  }
}

export function orgLevelTops(root: LayoutTopic, collapsedIds: ReadonlySet<string>): number[] {
  const levelHeights: number[] = [];

  const visit = (topic: LayoutTopic, depth: number): void => {
    const box = topic._layout;
    levelHeights[depth] = Math.max(levelHeights[depth] || 0, box.height);

    for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
      visit(subtopic, depth + 1);
    }
  };

  visit(root, 0);

  const levelTops = [0];
  for (let depth = 1; depth < levelHeights.length; depth += 1) {
    levelTops[depth] = levelTops[depth - 1] + levelHeights[depth - 1] + LEVEL_GAP;
  }

  return levelTops;
}

export function orgSubtreeWidth(
  topic: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): number {
  return orgSubtreeExtent(topic, collapsedIds, branchExpansion).width;
}

function orgSubtreeExtent(
  topic: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): HorizontalExtent {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const ownLeft = box.width / 2;
  const ownRight = box.width / 2;

  if (!subtopics.length) {
    return normalizeHorizontalExtent({ left: ownLeft, right: ownRight });
  }

  const subtopicExtents = subtopics.map((subtopic) =>
    orgSubtreeExtent(subtopic, collapsedIds, branchExpansion)
  );

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    const hangingWidth = subtopicExtents.reduce(
      (maximum, extent) => Math.max(maximum, extent.width),
      0
    );
    const startOffset = horizontalHangingStartOffset(box, subtopics[0]?._layout);
    return normalizeHorizontalExtent({
      left: ownLeft,
      right: Math.max(ownRight, startOffset + hangingWidth),
    });
  }

  const subtopicWidth = horizontalExtentGroupWidth(subtopicExtents, SIBLING_GAP);
  const subtopicCenterOffset = directSubtopicGroupCenterXOffset(subtopicExtents, SIBLING_GAP);

  return normalizeHorizontalExtent({
    left: Math.max(ownLeft, subtopicCenterOffset),
    right: Math.max(ownRight, subtopicWidth - subtopicCenterOffset),
  });
}

export function orgSubtopicsWidth(
  subtopics: readonly LayoutTopic[],
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): number {
  return (
    subtopics.reduce(
      (sum, subtopic) => sum + orgSubtreeWidth(subtopic, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP
  );
}

export function orgHangingSubtreeHeight(
  topic: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): number {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.height;

  const subtopicHeight =
    subtopics.reduce(
      (sum, subtopic) => sum + orgHangingSubtreeHeight(subtopic, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) * HANGING_SIBLING_GAP;

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return box.height + HANGING_SIBLING_GAP + subtopicHeight;
  }

  return Math.max(box.height, subtopicHeight);
}

export function placeOrgRightRootSubtopics(
  root: LayoutTopic,
  subtopics: readonly LayoutTopic[],
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): void {
  if (!subtopics.length) return;

  const rootBox = root._layout;
  const widths = subtopics.map((subtopic) =>
    orgRightSubtreeWidth(subtopic, collapsedIds, branchExpansion)
  );
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, subtopics.length - 1) * BRANCH_GAP;
  const maxRootSubtopicHeight = subtopics.reduce(
    (maximum, subtopic) => Math.max(maximum, subtopic._layout.height),
    TOPIC_MIN_HEIGHT
  );
  const subtopicY = rootBox.y + rootBox.height / 2 + LEVEL_GAP + maxRootSubtopicHeight / 2;
  let x = rootBox.x - totalWidth / 2;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const width = widths[index];

    subtopicBox.side = 'org-right-branch';
    subtopicBox.x = x + subtopicBox.width / 2;
    subtopicBox.y = subtopicY - maxRootSubtopicHeight / 2 + subtopicBox.height / 2;

    placeOrgRightDescendants(subtopic, collapsedIds, branchExpansion);
    x += width + BRANCH_GAP;
  }
}

export function placeOrgRightDescendants(
  parent: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): void {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (
    Number(parent.level || 1) >= HANGING_EXPANSION_LEVEL_THRESHOLD &&
    branchExpansion === 'side'
  ) {
    placeOrgRightNaturalDescendants(parent, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const extents = subtopics.map((subtopic) =>
    orgRightSubtreeExtent(subtopic, collapsedIds, branchExpansion)
  );
  let y = parentBox.y + parentBox.height / 2 + ORG_RIGHT_DESCENDANT_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const extent = extents[index];

    subtopicBox.side = 'org-right';
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x =
      branchExpansion === 'hanging'
        ? parentBox.x + horizontalHangingStartOffset(parentBox, subtopicBox) + subtopicBox.width / 2
        : parentBox.x +
          parentBox.width / 2 +
          ORG_RIGHT_DESCENDANT_LEVEL_GAP +
          subtopicBox.width / 2;
    subtopicBox.y =
      branchExpansion === 'hanging'
        ? verticalBlockTopicY(y, extent.height, subtopic, branchExpansion)
        : y + extent.above;

    placeOrgRightDescendants(subtopic, collapsedIds, branchExpansion);
    y += extent.height + ORG_RIGHT_DESCENDANT_SIBLING_GAP;
  }
}

export function placeOrgRightNaturalDescendants(
  parent: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion
): void {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  const extents = subtopics.map((subtopic) =>
    orgRightSubtreeExtent(subtopic, collapsedIds, branchExpansion)
  );
  const subtopicGroupCenterOffset = directSubtopicGroupCenterOffset(
    extents,
    ORG_RIGHT_DESCENDANT_SIBLING_GAP
  );
  let y = parentBox.y - subtopicGroupCenterOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const extent = extents[index];

    subtopicBox.side = 'org-right';
    subtopicBox.branchExpansion = 'side';
    subtopicBox.x =
      parentBox.x + parentBox.width / 2 + ORG_RIGHT_DESCENDANT_LEVEL_GAP + subtopicBox.width / 2;
    subtopicBox.y = y + extent.above;

    placeOrgRightDescendants(subtopic, collapsedIds, branchExpansion);
    y += extent.height + ORG_RIGHT_DESCENDANT_SIBLING_GAP;
  }
}

export function orgRightSubtreeWidth(
  topic: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): number {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  const subtopicWidth = subtopics.reduce(
    (maximum, subtopic) =>
      Math.max(maximum, orgRightSubtreeWidth(subtopic, collapsedIds, branchExpansion)),
    0
  );

  if (branchExpansion === 'hanging') {
    return horizontalHangingSubtreeWidth(box, subtopicWidth, subtopics[0]?._layout);
  }

  return Math.max(box.width, box.width + ORG_RIGHT_DESCENDANT_LEVEL_GAP + subtopicWidth);
}

function orgRightSubtreeExtent(
  topic: LayoutTopic,
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
    orgRightSubtreeExtent(subtopic, collapsedIds, branchExpansion)
  );
  const subtopicHeight = verticalExtentGroupHeight(
    subtopicExtents,
    ORG_RIGHT_DESCENDANT_SIBLING_GAP
  );

  if (Number(topic.level || 1) >= HANGING_EXPANSION_LEVEL_THRESHOLD && branchExpansion === 'side') {
    const subtopicCenterOffset = directSubtopicGroupCenterOffset(
      subtopicExtents,
      ORG_RIGHT_DESCENDANT_SIBLING_GAP
    );
    return normalizeVerticalExtent({
      above: Math.max(ownAbove, subtopicCenterOffset),
      below: Math.max(ownBelow, subtopicHeight - subtopicCenterOffset),
    });
  }

  return normalizeVerticalExtent({
    above: ownAbove,
    below: ownBelow + ORG_RIGHT_DESCENDANT_SIBLING_GAP + subtopicHeight,
  });
}

export function orgRightSubtreeHeight(
  topic: LayoutTopic,
  collapsedIds: ReadonlySet<string>,
  branchExpansion: BranchExpansion = 'side'
): number {
  return orgRightSubtreeExtent(topic, collapsedIds, branchExpansion).height;
}
