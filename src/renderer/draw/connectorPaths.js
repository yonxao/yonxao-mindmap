/*
 * 插件兼容出口：连接线路径算法由 @yonxao/mindmap-svg-renderer 提供。
 * 这里只把 renderer 的布局配置转换成核心需要的 connectorStyle。
 */

import {
  axisLinePath,
  connectorPath,
  elbowPath,
  hangingHorizontalPath,
  hangingVerticalPath,
} from '@yonxao/mindmap-svg-renderer';

export const connectorPathMethods = {
  axisLinePath,
  elbowPath,
  hangingHorizontalPath,
  hangingVerticalPath,

  connectorPath(anchors, layoutMode) {
    return connectorPath(anchors, this.effectiveConnectorStyle(layoutMode));
  },
};
