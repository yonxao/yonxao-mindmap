import {
  RADIAL_COLLISION_ITERATIONS,
  RADIAL_COLLISION_MARGIN,
  RADIAL_LEVEL_GAP,
  RADIAL_RADIUS_EXTRA_LIMIT,
  RADIAL_ROOT_RADIUS_EXTRA,
  RADIAL_ROOT_RADIUS_MIN,
  RADIAL_SIBLING_GAP,
  TOPIC_MIN_WIDTH,
} from './layoutConstants.js';
import {
  radialCollisionPush,
  radialConnectorObstaclePush,
  radialExtent,
  radialNormal,
  radialPerpendicularExtent,
  radialSide,
  radialSubtreeBounds,
  radialTopicBounds,
  radialUnit,
  radialVisibleSubtreeTopics,
  translateRadialSubtree,
  updateRadialRootBranchDirection,
} from './radialGeometry.js';
import { nearestRelationAnchorForAngle } from '../model/relationAnchors.js';
import type { LayoutTopic, RadialLayoutBox } from './layoutTypes.js';
import { visibleSubtopics } from '../model/topicTraversal.js';

const RADIAL_WEIGHT_PER_DIRECT_CHILD = 0.75;
const RADIAL_WEIGHT_PER_DESCENDANT_SQRT = 0.55;
const RADIAL_WEIGHT_PER_DEPTH = 0.35;
const RADIAL_WEIGHT_PER_SIZE_SCORE = 0.35;
const RADIAL_AREA_SCORE_DIRECT_CHILD_MULT = 1.2;
const RADIAL_AREA_SCORE_DESCENDANT_MULT = 0.45;
const RADIAL_AREA_SCORE_DEPTH_MULT = 1.1;
const RADIAL_AREA_SCORE_SIZE_MULT = 1.8;
const RADIAL_SIZE_SCORE_HEIGHT_DIVISOR = 120;
const RADIAL_SAFE_HALF_ANGLE_MIN = 0.26;
const RADIAL_SAFE_SLICE_RATIO = 0.48;
const RADIAL_SAFE_HALF_ANGLE_MAX = Math.PI / 2.6;
const RADIAL_CONNECTOR_TOPIC_MARGIN = 10;

export type RadialLayoutTopic = LayoutTopic<RadialLayoutBox>;

export interface RadialBranchStats {
  directSubtopicCount: number;
  descendantCount: number;
  maxDepth: number;
  sizeScore: number;
}

export interface RadialBranchDirectionPlan {
  subtopic: RadialLayoutTopic;
  documentIndex: number;
  stats: RadialBranchStats;
  areaScore: number;
  slice: number;
  angle: number;
}

export function layoutRadial(root: RadialLayoutTopic, collapsedIds: ReadonlySet<string>): void {
  const subtopics = visibleSubtopics(root, collapsedIds);
  const radius = Math.max(
    RADIAL_ROOT_RADIUS_MIN,
    root._layout.width / 2 + RADIAL_LEVEL_GAP + RADIAL_ROOT_RADIUS_EXTRA
  );
  const branchPlans = radialBranchDirectionPlans(subtopics, collapsedIds);

  branchPlans.forEach((plan) => {
    const branchRadius = radialBranchRadius(
      radius,
      plan.subtopic,
      plan.angle,
      plan.slice,
      collapsedIds
    );
    placeRadialRootBranch(root, plan.subtopic, plan.angle, branchRadius, collapsedIds);
  });

  resolveRadialRootBranchCollisions(root, subtopics, collapsedIds);
}

export function radialBranchDirectionPlans(
  subtopics: readonly RadialLayoutTopic[],
  collapsedIds: ReadonlySet<string>
): RadialBranchDirectionPlan[] {
  if (!subtopics.length) return [];

  const slotAngle = (Math.PI * 2) / subtopics.length;
  const angleSlots = radialSpreadAngleSlots(subtopics.length);
  const branchPlans = subtopics.map((subtopic, documentIndex) => {
    const stats = radialBranchStats(subtopic, collapsedIds);
    return {
      subtopic,
      documentIndex,
      stats,
      areaScore: radialBranchAreaScore(stats),
      slice: slotAngle,
      angle: 0,
    };
  });

  const largeBranchFirstPlans = [...branchPlans].sort((left, right) => {
    if (right.areaScore !== left.areaScore) return right.areaScore - left.areaScore;
    return left.documentIndex - right.documentIndex;
  });

  largeBranchFirstPlans.forEach((plan, index) => {
    plan.angle = angleSlots[index];
  });

  return branchPlans;
}

