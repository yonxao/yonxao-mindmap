/*
 * 文件作用：
 * 连线路径方法集合，负责曲线、直线、折线和特殊下挂路径生成。
 *
 * 实现逻辑：
 * 根据父子主题侧边、连接点和布局扩展标记生成稳定的 SVG path 字符串。
 *
 * 调用链：
 * connectorDrawMethods -> connectorPathMethods -> SVG path。
 */

import { CONNECTOR_AXIS_EPSILON } from '../../shared/rendererShared.js';

export const connectorPathMethods = {
  axisLinePath(startX, startY, endX, endY) {
    if (Math.abs(startY - endY) < CONNECTOR_AXIS_EPSILON) {
      return ['M', startX, startY, 'H', endX].join(' ');
    }

    if (Math.abs(startX - endX) < CONNECTOR_AXIS_EPSILON) {
      return ['M', startX, startY, 'V', endY].join(' ');
    }

    return null;
  },

  elbowPath(startX, startY, endX, endY, axis) {
    const linePath = this.axisLinePath(startX, startY, endX, endY);
    if (linePath) return linePath;

    if (axis === 'y') {
      const midY = startY + (endY - startY) / 2;
      return ['M', startX, startY, 'V', midY, 'H', endX, 'V', endY].join(' ');
    }

    const midX = startX + (endX - startX) / 2;
    return ['M', startX, startY, 'H', midX, 'V', endY, 'H', endX].join(' ');
  },

  hangingHorizontalPath(startX, startY, endX, endY) {
    return (
      this.axisLinePath(startX, startY, endX, endY) ||
      ['M', startX, startY, 'V', endY, 'H', endX].join(' ')
    );
  },

  hangingVerticalPath(startX, startY, endX, endY) {
    return (
      this.axisLinePath(startX, startY, endX, endY) ||
      ['M', startX, startY, 'H', endX, 'V', endY].join(' ')
    );
  },

  connectorPath(anchors, layoutMode) {
    const { kind, startX, startY, endX, endY, axis, sign } = anchors;
    const connectorStyle = this.effectiveConnectorStyle(layoutMode);

    if (kind === 'tree-branch' || kind === 'trunk-branch') {
      return this.axisLinePath(startX, startY, endX, startY);
    }

    if (kind === 'org') {
      const midY = startY + (endY - startY) / 2;
      return (
        this.axisLinePath(startX, startY, endX, endY) ||
        ['M', startX, startY, 'V', midY, 'H', endX, 'V', endY].join(' ')
      );
    }

    if (kind === 'org-right-subtopic') {
      return this.axisLinePath(startX, startY, endX, startY);
    }

    if (kind === 'timeline-detail') {
      return this.axisLinePath(startX, startY, endX, startY);
    }

    if (kind === 'hanging-horizontal') {
      return this.hangingHorizontalPath(startX, startY, endX, endY);
    }

    if (kind === 'hanging-vertical') {
      return this.hangingVerticalPath(startX, startY, endX, endY);
    }

    if (kind === 'radial') {
      return ['M', startX, startY, 'L', endX, endY].join(' ');
    }

    if (kind === 'fishbone-primary-bone') {
      return ['M', startX, startY, 'L', endX, endY].join(' ');
    }

    if (kind === 'fishbone-rib-descendant') {
      const midX = startX + (endX - startX) / 2;
      return (
        this.axisLinePath(startX, startY, endX, endY) ||
        ['M', startX, startY, 'H', midX, 'V', endY, 'H', endX].join(' ')
      );
    }

    if (kind === 'fishbone-rib-topic') {
      return this.axisLinePath(startX, startY, endX, startY);
    }

    if (kind === 'skip') {
      return '';
    }

    if (connectorStyle === 'straight') {
      return ['M', startX, startY, 'L', endX, endY].join(' ');
    }

    if (connectorStyle === 'elbow') {
      return this.elbowPath(startX, startY, endX, endY, axis);
    }

    const bend = Math.max(44, Math.abs(axis === 'y' ? endY - startY : endX - startX) * 0.46);
    if (axis === 'y') {
      return [
        'M',
        startX,
        startY,
        'C',
        startX,
        startY + sign * bend,
        endX,
        endY - sign * bend,
        endX,
        endY,
      ].join(' ');
    }

    return [
      'M',
      startX,
      startY,
      'C',
      startX + sign * bend,
      startY,
      endX - sign * bend,
      endY,
      endX,
      endY,
    ].join(' ');
  },
};
