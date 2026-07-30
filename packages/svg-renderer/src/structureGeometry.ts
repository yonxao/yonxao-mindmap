import {
  applyRelationAnchorEndpoints,
  type LayoutBounds,
  type LayoutBox,
  type LayoutMode,
  type LayoutTopic,
  type Point,
  type RelationAnchorAttributes,
} from '@yonxao/mindmap-core';

export const BOUNDARY_PADDING = 12;
export const BOUNDARY_LABEL_NEIGHBOR_GAP = 8;
export const BOUNDARY_LABEL_HORIZONTAL_PADDING = 6;
export const BOUNDARY_LABEL_HEIGHT = 22;
export const BOUNDARY_LABEL_LEFT_OFFSET = 10;
export const STRUCTURE_LABEL_LINE_HEIGHT = 16;

const BOUNDARY_NEIGHBOR_GAP = 3;
const SUMMARY_OFFSET = 26;
const SUMMARY_LABEL_OFFSET = 14;
const SUMMARY_LABEL_HORIZONTAL_PADDING = 8;
const SUMMARY_LABEL_VERTICAL_PADDING = 5;
const SUMMARY_HOOK_LENGTH = 10;
const RELATION_TOPIC_CLEARANCE = 10;
const RELATION_ROUTE_MARGIN = 48;
const RELATION_NEAR_DISTANCE = 160;
const RELATION_SEGMENT_SAMPLE_STEP = 8;
const RELATION_CURVE_OFFSET_MIN = 24;
const RELATION_CURVE_OFFSET_MAX = 56;
const RELATION_CURVE_OFFSET_RATIO = 0.18;
const RELATION_CURVE_DIRECT_PADDING = 56;

export interface StructureGeometryTopic extends LayoutTopic {
  subtopics: StructureGeometryTopic[];
}

