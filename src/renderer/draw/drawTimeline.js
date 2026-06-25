/*
 * 文件作用：
 * 时间轴结构线绘制方法集合，负责轴线、时间点竖线和详情分支主干。
 *
 * 实现逻辑：
 * 时间轴布局的二级主题位于轴上，详情主题按上/下侧分支绘制专用结构线。
 *
 * 调用链：
 * mapRendererMethods -> timelineDrawMethods -> connector helpers。
 */

import {
  TOPIC_PADDING_X,
  themeConnectorOpacity,
  connectorColor,
  svg,
  DEFAULT_CONNECTOR_STROKE,
  TIMELINE_MIN_TRUNK_X,
} from '../../shared/rendererShared.js';

export const timelineDrawMethods = {
  timelineDetailBranchX(parentBox, subtopicBoxes = []) {
    if (parentBox.side !== 'timeline-detail-top' && parentBox.side !== 'timeline-detail-bottom') {
      return parentBox.x;
    }

    const parentRight = parentBox.x + parentBox.width / 2;
    const preferredX = parentRight + TOPIC_PADDING_X;
    if (!subtopicBoxes.length) return preferredX;

    const firstSubtopicLeft = Math.min(...subtopicBoxes.map((box) => box.x - box.width / 2));
    const available = firstSubtopicLeft - parentRight;
    if (available <= TOPIC_PADDING_X) {
      return parentRight + Math.max(TIMELINE_MIN_TRUNK_X, available / 2);
    }

    return Math.min(preferredX, firstSubtopicLeft - TOPIC_PADDING_X / 2);
  },

  renderTimelineAxis(layout) {
    if (!this.isTimelineLayoutMode(layout.mode)) return null;

    const rootBox = this.root?._layout;
    const axisY = rootBox?.timelineAxisY;
    if (!rootBox || !Number.isFinite(axisY)) return null;

    const eventTopics = layout.topics.filter((topic) => {
      const side = topic._layout?.side;
      return side === 'timeline-point';
    });
    if (!eventTopics.length) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-timeline-axis' });
    const sortedTopics = [...eventTopics].sort((left, right) => left._layout.x - right._layout.x);
    this.renderSequentialBranchColoredTrunk(
      groupEl,
      sortedTopics,
      {
        axis: 'x',
        fixedCoord: axisY,
        startCoord: rootBox.timelineAxisMinX ?? rootBox.x + rootBox.width / 2,
        segmentEndCoord: (topic) => topic._layout.x - topic._layout.width / 2,
        nextStartCoord: (topic) => topic._layout.x + topic._layout.width / 2,
      },
      `opacity: ${themeConnectorOpacity(this.config)}`
    );

    return groupEl;
  },

  renderTimelineDetailTrunks(layout) {
    if (!this.isTimelineLayoutMode(layout.mode)) return null;

    const groups = new Map();
    for (const connector of layout.connectors) {
      const side = connector.subtopic?._layout?.side;
      if (side !== 'timeline-detail-top' && side !== 'timeline-detail-bottom') continue;
      if (connector.subtopic?._layout?.branchExpansion === 'side') continue;
      if (connector.subtopic?._layout?.branchExpansion === 'hanging') continue;
      if (!groups.has(connector.parentTopic.id)) {
        groups.set(connector.parentTopic.id, []);
      }
      groups.get(connector.parentTopic.id).push(connector);
    }

    if (!groups.size) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-timeline-detail-trunks' });
    for (const connectors of groups.values()) {
      const parentTopic = connectors[0]?.parentTopic;
      const parentBox = parentTopic?._layout;
      if (!parentBox || !connectors.length) continue;

      const firstSide = connectors[0].subtopic._layout.side;
      const subtopicBoxes = connectors.map((connector) => connector.subtopic._layout);
      const trunkX = this.timelineDetailBranchX(parentBox, subtopicBoxes);
      const isDetailParent =
        parentBox.side === 'timeline-detail-top' || parentBox.side === 'timeline-detail-bottom';
      const startX = isDetailParent ? parentBox.x + parentBox.width / 2 : parentBox.x;
      const subtopicYs = connectors.map((connector) => connector.subtopic._layout.y);
      const minSubtopicY = Math.min(...subtopicYs);
      const maxSubtopicY = Math.max(...subtopicYs);
      const startY = isDetailParent
        ? parentBox.y
        : firstSide === 'timeline-detail-top'
          ? parentBox.y - parentBox.height / 2
          : parentBox.y + parentBox.height / 2;
      const trunkStartY = isDetailParent ? minSubtopicY : startY;
      const trunkEndY = isDetailParent
        ? maxSubtopicY
        : firstSide === 'timeline-detail-top'
          ? minSubtopicY
          : maxSubtopicY;
      const color = connectorColor(parentTopic, this.config);
      const commands = [];

      if (startX !== trunkX) {
        commands.push('M', startX, startY, 'H', trunkX);
      }

      commands.push('M', trunkX, trunkStartY, 'V', trunkEndY);

      groupEl.appendChild(
        svg('path', {
          class: 'yonxao-mindmap-connector yonxao-mindmap-timeline-detail-trunk',
          d: commands.join(' '),
          stroke: color || DEFAULT_CONNECTOR_STROKE,
          style: `opacity: ${themeConnectorOpacity(this.config)}`,
        })
      );
    }

    return groupEl;
  },

  isTimelineLayoutMode(mode) {
    return mode === 'timeline-up' || mode === 'timeline-down' || mode === 'timeline';
  },
};
