/*
 * 文件作用：
 * 鱼骨图主骨、大骨和鱼刺主题布局。
 */

import {
  FISHBONE_PRIMARY_BONE_MIN_EDGE_OFFSET,
  FISHBONE_PRIMARY_BONE_SLOPE,
  HANGING_SIBLING_GAP,
  LEVEL_GAP,
  SIBLING_GAP,
  horizontalHangingStartOffset,
  horizontalHangingSubtreeWidth,
  shouldUseHangingExpansion,
  verticalBlockTopicY,
  visibleSubtopics,
  clamp,
} from './layoutShared.js';

export function layoutFishbone(
  root,
  collapsedIds,
  mode = 'fishbone-left',
  branchExpansion = 'side'
) {
  const rootBox = root._layout;
  const subtopics = visibleSubtopics(root, collapsedIds);
  if (!subtopics.length) return;

  const direction = mode === 'fishbone-right' ? -1 : 1;
  const firstAttachX = rootBox.x + direction * (rootBox.width / 2 + LEVEL_GAP);
  const sideCursors = {
    top: firstAttachX,
    bottom: firstAttachX + direction * LEVEL_GAP * 0.45,
  };

  rootBox.fishboneDirection = direction;

  subtopics.forEach((subtopic, index) => {
    const subtopicBox = subtopic._layout;
    const sign = index % 2 === 0 ? -1 : 1;
    const sideKey = sign < 0 ? 'top' : 'bottom';
    // 大分支的子树高度决定它离主骨多远，避免上下两侧的鱼刺主题互相压住。
    const primaryBoneHeight = fishbonePrimaryBoneSubtreeHeight(
      subtopic,
      collapsedIds,
      branchExpansion
    );
    const attachX = sideCursors[sideKey];
    /*
     * 大分支斜骨使用固定倾角，避免不同分支因为自身高度不同而出现忽陡忽缓的观感。
     * 先根据子树高度算出大分支主题靠近主骨一侧边缘的纵向偏移，
     * 再用固定斜率反推水平投影，这样斜骨线角度稳定，仍然给高分支留出足够空间。
     */
    const primaryBoneEdgeOffset = Math.max(
      FISHBONE_PRIMARY_BONE_MIN_EDGE_OFFSET,
      primaryBoneHeight + SIBLING_GAP * 2.5
    );
    const primaryBoneRun = primaryBoneEdgeOffset / FISHBONE_PRIMARY_BONE_SLOPE;

    subtopicBox.side = sign < 0 ? 'fishbone-top' : 'fishbone-bottom';
    subtopicBox.fishboneSign = sign;
    subtopicBox.fishboneDirection = direction;
    // 大分支挂到主骨上的 x 坐标，渲染主骨分段时也依赖它来确定每段颜色。
    subtopicBox.fishboneMainSpineAttachX = attachX;
    subtopicBox.x = attachX + direction * primaryBoneRun;
    subtopicBox.y = rootBox.y + sign * (primaryBoneEdgeOffset + subtopicBox.height / 2);
    // 斜骨线从主骨挂点出发，终点落在大分支主题靠近主骨的一侧边框中点。
    subtopicBox.fishboneDiagonalBoneStartX = attachX;
    subtopicBox.fishboneDiagonalBoneStartY = rootBox.y;
    subtopicBox.fishboneDiagonalBoneEndX = subtopicBox.x;
    subtopicBox.fishboneDiagonalBoneEndY =
      sign < 0 ? subtopicBox.y + subtopicBox.height / 2 : subtopicBox.y - subtopicBox.height / 2;

    placeFishboneRibTopics(subtopic, sign, direction, collapsedIds, branchExpansion);
    /*
     * 同侧下一条大分支的挂点，落在上一条大分支可见子树末端垂线与主骨的交点上。
     * 这比使用“预估宽度 + 安全间距”更贴近鱼骨图语义，也避免主骨上出现过大的空白段。
     */
    sideCursors[sideKey] = fishboneVisibleSubtreeHorizontalBoundary(
      subtopic,
      direction,
      collapsedIds
    );
  });
}

