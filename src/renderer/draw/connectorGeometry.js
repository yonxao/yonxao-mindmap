/*
 * 插件兼容出口：连接线锚点、裁剪和拐点计算由 @yonxao/mindmap-svg-renderer 提供。
 * renderer 只负责把当前布局对应的线型传入公共核心。
 */

import {
  connectorAnchors,
  connectorBendPoint,
  normalizedVector,
  trimConnectorAlongVectors,
  trimConnectorAnchors,
} from '@yonxao/mindmap-svg-renderer';

export const connectorGeometryMethods = {
  trimConnectorAnchors(anchors, layoutMode) {
    return trimConnectorAnchors(anchors, this.effectiveConnectorStyle(layoutMode));
  },

  trimConnectorAlongVectors,
  normalizedVector,
  connectorBendPoint,
  connectorAnchors,
};
