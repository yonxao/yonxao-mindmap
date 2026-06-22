/*
 * 文件作用：
 * 树形图、左右树形图和平衡树形图布局。
 */

import {
  TREE_DESCENDANT_LEVEL_GAP,
  TREE_DESCENDANT_SIBLING_GAP,
  TREE_HANGING_SIBLING_GAP,
  TREE_TRUNK_BRANCH_GAP,
  TREE_TRUNK_LEVEL_GAP,
  TREE_TRUNK_ORDER_GAP,
  TREE_TRUNK_START_GAP,
  directSubtopicGroupCenterOffset,
  horizontalHangingStartOffset,
  normalizeVerticalExtent,
  shouldUseHangingExpansion,
  verticalExtentGroupHeight,
  visibleSubtopics,
} from './layoutShared.js';

export function layoutOutlineTree(
  root,
  collapsedIds,
  mode = 'tree-right',
  branchExpansion = 'side'
) {
  const rootSubtopics = visibleSubtopics(root, collapsedIds);
  placeTreeTrunkSubtopics(root, rootSubtopics, mode, collapsedIds, branchExpansion);
}

/*
 * 作用：
 * 沿中心主题下方的纵向主干摆放一级分支。
 *
 * 关键点：
 * 树形图和普通导图的最大区别在一级分支：普通导图从中心点左右展开，
 * 树形图则先形成一条自上而下的主干，再把一级分支挂在主干左右。
 */
export function placeTreeTrunkSubtopics(root, subtopics, mode, collapsedIds, branchExpansion) {
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

  const sideEntries = {
    'tree-left': [],
    'tree-right': [],
  };
  subtopics.forEach((subtopic, index) => {
    const side = rootSubtopicTreeSide(index, mode);
    const extent = treeSubtreeExtent(subtopic, side, collapsedIds, branchExpansion);
    sideEntries[side].push({
      subtopic,
      side,
      extent,
    });
  });

  placeTreeTrunkSide(root, sideEntries['tree-right'], collapsedIds, branchExpansion);
  placeTreeTrunkSide(root, sideEntries['tree-left'], collapsedIds, branchExpansion);

  // 中心主题保持在树的顶部中间；整体 bounds 会自然包含下方所有一级分支。
  // 这里不调用 centerVisibleTopics，避免把顶部根主题又拉回普通导图的视觉中心。
}

/*
 * 作用：
 * 紧凑摆放树形图主干某一侧的一级分支。
 *
 * 关键点：
 * tree-left/tree-right 只有单侧分支；tree 双侧布局会把左右分支按文档顺序传入同一条主干。
 * 因此这里始终按 entries 顺序推进 y，保证主干上的一级分支顺序稳定。
 */
