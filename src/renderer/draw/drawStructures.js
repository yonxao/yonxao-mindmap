/**
 * 高级结构（外框 / 概要 / 关联）的 SVG 绘制逻辑。
 *
 * 实现逻辑：
 * - 外框 (boundary)：基于一组主题的布局盒计算最小包围矩形，并考虑相邻未包含主题的可用间距
 *   （boundaryAvailablePadding）决定实际内边距；附带可选标签，标签与相邻主题碰撞时自动下移
 *   （reserveBoundaryLabelSpace）。
 * - 概要 (summary)：在主题组外侧绘制 L 形钩子线，附带居中标签；钩子方向由主题分布自动决定。
 * - 关联 (relation)：支持直线、直角线（elbow）、贝塞尔曲线三种线型；
 *   曲线模式下自动计算默认控制点（defaultCurveControls），也支持用户指定的 control1/control2；
 *   路径自动避让中间主题（relationRoute → routeCollisionCount），从多个候选路径中选取最优。
 * - 关联箭头通过 SVG marker 实现，支持单向（forward/backward）和双向。
 *
 * 调用链：
 *   drawLayout() → renderMindStructures()
 *     ├─ reserveBoundaryLabelSpace()      [边界标签碰撞偏移]
 *     ├─ renderBoundaryStructure()        [外框 + 标签]
 *     ├─ renderSummaryStructure()         [概要钩子 + 标签]
 *     └─ renderRelationStructure()        [关联线 + 箭头 + 控制点 + 标签]
 *          └─ relationRoute() → directRelationPoints(), routeCollisionCount(), segmentIntersectsBox()
 *          └─ curveRouteGeometry() → normalizedRoutePoints(), defaultCurveControls(), controlPointFromValue()
 *          └─ straightRoutePath() / elbowRoutePath()
 */
import { normalizeColor, svg } from '../../shared/rendererShared.js';
import { DEFAULT_MIND_CONFIG } from '../../config/defaultMindConfig.js';
import {
  RELATION_DEFAULT_DIRECTION,
  RELATION_DEFAULT_LINE_STYLE,
} from '../../parser/mindStructures.js';
import { estimateTopicTextWidth } from '../../utils/text.js';

// 外框内边缘与内部主题之间的间距，即边界框的外扩 padding。
const BOUNDARY_PADDING = 12;
// 外框与相邻未包含主题之间的最小间隙，防止边界框紧贴无关主题产生视觉粘连。
const BOUNDARY_NEIGHBOR_GAP = 3;
// 外框标签与相邻未包含主题之间的额外间隙，避免标签文字被遮挡。
const BOUNDARY_LABEL_NEIGHBOR_GAP = 8;
// 概要线端点与主题组最外侧之间的水平偏移距离，拉开钩子与主题的距离以清晰识别。
const SUMMARY_OFFSET = 26;
// 概要标签相对于概要线的水平偏移量，使标签不贴住钩子线。
const LABEL_OFFSET = 14;
// 概要标签内文字与标签框左右边界的间距。
const SUMMARY_LABEL_HORIZONTAL_PADDING = 8;
// 概要标签内文字与标签框上下边界的间距。
const SUMMARY_LABEL_VERTICAL_PADDING = 5;
// 外框标签内文字与标签框左右边界的间距。
const BOUNDARY_LABEL_HORIZONTAL_PADDING = 6;
// 外框标签矩形框的高度，配合文字字号决定标签盒尺寸。
const BOUNDARY_LABEL_HEIGHT = 22;
// 外框标签相对于外框左边框的水平偏移量，使标签从左上角向右缩进一段距离。
const BOUNDARY_LABEL_LEFT_OFFSET = 10;
// 关联线与主题卡片保持的最小视觉间距，避免线条贴着卡片边缘影响阅读。
const RELATION_TOPIC_CLEARANCE = 10;
// 外围绕行通道与整张导图边界的距离，为圆角和箭头预留空间。
const RELATION_ROUTE_MARGIN = 48;
// 距离较近时不画正面短线，统一从主题侧面绕出，保证关联语义清晰可见。
const RELATION_NEAR_DISTANCE = 160;
// 结构标签各行之间的行高，用于多行文本的垂直间距计算。
const STRUCTURE_LABEL_LINE_HEIGHT = 16;

/**
 * 获取主题作为"障碍物"的包围盒，相比实际布局盒外扩 RELATION_TOPIC_CLEARANCE 像素，
 * 使关联线绕行时与主题保持足够视觉间距。
 * 作用：为关联路径避障提供带 clearance 的碰撞检测盒。
 * 调用链：relationRoute() → routeCollisionCount() → segmentIntersectsBox()
 */
function topicObstacleBox(topic) {
  const box = topic._layout;
  return {
    minX: box.x - box.width / 2 - RELATION_TOPIC_CLEARANCE,
    minY: box.y - box.height / 2 - RELATION_TOPIC_CLEARANCE,
    maxX: box.x + box.width / 2 + RELATION_TOPIC_CLEARANCE,
    maxY: box.y + box.height / 2 + RELATION_TOPIC_CLEARANCE,
  };
}

