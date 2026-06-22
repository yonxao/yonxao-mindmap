/*
 * 文件作用：
 * 放射图布局、角度分配和碰撞修正。
 */

import {
  RADIAL_COLLISION_ITERATIONS,
  RADIAL_COLLISION_MARGIN,
  RADIAL_LEVEL_GAP,
  RADIAL_RADIUS_EXTRA_LIMIT,
  RADIAL_ROOT_RADIUS_EXTRA,
  RADIAL_ROOT_RADIUS_MIN,
  RADIAL_SIBLING_GAP,
  TOPIC_MIN_WIDTH,
  visibleSubtopics,
} from './layoutShared.js';
import {
  radialCollisionPush,
  radialExtent,
  radialNormal,
  radialPerpendicularExtent,
  radialSide,
  radialSubtreeBounds,
  radialTopicBounds,
  radialUnit,
  translateRadialSubtree,
  updateRadialRootBranchDirection,
} from './radialGeometry.js';

export function layoutRadial(root, collapsedIds) {
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

/*
 * 作用：
 * 给放射图一级主题分配绘制方向。
 *
 * 实现逻辑：
 * - 先计算每个一级分支的占用面积和复杂度。
 * - 再把大分支优先放到彼此相隔更远的角度槽位上。
 * - 小分支最后填入剩余方向。
 *
 * 这样会牺牲“按文档顺序绕圈”的严格顺序，但能显著降低大分支挤在一起导致的重叠。
 */
export function radialBranchDirectionPlans(subtopics, collapsedIds) {
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
      // slice 表示该方向可用的理论扇区宽度，后续半径补偿会用它估算安全距离。
      slice: slotAngle,
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

/*
 * 作用：
 * 生成一组尽量“先远后近”的角度槽位。
 *
 * 例子：
 * 如果有 8 个一级分支，分配顺序大致是上、下、右、左、右上、左下、右下、左上。
 * 最大的几个分支会先落到相距更远的位置，减少外接矩形互相压住的概率。
 */
export function radialSpreadAngleSlots(count) {
  const baseAngles = Array.from(
    { length: count },
    (_, index) => -Math.PI / 2 + (index * Math.PI * 2) / count
  );
  const orderedSlotIndexes = [];
  const used = new Set();

  const pushNearestUnusedSlot = (targetIndex) => {
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

  /*
   * 先把四个主方向占住，再补四个斜向。
   * 后续如果一级分支更多，再按照普通圆周顺序填剩余槽位。
   */
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

/*
 * 作用：
 * 摆放放射图的一级分支。
 */
export function placeRadialRootBranch(root, topic, angle, radius, collapsedIds) {
  const box = topic._layout;
  const unit = radialUnit(angle);

  box.side = radialSide(angle);
  box.radialAngle = angle;
  box.x = root._layout.x + unit.x * radius;
  box.y = root._layout.y + unit.y * radius;

  placeRadialDescendants(topic, angle, collapsedIds);
}

/*
 * 作用：
 * 递归摆放放射图某条射线上的后代主题。
 *
 * 实现逻辑：
 * 当前主题作为父主题，子主题整体沿同一射线继续向外；
 * 多个子主题沿射线垂直方向分散，并让子主题组的中线对齐父主题出口。
 */
export function placeRadialDescendants(parent, angle, collapsedIds) {
  const subtopics = visibleSubtopics(parent, collapsedIds);
  if (!subtopics.length) return;

  const parentBox = parent._layout;
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

/*
 * 作用：
 * 计算放射图中某棵子树沿射线垂直方向需要占用的宽度。
 */
export function radialSubtreeBreadth(topic, angle, collapsedIds) {
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

/*
 * 作用：
 * 统计一级放射分支的复杂度，供角度动态分配使用。
 */
export function radialBranchStats(topic, collapsedIds) {
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
    sizeScore: Math.max(0, (box.width - TOPIC_MIN_WIDTH) / TOPIC_MIN_WIDTH) + box.height / 120,
  };
}

/*
 * 作用：
 * 根据分支复杂度计算角度权重。
 *
 * 设计思路：
 * 直接子主题数量对扇区大小影响最大；后代数量用平方根压缩，避免超大分支吃掉整圈；
 * 深度和主题尺寸作为补偿，照顾长文本主题和深层分支。
 */
export function radialBranchWeight(stat) {
  return (
    1 +
    stat.directSubtopicCount * 0.75 +
    Math.sqrt(stat.descendantCount) * 0.55 +
    stat.maxDepth * 0.35 +
    stat.sizeScore * 0.35
  );
}

/*
 * 作用：
 * 根据分支统计信息估算这个一级分支对空间的占用。
 *
 * 说明：
 * 排方向时使用面积感更强的分数，而不是只看后代数量。
 * 这样长文本分支、深层分支和直接子主题很多的分支都会优先拿到更独立的方向。
 */
export function radialBranchAreaScore(stat) {
  return (
    radialBranchWeight(stat) +
    stat.directSubtopicCount * 1.2 +
    stat.descendantCount * 0.45 +
    stat.maxDepth * 1.1 +
    stat.sizeScore * 1.8
  );
}

/*
 * 作用：
 * 根据分支内容和扇区宽度微调一级分支半径。
 *
 * 为什么需要半径补偿：
 * 有些分支虽然已经拿到更大角度，但如果子树非常宽，仍然可能靠近相邻扇区。
 * 适当把它推远，可以让同样的垂直展开宽度占据更小的视觉角度。
 */
export function radialBranchRadius(baseRadius, topic, angle, slice, collapsedIds) {
  const breadth = radialSubtreeBreadth(topic, angle, collapsedIds);
  const safeHalfAngle = Math.max(0.26, Math.min(slice * 0.48, Math.PI / 2.6));
  const requiredRadius = breadth / 2 / Math.tan(safeHalfAngle);

  return Math.max(baseRadius, Math.min(baseRadius + RADIAL_RADIUS_EXTRA_LIMIT, requiredRadius));
}

/*
 * 作用：
 * 放射图排版后的防重叠修正。
 *
 * 为什么需要二次修正：
 * 角度分配只能预估每个分支需要的扇区，真实主题是矩形，长文本、深层后代、不同方向的投影
 * 都可能让两个相邻扇区实际碰到一起。因此这里把每个一级主题的整棵可见子树当成一个整体，
 * 用矩形碰撞检测做最后一道保护，优先保证“不要重叠”。
 */
export function resolveRadialRootBranchCollisions(root, rootSubtopics, collapsedIds) {
  for (let iteration = 0; iteration < RADIAL_COLLISION_ITERATIONS; iteration += 1) {
    let moved = false;

    /*
     * 第一轮先处理中心主题和一级分支子树的碰撞。
     * 中心主题是固定锚点，所以只把碰到中心主题的分支整体向外推。
     */
    for (const subtopic of rootSubtopics) {
      const branchBounds = radialSubtreeBounds(subtopic, collapsedIds, RADIAL_COLLISION_MARGIN);
      const rootBounds = radialTopicBounds(root._layout, RADIAL_COLLISION_MARGIN);
      const push = radialCollisionPush(rootBounds, branchBounds);
      if (!push) continue;

      translateRadialSubtree(subtopic, push.dx, push.dy, collapsedIds);
      updateRadialRootBranchDirection(root, subtopic);
      moved = true;
    }

    /*
     * 第二轮处理一级分支之间的碰撞。
     * 两边各推一半，能保留整体围绕中心展开的感觉，不会让某一个分支承担全部位移。
     */
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

    if (!moved) return;
  }
}

/*
 * 作用：
 * 计算一个放射分支整棵可见子树的外接矩形。
 */
