/*
 * 文件作用：
 * 时间轴、上侧/下侧时间轴和上下平衡时间轴布局。
 */

import {
  BRANCH_GAP,
  HANGING_EXPANSION_LEVEL_THRESHOLD,
  LEVEL_GAP,
  TIMELINE_AXIS_DETAIL_GAP,
  TIMELINE_DETAIL_LEVEL_GAP,
  TOPIC_MIN_HEIGHT,
  directSubtopicGroupCenterOffset,
  horizontalHangingStartOffset,
  horizontalHangingSubtreeWidth,
  normalizeVerticalExtent,
  shouldUseHangingExpansion,
  timelineDetailSiblingGapForParent,
  verticalExtentGroupHeight,
  visibleSubtopics,
} from './layoutShared.js';

export function layoutTimeline(
  root,
  collapsedIds,
  mode = 'timeline-down',
  branchExpansion = 'side'
) {
  const rootBox = root._layout;
  const subtopics = visibleSubtopics(root, collapsedIds);
  if (!subtopics.length) return;

  const branchSides = subtopics.map((subtopic, index) => rootSubtopicTimelineSide(index, mode));
  const axisBandHalfHeight = subtopics.reduce(
    (max, subtopic) => Math.max(max, subtopic._layout.height / 2),
    TOPIC_MIN_HEIGHT / 2
  );

  const axisY = rootBox.y;
  const axisStartX = rootBox.x + rootBox.width / 2;
  const firstPointLeftX = axisStartX + LEVEL_GAP;
  const sideCursors = {
    'timeline-top': firstPointLeftX,
    'timeline-bottom': firstPointLeftX,
  };
  let pointCursorX = firstPointLeftX;
  let axisEndX = axisStartX;

  rootBox.timelineAxisY = axisY;
  rootBox.timelineAxisMinX = axisStartX;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const branchSide = branchSides[index];
    const width = timelinePointWidth(subtopic, collapsedIds, branchExpansion);
    /*
     * 时间轴的上侧详情和下侧详情不会互相重叠，可以分别用独立游标压缩横向空间；
     * 轴上时间点本身仍使用 pointCursorX 避免同一条轴上的主题互相覆盖。
     */
    const blockLeftX = Math.max(pointCursorX, sideCursors[branchSide]);

    subtopicBox.side = 'timeline-point';
    subtopicBox.timelineBranchSide = branchSide;
    subtopicBox.x = blockLeftX + subtopicBox.width / 2;
    subtopicBox.y = axisY;
    subtopicBox.timelineAxisY = axisY;
    subtopicBox.timelineAxisBandHalfHeight = axisBandHalfHeight;

    placeTimelineDetails(subtopic, branchSide, collapsedIds, branchExpansion);
    pointCursorX = subtopicBox.x + subtopicBox.width / 2 + BRANCH_GAP;
    sideCursors[branchSide] =
      Math.max(
        blockLeftX + width,
        timelineVisibleSubtreeHorizontalBoundary(subtopic, collapsedIds)
      ) + BRANCH_GAP;
    axisEndX = Math.max(axisEndX, subtopicBox.x + subtopicBox.width / 2);
  }

  rootBox.timelineAxisMaxX = axisEndX;
}

/*
 * 作用：
 * 判断时间轴一级主题挂在轴线上方还是下方。
 */
export function rootSubtopicTimelineSide(index, mode) {
  if (mode === 'timeline-up') return 'timeline-top';
  if (mode === 'timeline') return index % 2 === 0 ? 'timeline-top' : 'timeline-bottom';
  return 'timeline-bottom';
}

/*
 * 作用：
 * 摆放某个时间点的详情子树。
 *
 * 实现逻辑：
 * 时间点本身在轴线上；详情主题从时间点上方或下方拉出一条竖线，
 * 再在竖线右侧逐层递进，形成时间轴常见的事件详情区。
 */
