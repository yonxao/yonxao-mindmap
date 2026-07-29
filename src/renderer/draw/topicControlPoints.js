/*
 * 插件适配层：主题控件语义点由 @yonxao/mindmap-svg-renderer 统一计算。
 * 这里仅组合编辑权限、按钮显隐、国际化标签和 renderer 当前状态。
 */

import {
  EDIT_BUTTON_SIZE,
  avoidSiblingInsertionPoint,
  resolveTopicControlPoints,
} from '@yonxao/mindmap-svg-renderer';

export const topicControlPointMethods = {
  resolveTopicControlPositions(topic) {
    if (!topic || topic._virtual) return null;

    const canEdit = this.canEditMindMap();
    const points = this.resolveTopicControlPoints(topic);
    const hasSubtopics = topic.subtopics.length > 0;
    const positions = {};

    if (canEdit) {
      positions.edit = this.pointToButtonPosition(points.parentConnectorInlet, {
        width: EDIT_BUTTON_SIZE,
        height: EDIT_BUTTON_SIZE,
      });

      if (this.shouldShowSiblingTopicControls(topic)) {
        positions.previousSibling = this.resolveSiblingButtonPosition(
          points.previousSiblingInsertionPoint,
          'before',
          points
        );
        positions.nextSibling = this.resolveSiblingButtonPosition(
          points.nextSiblingInsertionPoint,
          'after',
          points
        );
      }

      if (!hasSubtopics && this.shouldShowSubtopicControl(topic)) {
        positions.subtopic = points.childConnectorOutlet;
      }
    }

    if (hasSubtopics) positions.toggle = points.childConnectorOutlet;
    return Object.keys(positions).length ? positions : null;
  },

  resolveTopicControlPoints(topic) {
    return resolveTopicControlPoints(topic, {
      root: this.root,
      layoutMode: this.config.layout,
      collapsedIds: this.collapsedIds,
    });
  },

  resolveSiblingButtonPosition(point, placement, points) {
    return {
      ...avoidSiblingInsertionPoint(point, placement, [
        points.childConnectorOutlet,
        points.parentConnectorInlet,
      ]),
      placement,
      label: this.siblingButtonLabel(point.side, placement),
    };
  },
};