export function placeTreeTrunkSide(root, entries, collapsedIds, branchExpansion) {
  if (!entries.length) return;

  const rootBox = root._layout;
  const firstAttachY = rootBox.y + rootBox.height / 2 + TREE_TRUNK_START_GAP;
  let nextOrderedAttachY = firstAttachY;
  const sideBottoms = {
    'tree-left': firstAttachY - TREE_TRUNK_BRANCH_GAP,
    'tree-right': firstAttachY - TREE_TRUNK_BRANCH_GAP,
  };

  for (const entry of entries) {
    const { subtopic, side, extent } = entry;
    const subtopicBox = subtopic._layout;
    const dir = side === 'tree-left' ? -1 : 1;
    const sideSafeAttachY = sideBottoms[side] + TREE_TRUNK_BRANCH_GAP + extent.above;
    const attachY = Math.max(nextOrderedAttachY, sideSafeAttachY);

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'side';
    subtopicBox.x = rootBox.x + dir * (TREE_TRUNK_LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = attachY;

    placeTreeDescendants(subtopic, side, collapsedIds, branchExpansion);
    sideBottoms[side] = attachY - extent.above + extent.height;
    nextOrderedAttachY = attachY + TREE_TRUNK_ORDER_GAP;
  }
}

/*
 * 作用：
 * 判断树形图的一级分支挂在主干哪一侧。
 */
export function rootSubtopicTreeSide(index, mode) {
  if (mode === 'tree-left') return 'tree-left';
  if (mode === 'tree') return index % 2 === 0 ? 'tree-right' : 'tree-left';
  return 'tree-right';
}

/*
 * 作用：
 * 递归摆放树形图中的后代主题。
 *
 * 实现逻辑：
 * 同一个父主题下的所有子主题先计算总高度，再围绕父主题的 y 坐标上下展开。
 * 父主题因此会自然位于子树的视觉中线，连线也更像常见树图结构。
 */
export function placeTreeDescendants(parent, side, collapsedIds, branchExpansion = 'side') {
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
  const dir = side === 'tree-left' ? -1 : 1;
  let y = parentBox.y - centerOffset;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const extent = extents[index];

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'side';
    subtopicBox.x =
      parentBox.x + dir * (parentBox.width / 2 + TREE_DESCENDANT_LEVEL_GAP + subtopicBox.width / 2);
    subtopicBox.y = y + extent.above;

    placeTreeDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += extent.height + TREE_DESCENDANT_SIBLING_GAP;
  }
}

/*
 * 作用：
 * 树形图的下挂展开，用父主题下方出口换取更短的横向推进距离。
 */
export function placeTreeHangingDescendants(parent, side, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  parentBox.childBranchExpansion = 'hanging-horizontal';
  const extents = subtopics.map((subtopic) =>
    treeSubtreeExtent(subtopic, side, collapsedIds, branchExpansion)
  );
  const totalHeight = verticalExtentGroupHeight(extents, TREE_HANGING_SIBLING_GAP);
  const dir = side === 'tree-left' ? -1 : 1;
  let y = parentBox.y + parentBox.height / 2 + TREE_HANGING_SIBLING_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const extent = extents[index];
    const subtopicBox = subtopic._layout;

    subtopicBox.side = side;
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.x =
      parentBox.x +
      dir * (horizontalHangingStartOffset(parentBox, subtopicBox) + subtopicBox.width / 2);
    subtopicBox.y = y + extent.above;

    placeTreeDescendants(subtopic, side, collapsedIds, branchExpansion);
    y += extent.height + TREE_HANGING_SIBLING_GAP;
  }

  parentBox.hangingSubtopicsHeight = totalHeight;
}

/*
 * 作用：
 * 树形图中只有多个直接子主题时才使用下挂展开。
 *
 * 原因：
 * 单个直接子主题拥有明确的侧向阅读方向，继续强制下挂会制造无意义折线；
 * 这种情况下退回普通侧向直连更自然。
 */
function shouldUseTreeHangingExpansion(parent, collapsedIds, branchExpansion) {
  return (
    shouldUseHangingExpansion(parent, branchExpansion) &&
    visibleSubtopics(parent, collapsedIds).length > 1
  );
}

/*
 * 作用：
 * 计算树形图子树相对当前主题中心点的上下非对称占位。
 *
 * 关键点：
 * 父主题应该对齐直接子主题连线组中心；深层后代只扩大避让空间，
 * 不应把父主题从直接子主题组中心拉走。
 */
function treeSubtreeExtent(topic, side, collapsedIds, branchExpansion = 'side') {
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

/*
 * 作用：
 * 计算树形图中一个子树实际需要占用的高度。
 *
 * 为什么不直接复用主题高度：
 * 一个主题本身可能只有一行高，但它下面可能挂着很多后代。
 * 如果只看主题高度，兄弟分支就会彼此重叠；所以这里递归累加可见子树高度。
 */
export function treeSubtreeHeight(topic, side, collapsedIds, branchExpansion = 'side') {
  return treeSubtreeExtent(topic, side, collapsedIds, branchExpansion).height;
}