/*
 * 作用：
 * 摆放鱼骨图中挂在斜骨线上的鱼刺主题。
 *
 * 实现逻辑：
 * 鱼刺主题不是按普通树从大分支主题右侧长出，而是先沿着斜骨线寻找挂点；
 * 挂点的 y 坐标由鱼刺主题子树高度决定，挂点的 x 坐标再通过斜骨线线性插值得到。
 */
export function placeFishboneRibTopics(parent, sign, direction, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  const diagonalBoneStartX = parentBox.fishboneDiagonalBoneStartX;
  const diagonalBoneStartY = parentBox.fishboneDiagonalBoneStartY;
  const diagonalBoneEndX = parentBox.fishboneDiagonalBoneEndX;
  const diagonalBoneEndY = parentBox.fishboneDiagonalBoneEndY;
  const ribTopicHeights = subtopics.map((subtopic) =>
    fishboneRibTopicSubtreeHeight(subtopic, collapsedIds, branchExpansion)
  );
  const totalRibHeight =
    ribTopicHeights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP;
  const diagonalBoneHeight = Math.abs(diagonalBoneEndY - diagonalBoneStartY);
  const usableHeight = Math.max(1, diagonalBoneHeight - parentBox.height - SIBLING_GAP * 2);
  const contentStart = SIBLING_GAP + Math.max(0, (usableHeight - totalRibHeight) / 2);
  let offset = 0;

  subtopics.forEach((subtopic, index) => {
    const subtopicBox = subtopic._layout;
    const height = ribTopicHeights[index];
    const blockStartOnDiagonal = contentStart + offset;
    const blockEndOnDiagonal = blockStartOnDiagonal + height;
    const blockStartY = diagonalBoneEndY - sign * blockStartOnDiagonal;
    const blockEndY = diagonalBoneEndY - sign * blockEndOnDiagonal;
    const blockTopY = Math.min(blockStartY, blockEndY);
    const subtopicY = verticalBlockTopicY(blockTopY, height, subtopic, branchExpansion);
    const ratio = clamp(
      (subtopicY - diagonalBoneStartY) / (diagonalBoneEndY - diagonalBoneStartY || 1),
      0,
      1
    );
    const attachX = diagonalBoneStartX + (diagonalBoneEndX - diagonalBoneStartX) * ratio;
    const attachY = subtopicY;

    subtopicBox.side = 'fishbone-rib-topic';
    subtopicBox.fishboneSign = sign;
    subtopicBox.fishboneDirection = direction;
    // 鱼刺主题挂到斜骨线上的交点，渲染连线和折叠点都会用到。
    subtopicBox.fishboneDiagonalBoneAttachX = attachX;
    subtopicBox.fishboneDiagonalBoneAttachY = attachY;
    subtopicBox.x = attachX + direction * (LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = subtopicY;

    placeFishboneRibDescendants(subtopic, sign, direction, collapsedIds, branchExpansion);
    offset += height + SIBLING_GAP;
  });
}

/*
 * 作用：
 * 摆放鱼刺主题的后代主题。
 */
export function placeFishboneRibDescendants(
  parent,
  sign,
  direction,
  collapsedIds,
  branchExpansion = 'side'
) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (shouldUseHangingExpansion(parent, branchExpansion)) {
    placeFishboneHangingRibDescendants(parent, sign, direction, collapsedIds, branchExpansion);
    return;
  }

  const parentBox = parent._layout;
  const heights = subtopics.map((subtopic) =>
    fishboneRibTopicSubtreeHeight(subtopic, collapsedIds, branchExpansion)
  );
  const totalHeight =
    heights.reduce((sum, height) => sum + height, 0) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP;
  let y = parentBox.y - totalHeight / 2;

  subtopics.forEach((subtopic, index) => {
    const subtopicBox = subtopic._layout;
    const height = heights[index];

    subtopicBox.side = 'fishbone-rib-descendant';
    subtopicBox.fishboneSign = sign;
    subtopicBox.fishboneDirection = direction;
    subtopicBox.x =
      parentBox.x + direction * (parentBox.width / 2 + LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeFishboneRibDescendants(subtopic, sign, direction, collapsedIds, branchExpansion);
    y += height + SIBLING_GAP;
  });
}

/*
 * 作用：
 * 鱼刺后代的下挂展开：从鱼刺主题下方出线，再朝鱼尾方向接到子主题。
 */
export function placeFishboneHangingRibDescendants(
  parent,
  sign,
  direction,
  collapsedIds,
  branchExpansion
) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const heights = subtopics.map((subtopic) =>
    fishboneRibTopicSubtreeHeight(subtopic, collapsedIds, branchExpansion)
  );
  let y = parentBox.y + parentBox.height / 2 + HANGING_SIBLING_GAP;

  subtopics.forEach((subtopic, index) => {
    const subtopicBox = subtopic._layout;
    const height = heights[index];

    subtopicBox.side = 'fishbone-rib-descendant';
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.fishboneSign = sign;
    subtopicBox.fishboneDirection = direction;
    subtopicBox.x =
      parentBox.x +
      direction * (horizontalHangingStartOffset(parentBox, subtopicBox) + subtopicBox.width / 2);
    subtopicBox.y = verticalBlockTopicY(y, height, subtopic, branchExpansion);

    placeFishboneRibDescendants(subtopic, sign, direction, collapsedIds, branchExpansion);
    y += height + HANGING_SIBLING_GAP;
  });
}

