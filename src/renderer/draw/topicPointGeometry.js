/*
 * 插件兼容出口：主题边界点、方向归一和控件冲突计算由 @yonxao/mindmap-svg-renderer 提供。
 */

export {
  globalPointToTopicPoint,
  nearestTopicBorderSide,
  oppositeTopicSide,
  pointToButtonPosition,
  projectTopicPointToBorder,
  sameTopicControlPoint,
  topicBorderPoint,
  topicControlPointsConflict,
} from '@yonxao/mindmap-svg-renderer';

import {
  globalPointToTopicPoint,
  nearestTopicBorderSide,
  oppositeTopicSide,
  pointToButtonPosition,
  projectTopicPointToBorder,
  sameTopicControlPoint,
  topicBorderPoint,
  topicControlPointsConflict,
} from '@yonxao/mindmap-svg-renderer';

export const topicPointGeometryMethods = {
  topicBorderPoint,
  globalPointToTopicPoint,
  projectTopicPointToBorder,
  nearestTopicBorderSide,
  oppositeTopicSide,
  pointToButtonPosition,
  sameTopicControlPoint,
  topicControlPointsConflict,
};