export function placeTimelineDetails(parent, branchSide, collapsedIds, branchExpansion = 'side') {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  if (Number(parent?.level || 1) >= HANGING_EXPANSION_LEVEL_THRESHOLD) {
    if (branchExpansion === 'side') {
      placeTimelineNaturalDetails(parent, branchSide, collapsedIds, branchExpansion);
      return;
    }
    if (branchExpansion === 'hanging') {
      placeTimelineHangingDetails(parent, branchSide, collapsedIds, branchExpansion);
      return;
    }
  }

  const parentBox = parent._layout;
  const gap = timelineDetailSiblingGapForParent(parent, branchExpansion);
  const extents = subtopics.map((subtopic) =>
    timelineDetailSubtreeExtent(subtopic, branchSide, collapsedIds, branchExpansion)
  );
  const totalHeight = verticalExtentGroupHeight(extents, gap);
  const isDetailParent =
    parentBox.side === 'timeline-detail-top' || parentBox.side === 'timeline-detail-bottom';
  const axisBandHalfHeight = Number.isFinite(parentBox.timelineAxisBandHalfHeight)
    ? parentBox.timelineAxisBandHalfHeight
    : parentBox.height / 2;
  let y = isDetailParent
    ? parentBox.y - directSubtopicGroupCenterOffset(extents, gap)
    : branchSide === 'timeline-top'
      ? parentBox.y - axisBandHalfHeight - TIMELINE_AXIS_DETAIL_GAP - totalHeight
      : parentBox.y + axisBandHalfHeight + TIMELINE_AXIS_DETAIL_GAP;

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const extent = extents[index];
    const isTopBranch = branchSide === 'timeline-top';

    subtopicBox.side = isTopBranch ? 'timeline-detail-top' : 'timeline-detail-bottom';
    subtopicBox.branchExpansion = '';
    subtopicBox.timelineBranchSide = branchSide;
    /*
     * 时间轴详情树使用更大的横向推进距离。
     * 这样父主题右侧出口、竖向目录线和子主题之间会留出呼吸感，
     * 避免多级主题挤成一团。
     */
    subtopicBox.x = parentBox.x + TIMELINE_DETAIL_LEVEL_GAP + subtopicBox.width / 2;
    subtopicBox.y = y + extent.above;

    placeTimelineDetails(subtopic, branchSide, collapsedIds, branchExpansion);
    y += extent.height + gap;
  }
}

/*
 * 作用：
 * 时间轴详情区的下挂展开。
 *
 * 关键点：
 * 时间轴上侧/下侧只决定详情树挂在主轴哪一侧；
 * 进入三级及更深的普通主题后，“下挂展开”仍然从主题下方出线并向下排列。
 */
export function placeTimelineHangingDetails(parent, branchSide, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  const isTopBranch = branchSide === 'timeline-top';
  const gap = timelineDetailSiblingGapForParent(parent, branchExpansion);
  const extents = subtopics.map((subtopic) =>
    timelineDetailSubtreeExtent(subtopic, branchSide, collapsedIds, branchExpansion)
  );
  let blockTopY = parentBox.y + parentBox.height / 2 + gap;

  parentBox.childBranchExpansion = 'hanging-horizontal';

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const extent = extents[index];

    subtopicBox.side = isTopBranch ? 'timeline-detail-top' : 'timeline-detail-bottom';
    subtopicBox.branchExpansion = 'hanging';
    subtopicBox.timelineBranchSide = branchSide;
    subtopicBox.x =
      parentBox.x + horizontalHangingStartOffset(parentBox, subtopicBox) + subtopicBox.width / 2;
    subtopicBox.y = blockTopY + extent.above;

    placeTimelineDetails(subtopic, branchSide, collapsedIds, branchExpansion);
    blockTopY += extent.height + gap;
  }
}

/*
 * 作用：
 * 时间轴详情区的自然展开：三级及更深主题从右侧直接继续展开。
 */
