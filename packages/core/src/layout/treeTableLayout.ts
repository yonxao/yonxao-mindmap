import {
  TEXT_Y_CENTER_RATIO,
  TOPIC_MIN_HEIGHT,
  TOPIC_MIN_WIDTH,
  TOPIC_PADDING_Y,
} from './layoutConstants.js';
import type { LayoutTopic, TreeTableLayoutBox } from './layoutTypes.js';
import { visibleSubtopics } from '../model/topicTraversal.js';

const TREE_TABLE_MIN_COLUMN_WIDTH = 120;
const TREE_TABLE_HEADER_HEIGHT_MULTIPLIER = 1.6;

export type TreeTableTopic = LayoutTopic<TreeTableLayoutBox>;

export interface TreeTableLayoutOptions {
  fillLeafRemainderColumns?: boolean;
}

export function layoutTreeTable(
  root: TreeTableTopic,
  collapsedIds: ReadonlySet<string>,
  options: TreeTableLayoutOptions = {}
): void {
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

export function treeTableColumnWidths(
  root: TreeTableTopic,
  collapsedIds: ReadonlySet<string>
): number[] {
  const columnWidths: number[] = [];
  const minimumColumnWidth = Math.max(TOPIC_MIN_WIDTH, TREE_TABLE_MIN_COLUMN_WIDTH);

  const visit = (topic: TreeTableTopic, columnIndex: number): void => {
    const box = topic._layout;
    columnWidths[columnIndex] = Math.max(
      columnWidths[columnIndex] || minimumColumnWidth,
      box.width
    );

    for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
      visit(subtopic, columnIndex + 1);
    }
  };

  for (const subtopic of visibleSubtopics(root, collapsedIds)) {
    visit(subtopic, 0);
  }

  return columnWidths.length ? columnWidths : [minimumColumnWidth];
}

export function treeTableColumnLefts(columnWidths: readonly number[], tableLeft: number): number[] {
  const columnLefts: number[] = [];
  let cursorX = tableLeft;

  columnWidths.forEach((width, index) => {
    columnLefts[index] = cursorX;
    cursorX += width;
  });

  return columnLefts;
}

export function treeTableSubtreeHeight(
  topic: TreeTableTopic,
  collapsedIds: ReadonlySet<string>
): number {
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

export function placeTreeTableTopic(
  topic: TreeTableTopic,
  columnIndex: number,
  topY: number,
  allocatedHeight: number,
  columnLefts: readonly number[],
  columnWidths: readonly number[],
  collapsedIds: ReadonlySet<string>,
  options: TreeTableLayoutOptions = {}
): void {
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

export function recenterTopicText(box: TreeTableLayoutBox): void {
  box.textY =
    (box.height - (box.lines.length - 1) * box.font.lineHeight) / 2 +
    box.font.size * TEXT_Y_CENTER_RATIO;
}
