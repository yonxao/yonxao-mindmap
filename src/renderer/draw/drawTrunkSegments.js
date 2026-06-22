/*
 * 文件作用：
 * 主干线段绘制方法集合，负责把结构主线拆成可独立上色的 SVG 片段。
 *
 * 实现逻辑：
 * 调用方传入起止点和颜色，本模块只生成线段元素和统一的视觉属性。
 *
 * 调用链：
 * branchTrunkDraw/timelineDraw/fishboneDraw -> trunkSegmentDrawMethods。
 */

import { connectorColor, DEFAULT_CONNECTOR_STROKE } from '../../shared/rendererShared.js';

export const trunkSegmentDrawMethods = {
  renderBranchColoredTrunkFromOrigin(groupEl, connectors, trunk, opacityStyle) {
    const negativeSideConnectors = connectors
      .filter((connector) => connector.subtopic._layout[trunk.axis] < trunk.originCoord)
      .sort(
        (left, right) => right.subtopic._layout[trunk.axis] - left.subtopic._layout[trunk.axis]
      );
    const positiveSideConnectors = connectors
      .filter((connector) => connector.subtopic._layout[trunk.axis] > trunk.originCoord)
      .sort(
        (left, right) => left.subtopic._layout[trunk.axis] - right.subtopic._layout[trunk.axis]
      );

    this.renderBranchColoredTrunkRun(groupEl, negativeSideConnectors, trunk, opacityStyle);
    this.renderBranchColoredTrunkRun(groupEl, positiveSideConnectors, trunk, opacityStyle);
  },

  renderBranchColoredTrunkRun(groupEl, sortedConnectors, trunk, opacityStyle) {
    let segmentStartCoord = trunk.originCoord;

    for (const connector of sortedConnectors) {
      const segmentEndCoord = connector.subtopic._layout[trunk.axis];
      const segmentColor =
        connectorColor(connector.subtopic, this.config) || DEFAULT_CONNECTOR_STROKE;
      const segmentEl = this.renderBranchColoredTrunkSegment(
        trunk.axis,
        trunk.fixedCoord,
        segmentStartCoord,
        segmentEndCoord,
        segmentColor,
        opacityStyle
      );

      if (segmentEl) groupEl.appendChild(segmentEl);
      segmentStartCoord = segmentEndCoord;
    }
  },

  renderSequentialBranchColoredTrunk(groupEl, topics, trunk, opacityStyle) {
    let segmentStartCoord = trunk.startCoord;

    for (const topic of topics) {
      const segmentEndCoord = trunk.segmentEndCoord(topic);
      const segmentColor = connectorColor(topic, this.config) || DEFAULT_CONNECTOR_STROKE;
      const segmentEl = this.renderBranchColoredTrunkSegment(
        trunk.axis,
        trunk.fixedCoord,
        segmentStartCoord,
        segmentEndCoord,
        segmentColor,
        opacityStyle
      );

      if (segmentEl) groupEl.appendChild(segmentEl);
      segmentStartCoord = trunk.nextStartCoord(topic);
    }

    return segmentStartCoord;
  },

  renderBranchColoredTrunkSegment(axis, fixedCoord, startCoord, endCoord, stroke, opacityStyle) {
    if (
      !Number.isFinite(fixedCoord) ||
      !Number.isFinite(startCoord) ||
      !Number.isFinite(endCoord)
    ) {
      return null;
    }
    if (Math.abs(endCoord - startCoord) < 0.001) return null;

    const pathParts =
      axis === 'y'
        ? ['M', fixedCoord, startCoord, 'V', endCoord]
        : ['M', startCoord, fixedCoord, 'H', endCoord];

    return this.renderConnectorPath(pathParts, stroke, opacityStyle);
  },
};
