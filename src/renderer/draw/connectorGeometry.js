/*
 * 文件作用：
 * 连线几何方法集合，负责锚点裁剪、矩形边界交点和 round cap 修正。
 *
 * 实现逻辑：
 * 这些方法只做几何计算，不直接读取 DOM，方便各类布局共用。
 *
 * 调用链：
 * drawConnector/drawBranchTrunks/drawTimeline -> connectorGeometryMethods。
 */

import { CONNECTOR_ROUND_CAP_EXTENSION } from '../../shared/rendererShared.js';

export const connectorGeometryMethods = {
  trimConnectorAnchors(anchors, layoutMode) {
    if (!anchors || anchors.kind === 'skip') return anchors;

    const offset = CONNECTOR_ROUND_CAP_EXTENSION;
    if (offset <= 0) return anchors;

    if (anchors.kind === 'radial' || anchors.kind === 'fishbone-primary-bone') {
      return this.trimConnectorAlongVectors(
        anchors,
        anchors.endX - anchors.startX,
        anchors.endY - anchors.startY,
        anchors.endX - anchors.startX,
        anchors.endY - anchors.startY,
        offset
      );
    }

    if (anchors.kind === 'hanging-horizontal') {
      return this.trimConnectorAlongVectors(
        anchors,
        0,
        anchors.endY - anchors.startY,
        anchors.endX - anchors.startX,
        0,
        offset
      );
    }

    if (anchors.kind === 'hanging-vertical') {
      return this.trimConnectorAlongVectors(
        anchors,
        anchors.endX - anchors.startX,
        0,
        0,
        anchors.endY - anchors.startY,
        offset
      );
    }

    if (anchors.kind === 'org') {
      return this.trimConnectorAlongVectors(
        anchors,
        0,
        anchors.endY - anchors.startY,
        0,
        anchors.endY - anchors.startY,
        offset
      );
    }

    if (
      anchors.kind === 'tree-branch' ||
      anchors.kind === 'trunk-branch' ||
      anchors.kind === 'org-right-subtopic' ||
      anchors.kind === 'timeline-detail' ||
      anchors.kind === 'fishbone-rib-topic' ||
      anchors.kind === 'fishbone-rib-descendant'
    ) {
      return this.trimConnectorAlongVectors(
        anchors,
        anchors.endX - anchors.startX,
        0,
        anchors.endX - anchors.startX,
        0,
        offset
      );
    }

    if (this.effectiveConnectorStyle(layoutMode) === 'straight') {
      return this.trimConnectorAlongVectors(
        anchors,
        anchors.endX - anchors.startX,
        anchors.endY - anchors.startY,
        anchors.endX - anchors.startX,
        anchors.endY - anchors.startY,
        offset
      );
    }

    const axis = anchors.axis === 'y' ? 'y' : 'x';
    const sign = anchors.sign || 1;
    return this.trimConnectorAlongVectors(
      anchors,
      axis === 'y' ? 0 : sign,
      axis === 'y' ? sign : 0,
      axis === 'y' ? 0 : sign,
      axis === 'y' ? sign : 0,
      offset
    );
  },

  trimConnectorAlongVectors(anchors, startDx, startDy, endDx, endDy, offset) {
    const startVector = this.normalizedVector(startDx, startDy);
    const endVector = this.normalizedVector(endDx, endDy);
    if (!startVector || !endVector) return anchors;

    return {
      ...anchors,
      startX: anchors.startX + startVector.x * offset,
      startY: anchors.startY + startVector.y * offset,
      endX: anchors.endX - endVector.x * offset,
      endY: anchors.endY - endVector.y * offset,
    };
  },

  normalizedVector(dx, dy) {
    const length = Math.hypot(dx, dy);
    if (length <= Number.EPSILON) return null;
    return {
      x: dx / length,
      y: dy / length,
    };
  },

  /*
   * 作用：
   * 根据连线锚点推导拐点（折线的转弯角坐标）。
   *
   * 使用场景：
   * 主题控件避让偏移方向 = 子主题父线入口点 → 拐点。
   *
   * 返回：
   * { x, y } | null（直线连线无拐点返回 null）。
   */
  connectorBendPoint(anchors) {
    const { kind, startX, startY, endX, endY } = anchors;

    if (kind === 'hanging-horizontal') {
      // V-then-H: M startX, startY V endY H endX → 拐点 = (startX, endY)
      return { x: startX, y: endY };
    }

    if (kind === 'hanging-vertical') {
      // H-then-V: M startX, startY H endX V endY → 拐点 = (endX, startY)
      return { x: endX, y: startY };
    }

    if (kind === 'fishbone-rib-descendant') {
      // H-V-H: M startX, startY H midX V endY H endX → 入口前最后一个拐点 = (midX, endY)
      const midX = (startX + endX) / 2;
      return { x: midX, y: endY };
    }

    if (kind === 'org') {
      // V-H-V: M startX, startY V midY H endX V endY → 入口前最后一个拐点 = (endX, midY)
      const midY = (startY + endY) / 2;
      return { x: endX, y: midY };
    }

    return null;
  },

  connectorAnchors(parentBox, subtopicBox) {
    const side = subtopicBox.side;

    if (subtopicBox.branchExpansion === 'hanging') {
      if (side === 'top' || side === 'bottom') {
        const direction = side === 'top' ? -1 : 1;
        const horizontalDirection = subtopicBox.x < parentBox.x ? -1 : 1;
        return {
          kind: 'hanging-vertical',
          startX: parentBox.x + horizontalDirection * (parentBox.width / 2),
          startY: parentBox.y,
          endX: subtopicBox.x,
          endY: subtopicBox.y - direction * (subtopicBox.height / 2),
        };
      }

      const direction =
        side === 'left' || side === 'tree-left' || subtopicBox.fishboneDirection < 0 ? -1 : 1;
      return {
        kind: 'hanging-horizontal',
        startX: parentBox.x,
        startY: parentBox.y + parentBox.height / 2,
        endX: subtopicBox.x - direction * (subtopicBox.width / 2),
        endY: subtopicBox.y,
      };
    }

    if (parentBox.side === 'root' && (side === 'tree-left' || side === 'tree-right')) {
      return {
        kind: 'tree-branch',
        startX: parentBox.x,
        startY: subtopicBox.y,
        endX:
          side === 'tree-left'
            ? subtopicBox.x + subtopicBox.width / 2
            : subtopicBox.x - subtopicBox.width / 2,
        endY: subtopicBox.y,
      };
    }

    if (parentBox.side === 'root' && side === 'org-right') {
      return {
        kind: 'trunk-branch',
        startX: parentBox.x,
        startY: subtopicBox.y,
        endX: subtopicBox.x - subtopicBox.width / 2,
        endY: subtopicBox.y,
      };
    }

    if (parentBox.side === 'root' && side === 'org-right-branch') {
      return {
        kind: 'org',
        startX: parentBox.x,
        startY: parentBox.y + parentBox.height / 2,
        endX: subtopicBox.x,
        endY: subtopicBox.y - subtopicBox.height / 2,
      };
    }

    if (parentBox.side === 'root' && side === 'timeline-point') {
      return {
        kind: 'skip',
        startX: subtopicBox.x,
        startY: subtopicBox.y,
        endX: subtopicBox.x,
        endY: subtopicBox.y,
      };
    }

    if (parentBox.side === 'root' && (side === 'fishbone-top' || side === 'fishbone-bottom')) {
      return {
        kind: 'fishbone-primary-bone',
        startX: subtopicBox.fishboneMainSpineAttachX,
        startY: parentBox.y,
        endX: subtopicBox.x,
        endY:
          side === 'fishbone-top'
            ? subtopicBox.y + subtopicBox.height / 2
            : subtopicBox.y - subtopicBox.height / 2,
      };
    }

    if (Number.isFinite(subtopicBox.radialAngle)) {
      const start = this.radialConnectorPoint(parentBox, subtopicBox.radialAngle);
      const end = this.radialConnectorPoint(subtopicBox, subtopicBox.radialAngle + Math.PI);
      return {
        kind: 'radial',
        startX: start.x,
        startY: start.y,
        endX: end.x,
        endY: end.y,
      };
    }

    if (side === 'fishbone-rib-descendant') {
      const direction = subtopicBox.fishboneDirection || 1;
      return {
        kind: 'fishbone-rib-descendant',
        startX: parentBox.x + direction * (parentBox.width / 2),
        startY: parentBox.y,
        endX: subtopicBox.x - direction * (subtopicBox.width / 2),
        endY: subtopicBox.y,
      };
    }

    if (side === 'fishbone-rib-topic') {
      const direction = subtopicBox.fishboneDirection || 1;
      return {
        kind: 'fishbone-rib-topic',
        startX: subtopicBox.fishboneDiagonalBoneAttachX,
        startY: subtopicBox.fishboneDiagonalBoneAttachY,
        endX: subtopicBox.x - direction * (subtopicBox.width / 2),
        endY: subtopicBox.y,
      };
    }

    if (side === 'timeline-detail-top' || side === 'timeline-detail-bottom') {
      if (subtopicBox.branchExpansion === 'side') {
        return {
          startX: parentBox.x + parentBox.width / 2,
          startY: parentBox.y,
          endX: subtopicBox.x - subtopicBox.width / 2,
          endY: subtopicBox.y,
          axis: 'x',
          sign: 1,
        };
      }

      const startX = this.timelineDetailBranchX(parentBox, [subtopicBox]);
      return {
        kind: 'timeline-detail',
        startX,
        startY: subtopicBox.y,
        endX: subtopicBox.x - subtopicBox.width / 2,
        endY: subtopicBox.y,
      };
    }

    if (side === 'org-bottom') {
      return {
        kind: 'org',
        startX: parentBox.x,
        startY: parentBox.y + parentBox.height / 2,
        endX: subtopicBox.x,
        endY: subtopicBox.y - subtopicBox.height / 2,
      };
    }

    if (side === 'org-hanging') {
      return {
        kind: 'hanging-horizontal',
        startX: parentBox.x,
        startY: parentBox.y + parentBox.height / 2,
        endX: subtopicBox.x - subtopicBox.width / 2,
        endY: subtopicBox.y,
      };
    }

    if (side === 'org-right') {
      if (subtopicBox.branchExpansion === 'side') {
        return {
          startX: parentBox.x + parentBox.width / 2,
          startY: parentBox.y,
          endX: subtopicBox.x - subtopicBox.width / 2,
          endY: subtopicBox.y,
          axis: 'x',
          sign: 1,
        };
      }

      return {
        kind: 'org-right-subtopic',
        startX: this.orgRightBranchX(parentBox),
        startY: subtopicBox.y,
        endX: subtopicBox.x - subtopicBox.width / 2,
        endY: subtopicBox.y,
      };
    }

    if (side === 'left' || side === 'tree-left') {
      return {
        startX: parentBox.x - parentBox.width / 2,
        startY: parentBox.y,
        endX: subtopicBox.x + subtopicBox.width / 2,
        endY: subtopicBox.y,
        axis: 'x',
        sign: -1,
      };
    }

    if (side === 'top') {
      return {
        startX: parentBox.x,
        startY: parentBox.y - parentBox.height / 2,
        endX: subtopicBox.x,
        endY: subtopicBox.y + subtopicBox.height / 2,
        axis: 'y',
        sign: -1,
      };
    }

    if (side === 'bottom') {
      return {
        startX: parentBox.x,
        startY: parentBox.y + parentBox.height / 2,
        endX: subtopicBox.x,
        endY: subtopicBox.y - subtopicBox.height / 2,
        axis: 'y',
        sign: 1,
      };
    }

    return {
      startX: parentBox.x + parentBox.width / 2,
      startY: parentBox.y,
      endX: subtopicBox.x - subtopicBox.width / 2,
      endY: subtopicBox.y,
      axis: 'x',
      sign: 1,
    };
  },
};
