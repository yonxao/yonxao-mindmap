/*
 * 文件作用：
 * 放射图边界、碰撞和平移几何辅助。
 */

/*
 * 碰撞推离时额外增加的最小像素，确保两个矩形不再紧贴或仍有 1px 重叠。
 */
const RADIAL_PUSH_EXTRA_PX = 1;
// 线段与矩形边界计算时忽略浮点误差。
const RADIAL_SEGMENT_EPSILON = 1e-9;

export function radialSubtreeBounds(topic, collapsedIds, margin = 0) {
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

/*
 * 作用：
 * 计算单个主题的外接矩形，主要用于中心主题这个固定碰撞体。
 */
export function radialTopicBounds(box, margin = 0) {
  return {
    left: box.x - box.width / 2 - margin,
    right: box.x + box.width / 2 + margin,
    top: box.y - box.height / 2 - margin,
    bottom: box.y + box.height / 2 + margin,
    x: box.x,
    y: box.y,
  };
}

/*
 * 作用：
 * 如果两个矩形发生重叠，计算把第二个矩形推出去所需的最小位移。
 */
export function radialCollisionPush(fixedBounds, movingBounds) {
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

/*
 * 判断线段是否穿过轴对齐矩形。
 * 使用 slab 裁剪，避免只检查端点或四条边造成的斜线漏判。
 */
export function radialSegmentIntersectsBounds(start, end, bounds) {
  let minimumProgress = 0;
  let maximumProgress = 1;

  for (const axis of ['x', 'y']) {
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

/*
 * 计算把一整个分支移出某条放射连线走廊所需的法向位移。
 * preferredBox 决定向线段哪一侧移动，避免同一分支在迭代中左右抖动。
 */
export function radialConnectorObstaclePush(start, end, obstacleBoxes, preferredBox, margin = 0) {
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

/*
 * 作用：
 * 收集一个放射分支下所有未折叠的可见主题。
 */
export function radialVisibleSubtreeTopics(topic, collapsedIds) {
  const topics = [topic];
  if (collapsedIds.has(topic.id)) return topics;

  for (const subtopic of topic.subtopics) {
    topics.push(...radialVisibleSubtreeTopics(subtopic, collapsedIds));
  }

  return topics;
}

/*
 * 作用：
 * 整体平移一个放射分支子树。
 */
export function translateRadialSubtree(topic, dx, dy, collapsedIds) {
  topic._layout.x += dx;
  topic._layout.y += dy;
  if (collapsedIds.has(topic.id)) return;

  for (const subtopic of topic.subtopics) {
    translateRadialSubtree(subtopic, dx, dy, collapsedIds);
  }
}

/*
 * 作用：
 * 分支子树被碰撞修正整体平移后，更新一级主题相对中心主题的角度和方向。
 *
 * 注意：
 * 只更新一级主题本身。它的后代和父主题一起平移，父子相对方向没有改变，
 * 所以后代仍然保留原来的 radialAngle。
 */
export function updateRadialRootBranchDirection(root, subtopic) {
  const angle = Math.atan2(
    subtopic._layout.y - root._layout.y,
    subtopic._layout.x - root._layout.x
  );
  subtopic._layout.radialAngle = angle;
  subtopic._layout.side = radialSide(angle);
}

/*
 * 作用：
 * 根据角度给放射主题归类，供连线锚点和按钮方向使用。
 */
export function radialSide(angle) {
  const sin = Math.sin(angle);
  const cos = Math.cos(angle);
  if (Math.abs(cos) >= Math.abs(sin)) return cos >= 0 ? 'right' : 'left';
  return sin >= 0 ? 'bottom' : 'top';
}

/*
 * 作用：
 * 计算射线方向单位向量。
 */
export function radialUnit(angle) {
  return {
    x: Math.cos(angle),
    y: Math.sin(angle),
  };
}

/*
 * 作用：
 * 计算与射线垂直的单位向量，用来分散同级主题。
 */
export function radialNormal(angle) {
  return {
    x: -Math.sin(angle),
    y: Math.cos(angle),
  };
}

/*
 * 作用：
 * 计算主题矩形在射线方向上的半径投影。
 */
export function radialExtent(box, angle) {
  const unit = radialUnit(angle);
  return (Math.abs(unit.x) * box.width + Math.abs(unit.y) * box.height) / 2;
}

/*
 * 作用：
 * 计算主题矩形在射线垂直方向上的半径投影。
 */
export function radialPerpendicularExtent(box, angle) {
  const normal = radialNormal(angle);
  return (Math.abs(normal.x) * box.width + Math.abs(normal.y) * box.height) / 2;
}