/**
 * 获取主题的实际布局包围盒，直接取自 layout 数据，不含额外间距。
 * 作用：用于边界框大小计算、相邻主题碰撞检测等精确几何判断。
 * 调用链：boundaryAvailablePadding(), reserveBoundaryLabelSpace()
 */
function topicLayoutBox(topic) {
  const box = topic._layout;
  return {
    minX: box.x - box.width / 2,
    minY: box.y - box.height / 2,
    maxX: box.x + box.width / 2,
    maxY: box.y + box.height / 2,
  };
}

/**
 * 判断两个一维区间 [min, max] 是否有重叠（非接触即可判定为重叠）。
 * 作用：一维范围重叠检测，作为 boxesOverlap 的基础。
 */
function rangesOverlap(minA, maxA, minB, maxB) {
  return maxA > minB && maxB > minA;
}

/**
 * 判断两个二维轴对齐矩形是否重叠。
 * 作用：主题盒、障碍物盒、标签盒之间的碰撞检测。
 * 调用链：boundaryAvailablePadding(), reserveBoundaryLabelSpace()
 */
function boxesOverlap(first, second) {
  return (
    rangesOverlap(first.minX, first.maxX, second.minX, second.maxX) &&
    rangesOverlap(first.minY, first.maxY, second.minY, second.maxY)
  );
}

/**
 * 计算外框在四个方向上实际可用的内边距。
 * 外框默认使用 BOUNDARY_PADDING，但如果某个方向上有相邻未包含的主题，
 * 外框会向内收缩以避免压住它们。返回值每个方向至少为 1px。
 * 作用：让外框智能避让相邻主题，不覆盖无关内容。
 * 调用链：renderBoundaryStructure()
 *
 * @param {Object} box - 被包含主题的合并包围盒
 * @param {Array} includedTopics - 外框包含的主题列表
 * @param {Array} layoutTopics - 布局中所有主题
 * @param {Object} requestedPadding - 各方向请求的初始 padding {left,top,right,bottom}
 * @returns {Object} 各方向实际可用 padding，最小值为 1
 */
function boundaryAvailablePadding(box, includedTopics, layoutTopics, requestedPadding) {
  const included = new Set(includedTopics);
  const available = { ...requestedPadding };
  // 遍历所有布局主题，检查哪些方向上有相邻且未被外框包含的主题
  for (const topic of layoutTopics) {
    // 跳过被外框包含的主题，它们不需要避让
    if (included.has(topic)) continue;
    const neighbor = topicLayoutBox(topic);
    // 垂直方向上有重叠 → 相邻主题在左右两侧，可能压缩左右 padding
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
    // 水平方向上有重叠 → 相邻主题在上下两侧，可能压缩上下 padding
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
  return Object.fromEntries(
    Object.entries(available).map(([side, padding]) => [side, Math.max(1, padding)])
  );
}

/**
 * 判断线段（由起点和终点定义）是否与轴对齐矩形相交。
 * 通过在路径上以 8px 间隔采样点，检查是否有点落在矩形内部。
 * 作用：检测关联路径的某一段是否穿过了某个障碍主题。
 * 调用链：routeCollisionCount()
 */
function segmentIntersectsBox(start, end, box) {
  const steps = Math.max(2, Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 8));
  // 在路径上等距采样，检查样本点是否进入障碍物矩形
  for (let index = 1; index < steps; index += 1) {
    const ratio = index / steps;
    const x = start.x + (end.x - start.x) * ratio;
    const y = start.y + (end.y - start.y) * ratio;
    if (x > box.minX && x < box.maxX && y > box.minY && y < box.maxY) return true;
  }
  return false;
}

/**
 * 统计一条路径（点序列）与所有障碍物的碰撞次数，用于路径优劣排序。
 * 作用：在 relationRoute() 中比较候选绕行路径，碰撞越少优先级越高。
 * 调用链：relationRoute()
 */
function routeCollisionCount(points, obstacles) {
  let collisions = 0;
  // 遍历路径的每一段，检测是否与任何一个障碍物相交
  for (let index = 1; index < points.length; index += 1) {
    for (const obstacle of obstacles) {
      if (segmentIntersectsBox(points[index - 1], points[index], obstacle)) collisions += 1;
    }
  }
  return collisions;
}

/**
 * 计算路径的总长度（所有线段长度之和）。
 * 作用：在 relationRoute() 中作为候选路径的次要排序依据，路径更短更优。
 * 调用链：relationRoute()
 */
function routeLength(points) {
  let length = 0;
  // 累加相邻点之间的欧几里得距离
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(
      points[index].x - points[index - 1].x,
      points[index].y - points[index - 1].y
    );
  }
  return length;
}

/**
 * 去除点序列中连续重复的点，保留路径中的唯一位置。
 * 作用：在生成 SVG 路径前精简点序列，避免零长度线段影响 path 语义。
 * 调用链：curveRouteGeometry(), straightRoutePath(), elbowRoutePath(), renderRelationStructure()
 */
function normalizedRoutePoints(points) {
  return points.filter(
    (point, index) =>
      index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y
  );
}

