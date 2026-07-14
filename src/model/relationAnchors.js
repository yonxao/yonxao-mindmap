/*
 * 关联线端点支持的 8 个固定锚点。
 * 四个角点避开主题卡片的圆角空白，落在实际可见的上/下边框上。
 */
import { RELATION_ANCHOR_NAMES } from '../parser/mindStructures.js';

export { RELATION_ANCHOR_NAMES };

// 普通主题卡片的圆角半径为 8px；锚点向内收缩后才会真正落在描边上。
const TOPIC_CARD_CORNER_ANCHOR_INSET = 8;

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

export function relationAnchorPoint(layout, name) {
  return relationAnchorPoints(layout).find((anchor) => anchor.name === name) || null;
}

export function nearestRelationAnchor(layout, point) {
  return relationAnchorPoints(layout).reduce((nearest, anchor) => {
    const distance = Math.hypot(point.x - anchor.x, point.y - anchor.y);
    return !nearest || distance < nearest.distance ? { ...anchor, distance } : nearest;
  }, null);
}

export function applyRelationAnchorEndpoints(points, fromLayout, toLayout, attributes = {}) {
  if (points.length < 2) return points;
  const anchored = points.map((point) => ({ ...point }));
  const fromAnchor = relationAnchorPoint(fromLayout, attributes.fromAnchor);
  const toAnchor = relationAnchorPoint(toLayout, attributes.toAnchor);
  if (fromAnchor) anchored[0] = { x: fromAnchor.x, y: fromAnchor.y };
  if (toAnchor) anchored[anchored.length - 1] = { x: toAnchor.x, y: toAnchor.y };
  return anchored;
}

/*
 * 把屏幕像素换算为当前 SVG viewBox 中的导图单位。
 * 关联线抓手用这个比例抵消视图缩放，保证缩小导图后仍有稳定的可见和命中尺寸。
 */
export function relationControlMapUnitsPerPixel(viewBox, viewportWidth, viewportHeight) {
  if (!viewBox || viewportWidth <= 0 || viewportHeight <= 0) return 1;
  return Math.max(viewBox.width / viewportWidth, viewBox.height / viewportHeight);
}