export function radialSpreadAngleSlots(count: number): number[] {
  const baseAngles = Array.from(
    { length: count },
    (_, index) => -Math.PI / 2 + (index * Math.PI * 2) / count
  );
  const orderedSlotIndexes: number[] = [];
  const used = new Set<number>();

  const pushNearestUnusedSlot = (targetIndex: number): void => {
    for (let step = 0; step < count; step += 1) {
      const rightIndex = (targetIndex + step) % count;
      if (!used.has(rightIndex)) {
        used.add(rightIndex);
        orderedSlotIndexes.push(rightIndex);
        return;
      }

      const leftIndex = (targetIndex - step + count) % count;
      if (!used.has(leftIndex)) {
        used.add(leftIndex);
        orderedSlotIndexes.push(leftIndex);
        return;
      }
    }
  };

  const preferredFractions = [0, 0.5, 0.25, 0.75, 0.125, 0.625, 0.375, 0.875];
  for (const fraction of preferredFractions) {
    pushNearestUnusedSlot(Math.round(fraction * count) % count);
  }

  for (let index = 0; index < count; index += 1) {
    if (!used.has(index)) {
      used.add(index);
      orderedSlotIndexes.push(index);
    }
  }

  return orderedSlotIndexes.map((index) => baseAngles[index]);
}

export function placeRadialRootBranch(
  root: RadialLayoutTopic,
  topic: RadialLayoutTopic,
  angle: number,
  radius: number,
  collapsedIds: ReadonlySet<string>
): void {
  const box = topic._layout;
  const unit = radialUnit(angle);

  box.side = radialSide(angle);
  box.radialAngle = angle;
  box.x = root._layout.x + unit.x * radius;
  box.y = root._layout.y + unit.y * radius;

  placeRadialDescendants(topic, angle, collapsedIds);
}

export function placeRadialDescendants(
  parent: RadialLayoutTopic,
  angle: number,
  collapsedIds: ReadonlySet<string>
): void {
  const parentBox = parent._layout;
  parentBox.radialChildAngle = angle;
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const unit = radialUnit(angle);
  const normal = radialNormal(angle);
  const breadths = subtopics.map((subtopic) => radialSubtreeBreadth(subtopic, angle, collapsedIds));
  const totalBreadth =
    breadths.reduce((sum, breadth) => sum + breadth, 0) +
    Math.max(0, subtopics.length - 1) * RADIAL_SIBLING_GAP;
  const parentForward = radialExtent(parentBox, angle);
  let offset = -totalBreadth / 2;

  subtopics.forEach((subtopic, index) => {
    const subtopicBox = subtopic._layout;
    const breadth = breadths[index];
    const subtopicForward = radialExtent(subtopicBox, angle);
    const along = parentForward + RADIAL_LEVEL_GAP + subtopicForward;
    const cross = offset + breadth / 2;

    subtopicBox.side = radialSide(angle);
    subtopicBox.radialAngle = angle;
    subtopicBox.x = parentBox.x + unit.x * along + normal.x * cross;
    subtopicBox.y = parentBox.y + unit.y * along + normal.y * cross;

    placeRadialDescendants(subtopic, angle, collapsedIds);
    offset += breadth + RADIAL_SIBLING_GAP;
  });
}

export function radialSubtreeBreadth(
  topic: RadialLayoutTopic,
  angle: number,
  collapsedIds: ReadonlySet<string>
): number {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  const ownBreadth = radialPerpendicularExtent(box, angle) * 2;
  if (!subtopics.length) return ownBreadth;

  const subtopicBreadth =
    subtopics.reduce(
      (sum, subtopic) => sum + radialSubtreeBreadth(subtopic, angle, collapsedIds),
      0
    ) +
    Math.max(0, subtopics.length - 1) * RADIAL_SIBLING_GAP;

  return Math.max(ownBreadth, subtopicBreadth);
}

export function radialBranchStats(
  topic: RadialLayoutTopic,
  collapsedIds: ReadonlySet<string>
): RadialBranchStats {
  const box = topic._layout;
  const subtopics = visibleSubtopics(topic, collapsedIds);
  let descendantCount = subtopics.length;
  let maxDepth = subtopics.length ? 1 : 0;

  for (const subtopic of subtopics) {
    const subtopicStats = radialBranchStats(subtopic, collapsedIds);
    descendantCount += subtopicStats.descendantCount;
    maxDepth = Math.max(maxDepth, subtopicStats.maxDepth + 1);
  }

  return {
    directSubtopicCount: subtopics.length,
    descendantCount,
    maxDepth,
    sizeScore:
      Math.max(0, (box.width - TOPIC_MIN_WIDTH) / TOPIC_MIN_WIDTH) +
      box.height / RADIAL_SIZE_SCORE_HEIGHT_DIVISOR,
  };
}

