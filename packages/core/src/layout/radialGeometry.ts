import type {
  AxisAlignedBounds,
  LayoutBox,
  LayoutPoint,
  LayoutSide,
  LayoutTopic,
  LayoutTranslation,
  RadialLayoutBox,
} from './layoutTypes.js';

const RADIAL_PUSH_EXTRA_PX = 1;
const RADIAL_SEGMENT_EPSILON = 1e-9;

type RadialTopic = LayoutTopic<RadialLayoutBox>;

export function radialSubtreeBounds(
  topic: RadialTopic,
  collapsedIds: ReadonlySet<string>,
  margin = 0
): AxisAlignedBounds {
  const topics = radialVisibleSubtreeTopics(topic, collapsedIds);
  const left = Math.min(...topics.map((item) => item._layout.x - item._layout.width / 2));
  const right = Math.max(...topics.map((item) => item._layout.x + item._layout.width / 2));
  const top = Math.min(...topics.map((item) => item._layout.y - item._layout.height / 2));
  const bottom = Math.max(...topics.map((item) => item._layout.y + item._layout.height / 2));

  return {
    left: left - margin,
    right: right + margin,
    top: top - margin,
    bottom: bottom + margin,
    x: (left + right) / 2,
    y: (top + bottom) / 2,
  };
}

export function radialTopicBounds(box: LayoutBox, margin = 0): AxisAlignedBounds {
  return {
    left: box.x - box.width / 2 - margin,
    right: box.x + box.width / 2 + margin,
    top: box.y - box.height / 2 - margin,
    bottom: box.y + box.height / 2 + margin,
    x: box.x,
    y: box.y,
  };
}

export function radialCollisionPush(
  fixedBounds: AxisAlignedBounds,
  movingBounds: AxisAlignedBounds
): LayoutTranslation | null {
  const overlapX =
    Math.min(fixedBounds.right, movingBounds.right) - Math.max(fixedBounds.left, movingBounds.left);
  const overlapY =
    Math.min(fixedBounds.bottom, movingBounds.bottom) - Math.max(fixedBounds.top, movingBounds.top);

  if (overlapX <= 0 || overlapY <= 0) return null;

  const signX = movingBounds.x >= fixedBounds.x ? 1 : -1;
  const signY = movingBounds.y >= fixedBounds.y ? 1 : -1;

  if (overlapX < overlapY) {
    return { dx: signX * (overlapX + RADIAL_PUSH_EXTRA_PX), dy: 0 };
  }

  return { dx: 0, dy: signY * (overlapY + RADIAL_PUSH_EXTRA_PX) };
}

export function radialSegmentIntersectsBounds(
  start: LayoutPoint,
  end: LayoutPoint,
  bounds: AxisAlignedBounds
): boolean {
  let minimumProgress = 0;
  let maximumProgress = 1;

  for (const axis of ['x', 'y'] as const) {
    const delta = end[axis] - start[axis];
    const minimum = axis === 'x' ? bounds.left : bounds.top;
    const maximum = axis === 'x' ? bounds.right : bounds.bottom;

    if (Math.abs(delta) <= RADIAL_SEGMENT_EPSILON) {
      if (start[axis] < minimum || start[axis] > maximum) return false;
      continue;
    }

    const firstProgress = (minimum - start[axis]) / delta;
    const secondProgress = (maximum - start[axis]) / delta;
    const entryProgress = Math.min(firstProgress, secondProgress);
    const exitProgress = Math.max(firstProgress, secondProgress);
    minimumProgress = Math.max(minimumProgress, entryProgress);
    maximumProgress = Math.min(maximumProgress, exitProgress);
    if (minimumProgress > maximumProgress) return false;
  }

  return true;
}

export function radialConnectorObstaclePush(
  start: LayoutPoint,
  end: LayoutPoint,
  obstacleBoxes: readonly LayoutBox[],
  preferredBox: LayoutPoint,
  margin = 0
): LayoutTranslation | null {
  const segmentDx = end.x - start.x;
  const segmentDy = end.y - start.y;
  const segmentLength = Math.hypot(segmentDx, segmentDy);
  if (segmentLength <= RADIAL_SEGMENT_EPSILON) return null;

  const normal = {
    x: -segmentDy / segmentLength,
    y: segmentDx / segmentLength,
  };
  const preferredDistance =
    (preferredBox.x - start.x) * normal.x + (preferredBox.y - start.y) * normal.y;
  const direction = preferredDistance < 0 ? -1 : 1;
  let requiredDistance = 0;
  let intersects = false;

  for (const box of obstacleBoxes) {
    const bounds = radialTopicBounds(box, margin);
    if (!radialSegmentIntersectsBounds(start, end, bounds)) continue;

    intersects = true;
    const signedDistance = (box.x - start.x) * normal.x + (box.y - start.y) * normal.y;
    const perpendicularExtent =
      Math.abs(normal.x) * (box.width / 2) + Math.abs(normal.y) * (box.height / 2) + margin;
    requiredDistance = Math.max(
      requiredDistance,
      perpendicularExtent - direction * signedDistance + RADIAL_PUSH_EXTRA_PX
    );
  }

  if (!intersects || requiredDistance <= 0) return null;
  return {
    dx: normal.x * direction * requiredDistance,
    dy: normal.y * direction * requiredDistance,
  };
}

export function radialVisibleSubtreeTopics(
  topic: RadialTopic,
  collapsedIds: ReadonlySet<string>
): RadialTopic[] {
  const topics = [topic];
  if (collapsedIds.has(topic.id)) return topics;

  for (const subtopic of topic.subtopics) {
    topics.push(...radialVisibleSubtreeTopics(subtopic, collapsedIds));
  }

  return topics;
}

export function translateRadialSubtree(
  topic: RadialTopic,
  dx: number,
  dy: number,
  collapsedIds: ReadonlySet<string>
): void {
  topic._layout.x += dx;
  topic._layout.y += dy;
  if (collapsedIds.has(topic.id)) return;

  for (const subtopic of topic.subtopics) {
    translateRadialSubtree(subtopic, dx, dy, collapsedIds);
  }
}

export function updateRadialRootBranchDirection(root: RadialTopic, subtopic: RadialTopic): void {
  const angle = Math.atan2(
    subtopic._layout.y - root._layout.y,
    subtopic._layout.x - root._layout.x
  );
  subtopic._layout.radialAngle = angle;
  subtopic._layout.side = radialSide(angle);
}

export function radialSide(angle: number): LayoutSide {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  if (Math.abs(cos) >= Math.abs(sin)) return cos >= 0 ? 'right' : 'left';
  return sin >= 0 ? 'bottom' : 'top';
}

export function radialUnit(angle: number): LayoutPoint {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

export function radialNormal(angle: number): LayoutPoint {
  return {
    x: -Math.sin(angle),
    y: Math.cos(angle),
  };
}

export function radialExtent(box: LayoutBox, angle: number): number {
  const unit = radialUnit(angle);
  return (Math.abs(unit.x) * box.width + Math.abs(unit.y) * box.height) / 2;
}

export function radialPerpendicularExtent(box: LayoutBox, angle: number): number {
  const normal = radialNormal(angle);
  return (Math.abs(normal.x) * box.width + Math.abs(normal.y) * box.height) / 2;
}
