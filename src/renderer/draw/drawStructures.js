/**
 * 高级结构（外框 / 概要 / 关联）的 SVG 绘制逻辑。
 *
 * 实现逻辑：
 * - 外框 (boundary)：基于一组主题的布局盒计算最小包围矩形，并考虑相邻未包含主题的可用间距
 *   （boundaryAvailablePadding）决定实际内边距；附带可选标签，标签与相邻主题碰撞时自动下移
 *   （reserveBoundaryLabelSpace）。
 * - 概要 (summary)：在主题组外侧绘制 L 形钩子线，附带居中标签；钩子方向由主题分布自动决定。
 * - 关联 (relation)：支持直线、直角线（elbow）、贝塞尔曲线三种线型；
 *   两端可固定到主题边框的 8 个锚点，未指定时继续使用自动路由；
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
import {
  relationAnchorPoints,
  relationControlMapUnitsPerPixel,
} from '../../model/relationAnchors.js';
import {
  BOUNDARY_LABEL_HEIGHT,
  BOUNDARY_LABEL_HORIZONTAL_PADDING,
  BOUNDARY_LABEL_LEFT_OFFSET,
  BOUNDARY_LABEL_NEIGHBOR_GAP,
  BOUNDARY_PADDING,
  STRUCTURE_LABEL_LINE_HEIGHT,
  boundaryGeometry,
  mergeBounds as coreMergeBounds,
  relationGeometry,
  relationRoute as coreRelationRoute,
  reserveBoundaryLabelVerticalSpace,
  summaryGeometry,
  unionTopicBoxes as coreUnionTopicBoxes,
} from '@yonxao/mindmap-svg-renderer';

// 关联端点抓手保持固定屏幕尺寸，避免适配视图缩小时难以看清或命中。
const RELATION_ENDPOINT_HANDLE_SCREEN_RADIUS = 7;
const RELATION_ENDPOINT_HIT_SCREEN_RADIUS = 16;
const RELATION_ANCHOR_TARGET_SCREEN_RADIUS = 4;
const RELATION_CURVE_CONTROL_SCREEN_RADIUS = 8;

/**
 * 计算一组主题布局盒的合并包围盒，覆盖所有主题的完整范围。
 * 作用：外框和概要以此为基础确定整体框体尺寸。
 * 调用链：reserveBoundaryLabelSpace(), renderBoundaryStructure(), renderSummaryStructure()
 */
function unionTopicBoxes(topics) {
  return coreUnionTopicBoxes(topics);
}

/**
 * 将 source 包围盒合并到 target 包围盒中（原地修改 target）。
 * 作用：在 renderMindStructures() 中累计所有结构的渲染边界到 layout.bounds。
 */
function mergeBounds(target, source) {
  coreMergeBounds(target, source);
}

