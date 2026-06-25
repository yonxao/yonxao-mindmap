/*
 * 文件作用：
 * 树形表格和阶梯树形表格布局。
 */

import {
  TEXT_Y_CENTER_RATIO,
  TOPIC_MIN_HEIGHT,
  TOPIC_MIN_WIDTH,
  TOPIC_PADDING_Y,
  visibleSubtopics,
} from './layoutShared.js';

/*
 * 树形表格的最小列宽度。
 * 即使所有主题文本都很短，列的宽度也不会低于此值，保证表格有基本的可读性。
 */
const TREE_TABLE_MIN_COLUMN_WIDTH = 120;
/*
 * 树形表格表头高度相对于 TOPIC_MIN_HEIGHT 的最小乘数。
 * 表头需要比正文行更高以保持视觉层次感。
 */
const TREE_TABLE_HEADER_HEIGHT_MULTIPLIER = 1.6;

export function layoutTreeTable(root, collapsedIds, options = {}) {
  const fillLeafRemainderColumns = options.fillLeafRemainderColumns !== false;
  const rootBox = root._layout;
  const columnWidths = treeTableColumnWidths(root, collapsedIds);
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const headerHeight = Math.max(
    rootBox.height + TOPIC_PADDING_Y * 2,
    TOPIC_MIN_HEIGHT * TREE_TABLE_HEADER_HEIGHT_MULTIPLIER
  );

  rootBox.side = 'tree-table-root';
  rootBox.width = Math.max(rootBox.width, tableWidth);
  rootBox.height = headerHeight;
  rootBox.x = 0;
  rootBox.y = headerHeight / 2;
  recenterTopicText(rootBox);

  const subtopics = visibleSubtopics(root, collapsedIds);
  if (!subtopics.length) return;

  const bodyTop = headerHeight;
  const tableLeft = -tableWidth / 2;
  const columnLefts = treeTableColumnLefts(columnWidths, tableLeft);
  const subtopicHeights = subtopics.map((subtopic) =>
    treeTableSubtreeHeight(subtopic, collapsedIds)
  );
  let cursorTop = bodyTop;

  subtopics.forEach((subtopic, index) => {
    const allocatedHeight = subtopicHeights[index];
    placeTreeTableTopic(
      subtopic,
      0,
      cursorTop,
      allocatedHeight,
      columnLefts,
      columnWidths,
      collapsedIds,
      { fillLeafRemainderColumns }
    );
    cursorTop += allocatedHeight;
  });
}

/*
 * 作用：
 * 统计树形表格每一列的宽度。
 *
 * 变量说明：
 * columnIndex 从 0 开始；根主题是表头，不占正文列，所以根主题的直接子主题在第 0 列。
 * 每列取该列所有主题宽度的最大值，并设置一个最小宽度，保证表格不会因为短文本变得太窄。
 */
export function treeTableColumnWidths(root, collapsedIds) {
  const columnWidths = [];
  const minColumnWidth = Math.max(TOPIC_MIN_WIDTH, TREE_TABLE_MIN_COLUMN_WIDTH);

  const visit = (topic, columnIndex) => {
    const box = topic._layout;
    columnWidths[columnIndex] = Math.max(columnWidths[columnIndex] || minColumnWidth, box.width);

    for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
      visit(subtopic, columnIndex + 1);
    }
  };

  for (const subtopic of visibleSubtopics(root, collapsedIds)) {
    visit(subtopic, 0);
  }

  return columnWidths.length ? columnWidths : [minColumnWidth];
}

/*
 * 作用：
 * 根据列宽和表格左边界，计算每一列的左侧 x 坐标。
 */
export function treeTableColumnLefts(columnWidths, tableLeft) {
  const columnLefts = [];
  let cursorX = tableLeft;

  columnWidths.forEach((width, index) => {
    columnLefts[index] = cursorX;
    cursorX += width;
  });

  return columnLefts;
}

/*
 * 作用：
 * 计算树形表格中一个主题需要占用的总高度。
 *
 * 实现逻辑：
 * - 叶子主题至少占自己文本需要的高度。
 * - 父主题高度等于所有子主题高度之和。
 * - 如果父主题文本更高，则用父主题高度兜底，后续布局时会把多出的高度分摊给子主题。
 */
export function treeTableSubtreeHeight(topic, collapsedIds) {
  const box = topic._layout;
  const ownHeight = Math.max(TOPIC_MIN_HEIGHT, box.height);
  const subtopics = visibleSubtopics(topic, collapsedIds);
  if (!subtopics.length) return ownHeight;

  const subtopicsHeight = subtopics.reduce(
    (sum, subtopic) => sum + treeTableSubtreeHeight(subtopic, collapsedIds),
    0
  );

  return Math.max(ownHeight, subtopicsHeight);
}

/*
 * 作用：
 * 把主题和它的子树放入树形表格。
 *
 * 变量说明：
 * allocatedHeight 是当前主题拿到的完整单元格高度，类似表格 rowspan 后的高度。
 * subtopicExtraHeight 是父单元格比子主题总高度多出来的部分；平均分给子主题，避免长文案父主题压住右侧子表格。
 */
export function placeTreeTableTopic(
  topic,
  columnIndex,
  topY,
  allocatedHeight,
  columnLefts,
  columnWidths,
  collapsedIds,
  options = {}
) {
  const box = topic._layout;
  const fillLeafRemainderColumns = options.fillLeafRemainderColumns !== false;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const isLeafTopic = subtopics.length === 0;
  const lastColumnIndex = Math.max(0, columnWidths.length - 1);
  const shouldFillRemainingColumns = fillLeafRemainderColumns && isLeafTopic;
  const columnWidth = shouldFillRemainingColumns
    ? columnWidths.slice(columnIndex).reduce((sum, width) => sum + width, 0)
    : columnWidths[columnIndex] || columnWidths[lastColumnIndex];
  const columnLeft = columnLefts[columnIndex] || columnLefts[columnLefts.length - 1];

  box.side = 'tree-table-cell';
  box.treeTableColumn = columnIndex;
  box.treeTableColumnSpan = shouldFillRemainingColumns ? lastColumnIndex - columnIndex + 1 : 1;
  box.width = columnWidth;
  box.height = allocatedHeight;
  box.x = columnLeft + columnWidth / 2;
  box.y = topY + allocatedHeight / 2;
  recenterTopicText(box);

  if (!subtopics.length) return;

  const subtopicBaseHeights = subtopics.map((subtopic) =>
    treeTableSubtreeHeight(subtopic, collapsedIds)
  );
  const subtopicBaseTotal = subtopicBaseHeights.reduce((sum, height) => sum + height, 0);
  const subtopicExtraHeight = Math.max(0, allocatedHeight - subtopicBaseTotal);
  const subtopicExtraHeightPerTopic = subtopicExtraHeight / subtopics.length;
  let subtopicTop = topY;

  subtopics.forEach((subtopic, index) => {
    const subtopicAllocatedHeight = subtopicBaseHeights[index] + subtopicExtraHeightPerTopic;
    placeTreeTableTopic(
      subtopic,
      columnIndex + 1,
      subtopicTop,
      subtopicAllocatedHeight,
      columnLefts,
      columnWidths,
      collapsedIds,
      { fillLeafRemainderColumns }
    );
    subtopicTop += subtopicAllocatedHeight;
  });
}

/*
 * 作用：
 * 主题宽高被布局策略改写后，重新把多行文本垂直居中。
 */
export function recenterTopicText(box) {
  box.textY =
    (box.height - (box.lines.length - 1) * box.font.lineHeight) / 2 +
    box.font.size * TEXT_Y_CENTER_RATIO;
}
