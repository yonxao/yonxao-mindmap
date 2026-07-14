/**
 * 高级结构的纯几何计算，避免与 Obsidian DOM 绘制逻辑耦合。
 * 包含主题包围盒转换、区间重叠检测和边界标签碰撞偏移。
 */

/**
 * 把主题中心点布局转换为轴对齐包围盒。
 * @param {{ _layout: { x: number, y: number, width: number, height: number } }} topic
 * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
 */
export function topicLayoutBox(topic) {
  const box = topic._layout;
  return {
    minX: box.x - box.width / 2,
    minY: box.y - box.height / 2,
    maxX: box.x + box.width / 2,
    maxY: box.y + box.height / 2,
  };
}

/**
 * 判断两个一维区间是否真正重叠，边界接触不算重叠。
 * @param {number} minA
 * @param {number} maxA
 * @param {number} minB
 * @param {number} maxB
 * @returns {boolean}
 */
export function rangesOverlap(minA, maxA, minB, maxB) {
  return maxA > minB && maxB > minA;
}

/**
 * 判断两个轴对齐包围盒是否重叠。
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} first
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} second
 * @returns {boolean}
 */
function boxesOverlap(first, second) {
  return (
    rangesOverlap(first.minX, first.maxX, second.minX, second.maxX) &&
    rangesOverlap(first.minY, first.maxY, second.minY, second.maxY)
  );
}

/**
 * 外框标题与上方主题冲突时，为标题插入一条完整的水平空间。
 *
 * 关键点：
 * 不能只移动与外框同列的主题。否则多次避让后，后续分支的子主题会下移，
 * 但父主题仍留在原位，破坏树形图的父子对齐和分组边界。
 *
 * @param {Array<Object>} layoutTopics - 所有已布局的主题
 * @param {Array<Object>} includedTopics - 外框包含的主题
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} boundaryBox - 外框包围盒
 * @param {{ minX: number, minY: number, maxX: number, maxY: number }} labelBox - 标签包围盒
 * @param {number} neighborGap - 标签与相邻主题的间隙
 * @returns {number} 实际下移的像素量，无碰撞时为 0
 */
export function reserveBoundaryLabelVerticalSpace(
  layoutTopics,
  includedTopics,
  boundaryBox,
  labelBox,
  neighborGap
) {
  const included = new Set(includedTopics);
  const labelClearanceBox = {
    ...labelBox,
    minY: labelBox.minY - neighborGap,
  };
  const collisions = layoutTopics
    .filter((topic) => !included.has(topic))
    .map(topicLayoutBox)
    .filter((topicBox) => boxesOverlap(labelClearanceBox, topicBox));
  if (!collisions.length) return 0;

  const shiftY = Math.max(
    ...collisions.map((topicBox) => topicBox.maxY + neighborGap - labelBox.minY)
  );
  for (const topic of layoutTopics) {
    const topicBox = topicLayoutBox(topic);
    // 把穿过插入线及其下方的主题整体下移，保持后续子树的相对坐标。
    if (included.has(topic) || topicBox.maxY > boundaryBox.minY) topic._layout.y += shiftY;
  }
  return shiftY;
}