export const structureDrawMethods = {
  /**
   * 按当前 viewBox 比例同步关联端点、候选锚点和曲线控制点尺寸。
   * SVG viewBox 缩放会同步缩小普通 circle；换算为导图单位后，控件可稳定保持屏幕像素尺寸。
   */
  syncRelationControlHandleSizes() {
    if (!this.mapEl || !this.svgEl || !this.viewBox) return;
    const viewport = this.svgEl.getBoundingClientRect();
    const mapUnitsPerPixel = relationControlMapUnitsPerPixel(
      this.viewBox,
      viewport.width,
      viewport.height
    );
    const syncRadius = (selector, screenRadius) => {
      const radius = (screenRadius * mapUnitsPerPixel).toFixed(2);
      for (const element of this.mapEl.querySelectorAll(selector)) {
        element.setAttribute('r', radius);
      }
    };
    syncRadius('.yonxao-mindmap-relation-anchor-target', RELATION_ANCHOR_TARGET_SCREEN_RADIUS);
    syncRadius('.yonxao-mindmap-relation-endpoint-hit-target', RELATION_ENDPOINT_HIT_SCREEN_RADIUS);
    syncRadius('.yonxao-mindmap-relation-endpoint-handle', RELATION_ENDPOINT_HANDLE_SCREEN_RADIUS);
    syncRadius('.yonxao-mindmap-relation-control-handle', RELATION_CURVE_CONTROL_SCREEN_RADIUS);
  },

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
      reserveBoundaryLabelVerticalSpace(
        layout.topics,
        includedTopics,
        box,
        labelBox,
        BOUNDARY_LABEL_NEIGHBOR_GAP
      );
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
    const textWidth = structure.text
      ? Math.ceil(estimateTopicTextWidth(structure.text, { size: 13, weight: 600 }))
      : 0;
    const geometry = boundaryGeometry(topics, layoutTopics, textWidth);
    if (!geometry) return null;
    const { frame, labelBox } = geometry;
    const group = this.structureGroup(structure, 'yonxao-mindmap-boundary');
    group.style.setProperty('--structure-color', this.structureColor(structure));
    // 绘制外框圆角矩形主体
    group.appendChild(
      svg('rect', {
        x: frame.minX,
        y: frame.minY,
        width: frame.maxX - frame.minX,
        height: frame.maxY - frame.minY,
        rx: 14,
        class: 'yonxao-mindmap-boundary-frame',
      })
    );
    // 如果外框有标签文字，在左上角绘制标签背景和文字
    if (structure.text && labelBox) {
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
    }
    return { el: group, background: true, bounds: geometry.bounds };
  },

  /**
   * 渲染概要结构：在主题组外侧绘制 L 形钩子线，并可附带居中标签。
   * 钩子方向由主题组平均 X 坐标与根主题 X 坐标的关系自动决定（左/右）。
   * 作用：对一组主题添加概要说明，表示这些主题的共同上层概念。
   * 调用链：renderMindStructures()
   */
  renderSummaryStructure(structure, topics) {
    const labelLines = structure.text ? structure.text.split(/\r?\n/) : [];
    const labelTextWidth = Math.ceil(
      labelLines.reduce(
        (longest, line) =>
          Math.max(longest, estimateTopicTextWidth(line, { size: 13, weight: 600 })),
        0
      )
    );
    const geometry = summaryGeometry(
      topics,
      this.root?._layout?.x || 0,
      labelTextWidth,
      labelLines.length
    );
    if (!geometry) return null;
    const { path, side, labelPoint, labelBox } = geometry;
    const group = this.structureGroup(structure, 'yonxao-mindmap-summary');
    group.style.setProperty('--structure-color', this.structureColor(structure));
    group.appendChild(svg('path', { d: path, class: 'yonxao-mindmap-structure-hit-target' }));
    group.appendChild(svg('path', { d: path }));
    if (structure.text && labelBox) {
      group.appendChild(
        svg('rect', {
          x: labelBox.minX,
          y: labelBox.minY,
          width: labelBox.maxX - labelBox.minX,
          height: labelBox.maxY - labelBox.minY,
          rx: 6,
          class: 'yonxao-mindmap-summary-label-box',
        })
      );
      const label = svg('text', {
        x: labelPoint.x,
        y: geometry.firstLineY,
        class: 'yonxao-mindmap-structure-label',
        'text-anchor': side > 0 ? 'start' : 'end',
      });
      // 逐行创建 tspan 元素，多行标签垂直排列
      for (let index = 0; index < labelLines.length; index += 1) {
        const line = svg('tspan', {
          x: labelPoint.x,
          dy: index === 0 ? 0 : STRUCTURE_LABEL_LINE_HEIGHT,
        });
        line.textContent = labelLines[index];
        label.appendChild(line);
      }
      group.appendChild(label);
    }
    return { el: group, bounds: geometry.bounds };
  },

  /**
   * 计算关联线的避障路径，从多个候选路径中选取最优（碰撞最少→优先级最高→路径最短）。
   * 候选路径包括：直达路径、上下绕行、左右绕行。
   * 当两个主题距离较近（< RELATION_NEAR_DISTANCE）时，只保留左右两侧绕行方案以避免路径怪异。
   * 作用：确保关联线在有多主题阻挡时仍能找到清晰可读的路径。
   * 调用链：renderRelationStructure()
   */
  relationRoute(from, to, layoutTopics, layoutMode, attributes = {}) {
    return coreRelationRoute(from, to, layoutTopics, layoutMode, attributes);
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
    const direction = structure.attributes?.direction || RELATION_DEFAULT_DIRECTION;
    const labelLines = structure.text ? structure.text.split(/\r?\n/) : [];
    const labelHalfWidth =
      Math.ceil(
        labelLines.reduce(
          (longest, line) =>
            Math.max(longest, estimateTopicTextWidth(line, { size: 13, weight: 600 })),
          0
        )
      ) / 2;
    const geometry = relationGeometry(
      from,
      to,
      layoutTopics,
      layoutMode,
      lineStyle,
      structure.attributes,
      labelHalfWidth,
      labelLines.length
    );
    const renderPoints = geometry.points;
    const d = geometry.path;
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
    const start = renderPoints[0];
    const end = renderPoints[renderPoints.length - 1];
    // 选中关联时显示两端主题的 8 个候选锚点，以及当前端点的拖拽手柄。
    const controlGroup = svg('g', { class: 'yonxao-mindmap-relation-controls' });
    for (const [endpointIndex, topic] of [from, to].entries()) {
      const endpoint = endpointIndex === 0 ? 'from' : 'to';
      const activeAnchor = structure.attributes?.[`${endpoint}Anchor`] || '';
      for (const anchor of relationAnchorPoints(topic._layout)) {
        controlGroup.appendChild(
          svg('circle', {
            cx: anchor.x,
            cy: anchor.y,
            r: RELATION_ANCHOR_TARGET_SCREEN_RADIUS,
            class: `yonxao-mindmap-relation-anchor-target${anchor.name === activeAnchor ? ' is-active' : ''}`,
            'data-relation-endpoint': endpoint,
            'data-relation-anchor': anchor.name,
          })
        );
      }
    }
    for (const [endpoint, point] of [
      ['from', start],
      ['to', end],
    ]) {
      // 透明命中圈提供更大的抓取范围；可见端点只负责视觉反馈，避免大圆遮挡主题内容。
      controlGroup.appendChild(
        svg('circle', {
          cx: point.x,
          cy: point.y,
          r: RELATION_ENDPOINT_HIT_SCREEN_RADIUS,
          class: 'yonxao-mindmap-relation-endpoint-hit-target',
          'data-structure-id': structure.id,
          'data-relation-endpoint': endpoint,
        })
      );
      controlGroup.appendChild(
        svg('circle', {
          cx: point.x,
          cy: point.y,
          r: RELATION_ENDPOINT_HANDLE_SCREEN_RADIUS,
          class: 'yonxao-mindmap-relation-endpoint-handle',
          'data-structure-id': structure.id,
          'data-relation-endpoint': endpoint,
        })
      );
    }
    // 曲线模式额外绘制两个贝塞尔控制点，供用户微调弯曲形状。
    if (lineStyle === 'curve') {
      const controls = geometry.controls;
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
            r: RELATION_CURVE_CONTROL_SCREEN_RADIUS,
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
    }
    group.appendChild(controlGroup);
    const labelX = geometry.labelPoint.x;
    const labelY = geometry.labelPoint.y;

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
    return {
      el: group,
      bounds: geometry.bounds,
    };
  },

  /**
   * 创建关联线箭头 SVG marker 定义，通过 <defs> 注入 SVG 以便所有关联线引用。
   * 同时创建正向（marker-end）和反向（marker-start）两个箭头标记。
   * 作用：为关联线的起点和/或终点添加箭头指示方向。
   * 调用链：drawLayout() 初始化时调用一次
   *
   * orient: 'auto-start-reverse' 让正向箭头（marker-end）指向路径方向，
   * 反向箭头（marker-start）自动翻转指向路径的反方向，避免为反向单独定义 marker。
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