export function placeTimelineNaturalDetails(parent, branchSide, collapsedIds, branchExpansion) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
  const gap = timelineDetailSiblingGapForParent(parent, branchExpansion);
  const extents = subtopics.map((subtopic) =>
    timelineDetailSubtreeExtent(subtopic, branchSide, collapsedIds, branchExpansion)
  );
  let y = parentBox.y - directSubtopicGroupCenterOffset(extents, gap);

  for (let index = 0; index < subtopics.length; index += 1) {
    const subtopic = subtopics[index];
    const subtopicBox = subtopic._layout;
    const extent = extents[index];
    const isTopBranch = branchSide === 'timeline-top';

    subtopicBox.side = isTopBranch ? 'timeline-detail-top' : 'timeline-detail-bottom';
    subtopicBox.branchExpansion = 'side';
    subtopicBox.timelineBranchSide = branchSide;
    subtopicBox.x =
      parentBox.x + parentBox.width / 2 + TIMELINE_DETAIL_LEVEL_GAP + subtopicBox.width / 2;
    subtopicBox.y = y + extent.above;

    placeTimelineDetails(subtopic, branchSide, collapsedIds, branchExpansion);
    y += extent.height + gap;
  }
}

/*
 * 作用：
 * 计算某个时间点连同详情区需要占用的横向宽度。
 */
export function timelinePointWidth(topic, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return box.width;

  const subtopicWidth = subtopics.reduce(
    (max, subtopic) => Math.max(max, timelinePointWidth(subtopic, collapsedIds, branchExpansion)),
    0
  );

  if (shouldUseHangingExpansion(topic, branchExpansion)) {
    return horizontalHangingSubtreeWidth(box, subtopicWidth, subtopics[0]?._layout);
  }

  return Math.max(box.width, box.width / 2 + TIMELINE_DETAIL_LEVEL_GAP + subtopicWidth);
}

/*
 * 作用：
 * 计算时间轴某个时间点详情子树的实际最右边界。
 *
 * 为什么不用 timelinePointWidth：
 * 宽度预估用于初步排布；但详情主题完成递归布局后，深层后代或长文本可能比预估更靠右。
 * 主轴上同侧下一个时间点需要避开这个真实边界，否则它的竖向详情主干会穿过上一棵详情子树。
 */
export function timelineVisibleSubtreeHorizontalBoundary(topic, collapsedIds) {
  const box = topic?._layout;
  if (!box) return 0;

  let boundary = box.x + box.width / 2;
  for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
    boundary = Math.max(boundary, timelineVisibleSubtreeHorizontalBoundary(subtopic, collapsedIds));
  }

  return boundary;
}

/*
 * 作用：
 * 计算时间轴详情子树相对当前详情主题中心点的上下非对称占位。
 *
 * 关键点：
 * 时间轴详情区的父主题应该对齐直接子主题连接点组，而不是整个后代外包矩形。
 * 这样长文本主题只扩大必要方向的避让空间，不会把整条时间轴撑出巨大留白。
 */
function timelineDetailSubtreeExtent(topic, branchSide, collapsedIds, branchExpansion = 'side') {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const ownAbove = box.height / 2;
  const ownBelow = box.height / 2;

  if (!subtopics.length) {
    return normalizeVerticalExtent({ above: ownAbove, below: ownBelow });
  }

  const gap = timelineDetailSiblingGapForParent(topic, branchExpansion);
  const subtopicExtents = subtopics.map((subtopic) =>
    timelineDetailSubtreeExtent(subtopic, branchSide, collapsedIds, branchExpansion)
  );

  if (
    Number(topic?.level || 1) >= HANGING_EXPANSION_LEVEL_THRESHOLD &&
    branchExpansion === 'hanging'
  ) {
    const subtopicHeight = verticalExtentGroupHeight(subtopicExtents, gap);
    return normalizeVerticalExtent({
      above: ownAbove,
      below: ownBelow + gap + subtopicHeight,
    });
  }

  const subtopicHeight = verticalExtentGroupHeight(subtopicExtents, gap);
  const subtopicCenterOffset = directSubtopicGroupCenterOffset(subtopicExtents, gap);
  return normalizeVerticalExtent({
    above: Math.max(ownAbove, subtopicCenterOffset),
    below: Math.max(ownBelow, subtopicHeight - subtopicCenterOffset),
  });
}

/*
 * 作用：
 * 计算时间轴详情子树需要占用的垂直高度。
 */
export function timelineDetailSubtreeHeight(
  topic,
  branchSide,
  collapsedIds,
  branchExpansion = 'side'
) {
  return timelineDetailSubtreeExtent(topic, branchSide, collapsedIds, branchExpansion).height;
}