/**
 * 根据路径点自动推算默认的贝塞尔曲线控制点。
 * - 当路径中间有至少两个拐点（总点数 ≥ 4）时，直接使用第一个和倒数第二个拐点作为控制点。
 * - 当路径只有起点和终点（直线）时，沿法线方向外推两个控制点，产生自然弧度；
 *   外推距离随路径长度线性变化（18%~24px~56px 区间）。
 * 作用：为关联曲线提供合理的默认控制点，使用户不需要手动调整也能获得平滑曲线。
 * 调用链：curveRouteGeometry()
 */
function defaultCurveControls(routePoints) {
  const start = routePoints[0];
  const end = routePoints[routePoints.length - 1];
  // 路径中间已有转折点，直接取第一个和倒数第二个作为控制点，保持拐角弧度
  if (routePoints.length >= 4) {
    return [routePoints[1], routePoints[routePoints.length - 2]];
  }
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const curveOffset = Math.min(56, Math.max(24, length * 0.18));
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

/**
 * 从用户自定义的 control1/control2 属性解析一个贝塞尔控制点。
 * 控制点格式为 "ratio,offset"，其中 ratio 是沿起点→终点方向的位置比例 [0,1]，
 * offset 是垂直于该方向的偏移量（正值偏向法线方向左侧）。
 * 解析失败时返回 fallback（使用默认控制点）。
 * 作用：支持用户通过属性自定义关联曲线的弯曲形状。
 * 调用链：curveRouteGeometry()
 */
function controlPointFromValue(value, start, end, fallback) {
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

/**
 * 为贝塞尔曲线关联线生成 SVG path 字符串和控制点数组。
 * 先去除重复点，再计算默认控制点，然后尝试用用户自定义控制点覆盖。
 * 作用：将折线路径转为平滑的三次贝塞尔曲线，支撑 curve 线型。
 * 调用链：renderRelationStructure()
 */
function curveRouteGeometry(points, attributes) {
  const routePoints = normalizedRoutePoints(points);
  if (routePoints.length < 2) return { path: '', controls: [] };
  const start = routePoints[0];
  const end = routePoints[routePoints.length - 1];
  const defaults = defaultCurveControls(routePoints);
  const controls = [
    controlPointFromValue(attributes?.control1, start, end, defaults[0]),
    controlPointFromValue(attributes?.control2, start, end, defaults[1]),
  ];
  return {
    path: `M ${start.x} ${start.y} C ${controls[0].x} ${controls[0].y}, ${controls[1].x} ${controls[1].y}, ${end.x} ${end.y}`,
    controls,
  };
}

/**
 * 计算三次贝塞尔曲线上指定比例处的点坐标。
 * 使用标准 Bernstein 多项式：B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃。
 * 作用：渲染曲线关联线标签时，在曲线中点处放置标签文字。
 * 调用链：renderRelationStructure()
 */
function cubicBezierPoint(start, control1, control2, end, ratio) {
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

/**
 * 生成"直线"线型的 SVG path：从起点到终点的直线段。
 * 作用：straight 线型下直接绘制两点间的直线。
 * 调用链：renderRelationStructure()
 */
function straightRoutePath(points) {
  const routePoints = normalizedRoutePoints(points);
  if (routePoints.length < 2) return '';
  const start = routePoints[0];
  const end = routePoints[routePoints.length - 1];
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}

/**
 * 生成"直角"（elbow）线型的 SVG path：依次连接路径所有点形成折线。
 * 作用：elbow 线型下绘制沿轴线绕行的折线路径。
 * 调用链：renderRelationStructure()
 */
function elbowRoutePath(points) {
  const routePoints = normalizedRoutePoints(points);
  if (routePoints.length < 2) return '';
  return routePoints
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
}

/**
 * 计算两个主题间的"直达"路径端点——从各自边界引出，方向沿主轴（水平或垂直）。
 * 选择跨度更大的轴作为连接方向，使路径更短且视觉更自然。
 * 作用：作为 relationRoute() 的第一候选路径和阻塞检测的基线。
 * 调用链：relationRoute(), renderRelationStructure()
 */
function directRelationPoints(fromBox, toBox) {
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

/**
 * 计算一组路径点的包围盒（最小/最大 x,y 范围）。
 * 作用：用于 renderRelationStructure() 中计算关联线的渲染边界，从而更新布局边界。
 * 调用链：renderRelationStructure()
 */
function routeBounds(points) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

/**
 * 计算一组主题布局盒的合并包围盒，覆盖所有主题的完整范围。
 * 作用：外框和概要以此为基础确定整体框体尺寸。
 * 调用链：reserveBoundaryLabelSpace(), renderBoundaryStructure(), renderSummaryStructure()
 */
function unionTopicBoxes(topics) {
  if (!topics.length) return null;
  return topics.reduce(
    (bounds, topic) => {
      const box = topic._layout;
      bounds.minX = Math.min(bounds.minX, box.x - box.width / 2);
      bounds.maxX = Math.max(bounds.maxX, box.x + box.width / 2);
      bounds.minY = Math.min(bounds.minY, box.y - box.height / 2);
      bounds.maxY = Math.max(bounds.maxY, box.y + box.height / 2);
      return bounds;
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );
}

/**
 * 将 source 包围盒合并到 target 包围盒中（原地修改 target）。
 * 作用：在 renderMindStructures() 中累计所有结构的渲染边界到 layout.bounds。
 */
function mergeBounds(target, source) {
  if (!source) return;
  target.minX = Math.min(target.minX, source.minX);
  target.minY = Math.min(target.minY, source.minY);
  target.maxX = Math.max(target.maxX, source.maxX);
  target.maxY = Math.max(target.maxY, source.maxY);
}

export const structureDrawMethods = {
  /**
   * 收集结构中涉及的所有可见主题（包含子树递归展开）。
   * - boundary/summary 类型需要遍历子主题的完整可见分支。
   * - relation 类型只取直接关联的两个主题。
   * 作用：确定结构实际覆盖哪些主题，用于后续布局计算和绘制。
   * 调用链：renderMindStructures(), reserveBoundaryLabelSpace()
   */
  visibleTopicsForStructure(structure, layoutTopics) {
    const visible = new Set(layoutTopics);
    const collected = [];
    // 递归收集主题及其未折叠的子主题，确保展开分支全部纳入
    const addSubtree = (topic) => {
      if (visible.has(topic)) collected.push(topic);
      if (this.collapsedIds.has(topic.id)) return;
      for (const child of topic.subtopics || []) addSubtree(child);
    };
    // 遍历结构引用的所有主题 ID，收集对应的可见主题
    for (const stableId of structure.topicIds) {
      const topic = this.topicForStableId(stableId);
      if (!topic) continue;
      // 外框和概要都覆盖所选主题的完整可见分支，避免结构落在其子主题前方。
      if (structure.type === 'boundary' || structure.type === 'summary') addSubtree(topic);
      else if (visible.has(topic)) collected.push(topic);
    }
    return [...new Set(collected)];
  },

  /**
   * 主渲染入口：遍历所有高级结构，按类型分发到具体渲染方法。
   * 背景元素（外框）放入 backgroundLayer，前景元素（概要、关联）放入 foregroundLayer。
   * 选中的结构最后绘制以确保置于顶层。
   * 作用：生成整个导图的高级结构 SVG 图层。
   * 调用链：drawLayout() → renderMindStructures()
   *   调用子方法：renderBoundaryStructure(), renderSummaryStructure(), renderRelationStructure()
   */
  renderMindStructures(layout) {
    // 先在布局阶段为边界标签预留空间，避免标签与相邻主题重叠
    this.reserveBoundaryLabelSpace(layout);
    const backgroundLayer = svg('g', { class: 'yonxao-mindmap-structure-backgrounds' });
    const foregroundLayer = svg('g', { class: 'yonxao-mindmap-structures' });
    let selectedForegroundElement = null;
    let selectedRelationElement = null;
    const relationElements = [];
    // 遍历所有结构定义，逐一渲染
    for (const structure of this.structures || []) {
      const topics = this.visibleTopicsForStructure(structure, layout.topics);
      if (!topics.length) continue;
      let result = null;
      if (structure.type === 'boundary') {
        result = this.renderBoundaryStructure(structure, topics, layout.topics);
      }
      if (structure.type === 'summary') result = this.renderSummaryStructure(structure, topics);
      if (structure.type === 'relation' && topics.length === 2) {
        result = this.renderRelationStructure(structure, topics, layout.topics, layout.mode);
      }
      if (!result) continue;
      if (result.background) backgroundLayer.appendChild(result.el);
      else if (structure.type === 'relation' && structure.id === this.selectedStructureId) {
        selectedRelationElement = result.el;
      } else if (structure.type === 'relation') relationElements.push(result.el);
      else if (structure.id === this.selectedStructureId) selectedForegroundElement = result.el;
      else foregroundLayer.appendChild(result.el);
      mergeBounds(layout.bounds, result.bounds);
    }
    // SVG 后绘制的元素优先接收指针事件：关联始终高于概要，选中关联再位于所有关联之上。
    if (selectedForegroundElement) foregroundLayer.appendChild(selectedForegroundElement);
    for (const relationElement of relationElements) foregroundLayer.appendChild(relationElement);
    if (selectedRelationElement) foregroundLayer.appendChild(selectedRelationElement);
    return { backgroundLayer, foregroundLayer };
  },

  /**
   * 预计算外框标签的占用空间，当标签与未包含主题碰撞时，将相关主题整体下移。
   * 作用：在正式渲染之前调整布局，避免标签被相邻主题遮挡。
   * 调用链：renderMindStructures() → reserveBoundaryLabelSpace()
   */
  reserveBoundaryLabelSpace(layout) {
    // 遍历所有结构，只处理带标签的外框
    for (const structure of this.structures || []) {
      if (structure.type !== 'boundary' || !structure.text) continue;
      const includedTopics = this.visibleTopicsForStructure(structure, layout.topics);
      if (!includedTopics.length) continue;
      const included = new Set(includedTopics);
      const box = unionTopicBoxes(includedTopics);
      const textWidth = Math.ceil(
        estimateTopicTextWidth(structure.text, { size: 13, weight: 600 })
      );
      const frameMinX = box.minX - BOUNDARY_PADDING;
      const labelBox = {
        minX: frameMinX + BOUNDARY_LABEL_LEFT_OFFSET,
        minY: box.minY - BOUNDARY_PADDING - BOUNDARY_LABEL_HEIGHT,
        maxX:
          frameMinX +
          BOUNDARY_LABEL_LEFT_OFFSET +
          textWidth +
          BOUNDARY_LABEL_HORIZONTAL_PADDING * 2,
        maxY: box.minY - BOUNDARY_PADDING,
      };
      const labelClearanceBox = {
        ...labelBox,
        minY: labelBox.minY - BOUNDARY_LABEL_NEIGHBOR_GAP,
      };
      // 找出与标签区域发生碰撞的相邻主题（排除包含在框内的）
      const collisions = layout.topics
        .filter((topic) => !included.has(topic))
        .map((topic) => topicLayoutBox(topic))
        .filter((topicBox) => boxesOverlap(labelClearanceBox, topicBox));
      // 没有碰撞则不需要偏移
      if (!collisions.length) continue;

      // 计算需要下移的最小距离，使标签完全避开所有碰撞主题
      const shiftY = Math.max(
        ...collisions.map((topicBox) => topicBox.maxY + BOUNDARY_LABEL_NEIGHBOR_GAP - labelBox.minY)
      );
      // 将框内主题和紧随框下方的主题整体下移，为标签腾出空间
      for (const topic of layout.topics) {
        const topicBox = topicLayoutBox(topic);
        const followsBoundary =
          topicBox.minY >= box.minY &&
          rangesOverlap(box.minX, box.maxX, topicBox.minX, topicBox.maxX);
        if (included.has(topic) || followsBoundary) topic._layout.y += shiftY;
      }
    }

    const topicBounds = unionTopicBoxes(layout.topics);
    Object.assign(layout.bounds, topicBounds);
  },

  /**
   * 创建结构 SVG 分组元素，统一设置类名、选中状态、aria 标签等属性。
   * 作用：为每种结构提供一致的交互标记和可访问性支持。
   */
  structureGroup(structure, className) {
    const selected = structure.id === this.selectedStructureId;
    return svg('g', {
      class: `yonxao-mindmap-structure ${className}${selected ? ' is-selected' : ''}`,
      'data-structure-id': structure.id,
      tabindex: '0',
      role: 'button',
      'aria-label': `${structure.type}: ${structure.text || structure.id}`,
    });
  },

  /**
   * 获取结构的显示颜色，优先级：结构自带属性 > 插件配置 > 默认配置。
   * 作用：统一颜色解析逻辑，保证各类型结构颜色一致。
   */
  structureColor(structure) {
    return (
      normalizeColor(structure.attributes?.color) ||
      normalizeColor(this.config?.advancedStructureColor?.[structure.type]) ||
      DEFAULT_MIND_CONFIG.color.advancedStructure[structure.type] ||
      DEFAULT_MIND_CONFIG.color.advancedStructure.relation
    );
  },

  /**
   * 渲染外框结构：绘制带圆角的矩形框，以及可选的左上角标签。
   * 外框尺寸基于被包含主题的合并包围盒计算，并智能避让相邻未包含主题。
   * 作用：视觉上圈定一组主题，表示它们属于同一逻辑分组。
   * 调用链：renderMindStructures()
   */
  renderBoundaryStructure(structure, topics, layoutTopics) {
    const box = unionTopicBoxes(topics);
    // 计算各方向可用 padding，避免外框压住相邻的未包含主题
    const padding = boundaryAvailablePadding(box, topics, layoutTopics, {
      left: BOUNDARY_PADDING,
      top: BOUNDARY_PADDING,
      right: BOUNDARY_PADDING,
      bottom: BOUNDARY_PADDING,
    });
    let minX = box.minX - padding.left;
    let minY = box.minY - padding.top;
    let maxX = box.maxX + padding.right;
    let maxY = box.maxY + padding.bottom;
    const group = this.structureGroup(structure, 'yonxao-mindmap-boundary');
    group.style.setProperty('--structure-color', this.structureColor(structure));
    // 绘制外框圆角矩形主体
    group.appendChild(
      svg('rect', {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
        rx: 14,
        class: 'yonxao-mindmap-boundary-frame',
      })
    );
    // 如果外框有标签文字，在左上角绘制标签背景和文字
    if (structure.text) {
      const textWidth = Math.ceil(
        estimateTopicTextWidth(structure.text, { size: 13, weight: 600 })
      );
      const labelBox = {
        minX: minX + BOUNDARY_LABEL_LEFT_OFFSET,
        minY: minY - BOUNDARY_LABEL_HEIGHT,
        maxX: minX + BOUNDARY_LABEL_LEFT_OFFSET + textWidth + BOUNDARY_LABEL_HORIZONTAL_PADDING * 2,
        maxY: minY,
      };
      group.appendChild(
        svg('rect', {
          x: labelBox.minX,
          y: labelBox.minY,
          width: labelBox.maxX - labelBox.minX,
          height: labelBox.maxY - labelBox.minY,
          rx: 6,
          class: 'yonxao-mindmap-boundary-label-box',
        })
      );
      const label = svg('text', {
        x: labelBox.minX + BOUNDARY_LABEL_HORIZONTAL_PADDING,
        y: labelBox.minY + 15,
        class: 'yonxao-mindmap-structure-label yonxao-mindmap-boundary-label',
      });
      label.textContent = structure.text;
      group.appendChild(label);
      minX = Math.min(minX, labelBox.minX);
      minY = Math.min(minY, labelBox.minY);
      maxX = Math.max(maxX, labelBox.maxX);
      maxY = Math.max(maxY, labelBox.maxY);
    }
    return { el: group, background: true, bounds: { minX, minY, maxX, maxY } };
  },

  /**
   * 渲染概要结构：在主题组外侧绘制 L 形钩子线，并可附带居中标签。
   * 钩子方向由主题组平均 X 坐标与根主题 X 坐标的关系自动决定（左/右）。
   * 作用：对一组主题添加概要说明，表示这些主题的共同上层概念。
   * 调用链：renderMindStructures()
   */
  renderSummaryStructure(structure, topics) {
    const box = unionTopicBoxes(topics);
    // 根据主题组重心与根主题的位置关系，决定概要钩子绘制在左侧还是右侧
    const averageX = topics.reduce((sum, topic) => sum + topic._layout.x, 0) / topics.length;
    const rootX = this.root?._layout?.x || 0;
    const side = averageX >= rootX ? 1 : -1;
    const x = side > 0 ? box.maxX + SUMMARY_OFFSET : box.minX - SUMMARY_OFFSET;
    const middleY = (box.minY + box.maxY) / 2;
    const hook = side * 10;
    const path = `M ${x - hook} ${box.minY} Q ${x} ${box.minY} ${x} ${box.minY + 10} L ${x} ${middleY - 8} Q ${x} ${middleY} ${x + hook} ${middleY} Q ${x} ${middleY} ${x} ${middleY + 8} L ${x} ${box.maxY - 10} Q ${x} ${box.maxY} ${x - hook} ${box.maxY}`;
    const group = this.structureGroup(structure, 'yonxao-mindmap-summary');
    group.style.setProperty('--structure-color', this.structureColor(structure));
    group.appendChild(svg('path', { d: path, class: 'yonxao-mindmap-structure-hit-target' }));
    group.appendChild(svg('path', { d: path }));
    let minX = Math.min(box.minX, x - Math.abs(hook));
    let maxX = Math.max(box.maxX, x + Math.abs(hook));
    let minY = box.minY;
    let maxY = box.maxY;
    if (structure.text) {
      const labelX = x + side * LABEL_OFFSET;
      const labelLines = structure.text.split(/\r?\n/);
      const labelTextWidth = Math.ceil(
        labelLines.reduce(
          (longest, line) =>
            Math.max(longest, estimateTopicTextWidth(line, { size: 13, weight: 600 })),
          0
        )
      );
      const labelHalfHeight = (labelLines.length * STRUCTURE_LABEL_LINE_HEIGHT) / 2;
      const labelBoxWidth = labelTextWidth + SUMMARY_LABEL_HORIZONTAL_PADDING * 2;
      const labelBoxHeight =
        labelLines.length * STRUCTURE_LABEL_LINE_HEIGHT + SUMMARY_LABEL_VERTICAL_PADDING * 2;
      const firstLineY = middleY - ((labelLines.length - 1) * STRUCTURE_LABEL_LINE_HEIGHT) / 2 + 4;
      group.appendChild(
        svg('rect', {
          x:
            side > 0
              ? labelX - SUMMARY_LABEL_HORIZONTAL_PADDING
              : labelX - labelTextWidth - SUMMARY_LABEL_HORIZONTAL_PADDING,
          y: middleY - labelBoxHeight / 2,
          width: labelBoxWidth,
          height: labelBoxHeight,
          rx: 6,
          class: 'yonxao-mindmap-summary-label-box',
        })
      );
      const label = svg('text', {
        x: labelX,
        y: firstLineY,
        class: 'yonxao-mindmap-structure-label',
        'text-anchor': side > 0 ? 'start' : 'end',
      });
      // 逐行创建 tspan 元素，多行标签垂直排列
      for (let index = 0; index < labelLines.length; index += 1) {
        const line = svg('tspan', {
          x: labelX,
          dy: index === 0 ? 0 : STRUCTURE_LABEL_LINE_HEIGHT,
        });
        line.textContent = labelLines[index];
        label.appendChild(line);
      }
      group.appendChild(label);
      // 根据标签方向扩展全局边界，确保标签不被裁剪
      if (side > 0) maxX = labelX + labelTextWidth + SUMMARY_LABEL_HORIZONTAL_PADDING;
      else minX = labelX - labelTextWidth - SUMMARY_LABEL_HORIZONTAL_PADDING;
      minY = Math.min(minY, middleY - labelHalfHeight - SUMMARY_LABEL_VERTICAL_PADDING);
      maxY = Math.max(maxY, middleY + labelHalfHeight + SUMMARY_LABEL_VERTICAL_PADDING);
    }
    return { el: group, bounds: { minX, minY, maxX, maxY } };
  },

  /**
   * 计算关联线的避障路径，从多个候选路径中选取最优（碰撞最少→优先级最高→路径最短）。
   * 候选路径包括：直达路径、上下绕行、左右绕行。
   * 当两个主题距离较近（< RELATION_NEAR_DISTANCE）时，只保留左右两侧绕行方案以避免路径怪异。
   * 作用：确保关联线在有多主题阻挡时仍能找到清晰可读的路径。
   * 调用链：renderRelationStructure()
   */
  relationRoute(from, to, layoutTopics, layoutMode) {
    const a = from._layout;
    const b = to._layout;
    // 构建障碍物列表：排除自身以外的所有主题，并扩展 clearance
    const obstacles = layoutTopics
      .filter((topic) => topic !== from && topic !== to)
      .map(topicObstacleBox);
    const candidates = [];

    // 候选 1：两点之间的直达路径（沿主轴延伸），作为最优路径基线
    const [directStart, directEnd] = directRelationPoints(a, b);
    const prefersRightSide = String(layoutMode || '').includes('right');
    candidates.push({ points: [directStart, directEnd], priority: prefersRightSide ? 2 : 0 });

    // 筛选出真正阻挡在直达路径上的障碍物，仅围绕它们计算局部绕行通道
    const blockingObstacles = obstacles.filter((obstacle) =>
      segmentIntersectsBox(directStart, directEnd, obstacle)
    );
    const localBounds = blockingObstacles.reduce(
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
    // 候选 2：从上方绕行，沿上边界走 ┐ 形路径
    candidates.push({
      points: [
        { x: a.x, y: a.y - a.height / 2 },
        { x: a.x, y: topY },
        { x: b.x, y: topY },
        { x: b.x, y: b.y - b.height / 2 },
      ],
      priority: 1,
    });
    // 候选 3：从下方绕行，沿下边界走 └ 形路径
    candidates.push({
      points: [
        { x: a.x, y: a.y + a.height / 2 },
        { x: a.x, y: bottomY },
        { x: b.x, y: bottomY },
        { x: b.x, y: b.y + b.height / 2 },
      ],
      priority: 1,
    });
    // 候选 4：从左侧绕行，沿左边界走 ┐ 形或 ┘ 形路径
    candidates.push({
      points: [
        { x: a.x - a.width / 2, y: a.y },
        { x: leftX, y: a.y },
        { x: leftX, y: b.y },
        { x: b.x - b.width / 2, y: b.y },
      ],
      priority: prefersRightSide ? 2 : 1,
    });
    // 候选 5：从右侧绕行，沿右边界走 ┌ 形或 └ 形路径
    candidates.push({
      points: [
        { x: a.x + a.width / 2, y: a.y },
        { x: rightX, y: a.y },
        { x: rightX, y: b.y },
        { x: b.x + b.width / 2, y: b.y },
      ],
      priority: prefersRightSide ? 0 : 1,
    });

    // 距离较近时只保留左右两侧候选，避免绕行路径过于迂回
    const routeCandidates =
      Math.hypot(b.x - a.x, b.y - a.y) < RELATION_NEAR_DISTANCE ? candidates.slice(-2) : candidates;
    return (
      routeCandidates
        .map((candidate) => ({
          ...candidate,
          collisions: routeCollisionCount(candidate.points, obstacles),
          length: routeLength(candidate.points),
        }))
        // 按碰撞数 → 优先级 → 路径长度三级排序，取最优
        .sort(
          (left, right) =>
            left.collisions - right.collisions ||
            left.priority - right.priority ||
            left.length - right.length
        )[0]
    );
  },

  /**
   * 渲染关联线结构：根据线型（straight / elbow / curve）生成对应的 SVG path，
   * 支持箭头（forward / backward / both）、曲线控制点手柄和标签文字。
   * 作用：在导图任意两个主题之间绘制可定制的关联线。
   * 调用链：renderMindStructures()
   */
  renderRelationStructure(structure, topics, layoutTopics, layoutMode) {
    const [from, to] = topics;
    const lineStyle = structure.attributes?.lineStyle || RELATION_DEFAULT_LINE_STYLE;
    // straight 线型直接用直达路径；其它线型（elbow/curve）需要避障路由
    const route =
      lineStyle === 'straight'
        ? { points: directRelationPoints(from._layout, to._layout) }
        : this.relationRoute(from, to, layoutTopics, layoutMode);
    const direction = structure.attributes?.direction || RELATION_DEFAULT_DIRECTION;
    const renderPoints = route.points.map((point) => ({ ...point }));
    const curveGeometry =
      lineStyle === 'curve' ? curveRouteGeometry(renderPoints, structure.attributes) : null;
    // 根据线型生成对应的 SVG path 字符串
    const d =
      lineStyle === 'straight'
        ? straightRoutePath(renderPoints)
        : lineStyle === 'elbow'
          ? elbowRoutePath(renderPoints)
          : curveGeometry.path;
    const group = this.structureGroup(structure, 'yonxao-mindmap-relation');
    group.style.setProperty('--structure-color', this.structureColor(structure));
    group.appendChild(
      svg('path', {
        d,
        class: 'yonxao-mindmap-structure-hit-target yonxao-mindmap-relation-hit-target',
      })
    );
    const path = svg('path', { d, class: 'yonxao-mindmap-relation-path' });
    // 根据方向设置箭头 marker（末端箭头、起端箭头或双向箭头）
    if (direction === 'forward' || direction === 'both') {
      path.setAttribute('marker-end', 'url(#yonxao-mindmap-relation-arrow)');
    }
    if (direction === 'backward' || direction === 'both') {
      path.setAttribute('marker-start', 'url(#yonxao-mindmap-relation-arrow-start)');
    }
    group.appendChild(path);
    // 曲线模式下绘制控制点手柄，供用户拖动微调曲线形状
    if (lineStyle === 'curve') {
      const routePoints = normalizedRoutePoints(renderPoints);
      const start = routePoints[0];
      const end = routePoints[routePoints.length - 1];
      const controls = curveGeometry.controls;
      const controlGroup = svg('g', { class: 'yonxao-mindmap-relation-controls' });
      // 遍历两个控制点，分别连接到起点或终点
      for (let index = 0; index < controls.length; index += 1) {
        const control = controls[index];
        const anchor = index === 0 ? start : end;
        controlGroup.appendChild(
          svg('line', {
            x1: anchor.x,
            y1: anchor.y,
            x2: control.x,
            y2: control.y,
            class: 'yonxao-mindmap-relation-control-line',
          })
        );
        controlGroup.appendChild(
          svg('circle', {
            cx: control.x,
            cy: control.y,
            r: 8,
            class: 'yonxao-mindmap-relation-control-handle',
            'data-structure-id': structure.id,
            'data-structure-control': String(index + 1),
            'data-route-start-x': start.x,
            'data-route-start-y': start.y,
            'data-route-end-x': end.x,
            'data-route-end-y': end.y,
          })
        );
      }
      group.appendChild(controlGroup);
    }
    // 计算标签居中位置：曲线模式下取贝塞尔曲线中点，折线模式下取路径中段的中点
    const labelSegmentIndex = Math.max(1, Math.floor(renderPoints.length / 2));
    const labelSegmentStart = renderPoints[labelSegmentIndex - 1];
    const labelSegmentEnd = renderPoints[labelSegmentIndex];
    const curveMiddle = curveGeometry
      ? cubicBezierPoint(
          renderPoints[0],
          curveGeometry.controls[0],
          curveGeometry.controls[1],
          renderPoints[renderPoints.length - 1],
          0.5
        )
      : null;
    const labelX = curveMiddle?.x ?? (labelSegmentStart.x + labelSegmentEnd.x) / 2;
    const labelY = curveMiddle?.y ?? (labelSegmentStart.y + labelSegmentEnd.y) / 2;
    const labelLines = structure.text ? structure.text.split(/\r?\n/) : [];
    const labelHalfWidth =
      Math.ceil(
        labelLines.reduce(
          (longest, line) =>
            Math.max(longest, estimateTopicTextWidth(line, { size: 13, weight: 600 })),
          0
        )
      ) / 2;
    const labelHalfHeight = (labelLines.length * STRUCTURE_LABEL_LINE_HEIGHT) / 2;

    // 绘制关联线标签：居中放置在路径中点处，支持多行文本
    if (structure.text) {
      const firstLineY = labelY - ((labelLines.length - 1) * STRUCTURE_LABEL_LINE_HEIGHT) / 2 - 7;
      const label = svg('text', {
        x: labelX,
        y: firstLineY,
        class: 'yonxao-mindmap-structure-label',
        'text-anchor': 'middle',
      });
      // 逐行创建 tspan 元素，实现多行标签垂直居中排列
      for (let index = 0; index < labelLines.length; index += 1) {
        const line = svg('tspan', {
          x: labelX,
          dy: index === 0 ? 0 : STRUCTURE_LABEL_LINE_HEIGHT,
        });
        line.textContent = labelLines[index];
        label.appendChild(line);
      }
      group.appendChild(label);
    }
    const bounds = routeBounds([...renderPoints, ...(curveGeometry?.controls || [])]);
    const directCurvePadding = lineStyle === 'curve' && renderPoints.length === 2 ? 56 : 0;
    return {
      el: group,
      bounds: {
        minX: Math.min(bounds.minX - directCurvePadding, labelX - labelHalfWidth),
        minY: Math.min(bounds.minY - directCurvePadding, labelY - labelHalfHeight - 10),
        maxX: Math.max(bounds.maxX + directCurvePadding, labelX + labelHalfWidth),
        maxY: Math.max(bounds.maxY + directCurvePadding, labelY + labelHalfHeight),
      },
    };
  },

  /**
   * 创建关联线箭头 SVG marker 定义，通过 <defs> 注入 SVG 以便所有关联线引用。
   * 同时创建正向（marker-end）和反向（marker-start）两个箭头标记。
   * 作用：为关联线的起点和/或终点添加箭头指示方向。
   * 调用链：drawLayout() 初始化时调用一次
   */
  relationArrowDefs() {
    const defs = svg('defs');
    const createMarker = (id) => {
      const marker = svg('marker', {
        id,
        viewBox: '0 0 10 10',
        // 箭头尖端位于 x=10；refX 同样设为 10，使正向和反向箭头都恰好贴住主题边框。
        refX: 10,
        refY: 5,
        markerWidth: 7,
        markerHeight: 7,
        orient: 'auto-start-reverse',
      });
      marker.appendChild(
        svg('path', { d: 'M 0 0 L 10 5 L 0 10 z', class: 'yonxao-mindmap-relation-arrow' })
      );
      return marker;
    };
    defs.appendChild(createMarker('yonxao-mindmap-relation-arrow'));
    defs.appendChild(createMarker('yonxao-mindmap-relation-arrow-start'));
    return defs;
  },
};
