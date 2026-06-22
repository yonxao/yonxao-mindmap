/*
 * 文件作用：
 * 普通父子连线绘制方法集合，负责按布局语义选择曲线、直线或折线。
 *
 * 实现逻辑：
 * 方法先计算父子锚点，再交给 connectorPaths/connectorGeometry 生成 SVG path。
 *
 * 调用链：
 * mapRendererMethods -> connectorDrawMethods -> connectorGeometry/connectorPaths。
 */

import {
  themeConnectorOpacity,
  connectorColor,
  svg,
  DEFAULT_CONNECTOR_STROKE,
} from '../../shared/rendererShared.js';

export const connectorDrawMethods = {
  renderConnector(connector, layoutMode) {
    const parentBox = connector.parentTopic._layout;
    const subtopicBox = connector.subtopic._layout;
    const anchors = this.trimConnectorAnchors(
      this.connectorAnchors(parentBox, subtopicBox),
      layoutMode
    );
    if (anchors.kind === 'skip') return null;
    const color = this.renderConnectorColor(connector, anchors);

    // 只有思维导图组允许用户选择线型；树形图等结构图固定按折线绘制，避免默认 curve 泄漏到不可配置布局。
    return svg('path', {
      class: 'yonxao-mindmap-connector',
      d: this.connectorPath(anchors, layoutMode),
      stroke: color || DEFAULT_CONNECTOR_STROKE,
      style: `opacity: ${themeConnectorOpacity(this.config)}`,
    });
  },

  renderConnectorColor(connector, anchors) {
    if (anchors.kind === 'timeline-detail') {
      return connectorColor(connector.parentTopic, this.config);
    }

    return connectorColor(connector.subtopic, this.config);
  },

  renderMindMapRootElbowConnectors(layout) {
    if (this.effectiveConnectorStyle(layout.mode) !== 'elbow') return null;
    if (!this.isMindMapLayoutMode(layout.mode)) return null;

    const rootConnectors = layout.connectors.filter((connector) =>
      this.isMindMapRootElbowConnector(connector, layout.mode)
    );
    if (!rootConnectors.length) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-root-elbow-connectors' });
    const connectorsBySide = this.groupMindMapRootConnectorsBySide(rootConnectors);

    for (const [side, connectors] of connectorsBySide.entries()) {
      const sideGroupEl = this.renderMindMapRootElbowSide(side, connectors);
      if (sideGroupEl) groupEl.appendChild(sideGroupEl);
    }

    return groupEl;
  },

  isMindMapRootElbowConnector(connector, layoutMode) {
    if (this.effectiveConnectorStyle(layoutMode) !== 'elbow') return false;
    if (!this.isMindMapLayoutMode(layoutMode)) return false;
    if (connector.parentTopic !== this.root) return false;

    const side = connector.subtopic?._layout?.side;
    return side === 'right' || side === 'left' || side === 'top' || side === 'bottom';
  },

  groupMindMapRootConnectorsBySide(rootConnectors) {
    const connectorsBySide = new Map();

    for (const connector of rootConnectors) {
      const side = connector.subtopic._layout.side;
      if (!connectorsBySide.has(side)) {
        connectorsBySide.set(side, []);
      }
      connectorsBySide.get(side).push(connector);
    }

    return connectorsBySide;
  },

  renderMindMapRootElbowSide(side, connectors) {
    if (!connectors.length) return null;

    const firstAnchors = this.trimConnectorAnchors(
      this.connectorAnchors(connectors[0].parentTopic._layout, connectors[0].subtopic._layout),
      this.config.layout
    );
    const groupEl = svg('g', { class: 'yonxao-mindmap-root-elbow-side' });
    const opacityStyle = `opacity: ${themeConnectorOpacity(this.config)}`;

    if (side === 'right' || side === 'left') {
      const bendX = firstAnchors.startX + (firstAnchors.endX - firstAnchors.startX) / 2;
      const nearestConnector = this.closestConnectorToRootAxis(
        connectors,
        'y',
        firstAnchors.startY
      );
      const nearestColor =
        connectorColor(nearestConnector.subtopic, this.config) || DEFAULT_CONNECTOR_STROKE;

      /*
       * root 到共享主干只画一次，颜色取离 root 最近的一级主题。
       * 共享竖线再按一级主题位置切成短段，避免最后一个主题覆盖整根主干。
       */
      groupEl.appendChild(
        this.renderConnectorPath(
          ['M', firstAnchors.startX, firstAnchors.startY, 'H', bendX],
          nearestColor,
          opacityStyle
        )
      );
      this.renderBranchColoredTrunkFromOrigin(
        groupEl,
        connectors,
        {
          axis: 'y',
          fixedCoord: bendX,
          originCoord: firstAnchors.startY,
        },
        opacityStyle
      );

      for (const connector of connectors) {
        const anchors = this.trimConnectorAnchors(
          this.connectorAnchors(connector.parentTopic._layout, connector.subtopic._layout),
          this.config.layout
        );
        const branchColor =
          connectorColor(connector.subtopic, this.config) || DEFAULT_CONNECTOR_STROKE;
        groupEl.appendChild(
          this.renderConnectorPath(
            ['M', bendX, anchors.endY, 'H', anchors.endX],
            branchColor,
            opacityStyle
          )
        );
      }

      return groupEl;
    }

    const bendY = firstAnchors.startY + (firstAnchors.endY - firstAnchors.startY) / 2;
    const nearestConnector = this.closestConnectorToRootAxis(connectors, 'x', firstAnchors.startX);
    const nearestColor =
      connectorColor(nearestConnector.subtopic, this.config) || DEFAULT_CONNECTOR_STROKE;

    groupEl.appendChild(
      this.renderConnectorPath(
        ['M', firstAnchors.startX, firstAnchors.startY, 'V', bendY],
        nearestColor,
        opacityStyle
      )
    );
    this.renderBranchColoredTrunkFromOrigin(
      groupEl,
      connectors,
      {
        axis: 'x',
        fixedCoord: bendY,
        originCoord: firstAnchors.startX,
      },
      opacityStyle
    );

    for (const connector of connectors) {
      const anchors = this.trimConnectorAnchors(
        this.connectorAnchors(connector.parentTopic._layout, connector.subtopic._layout),
        this.config.layout
      );
      const branchColor =
        connectorColor(connector.subtopic, this.config) || DEFAULT_CONNECTOR_STROKE;
      groupEl.appendChild(
        this.renderConnectorPath(
          ['M', anchors.endX, bendY, 'V', anchors.endY],
          branchColor,
          opacityStyle
        )
      );
    }

    return groupEl;
  },

  closestConnectorToRootAxis(connectors, axis, originCoord) {
    return connectors.reduce((closest, connector) => {
      const currentDistance = Math.abs(connector.subtopic._layout[axis] - originCoord);
      const closestDistance = Math.abs(closest.subtopic._layout[axis] - originCoord);
      return currentDistance < closestDistance ? connector : closest;
    }, connectors[0]);
  },

  renderConnectorPath(pathParts, stroke, opacityStyle) {
    return svg('path', {
      class: 'yonxao-mindmap-connector',
      d: pathParts.join(' '),
      stroke,
      style: opacityStyle,
    });
  },

  isMindMapLayoutMode(mode) {
    return (
      mode === 'mindmap-right' ||
      mode === 'mindmap-left' ||
      mode === 'mindmap-bidirectional' ||
      mode === 'mindmap-up' ||
      mode === 'mindmap-down' ||
      mode === 'mindmap-vertical'
    );
  },

  effectiveConnectorStyle(layoutMode) {
    return this.isMindMapLayoutMode(layoutMode) ? this.config.connector.style : 'elbow';
  },
};
