import { connectorAnchors, connectorBendPoint, radialConnectorPoint } from './connectorGeometry.js';
import type { ConnectorAnchors } from './connectorPaths.js';
import type { LayoutBox, LayoutMode, LayoutTopic } from '@yonxao/mindmap-core';
import {
  globalPointToTopicPoint,
  oppositeTopicSide,
  topicBorderPoint,
  topicControlPointsConflict,
  type TopicBorderPoint,
  type TopicBorderSide,
} from './topicPointGeometry.js';
import { TOPIC_CONTROL_AVOID_OFFSET } from './renderConstants.js';

const STRUCTURAL_CONNECTOR_ANCHOR_KINDS = new Set([
  'tree-branch',
  'trunk-branch',
  'skip',
  'fishbone-primary-bone',
  'fishbone-rib-topic',
]);

export interface TopicControlPoint extends TopicBorderPoint {
  siblingAvoidVector?: { x: number; y: number };
}

export interface TopicControlPoints {
  parentConnectorInlet: TopicControlPoint;
  childConnectorOutlet: TopicControlPoint;
  previousSiblingInsertionPoint: TopicControlPoint;
  nextSiblingInsertionPoint: TopicControlPoint;
}

export interface TopicControlGeometryOptions<TTopic extends LayoutTopic> {
  root: TTopic;
  layoutMode: LayoutMode;
  collapsedIds?: ReadonlySet<string>;
}

export type SiblingPlacement = 'before' | 'after';

function isFishboneLayoutMode(mode: LayoutMode): boolean {
  return mode === 'fishbone-left' || mode === 'fishbone-right';
}

function fishboneHeadSide(mode: LayoutMode): TopicBorderSide {
  return mode === 'fishbone-right' ? 'left' : 'right';
}

function fishboneSubtopicOutletSide(mode: LayoutMode): TopicBorderSide {
  return fishboneHeadSide(mode) === 'left' ? 'right' : 'left';
}

function isFishboneTopicBox(box: LayoutBox): boolean {
  return String(box.side || '').startsWith('fishbone-');
}

function isFishbonePrimaryTopicBox(box: LayoutBox): boolean {
  return box.side === 'fishbone-top' || box.side === 'fishbone-bottom';
}

function isTreeTableBox(box: LayoutBox): boolean {
  return box.side === 'tree-table-root' || box.side === 'tree-table-cell';
}

function isMindMapMultiOutletRootMode(mode: LayoutMode): boolean {
  return mode === 'mindmap-bidirectional' || mode === 'mindmap-vertical';
}

function shouldPlaceSiblingButtonsHorizontally(box: LayoutBox): boolean {
  return [
    'top',
    'bottom',
    'vertical',
    'timeline-point',
    'timeline-top',
    'timeline-bottom',
    'org-bottom',
    'org-right-branch',
  ].includes(String(box.side || '').toLowerCase());
}

export function findParentLayoutTopic<TTopic extends LayoutTopic>(
  parent: TTopic,
  topicId: string
): TTopic | null {
  if (!parent || !topicId) return null;
  for (const subtopic of parent.subtopics as TTopic[]) {
    if (subtopic.id === topicId) return parent;
    const found = findParentLayoutTopic(subtopic, topicId);
    if (found) return found;
  }
  return null;
}

export function defaultChildConnectorOutletSide(
  box: LayoutBox,
  layoutMode: LayoutMode
): TopicBorderSide {
  const side = String(box.side || '');
  if (box.childBranchExpansion === 'hanging-horizontal') return 'bottom';
  if (box.childBranchExpansion === 'hanging-vertical') return 'right';
  if (side === 'left' || side === 'right' || side === 'top' || side === 'bottom') return side;
  if ((isFishboneTopicBox(box) || side === 'root') && isFishboneLayoutMode(layoutMode)) {
    return fishboneSubtopicOutletSide(layoutMode);
  }
  if (isTreeTableBox(box)) return 'right';
  if (side === 'tree-left') return 'left';
  if (side === 'org-bottom' || side === 'org-right-branch') return 'bottom';
  if (side === 'org-hanging' || side === 'org-right') return 'right';
  if (side === 'timeline-point') {
    return box.timelineBranchSide === 'timeline-top' ? 'top' : 'bottom';
  }
  if (side === 'timeline-top') return 'top';
  if (side === 'timeline-bottom') return 'bottom';
  if (side === 'timeline-detail-top' || side === 'timeline-detail-bottom') return 'right';
  if (side === 'tree-right') return 'right';

  if (layoutMode === 'tree' || layoutMode === 'tree-left' || layoutMode === 'tree-right') {
    return 'bottom';
  }
  if (layoutMode === 'timeline-up' || layoutMode === 'timeline-down' || layoutMode === 'timeline') {
    return 'right';
  }
  if (layoutMode === 'mindmap-left') return 'left';
  if (layoutMode === 'mindmap-up') return 'top';
  if (layoutMode === 'mindmap-down' || layoutMode === 'org') return 'bottom';
  return 'right';
}

