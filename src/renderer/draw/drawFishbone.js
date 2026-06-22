/*
 * 文件作用：
 * 鱼骨图结构线绘制方法集合，负责鱼头、主骨、大骨和鱼刺分支。
 *
 * 实现逻辑：
 * 依据布局写入的 fishbone 元数据绘制主骨方向、斜骨角度和分支颜色。
 *
 * 调用链：
 * mapRendererMethods -> fishboneDrawMethods -> SVG path/line。
 */

import {
  LEVEL_GAP,
  themeConnectorOpacity,
  connectorColor,
  svg,
  DEFAULT_CONNECTOR_STROKE,
} from '../../shared/rendererShared.js';

export const fishboneDrawMethods = {
  renderFishboneMainSpine(layout) {
    if (!this.isFishboneLayoutMode(layout.mode)) return null;

    const rootBox = this.root?._layout;
    if (!rootBox) return null;

    const direction = layout.mode === 'fishbone-right' ? -1 : 1;
    const branchTopics = layout.topics
      .filter((topic) => {
        const side = topic._layout?.side;
        return side === 'fishbone-top' || side === 'fishbone-bottom';
      })
      .sort(
        (left, right) =>
          direction *
          (left._layout.fishboneMainSpineAttachX - right._layout.fishboneMainSpineAttachX)
      );

    if (!branchTopics.length) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-fishbone-main-spine' });
    const spineStart = rootBox.x + direction * (rootBox.width / 2);
    const segmentStart = this.renderSequentialBranchColoredTrunk(
      groupEl,
      branchTopics,
      {
        axis: 'x',
        fixedCoord: rootBox.y,
        startCoord: spineStart,
        segmentEndCoord: (topic) => topic._layout.fishboneMainSpineAttachX,
        nextStartCoord: (topic) => topic._layout.fishboneMainSpineAttachX,
      },
      `opacity: ${themeConnectorOpacity(this.config)}`
    );

    const lastTopic = branchTopics[branchTopics.length - 1];
    const tailBoundary = this.visibleSubtreeHorizontalBoundary(lastTopic, direction);
    const tailEnd =
      direction > 0
        ? Math.max(segmentStart + LEVEL_GAP * 1.7, tailBoundary)
        : Math.min(segmentStart - LEVEL_GAP * 1.7, tailBoundary);
    const tailEl = this.renderBranchColoredTrunkSegment(
      'x',
      rootBox.y,
      segmentStart,
      tailEnd,
      connectorColor(this.root, this.config) || DEFAULT_CONNECTOR_STROKE,
      `opacity: ${themeConnectorOpacity(this.config)}`
    );
    if (tailEl) {
      groupEl.appendChild(tailEl);
    }
    groupEl.appendChild(this.renderFishboneTail(tailEnd, rootBox.y, direction));

    return groupEl;
  },

  renderFishboneTail(x, y, direction = 1) {
    const color = connectorColor(this.root, this.config);
    const wingX = 18;
    const wingY = 10;
    const wingEndX = x + direction * wingX;

    return svg('path', {
      class: 'yonxao-mindmap-connector yonxao-mindmap-fishbone-tail',
      d: ['M', x, y, 'L', wingEndX, y - wingY, 'M', x, y, 'L', wingEndX, y + wingY].join(' '),
      stroke: color || DEFAULT_CONNECTOR_STROKE,
      style: `opacity: ${themeConnectorOpacity(this.config)}`,
    });
  },

  visibleSubtreeHorizontalBoundary(topic, direction = 1) {
    const box = topic?._layout;
    if (!box) return direction > 0 ? -Infinity : Infinity;

    let boundary = direction > 0 ? box.x + box.width / 2 : box.x - box.width / 2;
    if (this.collapsedIds.has(topic.id)) return boundary;

    for (const subtopic of topic.subtopics || []) {
      const subtopicBoundary = this.visibleSubtreeHorizontalBoundary(subtopic, direction);
      boundary =
        direction > 0 ? Math.max(boundary, subtopicBoundary) : Math.min(boundary, subtopicBoundary);
    }

    return boundary;
  },

  isFishboneLayoutMode(mode) {
    return mode === 'fishbone-left' || mode === 'fishbone-right';
  },
};
