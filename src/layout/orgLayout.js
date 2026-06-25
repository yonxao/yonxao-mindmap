/*
 * 文件作用：
 * 组织结构图和右向组织结构图布局。
 */

import {
  BRANCH_GAP,
  HANGING_EXPANSION_LEVEL_THRESHOLD,
  HANGING_SIBLING_GAP,
  LEVEL_GAP,
  ORG_RIGHT_DESCENDANT_LEVEL_GAP,
  ORG_RIGHT_DESCENDANT_SIBLING_GAP,
  SIBLING_GAP,
  TOPIC_MIN_HEIGHT,
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
  visibleSubtopics,
} from './layoutShared.js';

export function layoutOrgChart(root, collapsedIds, mode = 'org', branchExpansion = 'side') {
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

/*
 * 作用：
 * 递归摆放组织架构图子树，并返回子树宽度。
 *
 * 实现逻辑：
 * 标准组织结构图需要按“层级”对齐，而不是按每个父主题的高度单独下移。
 * 因此 y 坐标先从 levelTops 读取同层统一顶部，再加上主题自身高度的一半。
 * 这样长文案主题只会向下撑开，不会向上顶到父级连线区域。
 */
export function placeOrgSubtree(
  topic,
  centerX,
  depth,
  levelTops,
  collapsedIds,
  branchExpansion = 'side'
) {
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

/*
 * 作用：
 * 标准组织结构图的深层下挂展开。
 */
export function placeOrgHangingDescendants(parent, collapsedIds, branchExpansion) {
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

/*
 * 作用：
 * 计算标准组织结构图每一层的统一顶部 y 坐标。
 *
 * 关键点：
 * 组织结构图更适合顶部对齐：长文案主题会向下变高，而不是围绕中心线上下扩张。
 * 下一层根据上一层最大高度统一下移，所以不同父主题下的同层子主题仍然保持齐平。
 */
export function orgLevelTops(root, collapsedIds) {
  const levelHeights = [];

  const visit = (topic, depth) => {
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

/*
 * 作用：
 * 计算组织架构图子树宽度。
 */
export function orgSubtreeWidth(topic, collapsedIds, branchExpansion = 'side') {
  return orgSubtreeExtent(topic, collapsedIds, branchExpansion).width;
}

/*
 * 作用：
 * 计算组织结构图子树相对当前主题中心点的左右非对称占位。
 *
 * 关键点：
 * 父主题需要对齐“直接子主题连线组”的中心，而不是对齐整棵后代子树的外包矩形中心。
 * 当只有一个直接子主题时，子主题中心会自然和父主题中心同轴。
 */
function orgSubtreeExtent(topic, collapsedIds, branchExpansion = 'side') {
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
    const hangingWidth = subtopicExtents.reduce((max, extent) => Math.max(max, extent.width), 0);
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

/*
 * 作用：
 * 计算一组组织结构图子主题横向排布所需的总宽度。
 */
export function orgSubtopicsWidth(subtopics, collapsedIds, branchExpansion = 'side') {
  return (
    subtopics.reduce(
      (sum, subtopic) => sum + orgSubtreeWidth(subtopic, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP
  );
}

/*
 * 作用：
 * 估算标准组织结构图下挂子树的纵向占位。
 */
export function orgHangingSubtreeHeight(topic, collapsedIds, branchExpansion = 'side') {
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

/*
 * 作用：
 * 摆放“右向组织结构图”的一级主题。
 *
 * 实现逻辑：
 * 一级分支主题和标准组织图一样横向排列；每个一级分支再把自己的后代向右下展开。
 * 因此横向槽位不能只看一级主题宽度，还要把该分支右侧子树的宽度算进去。
 */
export function placeOrgRightRootSubtopics(root, subtopics, collapsedIds, branchExpansion) {
  if (!subtopics.length) return;

  const rootBox = root._layout;
  const widths = subtopics.map((subtopic) =>
    orgRightSubtreeWidth(subtopic, collapsedIds, branchExpansion)
  );
  const totalWidth =
    widths.reduce((sum, width) => sum + width, 0) + Math.max(0, subtopics.length - 1) * BRANCH_GAP;
  const maxRootSubtopicHeight = subtopics.reduce(
    (max, subtopic) => Math.max(max, subtopic._layout.height),
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

/*
 * 作用：
 * 递归摆放“右向组织结构图”的后代主题。
 *
 * 实现逻辑：
 * 子主题不是从父主题右侧直接散开，而是从父主题下方的竖向主线挂出。
 * 但普通主题展开时要像右向树形图一样，为每个子树预留真实高度。
 * 这样某个子主题继续展开后代时，不会和相邻兄弟主题互相重叠。
 */
export function placeOrgRightDescendants(parent, collapsedIds, branchExpansion = 'side') {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (
    Number(parent?.level || 1) >= HANGING_EXPANSION_LEVEL_THRESHOLD &&
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

/*
 * 作用：
 * 右向组织结构图的自然展开：普通主题从右侧直接展开子主题组。
 */
export function placeOrgRightNaturalDescendants(parent, collapsedIds, branchExpansion) {
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

/*
 * 作用：
 * 计算“右向组织结构图”中一个分支向右展开后需要占用的水平宽度。
 */
export function orgRightSubtreeWidth(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  const subtopicWidth = subtopics.reduce(
    (max, subtopic) => Math.max(max, orgRightSubtreeWidth(subtopic, collapsedIds, branchExpansion)),
    0
  );

  if (branchExpansion === 'hanging') {
    return horizontalHangingSubtreeWidth(box, subtopicWidth, subtopics[0]?._layout);
  }

  return Math.max(box.width, box.width + ORG_RIGHT_DESCENDANT_LEVEL_GAP + subtopicWidth);
}

/*
 * 作用：
 * 计算“右向组织结构图”普通主题相对自身中心线的上下占位。
 *
 * 关键点：
 * 自然展开的子主题组会围绕父主题中心线上下展开。如果只返回总高度，再把主题放在占位块顶部，
 * 后代可能向上溢出到前一个兄弟主题区域。这里保留 above/below，调用处才能把主题中心放到
 * 当前子树真正需要的位置。
 */
function orgRightSubtreeExtent(topic, collapsedIds, branchExpansion = 'side') {
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

  if (
    Number(topic?.level || 1) >= HANGING_EXPANSION_LEVEL_THRESHOLD &&
    branchExpansion === 'side'
  ) {
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

/*
 * 作用：
 * 计算“右向组织结构图”中一个普通主题展开后需要占用的垂直高度。
 */
export function orgRightSubtreeHeight(topic, collapsedIds, branchExpansion = 'side') {
  return orgRightSubtreeExtent(topic, collapsedIds, branchExpansion).height;
}