export function defaultChildConnectorOutletPoint(
  box: LayoutBox,
  layoutMode: LayoutMode
): TopicControlPoint {
  if (
    isFishbonePrimaryTopicBox(box) &&
    typeof box.fishboneDiagonalBoneEndX === 'number' &&
    typeof box.fishboneDiagonalBoneEndY === 'number'
  ) {
    return globalPointToTopicPoint(box, box.fishboneDiagonalBoneEndX, box.fishboneDiagonalBoneEndY);
  }
  return topicBorderPoint(box, defaultChildConnectorOutletSide(box, layoutMode));
}

function isStructuralConnectorAnchor(anchors: ConnectorAnchors): boolean {
  return STRUCTURAL_CONNECTOR_ANCHOR_KINDS.has(String(anchors.kind || ''));
}

function visibleChildConnectorOutletPoints<TTopic extends LayoutTopic>(
  topic: TTopic,
  collapsedIds: ReadonlySet<string>
): TopicControlPoint[] {
  if (collapsedIds.has(topic.id)) return [];
  return (topic.subtopics as TTopic[])
    .filter((subtopic) => subtopic?._layout)
    .map((subtopic) => {
      const anchors = connectorAnchors(topic._layout, subtopic._layout);
      if (isStructuralConnectorAnchor(anchors)) return null;
      return globalPointToTopicPoint(topic._layout, anchors.startX, anchors.startY);
    })
    .filter((point): point is TopicControlPoint => Boolean(point));
}

function multiChildConnectorOutletControlSide<TTopic extends LayoutTopic>(
  topic: TTopic,
  outletSides: ReadonlySet<TopicBorderSide>,
  options: TopicControlGeometryOptions<TTopic>
): TopicBorderSide {
  const { root, layoutMode } = options;
  if (topic === root) {
    if (isFishboneLayoutMode(layoutMode)) return fishboneSubtopicOutletSide(layoutMode);
    if (layoutMode === 'mindmap-bidirectional') return 'bottom';
    if (layoutMode === 'mindmap-vertical') return 'right';
    if (
      layoutMode === 'timeline-up' ||
      layoutMode === 'timeline-down' ||
      layoutMode === 'timeline' ||
      layoutMode === 'tree' ||
      layoutMode === 'tree-left' ||
      layoutMode === 'tree-right' ||
      layoutMode === 'org'
    ) {
      return 'bottom';
    }
  }

  const defaultSide = defaultChildConnectorOutletSide(topic._layout, layoutMode);
  if (!outletSides.has(defaultSide)) return defaultSide;
  if (!outletSides.has('bottom')) return 'bottom';
  if (!outletSides.has('top')) return 'top';
  if (!outletSides.has('right')) return 'right';
  return 'left';
}

function shouldUseDefaultChildConnectorOutlet<TTopic extends LayoutTopic>(
  topic: TTopic,
  options: TopicControlGeometryOptions<TTopic>
): boolean {
  if (topic._layout.side === 'timeline-point') return true;
  if (topic !== options.root) return false;
  return (
    options.layoutMode === 'tree' ||
    options.layoutMode === 'tree-left' ||
    options.layoutMode === 'tree-right' ||
    options.layoutMode === 'timeline-up' ||
    options.layoutMode === 'timeline-down' ||
    options.layoutMode === 'timeline' ||
    isFishboneLayoutMode(options.layoutMode)
  );
}

function childConnectorOutletPoint<TTopic extends LayoutTopic>(
  topic: TTopic,
  options: TopicControlGeometryOptions<TTopic>
): TopicControlPoint {
  const { root, layoutMode } = options;
  const box = topic._layout;
  if (topic === root && isMindMapMultiOutletRootMode(layoutMode)) {
    return topicBorderPoint(box, multiChildConnectorOutletControlSide(topic, new Set(), options));
  }

  if (
    layoutMode === 'radial' &&
    topic !== root &&
    typeof box.radialChildAngle === 'number' &&
    Number.isFinite(box.radialChildAngle)
  ) {
    const outlet = radialConnectorPoint(box, box.radialChildAngle);
    return globalPointToTopicPoint(box, outlet.x, outlet.y);
  }

  if (shouldUseDefaultChildConnectorOutlet(topic, options)) {
    return defaultChildConnectorOutletPoint(box, layoutMode);
  }

  const connectorPoints = visibleChildConnectorOutletPoints(
    topic,
    options.collapsedIds || new Set()
  );
  const outletSides = new Set(connectorPoints.map((point) => point.side));
  if (outletSides.size > 1) {
    return topicBorderPoint(box, multiChildConnectorOutletControlSide(topic, outletSides, options));
  }
  if (connectorPoints.length) {
    const side = connectorPoints[0]!.side;
    return topicBorderPoint(box, side || defaultChildConnectorOutletSide(box, layoutMode));
  }
  return defaultChildConnectorOutletPoint(box, layoutMode);
}

