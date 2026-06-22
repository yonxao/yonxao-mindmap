/*
 * 文件作用：
 * 主题点位几何方法集合，负责主题矩形边框上的基础点和方向归一。
 *
 * 实现逻辑：
 * 为高层语义点计算提供纯几何辅助，避免控件绘制重复处理矩形边界。
 *
 * 调用链：
 * topicControlPoints/connectorGeometry -> topicPointGeometryMethods。
 */

import {
  clamp,
  TOPIC_TOGGLE_BUTTON_RADIUS,
  TOPIC_SIBLING_BUTTON_RADIUS,
  TOPIC_CONTROL_AVOID_GAP,
} from '../../shared/rendererShared.js';

export const topicPointGeometryMethods = {
  topicBorderPoint(box, side) {
    if (side === 'left') return { side, x: 0, y: box.height / 2 };
    if (side === 'right') return { side, x: box.width, y: box.height / 2 };
    if (side === 'top') return { side, x: box.width / 2, y: 0 };
    return { side: 'bottom', x: box.width / 2, y: box.height };
  },

  globalPointToTopicPoint(box, x, y) {
    const localX = x - (box.x - box.width / 2);
    const localY = y - (box.y - box.height / 2);
    return this.projectTopicPointToBorder(box, localX, localY);
  },

  projectTopicPointToBorder(box, x, y) {
    const side = this.nearestTopicBorderSide(box, x, y);
    if (side === 'left') return { side, x: 0, y: clamp(y, 0, box.height) };
    if (side === 'right') return { side, x: box.width, y: clamp(y, 0, box.height) };
    if (side === 'top') return { side, x: clamp(x, 0, box.width), y: 0 };
    return { side: 'bottom', x: clamp(x, 0, box.width), y: box.height };
  },

  nearestTopicBorderSide(box, x, y) {
    const distances = [
      { side: 'left', distance: Math.abs(x) },
      { side: 'right', distance: Math.abs(box.width - x) },
      { side: 'top', distance: Math.abs(y) },
      { side: 'bottom', distance: Math.abs(box.height - y) },
    ];
    distances.sort((a, b) => a.distance - b.distance);
    return distances[0].side;
  },

  oppositeTopicSide(side) {
    if (side === 'left') return 'right';
    if (side === 'right') return 'left';
    if (side === 'top') return 'bottom';
    return 'top';
  },

  pointToButtonPosition(point, size) {
    return {
      ...point,
      x: point.x - size.width / 2,
      y: point.y - size.height / 2,
    };
  },

  sameTopicControlPoint(a, b) {
    return Boolean(a && b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5);
  },

  topicControlPointsConflict(a, b) {
    if (!a || !b) return false;
    if (this.sameTopicControlPoint(a, b)) return true;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const minDistance =
      TOPIC_SIBLING_BUTTON_RADIUS + TOPIC_TOGGLE_BUTTON_RADIUS + TOPIC_CONTROL_AVOID_GAP;
    return Math.sqrt(dx * dx + dy * dy) < minDistance;
  },
};
