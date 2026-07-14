/*
 * 关联线端点支持的 8 个固定锚点。
 * 四个角点避开主题卡片的圆角空白，落在实际可见的上/下边框上。
 */

// 普通主题卡片的圆角半径为 8px；锚点向内收缩后才会真正落在描边上。
const TOPIC_CARD_CORNER_ANCHOR_INSET = 8;

/**
 * 计算主题边框上的 8 个固定锚点坐标。
 * 角点沿边框向内收缩 TOPIC_CARD_CORNER_ANCHOR_INSET，避开圆角空白区域。
 * @param {{ x: number, y: number, width: number, height: number }} layout - 主题布局盒
 * @returns {Array<{ name: string, x: number, y: number }>}
 */
export function relationAnchorPoints(layout) {
  const left = layout.x - layout.width / 2;
  const right = layout.x + layout.width / 2;
  const top = layout.y - layout.height / 2;
  const bottom = layout.y + layout.height / 2;
  const cornerInset = Math.min(TOPIC_CARD_CORNER_ANCHOR_INSET, layout.width / 4, layout.height / 4);

  return [
    { name: 'top-left', x: left + cornerInset, y: top },
    { name: 'top', x: layout.x, y: top },
    { name: 'top-right', x: right - cornerInset, y: top },
    { name: 'left', x: left, y: layout.y },
    { name: 'right', x: right, y: layout.y },
    { name: 'bottom-left', x: left + cornerInset, y: bottom },
    { name: 'bottom', x: layout.x, y: bottom },
    { name: 'bottom-right', x: right - cornerInset, y: bottom },
  ];
}

/**
 * 按名称获取单个锚点坐标，未匹配时返回 null。
 * @param {{ x: number, y: number, width: number, height: number }} layout - 主题布局盒
 * @param {string} name - 锚点名称
 * @returns {{ name: string, x: number, y: number } | null}
 */
export function relationAnchorPoint(layout, name) {
  return relationAnchorPoints(layout).find((anchor) => anchor.name === name) || null;
}

/**
 * 找到距离给定点最近的锚点，返回带 distance 字段的锚点对象。
 * @param {{ x: number, y: number, width: number, height: number }} layout - 主题布局盒
 * @param {{ x: number, y: number }} point - 目标坐标
 * @returns {{ name: string, x: number, y: number, distance: number }}
 */
export function nearestRelationAnchor(layout, point) {
  return relationAnchorPoints(layout).reduce((nearest, anchor) => {
    const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    return !nearest || distance < nearest.distance ? { ...anchor, distance } : nearest;
  }, null);
}

/**
 * 将路径首尾坐标替换为手动指定的锚点位置。
 * 未配置锚点的端点保持原路径坐标不变。
 * @param {Array<{ x: number, y: number }>} points - 原始路径点
 * @param {{ x: number, y: number, width: number, height: number }} fromLayout - 起点主题布局
 * @param {{ x: number, y: number, width: number, height: number }} toLayout - 终点主题布局
 * @param {Object} attributes - 结构属性，可含 fromAnchor / toAnchor
 * @returns {Array<{ x: number, y: number }>}
 */
export function applyRelationAnchorEndpoints(points, fromLayout, toLayout, attributes = {}) {
  if (points.length < 2) return points;
  const anchored = points.map((point) => ({ ...point }));
  const fromAnchor = relationAnchorPoint(fromLayout, attributes.fromAnchor);
  const toAnchor = relationAnchorPoint(toLayout, attributes.toAnchor);
  if (fromAnchor) anchored[0] = { x: fromAnchor.x, y: fromAnchor.y };
  if (toAnchor) anchored[anchored.length - 1] = { x: toAnchor.x, y: toAnchor.y };
  return anchored;
}

/**
 * 把屏幕像素换算为当前 SVG viewBox 中的导图单位。
 * 关联线抓手用这个比例抵消视图缩放，保证缩小导图后仍有稳定的可见和命中尺寸。
 * @param {{ width: number, height: number } | null} viewBox
 * @param {number} viewportWidth
 * @param {number} viewportHeight
 * @returns {number}
 */
export function relationControlMapUnitsPerPixel(viewBox, viewportWidth, viewportHeight) {
  if (!viewBox || viewportWidth <= 0 || viewportHeight <= 0) return 1;
  return Math.max(viewBox.width / viewportWidth, viewBox.height / viewportHeight);
}