/*
 * 作用：
 * 计算鱼骨图大分支子树需要占用的垂直高度。
 */
export function fishbonePrimaryBoneSubtreeHeight(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.height;

  const ribHeight =
    subtopics.reduce(
      (sum, subtopic) =>
        sum + fishboneRibTopicSubtreeHeight(subtopic, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) * SIBLING_GAP;

  return Math.max(box.height, ribHeight);
}

/*
 * 作用：
 * 计算鱼刺主题及其后代需要占用的垂直高度。
 */
export function fishboneRibTopicSubtreeHeight(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.height;

  const subtopicHeight =
    subtopics.reduce(
      (sum, subtopic) =>
        sum + fishboneRibTopicSubtreeHeight(subtopic, collapsedIds, branchExpansion),
      0
    ) +
    Math.max(0, subtopics.length - 1) *
      (shouldUseHangingExpansion(topic, branchExpansion) ? HANGING_SIBLING_GAP : SIBLING_GAP);

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return box.height + HANGING_SIBLING_GAP + subtopicHeight;
  }

  return Math.max(box.height, subtopicHeight);
}

/*
 * 作用：
 * 计算鱼骨图大分支子树向鱼尾方向延伸的宽度。
 */
export function fishbonePrimaryBoneSubtreeWidth(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  const subtopicWidth = subtopics.reduce(
    (max, subtopic) =>
      Math.max(max, fishboneRibTopicSubtreeWidth(subtopic, collapsedIds, branchExpansion)),
    0
  );

  return Math.max(box.width, LEVEL_GAP + subtopicWidth);
}

/*
 * 作用：
 * 计算鱼刺主题及其后代向鱼尾方向延伸的宽度。
 */
export function fishboneRibTopicSubtreeWidth(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  const subtopicWidth = subtopics.reduce(
    (max, subtopic) =>
      Math.max(max, fishboneRibTopicSubtreeWidth(subtopic, collapsedIds, branchExpansion)),
    0
  );

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return horizontalHangingSubtreeWidth(box, subtopicWidth, subtopics[0]?._layout);
  }

  return box.width + LEVEL_GAP + subtopicWidth;
}

/*
 * 作用：
 * 计算鱼骨图某条大分支可见子树在鱼尾方向上的水平边界。
 *
 * 使用场景：
 * 同侧下一条大分支的斜骨起点，应放在上一条大分支末端垂线和主骨的交点上。
 * 这个“末端垂线”就是整棵可见子树在鱼尾方向上的最远边界。
 */
export function fishboneVisibleSubtreeHorizontalBoundary(topic, direction, collapsedIds) {
  const box = topic?._layout;
  if (!box) return 0;

  let boundary = direction > 0 ? box.x + box.width / 2 : box.x - box.width / 2;
  for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
    const subtopicBoundary = fishboneVisibleSubtreeHorizontalBoundary(
      subtopic,
      direction,
      collapsedIds
    );
    boundary =
      direction > 0 ? Math.max(boundary, subtopicBoundary) : Math.min(boundary, subtopicBoundary);
  }

  return boundary;
}