export interface BoxPadding {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RelationGeometryAttributes extends RelationAnchorAttributes {
  control1?: string | null;
  control2?: string | null;
}

export type RelationLineStyle = 'straight' | 'elbow' | 'curve';

export interface RelationRoute {
  points: Point[];
  priority: number;
  collisions: number;
  length: number;
}

export interface CurveRouteGeometry {
  path: string;
  controls: Point[];
}

export interface RelationGeometry {
  path: string;
  points: Point[];
  controls: Point[];
  labelPoint: Point;
  bounds: LayoutBounds;
}

export interface BoundaryGeometry {
  frame: LayoutBounds;
  labelBox: LayoutBounds | null;
  bounds: LayoutBounds;
  padding: BoxPadding;
}

export interface SummaryGeometry {
  path: string;
  side: -1 | 1;
  labelPoint: Point;
  labelBox: LayoutBounds | null;
  firstLineY: number;
  bounds: LayoutBounds;
}

export function topicLayoutBox(topic: LayoutTopic): LayoutBounds {
  const box = topic._layout;
  return {
    minX: box.x - box.width / 2,
    minY: box.y - box.height / 2,
    maxX: box.x + box.width / 2,
    maxY: box.y + box.height / 2,
  };
}

export function rangesOverlap(minA: number, maxA: number, minB: number, maxB: number): boolean {
  return maxA > minB && maxB > minA;
}

export function boxesOverlap(first: LayoutBounds, second: LayoutBounds): boolean {
  return (
    rangesOverlap(first.minX, first.maxX, second.minX, second.maxX) &&
    rangesOverlap(first.minY, first.maxY, second.minY, second.maxY)
  );
}

export function unionTopicBoxes(topics: readonly LayoutTopic[]): LayoutBounds | null {
  if (!topics.length) return null;
  return topics.reduce<LayoutBounds>(
    (bounds, topic) => {
      const box = topicLayoutBox(topic);
      return {
        minX: Math.min(bounds.minX, box.minX),
        minY: Math.min(bounds.minY, box.minY),
        maxX: Math.max(bounds.maxX, box.maxX),
        maxY: Math.max(bounds.maxY, box.maxY),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

export function mergeBounds(target: LayoutBounds, source: LayoutBounds | null | undefined): void {
  if (!source) return;
  target.minX = Math.min(target.minX, source.minX);
  target.minY = Math.min(target.minY, source.minY);
  target.maxX = Math.max(target.maxX, source.maxX);
  target.maxY = Math.max(target.maxY, source.maxY);
}

export function boundaryAvailablePadding(
  box: LayoutBounds,
  includedTopics: readonly LayoutTopic[],
  layoutTopics: readonly LayoutTopic[],
  requestedPadding: BoxPadding
): BoxPadding {
  const included = new Set(includedTopics);
  const available = { ...requestedPadding };
  for (const topic of layoutTopics) {
    if (included.has(topic)) continue;
    const neighbor = topicLayoutBox(topic);
    if (rangesOverlap(box.minY, box.maxY, neighbor.minY, neighbor.maxY)) {
      if (neighbor.maxX <= box.minX) {
        available.left = Math.min(available.left, box.minX - neighbor.maxX - BOUNDARY_NEIGHBOR_GAP);
      }
      if (neighbor.minX >= box.maxX) {
        available.right = Math.min(
          available.right,
          neighbor.minX - box.maxX - BOUNDARY_NEIGHBOR_GAP
        );
      }
    }
    if (rangesOverlap(box.minX, box.maxX, neighbor.minX, neighbor.maxX)) {
      if (neighbor.maxY <= box.minY) {
        available.top = Math.min(available.top, box.minY - neighbor.maxY - BOUNDARY_NEIGHBOR_GAP);
      }
      if (neighbor.minY >= box.maxY) {
        available.bottom = Math.min(
          available.bottom,
          neighbor.minY - box.maxY - BOUNDARY_NEIGHBOR_GAP
        );
      }
    }
  }
  return {
    left: Math.max(1, available.left),
    top: Math.max(1, available.top),
    right: Math.max(1, available.right),
    bottom: Math.max(1, available.bottom),
  };
}

export function reserveBoundaryLabelVerticalSpace(
  layoutTopics: LayoutTopic[],
  includedTopics: readonly LayoutTopic[],
  boundaryBox: LayoutBounds,
  labelBox: LayoutBounds,
  neighborGap: number
): number {
  const included = new Set(includedTopics);
  const labelClearanceBox = { ...labelBox, minY: labelBox.minY - neighborGap };
  const collisions = layoutTopics
    .filter((topic) => !included.has(topic))
    .map(topicLayoutBox)
    .filter((topicBox) => boxesOverlap(labelClearanceBox, topicBox));
  if (!collisions.length) return 0;

  const shiftY = Math.max(
    ...collisions.map((topicBox) => topicBox.maxY + neighborGap - labelBox.minY)
  );
  for (const topic of layoutTopics) {
    const topicBox = topicLayoutBox(topic);
    if (included.has(topic) || topicBox.maxY > boundaryBox.minY) topic._layout.y += shiftY;
  }
  return shiftY;
}

export function boundaryGeometry(
  topics: readonly LayoutTopic[],
  layoutTopics: readonly LayoutTopic[],
  labelWidth = 0
): BoundaryGeometry | null {
  const box = unionTopicBoxes(topics);
  if (!box) return null;
  const padding = boundaryAvailablePadding(box, topics, layoutTopics, {
    left: BOUNDARY_PADDING,
    top: BOUNDARY_PADDING,
    right: BOUNDARY_PADDING,
    bottom: BOUNDARY_PADDING,
  });
  const frame = {
    minX: box.minX - padding.left,
    minY: box.minY - padding.top,
    maxX: box.maxX + padding.right,
    maxY: box.maxY + padding.bottom,
  };
  const labelBox =
    labelWidth > 0
      ? {
          minX: frame.minX + BOUNDARY_LABEL_LEFT_OFFSET,
          minY: frame.minY - BOUNDARY_LABEL_HEIGHT,
          maxX:
            frame.minX +
            BOUNDARY_LABEL_LEFT_OFFSET +
            labelWidth +
            BOUNDARY_LABEL_HORIZONTAL_PADDING * 2,
          maxY: frame.minY,
        }
      : null;
  return {
    frame,
    labelBox,
    padding,
    bounds: labelBox
      ? {
          minX: Math.min(frame.minX, labelBox.minX),
          minY: Math.min(frame.minY, labelBox.minY),
          maxX: Math.max(frame.maxX, labelBox.maxX),
          maxY: Math.max(frame.maxY, labelBox.maxY),
        }
      : frame,
  };
}

export function summaryGeometry(
  topics: readonly LayoutTopic[],
  rootX: number,
  labelTextWidth = 0,
  labelLineCount = 0
): SummaryGeometry | null {
  const box = unionTopicBoxes(topics);
  if (!box) return null;
  const averageX = topics.reduce((sum, topic) => sum + topic._layout.x, 0) / topics.length;
  const side: -1 | 1 = averageX >= rootX ? 1 : -1;
  const x = side > 0 ? box.maxX + SUMMARY_OFFSET : box.minX - SUMMARY_OFFSET;
  const middleY = (box.minY + box.maxY) / 2;
  const hook = side * SUMMARY_HOOK_LENGTH;
  const path = `M ${x - hook} ${box.minY} Q ${x} ${box.minY} ${x} ${box.minY + 10} L ${x} ${middleY - 8} Q ${x} ${middleY} ${x + hook} ${middleY} Q ${x} ${middleY} ${x} ${middleY + 8} L ${x} ${box.maxY - 10} Q ${x} ${box.maxY} ${x - hook} ${box.maxY}`;
  const labelPoint = { x: x + side * SUMMARY_LABEL_OFFSET, y: middleY };
  const labelBoxHeight =
    labelLineCount * STRUCTURE_LABEL_LINE_HEIGHT + SUMMARY_LABEL_VERTICAL_PADDING * 2;
  const labelBox =
    labelTextWidth > 0 && labelLineCount > 0
      ? {
          minX:
            side > 0
              ? labelPoint.x - SUMMARY_LABEL_HORIZONTAL_PADDING
              : labelPoint.x - labelTextWidth - SUMMARY_LABEL_HORIZONTAL_PADDING,
          minY: middleY - labelBoxHeight / 2,
          maxX:
            side > 0
              ? labelPoint.x + labelTextWidth + SUMMARY_LABEL_HORIZONTAL_PADDING
              : labelPoint.x + SUMMARY_LABEL_HORIZONTAL_PADDING,
          maxY: middleY + labelBoxHeight / 2,
        }
      : null;
  const baseBounds = {
    minX: Math.min(box.minX, x - Math.abs(hook)),
    minY: box.minY,
    maxX: Math.max(box.maxX, x + Math.abs(hook)),
    maxY: box.maxY,
  };
  return {
    path,
    side,
    labelPoint,
    labelBox,
    firstLineY: middleY - ((Math.max(1, labelLineCount) - 1) * STRUCTURE_LABEL_LINE_HEIGHT) / 2 + 4,
    bounds: labelBox
      ? {
          minX: Math.min(baseBounds.minX, labelBox.minX),
          minY: Math.min(baseBounds.minY, labelBox.minY),
          maxX: Math.max(baseBounds.maxX, labelBox.maxX),
          maxY: Math.max(baseBounds.maxY, labelBox.maxY),
        }
      : baseBounds,
  };
}

export function topicObstacleBox(topic: LayoutTopic): LayoutBounds {
  const box = topic._layout;
  return {
    minX: box.x - box.width / 2 - RELATION_TOPIC_CLEARANCE,
    minY: box.y - box.height / 2 - RELATION_TOPIC_CLEARANCE,
    maxX: box.x + box.width / 2 + RELATION_TOPIC_CLEARANCE,
    maxY: box.y + box.height / 2 + RELATION_TOPIC_CLEARANCE,
  };
}

export function segmentIntersectsBox(start: Point, end: Point, box: LayoutBounds): boolean {
  const steps = Math.max(
    2,
    Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / RELATION_SEGMENT_SAMPLE_STEP)
  );
  for (let index = 1; index < steps; index += 1) {
    const ratio = index / steps;
    const x = start.x + (end.x - start.x) * ratio;
    const y = start.y + (end.y - start.y) * ratio;
    if (x > box.minX && x < box.maxX && y > box.minY && y < box.maxY) return true;
  }
  return false;
}

export function routeCollisionCount(
  points: readonly Point[],
  obstacles: readonly LayoutBounds[]
): number {
  let collisions = 0;
  for (let index = 1; index < points.length; index += 1) {
    for (const obstacle of obstacles) {
      if (segmentIntersectsBox(points[index - 1]!, points[index]!, obstacle)) collisions += 1;
    }
  }
  return collisions;
}

export function routeLength(points: readonly Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index]!.x - points[index - 1]!.x,
      points[index]!.y - points[index - 1]!.y
    );
  }
  return length;
}

export function normalizedRoutePoints(points: readonly Point[]): Point[] {
  return points.filter(
    (point, index) =>
      index === 0 || point.x !== points[index - 1]!.x || point.y !== points[index - 1]!.y
  );
}

export function defaultCurveControls(routePoints: readonly Point[]): [Point, Point] {
  const start = routePoints[0]!;
  const end = routePoints[routePoints.length - 1]!;
  if (routePoints.length >= 4) {
    return [routePoints[1]!, routePoints[routePoints.length - 2]!];
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const curveOffset = Math.min(
    RELATION_CURVE_OFFSET_MAX,
    Math.max(RELATION_CURVE_OFFSET_MIN, length * RELATION_CURVE_OFFSET_RATIO)
  );
  const normalX = -dy / length;
  const normalY = dx / length;
  return [
    {
      x: start.x + dx / 3 + normalX * curveOffset,
      y: start.y + dy / 3 + normalY * curveOffset,
    },
    {
      x: start.x + (dx * 2) / 3 + normalX * curveOffset,
      y: start.y + (dy * 2) / 3 + normalY * curveOffset,
    },
  ];
}

export function controlPointFromValue(
  value: string | null | undefined,
  start: Point,
  end: Point,
  fallback: Point
): Point {
  const [ratioText, offsetText] = String(value || '').split(',');
  const ratio = Number(ratioText);
  const offset = Number(offsetText);
  if (!Number.isFinite(ratio) || !Number.isFinite(offset)) return fallback;
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  return {
    x: start.x + dx * ratio + (-dy / length) * offset,
    y: start.y + dy * ratio + (dx / length) * offset,
  };
}

export function curveRouteGeometry(
  points: readonly Point[],
  attributes: RelationGeometryAttributes = {}
): CurveRouteGeometry {
  const routePoints = normalizedRoutePoints(points);
  if (routePoints.length < 2) return { path: '', controls: [] };
  const start = routePoints[0]!;
  const end = routePoints[routePoints.length - 1]!;
  const defaults = defaultCurveControls(routePoints);
  const controls = [
    controlPointFromValue(attributes.control1, start, end, defaults[0]),
    controlPointFromValue(attributes.control2, start, end, defaults[1]),
  ];
  return {
    path: `M ${start.x} ${start.y} C ${controls[0]!.x} ${controls[0]!.y}, ${controls[1]!.x} ${controls[1]!.y}, ${end.x} ${end.y}`,
    controls,
  };
}

export function cubicBezierPoint(
  start: Point,
  control1: Point,
  control2: Point,
  end: Point,
  ratio: number
): Point {
  const inverse = 1 - ratio;
  return {
    x:
      inverse ** 3 * start.x +
      3 * inverse ** 2 * ratio * control1.x +
      3 * inverse * ratio ** 2 * control2.x +
      ratio ** 3 * end.x,
    y:
      inverse ** 3 * start.y +
      3 * inverse ** 2 * ratio * control1.y +
      3 * inverse * ratio ** 2 * control2.y +
      ratio ** 3 * end.y,
  };
}

export function straightRoutePath(points: readonly Point[]): string {
  const routePoints = normalizedRoutePoints(points);
  if (routePoints.length < 2) return '';
  const start = routePoints[0]!;
  const end = routePoints[routePoints.length - 1]!;
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

export function elbowRoutePath(points: readonly Point[]): string {
  const routePoints = normalizedRoutePoints(points);
  if (routePoints.length < 2) return '';
  return routePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

export function orthogonalRelationPoints(
  points: readonly Point[],
  fromAnchor?: string | null,
  toAnchor?: string | null
): Point[] {
  const routePoints = normalizedRoutePoints(points);
  if (routePoints.length < 2) return routePoints;
  const anchorAxis = (anchor?: string | null) =>
    anchor?.startsWith('top') || anchor?.startsWith('bottom') ? 'vertical' : 'horizontal';
  const fromAxis = anchorAxis(fromAnchor);
  const toAxis = anchorAxis(toAnchor);

  if (routePoints.length === 2) {
    const [start, end] = routePoints as [Point, Point];
    if (start.x === end.x || start.y === end.y) return routePoints;
    if (fromAxis === 'vertical' && toAxis === 'horizontal') {
      return [start, { x: start.x, y: end.y }, end];
    }
    if (fromAxis === 'horizontal' && toAxis === 'vertical') {
      return [start, { x: end.x, y: start.y }, end];
    }
    if (fromAxis === 'vertical' && toAxis === 'vertical') {
      const middleY = (start.y + end.y) / 2;
      return [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end];
    }
    const middleX = (start.x + end.x) / 2;
    return [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
  }

  const orthogonal: Point[] = [routePoints[0]!];
  for (let index = 1; index < routePoints.length; index += 1) {
    const previous = orthogonal[orthogonal.length - 1]!;
    const current = routePoints[index]!;
    if (previous.x !== current.x && previous.y !== current.y) {
      const isFirstSegment = index === 1;
      const isLastSegment = index === routePoints.length - 1;
      if (isFirstSegment && fromAxis === 'vertical') {
        orthogonal.push({ x: previous.x, y: current.y });
      } else if (isLastSegment && toAxis === 'horizontal') {
        orthogonal.push({ x: previous.x, y: current.y });
      } else {
        orthogonal.push({ x: current.x, y: previous.y });
      }
    }
    orthogonal.push(current);
  }
  return normalizedRoutePoints(orthogonal);
}

export function directRelationPoints(fromBox: LayoutBox, toBox: LayoutBox): [Point, Point] {
  const horizontal = Math.abs(toBox.x - fromBox.x) >= Math.abs(toBox.y - fromBox.y);
  const horizontalSign = Math.sign(toBox.x - fromBox.x) || 1;
  const verticalSign = Math.sign(toBox.y - fromBox.y) || 1;
  return horizontal
    ? [
        { x: fromBox.x + (fromBox.width / 2) * horizontalSign, y: fromBox.y },
        { x: toBox.x - (toBox.width / 2) * horizontalSign, y: toBox.y },
      ]
    : [
        { x: fromBox.x, y: fromBox.y + (fromBox.height / 2) * verticalSign },
        { x: toBox.x, y: toBox.y - (toBox.height / 2) * verticalSign },
      ];
}

export function routeBounds(points: readonly Point[]): LayoutBounds {
  return points.reduce<LayoutBounds>(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

export function relationRoute(
  from: LayoutTopic,
  to: LayoutTopic,
  layoutTopics: readonly LayoutTopic[],
  layoutMode: LayoutMode,
  attributes: RelationGeometryAttributes = {}
): RelationRoute {
  const a = from._layout;
  const b = to._layout;
  const obstacles = layoutTopics
    .filter((topic) => topic !== from && topic !== to)
    .map(topicObstacleBox);
  const [directStart, directEnd] = directRelationPoints(a, b);
  const prefersRightSide = String(layoutMode).includes('right');
  const candidates: Array<{ points: Point[]; priority: number }> = [
    { points: [directStart, directEnd], priority: prefersRightSide ? 2 : 0 },
  ];
  const blockingObstacles = obstacles.filter((obstacle) =>
    segmentIntersectsBox(directStart, directEnd, obstacle)
  );
  const localBounds = blockingObstacles.reduce<LayoutBounds>(
    (bounds, obstacle) => ({
      minX: Math.min(bounds.minX, obstacle.minX),
      minY: Math.min(bounds.minY, obstacle.minY),
      maxX: Math.max(bounds.maxX, obstacle.maxX),
      maxY: Math.max(bounds.maxY, obstacle.maxY),
    }),
    {
      minX: Math.min(a.x - a.width / 2, b.x - b.width / 2),
      minY: Math.min(a.y - a.height / 2, b.y - b.height / 2),
      maxX: Math.max(a.x + a.width / 2, b.x + b.width / 2),
      maxY: Math.max(a.y + a.height / 2, b.y + b.height / 2),
    }
  );
  const topY = localBounds.minY - RELATION_ROUTE_MARGIN;
  const bottomY = localBounds.maxY + RELATION_ROUTE_MARGIN;
  const leftX = localBounds.minX - RELATION_ROUTE_MARGIN;
  const rightX = localBounds.maxX + RELATION_ROUTE_MARGIN;
  candidates.push(
    {
      points: [
        { x: a.x, y: a.y - a.height / 2 },
        { x: a.x, y: topY },
        { x: b.x, y: topY },
        { x: b.x, y: b.y - b.height / 2 },
      ],
      priority: 1,
    },
    {
      points: [
        { x: a.x, y: a.y + a.height / 2 },
        { x: a.x, y: bottomY },
        { x: b.x, y: bottomY },
        { x: b.x, y: b.y + b.height / 2 },
      ],
      priority: 1,
    },
    {
      points: [
        { x: a.x - a.width / 2, y: a.y },
        { x: leftX, y: a.y },
        { x: leftX, y: b.y },
        { x: b.x - b.width / 2, y: b.y },
      ],
      priority: prefersRightSide ? 2 : 1,
    },
    {
      points: [
        { x: a.x + a.width / 2, y: a.y },
        { x: rightX, y: a.y },
        { x: rightX, y: b.y },
        { x: b.x + b.width / 2, y: b.y },
      ],
      priority: prefersRightSide ? 0 : 1,
    }
  );

  const hasManualAnchor = Boolean(attributes.fromAnchor || attributes.toAnchor);
  const routeCandidates =
    !hasManualAnchor && Math.hypot(b.x - a.x, b.y - a.y) < RELATION_NEAR_DISTANCE
      ? candidates.slice(-2)
      : candidates;
  return routeCandidates
    .map((candidate) => {
      const points = applyRelationAnchorEndpoints(candidate.points, a, b, attributes);
      return {
        ...candidate,
        points,
        collisions: routeCollisionCount(points, obstacles),
        length: routeLength(points),
      };
    })
    .sort(
      (left, right) =>
        left.collisions - right.collisions ||
        left.priority - right.priority ||
        left.length - right.length
    )[0]!;
}

export function relationGeometry(
  from: LayoutTopic,
  to: LayoutTopic,
  layoutTopics: readonly LayoutTopic[],
  layoutMode: LayoutMode,
  lineStyle: RelationLineStyle,
  attributes: RelationGeometryAttributes = {},
  labelHalfWidth = 0,
  labelLineCount = 0
): RelationGeometry {
  const route =
    lineStyle === 'straight'
      ? { points: directRelationPoints(from._layout, to._layout) }
      : relationRoute(from, to, layoutTopics, layoutMode, attributes);
  let points = applyRelationAnchorEndpoints(route.points, from._layout, to._layout, attributes);
  if (lineStyle === 'elbow') {
    points = orthogonalRelationPoints(points, attributes.fromAnchor, attributes.toAnchor);
  }
  const curve = lineStyle === 'curve' ? curveRouteGeometry(points, attributes) : null;
  const path =
    lineStyle === 'straight'
      ? straightRoutePath(points)
      : lineStyle === 'elbow'
        ? elbowRoutePath(points)
        : curve!.path;
  const normalizedPoints = normalizedRoutePoints(points);
  const start = normalizedPoints[0]!;
  const end = normalizedPoints[normalizedPoints.length - 1]!;
  const labelSegmentIndex = Math.max(1, Math.floor(points.length / 2));
  const labelSegmentStart = points[labelSegmentIndex - 1]!;
  const labelSegmentEnd = points[labelSegmentIndex]!;
  const labelPoint = curve
    ? cubicBezierPoint(start, curve.controls[0]!, curve.controls[1]!, end, 0.5)
    : {
        x: (labelSegmentStart.x + labelSegmentEnd.x) / 2,
        y: (labelSegmentStart.y + labelSegmentEnd.y) / 2,
      };
  const bounds = routeBounds([...points, ...(curve?.controls || [])]);
  const directCurvePadding =
    lineStyle === 'curve' && points.length === 2 ? RELATION_CURVE_DIRECT_PADDING : 0;
  const labelHalfHeight = (labelLineCount * STRUCTURE_LABEL_LINE_HEIGHT) / 2;
  return {
    path,
    points: normalizedPoints,
    controls: curve?.controls || [],
    labelPoint,
    bounds: {
      minX: Math.min(bounds.minX - directCurvePadding, labelPoint.x - labelHalfWidth),
      minY: Math.min(bounds.minY - directCurvePadding, labelPoint.y - labelHalfHeight - 10),
      maxX: Math.max(bounds.maxX + directCurvePadding, labelPoint.x + labelHalfWidth),
      maxY: Math.max(bounds.maxY + directCurvePadding, labelPoint.y + labelHalfHeight),
    },
  };
}
