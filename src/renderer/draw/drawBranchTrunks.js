/*
 * 文件作用：
 * 分支主干绘制方法集合，负责思维导图、树形图和组织结构图的共享主干上色。
 *
 * 实现逻辑：
 * 按可见分支顺序拆分主干线段，使主干颜色跟随对应分支而不是被最后一个分支覆盖。
 *
 * 调用链：
 * mapRendererMethods -> branchTrunkDrawMethods -> drawTrunkSegments。
 */

import {
  themeConnectorOpacity,
  connectorColor,
  svg,
  DEFAULT_CONNECTOR_STROKE,
} from '../../shared/rendererShared.js';
import { nearestRelationAnchorForAngle } from '../../model/relationAnchors.js';

export const branchTrunkDrawMethods = {
  renderTreeTrunk(layout) {
    if (!this.isTreeLayoutMode(layout.mode)) return null;

    const rootBox = this.root?._layout;
    if (!rootBox) return null;

    const rootSubtopicConnectors = layout.connectors.filter((connector) => {
      const side = connector.subtopic?._layout?.side;
      return connector.parentTopic === this.root && (side === 'tree-left' || side === 'tree-right');
    });
    if (!rootSubtopicConnectors.length) return null;

    const startY = rootBox.y + rootBox.height / 2;
    const groupEl = svg('g', { class: 'yonxao-mindmap-tree-trunk' });

    /*
     * 树形图的纵向主干和思维导图折线主干一样，都是多个一级主题共享的线段。
     * 如果画成一整条单色线，就会丢失分支颜色；如果每条 root 边都重复画一遍，
     * 后绘制的分支又会覆盖前面的颜色。因此这里按一级主题位置分段绘制。
     */
    this.renderBranchColoredTrunkFromOrigin(
      groupEl,
      rootSubtopicConnectors,
      {
        axis: 'y',
        fixedCoord: rootBox.x,
        originCoord: startY,
      },
      `opacity: ${themeConnectorOpacity(this.config)}`
    );

    return groupEl;
  },

  isTreeLayoutMode(mode) {
    return mode === 'tree-right' || mode === 'tree-left' || mode === 'tree';
  },

  isTreeTableLayoutMode(mode) {
    return mode === 'tree-table' || mode === 'tree-table-stepped';
  },

  renderOrgSharedTrunks(layout) {
    if (layout.mode !== 'org' && layout.mode !== 'org-right') return null;

    const groupedConnectors = new Map();
    for (const connector of layout.connectors) {
      if (!this.isOrgSharedTrunkConnector(connector, layout.mode)) continue;
      if (!groupedConnectors.has(connector.parentTopic.id)) {
        groupedConnectors.set(connector.parentTopic.id, []);
      }
      groupedConnectors.get(connector.parentTopic.id).push(connector);
    }

    if (!groupedConnectors.size) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-org-shared-trunks' });
    for (const connectors of groupedConnectors.values()) {
      const trunkGroupEl = this.renderOrgSharedTrunkGroup(connectors);
      if (trunkGroupEl) groupEl.appendChild(trunkGroupEl);
    }

    return groupEl;
  },

  isOrgSharedTrunkConnector(connector, layoutMode) {
    const side = connector.subtopic?._layout?.side;
    if (layoutMode === 'org') return side === 'org-bottom';
    if (layoutMode === 'org-right') return side === 'org-right-branch';
    return false;
  },

  renderOrgSharedTrunkGroup(connectors) {
    if (!connectors.length) return null;

    const firstAnchors = this.trimConnectorAnchors(
      this.connectorAnchors(connectors[0].parentTopic._layout, connectors[0].subtopic._layout),
      this.config.layout
    );
    const busY = firstAnchors.startY + (firstAnchors.endY - firstAnchors.startY) / 2;
    const nearestConnector = this.closestConnectorToRootAxis(connectors, 'x', firstAnchors.startX);
    const nearestColor =
      connectorColor(nearestConnector.subtopic, this.config) || DEFAULT_CONNECTOR_STROKE;
    const opacityStyle = `opacity: ${themeConnectorOpacity(this.config)}`;
    const groupEl = svg('g', { class: 'yonxao-mindmap-org-shared-trunk' });

    /*
     * 父主题到横向总线的短竖线没有明确属于哪一个子主题，
     * 这里沿用基础思维导图的处理：使用离父主题最近的子主题颜色。
     */
    groupEl.appendChild(
      this.renderConnectorPath(
        ['M', firstAnchors.startX, firstAnchors.startY, 'V', busY],
        nearestColor,
        opacityStyle
      )
    );
    this.renderBranchColoredTrunkFromOrigin(
      groupEl,
      connectors,
      {
        axis: 'x',
        fixedCoord: busY,
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
          ['M', anchors.endX, busY, 'V', anchors.endY],
          branchColor,
          opacityStyle
        )
      );
    }

    return groupEl;
  },

  renderOrgRightTrunk(layout) {
    if (layout.mode !== 'org-right') return null;

    const rootBox = this.root?._layout;
    if (!rootBox) return null;

    const rootSubtopicConnectors = layout.connectors.filter(
      (connector) =>
        connector.parentTopic === this.root && connector.subtopic?._layout?.side === 'org-right'
    );
    if (!rootSubtopicConnectors.length) return null;

    const startY = rootBox.y + rootBox.height / 2;
    const groupEl = svg('g', { class: 'yonxao-mindmap-org-trunk' });

    this.renderBranchColoredTrunkFromOrigin(
      groupEl,
      rootSubtopicConnectors,
      {
        axis: 'y',
        fixedCoord: rootBox.x,
        originCoord: startY,
      },
      `opacity: ${themeConnectorOpacity(this.config)}`
    );

    return groupEl;
  },

  renderOrgRightBranchTrunks(layout) {
    if (layout.mode !== 'org-right') return null;

    const groups = new Map();
    for (const connector of layout.connectors) {
      if (connector.subtopic?._layout?.side !== 'org-right') continue;
      if (connector.subtopic?._layout?.branchExpansion === 'side') continue;
      if (connector.parentTopic === this.root) continue;
      if (!groups.has(connector.parentTopic.id)) {
        groups.set(connector.parentTopic.id, []);
      }
      groups.get(connector.parentTopic.id).push(connector);
    }

    if (!groups.size) return null;

    const groupEl = svg('g', { class: 'yonxao-mindmap-org-right-trunks' });

    for (const connectors of groups.values()) {
      const parentTopic = connectors[0]?.parentTopic;
      const parentBox = parentTopic?._layout;
      if (!parentBox || !connectors.length) continue;

      const startX = parentBox.x;
      const startY = parentBox.y + parentBox.height / 2;

      /*
       * org-right 后代的纵向共享线也按子主题分段上色，
       * 保持和基础思维导图 root 主干一致的颜色节奏。
       */
      this.renderBranchColoredTrunkFromOrigin(
        groupEl,
        connectors,
        {
          axis: 'y',
          fixedCoord: startX,
          originCoord: startY,
        },
        `opacity: ${themeConnectorOpacity(this.config)}`
      );
    }

    return groupEl;
  },

  radialConnectorPoint(box, angle) {
    /*
     * 放射线仍先按分支角度找到真实边界交点，再吸附到最近的固定锚点。
     * 这样不会改变分支所在方向，同一方向的子线出口却能归拢到与关联线相同的 8 个点位。
     */
    const anchor = nearestRelationAnchorForAngle(box, angle);
    return { x: anchor.x, y: anchor.y };
  },
};