export function radialBranchWeight(stat: RadialBranchStats): number {
  return (
    1 +
    stat.directSubtopicCount * RADIAL_WEIGHT_PER_DIRECT_CHILD +
    Math.sqrt(stat.descendantCount) * RADIAL_WEIGHT_PER_DESCENDANT_SQRT +
    stat.maxDepth * RADIAL_WEIGHT_PER_DEPTH +
    stat.sizeScore * RADIAL_WEIGHT_PER_SIZE_SCORE
  );
}

export function radialBranchAreaScore(stat: RadialBranchStats): number {
  return (
    radialBranchWeight(stat) +
    stat.directSubtopicCount * RADIAL_AREA_SCORE_DIRECT_CHILD_MULT +
    stat.descendantCount * RADIAL_AREA_SCORE_DESCENDANT_MULT +
    stat.maxDepth * RADIAL_AREA_SCORE_DEPTH_MULT +
    stat.sizeScore * RADIAL_AREA_SCORE_SIZE_MULT
  );
}

export function radialBranchRadius(
  baseRadius: number,
  topic: RadialLayoutTopic,
  angle: number,
  slice: number,
  collapsedIds: ReadonlySet<string>
): number {
  const breadth = radialSubtreeBreadth(topic, angle, collapsedIds);
  const safeHalfAngle = Math.max(
    RADIAL_SAFE_HALF_ANGLE_MIN,
    Math.min(slice * RADIAL_SAFE_SLICE_RATIO, RADIAL_SAFE_HALF_ANGLE_MAX)
  );
  const requiredRadius = breadth / 2 / Math.tan(safeHalfAngle);

  return Math.max(baseRadius, Math.min(baseRadius + RADIAL_RADIUS_EXTRA_LIMIT, requiredRadius));
}

export function resolveRadialRootBranchCollisions(
  root: RadialLayoutTopic,
  rootSubtopics: readonly RadialLayoutTopic[],
  collapsedIds: ReadonlySet<string>
): void {
  for (let iteration = 0; iteration < RADIAL_COLLISION_ITERATIONS; iteration += 1) {
    let moved = false;

    for (const subtopic of rootSubtopics) {
      const branchBounds = radialSubtreeBounds(subtopic, collapsedIds, RADIAL_COLLISION_MARGIN);
      const rootBounds = radialTopicBounds(root._layout, RADIAL_COLLISION_MARGIN);
      const push = radialCollisionPush(rootBounds, branchBounds);
      if (!push) continue;

      translateRadialSubtree(subtopic, push.dx, push.dy, collapsedIds);
      updateRadialRootBranchDirection(root, subtopic);
      moved = true;
    }

    for (let leftIndex = 0; leftIndex < rootSubtopics.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < rootSubtopics.length; rightIndex += 1) {
        const leftTopic = rootSubtopics[leftIndex];
        const rightTopic = rootSubtopics[rightIndex];
        const leftBounds = radialSubtreeBounds(leftTopic, collapsedIds, RADIAL_COLLISION_MARGIN);
        const rightBounds = radialSubtreeBounds(rightTopic, collapsedIds, RADIAL_COLLISION_MARGIN);
        const push = radialCollisionPush(leftBounds, rightBounds);
        if (!push) continue;

        translateRadialSubtree(leftTopic, -push.dx / 2, -push.dy / 2, collapsedIds);
        translateRadialSubtree(rightTopic, push.dx / 2, push.dy / 2, collapsedIds);
        updateRadialRootBranchDirection(root, leftTopic);
        updateRadialRootBranchDirection(root, rightTopic);
        moved = true;
      }
    }

    for (const connectorTopic of rootSubtopics) {
      const connectorBox = connectorTopic._layout;
      const connectorAngle = connectorBox.radialAngle;
      if (connectorAngle === undefined || !Number.isFinite(connectorAngle)) continue;

      const start = nearestRelationAnchorForAngle(root._layout, connectorAngle);
      const end = nearestRelationAnchorForAngle(connectorBox, connectorAngle + Math.PI);

      for (const obstacleTopic of rootSubtopics) {
        if (obstacleTopic === connectorTopic) continue;
        const obstacleBoxes = radialVisibleSubtreeTopics(obstacleTopic, collapsedIds).map(
          (topic) => topic._layout
        );
        const push = radialConnectorObstaclePush(
          start,
          end,
          obstacleBoxes,
          obstacleTopic._layout,
          RADIAL_CONNECTOR_TOPIC_MARGIN
        );
        if (!push) continue;

        translateRadialSubtree(obstacleTopic, push.dx, push.dy, collapsedIds);
        updateRadialRootBranchDirection(root, obstacleTopic);
        moved = true;
      }
    }

    if (!moved) return;
  }
}
