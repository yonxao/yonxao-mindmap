/*
 * 文件作用：
 * 横向、竖向和双向思维导图布局。
 */

import {
  BRANCH_GAP,
  HANGING_LEVEL_GAP,
  HANGING_SIBLING_GAP,
  LEVEL_GAP,
  SIBLING_GAP,
  directSubtopicGroupCenterOffset,
  directSubtopicGroupCenterXOffset,
  horizontalExtentGroupWidth,
  horizontalSubtreeExtent,
  shouldUseHangingExpansion,
  verticalExtentGroupHeight,
  verticalHangingDirection,
  verticalHangingStartOffset,
  verticalSubtreeExtent,
  visibleSubtopics,
} from './layoutShared.js';

export function layoutHorizontalMind(root, collapsedIds, mode, branchExpansion = 'side') {
  const visibleRootSubtopics = visibleSubtopics(root, collapsedIds);
  const rightSubtopics = [];
  const leftSubtopics = [];

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

/*
 * 作用：
 * 判断一级主题应该在左侧还是右侧。
 */
export function rootSubtopicHorizontalSide(index, mode) {
  if (mode === 'mindmap-left') return 'left';
  if (mode === 'mindmap-right') return 'right';
  return index % 2 === 0 ? 'right' : 'left';
}

/*
 * 作用：
 * 摆放根主题某一侧的一级子树。
 */
export function placeHorizontalRootSide(root, subtopics, side, collapsedIds, branchExpansion) {
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
    const dir = side === 'left' ? -1 : 1;

    subtopicBox.side = side;
    subtopicBox.x = rootBox.x + dir * (rootBox.width / 2 + LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = y + extent.above;

    placeHorizontalDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += extent.height + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 递归摆放水平布局中的非根后代。
 */
export function placeHorizontalDescendants(parent, side, collapsedIds, branchExpansion = 'side') {
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
    const dir = side === 'left' ? -1 : 1;

    subtopicBox.side = side;
    subtopicBox.x = parentBox.x + dir * (parentBox.width / 2 + LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = y + extent.above;

    placeHorizontalDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += extent.height + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 水平布局的下挂展开：父主题从下方引出纵向支线，子主题再向左右侧接出。
 *
 * 说明：
 * 相比自然展开，它不再从父主题侧边缘继续推进，从而减少横向占用；
 * 代价是父主题和子主题组会在垂直方向上串开，占用更多高度。
 */
export function placeHorizontalHangingDescendants(parent, side, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const extents = subtopics.map((subtopic) =>
    horizontalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalHeight = verticalExtentGroupHeight(extents, HANGING_SIBLING_GAP);
  const dir = side === 'left' ? -1 : 1;
  let y = parentBox.y + parentBox.height / 2 + HANGING_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x = parentBox.x + dir * (HANGING_LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = y + extent.above;

    placeHorizontalDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += extent.height + HANGING_SIBLING_GAP;
  }

  parentBox.hangingSubtopicsHeight = totalHeight;
}

/*
 * 作用：
 * 竖向思维导图布局，覆盖 mindmap-down/mindmap-up/mindmap-vertical。
 */
export function layoutVerticalMind(root, collapsedIds, mode, branchExpansion = 'side') {
  const visibleRootSubtopics = visibleSubtopics(root, collapsedIds);
  const bottomSubtopics = [];
  const topSubtopics = [];

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

/*
 * 作用：
 * 判断一级主题应该在上方还是下方。
 */
export function rootSubtopicVerticalSide(index, mode) {
  if (mode === 'mindmap-up') return 'top';
  if (mode === 'mindmap-down') return 'bottom';
  return index % 2 === 0 ? 'bottom' : 'top';
}

/*
 * 作用：
 * 摆放竖向布局中根主题某一侧的一级子树。
 */
export function placeVerticalRootSide(root, subtopics, side, collapsedIds, branchExpansion) {
  if (!subtopics.length) return;

  const rootBox = root._layout;
  const extents = subtopics.map((subtopic) =>
    verticalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const groupCenterOffset = directSubtopicGroupCenterXOffset(extents, BRANCH_GAP);
  const dir = side === 'top' ? -1 : 1;
  let x = rootBox.x - groupCenterOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.x = x + extent.left;
    subtopicBox.y = rootBox.y + dir * (rootBox.height / 2 + LEVEL_GAP + subtopicBox.height / 2);

    placeVerticalDescendants(subtopic, side, collapsedIds, branchExpansion);
    x += extent.width + BRANCH_GAP;
  }
}

/*
 * 作用：
 * 递归摆放竖向布局中的后代。
 */
export function placeVerticalDescendants(parent, side, collapsedIds, branchExpansion = 'side') {
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
  const dir = side === 'top' ? -1 : 1;
  let x = parentBox.x - groupCenterOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.x = x + extent.left;
    subtopicBox.y = parentBox.y + dir * (parentBox.height / 2 + LEVEL_GAP + subtopicBox.height / 2);

    placeVerticalDescendants(subtopic, side, collapsedIds, branchExpansion);
    x += extent.width + SIBLING_GAP;
  }
}

/*
 * 作用：
 * 竖向布局的下挂展开：从主题侧边拉出一条横向支线，再向上/下接到子主题。
 *
 * 说明：
 * 这是水平下挂展开的转置版本，用更多横向空间换取更短的纵向推进距离。
 */
export function placeVerticalHangingDescendants(parent, side, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-vertical';
  const extents = subtopics.map((subtopic) =>
    verticalSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalWidth = horizontalExtentGroupWidth(extents, HANGING_SIBLING_GAP);
  const dir = side === 'top' ? -1 : 1;
  const hangingDir = verticalHangingDirection();
  const startOffset = verticalHangingStartOffset(parentBox, extents[0], hangingDir);
  let x = parentBox.x + hangingDir * startOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x = hangingDir > 0 ? x + extent.left : x - extent.right;
    subtopicBox.y = parentBox.y + dir * (HANGING_LEVEL_GAP + subtopicBox.height / 2);

    placeVerticalDescendants(subtopic, side, collapsedIds, branchExpansion);
    x += hangingDir * (extent.width + HANGING_SIBLING_GAP);
  }

  parentBox.hangingSubtopicsWidth = totalWidth;
}
