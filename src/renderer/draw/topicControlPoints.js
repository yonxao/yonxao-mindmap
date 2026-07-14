/*
 * 文件作用：
 * 主题控件语义点计算方法集合，负责父线入口、子线出口和兄弟插入点。
 *
 * 实现逻辑：
 * 根据布局类型、主题层级、分支方向和下挂展开状态推导按钮应贴合的主题边框点。
 *
 * 调用链：
 * topicControlDrawMethods -> topicControlPointMethods -> SVG 控件定位。
 */

import { EDIT_BUTTON_SIZE, TOPIC_CONTROL_AVOID_OFFSET } from '../../shared/rendererShared.js';

// 不提供子线出口控件点的连接器类型列表；这些类型使用主干/骨架等结构线，不依赖主题子线出口。
const STRUCTURAL_CONNECTOR_ANCHOR_KINDS = Object.freeze([
  'tree-branch',
  'trunk-branch',
  'skip',
  'fishbone-primary-bone',
  'fishbone-rib-topic',
]);

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

    if (hasSubtopics) {
      positions.toggle = points.childConnectorOutlet;
    }

    if (
      !positions.edit &&
      !positions.previousSibling &&
      !positions.nextSibling &&
      !positions.subtopic &&
      !positions.toggle
    ) {
      return null;
    }

    return positions;
  },

  resolveTopicControlPoints(topic) {
    const box = topic._layout;
    const childConnectorOutlet = this.withHangingOutletAvoidance(
      this.childConnectorOutletPoint(topic),
      topic
    );
    const parentConnectorInlet = this.parentConnectorInletPoint(topic, childConnectorOutlet);
    const siblingPoints = this.siblingInsertionPoints(box);

    return {
      parentConnectorInlet,
      childConnectorOutlet,
      previousSiblingInsertionPoint: siblingPoints.previous,
      nextSiblingInsertionPoint: siblingPoints.next,
    };
  },

  childConnectorOutletPoint(topic) {
    const box = topic._layout;
    if (this.isSemanticMultiOutletRootTopic(topic)) {
      const controlSide = this.multiChildConnectorOutletControlSide(topic, new Set());
      return this.topicBorderPoint(box, controlSide);
    }

    if (
      this.config.layout === 'radial' &&
      topic !== this.root &&
      Number.isFinite(box.radialChildAngle)
    ) {
      /*
       * 放射图的折叠/添加按钮必须与子线共用同一出口。
       * radialChildAngle 记录后代的实际展开方向，不受一级分支碰撞平移后的父线入口角度影响。
       */
      const outlet = this.radialConnectorPoint(box, box.radialChildAngle);
      return this.globalPointToTopicPoint(box, outlet.x, outlet.y);
    }

    if (this.shouldUseDefaultChildConnectorOutlet(topic)) {
      return this.defaultChildConnectorOutletPoint(box);
    }

    const connectorPoints = this.visibleChildConnectorOutletPoints(topic);
    const outletSides = new Set(connectorPoints.map((point) => point.side));
    if (outletSides.size > 1) {
      return this.multiChildConnectorOutletPoint(topic, connectorPoints);
    }
    if (connectorPoints.length >= 1) {
      return this.sharedChildConnectorOutletPoint(topic, outletSides);
    }
    return this.defaultChildConnectorOutletPoint(box);
  },

  withHangingOutletAvoidance(point, topic) {
    const vector = this.hangingOutletAvoidVector(topic);
    if (!vector) return point;
    return {
      ...point,
      siblingAvoidVector: vector,
    };
  },

  hangingOutletAvoidVector(topic) {
    const box = topic._layout;
    const firstChild = topic.subtopics?.[0];
    if (!firstChild?._layout) return null;

    // 取首个子主题的连线锚点，从中推导拐点和入口点。
    // 偏移方向 = 入口点(endX/endY) → 拐点，由 connectorGeometryMethods 根据连线路径形状通用推导。
    const anchors = this.connectorAnchors(box, firstChild._layout);
    if (!anchors || anchors.kind === 'skip') return null;

    const bend = this.connectorBendPoint(anchors);
    if (!bend) return null;

    const dx = bend.x - anchors.endX;
    const dy = bend.y - anchors.endY;
    const len = Math.hypot(dx, dy);
    if (len < 1) return null;
    return { x: dx / len, y: dy / len };
  },

  visibleChildConnectorOutletPoints(topic) {
    if (this.collapsedIds.has(topic.id)) return [];

    return (topic.subtopics || [])
      .filter((subtopic) => subtopic?._layout)
      .map((subtopic) => {
        const anchors = this.connectorAnchors(topic._layout, subtopic._layout);
        if (this.isStructuralConnectorAnchor(anchors)) return null;
        return this.globalPointToTopicPoint(topic._layout, anchors.startX, anchors.startY);
      })
      .filter(Boolean);
  },

  shouldUseDefaultChildConnectorOutlet(topic) {
    if (String(topic?._layout?.side || '') === 'timeline-point') return true;
    if (topic !== this.root) return false;
    const mode = this.config.layout;
    return (
      mode === 'tree' ||
      mode === 'tree-left' ||
      mode === 'tree-right' ||
      mode === 'timeline-up' ||
      mode === 'timeline-down' ||
      mode === 'timeline' ||
      this.isFishboneLayoutMode(mode)
    );
  },

  isStructuralConnectorAnchor(anchors) {
    return STRUCTURAL_CONNECTOR_ANCHOR_KINDS.includes(String(anchors?.kind || ''));
  },

  multiChildConnectorOutletPoint(topic, connectorPoints) {
    const outletSides = new Set(connectorPoints.map((point) => point.side));
    const controlSide = this.multiChildConnectorOutletControlSide(topic, outletSides);
    return this.topicBorderPoint(topic._layout, controlSide);
  },

  sharedChildConnectorOutletPoint(topic, outletSides) {
    const [side] = outletSides;
    return this.topicBorderPoint(
      topic._layout,
      side || this.defaultChildConnectorOutletSide(topic._layout)
    );
  },

  multiChildConnectorOutletControlSide(topic, outletSides) {
    const mode = this.config.layout;
    const box = topic._layout;

    if (topic === this.root) {
      if (this.isFishboneLayoutMode(mode)) return this.fishboneSubtopicOutletSide();
      if (mode === 'mindmap-bidirectional') return 'bottom';
      if (mode === 'mindmap-vertical') return 'right';
      if (mode === 'timeline-up' || mode === 'timeline-down' || mode === 'timeline') {
        return 'bottom';
      }
      if (mode === 'tree' || mode === 'tree-left' || mode === 'tree-right' || mode === 'org') {
        return 'bottom';
      }
    }

    const defaultSide = this.defaultChildConnectorOutletSide(box);
    if (!outletSides.has(defaultSide)) return defaultSide;
    if (!outletSides.has('bottom')) return 'bottom';
    if (!outletSides.has('top')) return 'top';
    if (!outletSides.has('right')) return 'right';
    return 'left';
  },

  isSemanticMultiOutletRootTopic(topic) {
    return topic === this.root && this.isMindMapMultiOutletRootMode(this.config.layout);
  },

  isMindMapMultiOutletRootMode(mode) {
    return mode === 'mindmap-bidirectional' || mode === 'mindmap-vertical';
  },

  defaultChildConnectorOutletPoint(box) {
    if (
      this.isFishbonePrimaryTopicBox(box) &&
      Number.isFinite(box.fishboneDiagonalBoneEndX) &&
      Number.isFinite(box.fishboneDiagonalBoneEndY)
    ) {
      return this.globalPointToTopicPoint(
        box,
        box.fishboneDiagonalBoneEndX,
        box.fishboneDiagonalBoneEndY
      );
    }

    const side = this.defaultChildConnectorOutletSide(box);
    if (side === 'left') return { side, x: 0, y: box.height / 2 };
    if (side === 'top') return { side, x: box.width / 2, y: 0 };
    if (side === 'bottom') return { side, x: box.width / 2, y: box.height };
    return { side: 'right', x: box.width, y: box.height / 2 };
  },

  parentConnectorInletPoint(topic, childConnectorOutlet) {
    if (this.isFishbonePrimaryTopicBox(topic?._layout)) {
      return this.topicBorderPoint(topic._layout, this.fishboneHeadSide());
    }

    if (String(topic?._layout?.side || '') === 'timeline-point') {
      return this.topicBorderPoint(topic._layout, 'left');
    }

    const parentTopic = this.parentTopicForTopic(topic);
    if (parentTopic?._layout) {
      const anchors = this.connectorAnchors(parentTopic._layout, topic._layout);
      return this.globalPointToTopicPoint(topic._layout, anchors.endX, anchors.endY);
    }

    return this.topicBorderPoint(
      topic._layout,
      this.rootParentConnectorInletSide(topic, childConnectorOutlet)
    );
  },

  rootParentConnectorInletSide(topic, childConnectorOutlet) {
    const mode = this.config.layout;
    if (this.isFishboneLayoutMode(mode)) return this.fishboneHeadSide();
    if (mode === 'timeline-up' || mode === 'timeline-down' || mode === 'timeline') return 'left';
    if (mode === 'tree' || mode === 'tree-left' || mode === 'tree-right') return 'top';
    if (mode === 'mindmap-bidirectional') return 'top';
    if (mode === 'mindmap-vertical') return 'left';
    if (mode === 'org' || mode === 'org-right') return 'top';
    return this.oppositeTopicSide(childConnectorOutlet.side);
  },

  siblingInsertionPoints(box) {
    if (this.shouldPlaceSiblingButtonsHorizontally(box)) {
      return {
        previous: this.topicBorderPoint(box, 'left'),
        next: this.topicBorderPoint(box, 'right'),
      };
    }

    return {
      previous: this.topicBorderPoint(box, 'top'),
      next: this.topicBorderPoint(box, 'bottom'),
    };
  },

  defaultChildConnectorOutletSide(box) {
    const side = String(box.side || '');
    if (box.childBranchExpansion === 'hanging-horizontal') return 'bottom';
    if (box.childBranchExpansion === 'hanging-vertical') return 'right';
    if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
    if (this.isFishboneTopicBox(box) || side === 'root') {
      const mode = this.config.layout;
      if (this.isFishboneLayoutMode(mode)) return this.fishboneSubtopicOutletSide();
    }
    if (this.isTreeTableBox(box)) return 'right';
    if (side === 'tree-left') return 'left';
    if (side === 'org-bottom') return 'bottom';
    if (side === 'org-right-branch') return 'bottom';
    if (side === 'org-hanging') return 'right';
    if (side === 'org-right') return 'right';
    if (side === 'timeline-point') {
      return box.timelineBranchSide === 'timeline-top' ? 'top' : 'bottom';
    }
    if (side === 'timeline-top') return 'top';
    if (side === 'timeline-bottom') return 'bottom';
    if (side === 'timeline-detail-top' || side === 'timeline-detail-bottom') return 'right';
    if (side === 'tree-right') return 'right';

    const mode = this.config.layout;
    if (mode === 'tree' || mode === 'tree-left' || mode === 'tree-right') return 'bottom';
    if (mode === 'timeline-up' || mode === 'timeline-down' || mode === 'timeline') return 'right';
    if (mode === 'mindmap-left') return 'left';
    if (mode === 'mindmap-up') return 'top';
    if (mode === 'mindmap-down' || mode === 'org') return 'bottom';
    if (mode === 'org-right') return 'right';
    return 'right';
  },

  parentTopicForTopic(topic) {
    if (!topic || topic === this.root) return null;
    return this.findParentTopic(this.root, topic.id);
  },

  findParentTopic(parent, topicId) {
    if (!parent || !topicId) return null;
    for (const subtopic of parent.subtopics || []) {
      if (subtopic.id === topicId) return parent;
      const found = this.findParentTopic(subtopic, topicId);
      if (found) return found;
    }
    return null;
  },

  resolveSiblingButtonPosition(point, placement, points) {
    const label = this.siblingButtonLabel(point.side, placement);
    const blockedPoints = [points.childConnectorOutlet, points.parentConnectorInlet];
    const avoidedPoint = this.avoidSiblingInsertionPoint(point, placement, blockedPoints);
    return {
      ...avoidedPoint,
      placement,
      label,
    };
  },

  avoidSiblingInsertionPoint(point, placement, blockedPoints) {
    const conflictPoint = blockedPoints.find((blockedPoint) =>
      this.topicControlPointsConflict(point, blockedPoint)
    );
    if (!conflictPoint) return point;

    if (conflictPoint.siblingAvoidVector) {
      return {
        ...point,
        x: point.x + conflictPoint.siblingAvoidVector.x * TOPIC_CONTROL_AVOID_OFFSET,
        y: point.y + conflictPoint.siblingAvoidVector.y * TOPIC_CONTROL_AVOID_OFFSET,
      };
    }

    const tangentSign = placement === 'before' ? -1 : 1;
    if (point.side === 'left' || point.side === 'right') {
      return {
        ...point,
        y: point.y + tangentSign * TOPIC_CONTROL_AVOID_OFFSET,
      };
    }

    return {
      ...point,
      x: point.x + tangentSign * TOPIC_CONTROL_AVOID_OFFSET,
    };
  },
};