function withHangingOutletAvoidance<TTopic extends LayoutTopic>(
  point: TopicControlPoint,
  topic: TTopic
): TopicControlPoint {
  const firstChild = topic.subtopics[0] as TTopic | undefined;
  if (!firstChild?._layout) return point;
  const anchors = connectorAnchors(topic._layout, firstChild._layout);
  if (anchors.kind === 'skip') return point;
  const bend = connectorBendPoint(anchors);
  if (!bend) return point;
  const dx = bend.x - anchors.endX;
  const dy = bend.y - anchors.endY;
  const length = Math.hypot(dx, dy);
  if (length < 1) return point;
  return { ...point, siblingAvoidVector: { x: dx / length, y: dy / length } };
}

function rootParentConnectorInletSide(
  layoutMode: LayoutMode,
  childConnectorOutlet: TopicControlPoint
): TopicBorderSide {
  if (isFishboneLayoutMode(layoutMode)) return fishboneHeadSide(layoutMode);
  if (layoutMode === 'timeline-up' || layoutMode === 'timeline-down' || layoutMode === 'timeline') {
    return 'left';
  }
  if (
    layoutMode === 'tree' ||
    layoutMode === 'tree-left' ||
    layoutMode === 'tree-right' ||
    layoutMode === 'mindmap-bidirectional' ||
    layoutMode === 'org' ||
    layoutMode === 'org-right'
  ) {
    return 'top';
  }
  if (layoutMode === 'mindmap-vertical') return 'left';
  return oppositeTopicSide(childConnectorOutlet.side);
}

function parentConnectorInletPoint<TTopic extends LayoutTopic>(
  topic: TTopic,
  childConnectorOutlet: TopicControlPoint,
  options: TopicControlGeometryOptions<TTopic>
): TopicControlPoint {
  if (isFishbonePrimaryTopicBox(topic._layout)) {
    return topicBorderPoint(topic._layout, fishboneHeadSide(options.layoutMode));
  }
  if (topic._layout.side === 'timeline-point') return topicBorderPoint(topic._layout, 'left');

  const parentTopic = topic === options.root ? null : findParentLayoutTopic(options.root, topic.id);
  if (parentTopic?._layout) {
    const anchors = connectorAnchors(parentTopic._layout, topic._layout);
    return globalPointToTopicPoint(topic._layout, anchors.endX, anchors.endY);
  }
  return topicBorderPoint(
    topic._layout,
    rootParentConnectorInletSide(options.layoutMode, childConnectorOutlet)
  );
}

function siblingInsertionPoints(box: LayoutBox): {
  previous: TopicControlPoint;
  next: TopicControlPoint;
} {
  if (shouldPlaceSiblingButtonsHorizontally(box)) {
    return { previous: topicBorderPoint(box, 'left'), next: topicBorderPoint(box, 'right') };
  }
  return { previous: topicBorderPoint(box, 'top'), next: topicBorderPoint(box, 'bottom') };
}

export function resolveTopicControlPoints<TTopic extends LayoutTopic>(
  topic: TTopic,
  options: TopicControlGeometryOptions<TTopic>
): TopicControlPoints {
  const childConnectorOutlet = withHangingOutletAvoidance(
    childConnectorOutletPoint(topic, options),
    topic
  );
  const parentConnectorInlet = parentConnectorInletPoint(topic, childConnectorOutlet, options);
  const siblings = siblingInsertionPoints(topic._layout);
  return {
    parentConnectorInlet,
    childConnectorOutlet,
    previousSiblingInsertionPoint: siblings.previous,
    nextSiblingInsertionPoint: siblings.next,
  };
}

export function avoidSiblingInsertionPoint(
  point: TopicControlPoint,
  placement: SiblingPlacement,
  blockedPoints: readonly TopicControlPoint[]
): TopicControlPoint {
  const conflictPoint = blockedPoints.find((blockedPoint) =>
    topicControlPointsConflict(point, blockedPoint)
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
    return { ...point, y: point.y + tangentSign * TOPIC_CONTROL_AVOID_OFFSET };
  }
  return { ...point, x: point.x + tangentSign * TOPIC_CONTROL_AVOID_OFFSET };
}
