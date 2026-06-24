/*
 * 文件作用：
 * 导图 SVG 渲染调度方法集合，负责创建 SVG、调用布局系统并分派主题和连线绘制。
 *
 * 实现逻辑：
 * 先清理旧图层，再根据 layoutTree 输出绘制主干、连线、主题和交互控件。
 *
 * 调用链：
 * YonxaoMindmapRenderer.render -> mapRendererMethods -> layoutTree -> draw/*。
 */

import { DEFAULT_BUTTON_COLOR, layoutTree, normalizeColor, svg } from '../shared/rendererShared.js';

export const mapRendererMethods = {
  renderMap(fitAfterRender, options = {}) {
    this.clearTopicDropHighlight();
    this.closeInlineTextEditor(false);
    this.hoveredTopicControlId = '';
    this.topicById.clear();
    this.mapEl.textContent = '';

    this.applyButtonColorMode();

    // 渲染分两步：先把树计算成带坐标的主题/连线，再把这些数据画成 SVG。
    // 这样解析、布局、绘制互相独立，后续要替换布局算法也更容易。
    const layout = layoutTree(this.root, this.collapsedIds, this.config);
    const connectorLayer = svg('g', { class: 'yonxao-mindmap-connectors' });
    const topicLayer = svg('g', { class: 'yonxao-mindmap-topics' });
    const controlLayer = svg('g', { class: 'yonxao-mindmap-topic-controls-layer' });

    const treeTrunk = this.renderTreeTrunk(layout);
    if (treeTrunk) {
      connectorLayer.appendChild(treeTrunk);
    }
    const orgSharedTrunks = this.renderOrgSharedTrunks(layout);
    if (orgSharedTrunks) {
      connectorLayer.appendChild(orgSharedTrunks);
    }
    const orgRightTrunk = this.renderOrgRightTrunk(layout);
    if (orgRightTrunk) {
      connectorLayer.appendChild(orgRightTrunk);
    }
    const orgRightBranchTrunks = this.renderOrgRightBranchTrunks(layout);
    if (orgRightBranchTrunks) {
      connectorLayer.appendChild(orgRightBranchTrunks);
    }
    const timelineAxis = this.renderTimelineAxis(layout);
    if (timelineAxis) {
      connectorLayer.appendChild(timelineAxis);
    }
    const fishboneMainSpine = this.renderFishboneMainSpine(layout);
    if (fishboneMainSpine) {
      connectorLayer.appendChild(fishboneMainSpine);
    }
    const timelineDetailTrunks = this.renderTimelineDetailTrunks(layout);
    if (timelineDetailTrunks) {
      connectorLayer.appendChild(timelineDetailTrunks);
    }
    const mindMapRootElbowConnectors = this.renderMindMapRootElbowConnectors(layout);
    if (mindMapRootElbowConnectors) {
      connectorLayer.appendChild(mindMapRootElbowConnectors);
    }

    if (!this.isTreeTableLayoutMode(layout.mode)) {
      for (const connector of layout.connectors) {
        if (this.isMindMapRootElbowConnector(connector, layout.mode)) continue;
        if (this.isOrgSharedTrunkConnector(connector, layout.mode)) continue;

        const connectorEl = this.renderConnector(connector, layout.mode);
        if (connectorEl) {
          connectorLayer.appendChild(connectorEl);
        }
      }
    }

    for (const topic of layout.topics) {
      this.topicById.set(topic.id, topic);
      topicLayer.appendChild(this.renderTopic(topic));
      const topicControls = this.renderTopicControls(topic);
      if (topicControls) {
        controlLayer.appendChild(topicControls);
      }
    }

    this.mapEl.appendChild(connectorLayer);
    this.mapEl.appendChild(topicLayer);
    this.mapEl.appendChild(controlLayer);

    if (fitAfterRender || !this.viewBox) {
      this.applyConfiguredViewFit(layout.bounds, options);
    }

    this.didInitialMapRender = true;
  },

  applyButtonColorMode() {
    const buttonConfig = this.config.button || {};
    const colorMode = buttonConfig.colorMode || 'inherit-accent';

    if (colorMode === 'topic') {
      return;
    }

    let buttonColor;
    switch (colorMode) {
      case 'inherit-accent':
      case 'subtle': {
        const cssVarName = colorMode === 'inherit-accent' ? '--interactive-accent' : '--text-muted';
        const computedValue = getComputedStyle(document.body).getPropertyValue(cssVarName).trim();
        buttonColor = computedValue || DEFAULT_BUTTON_COLOR;
        break;
      }
      case 'custom':
        buttonColor = normalizeColor(buttonConfig.color) || DEFAULT_BUTTON_COLOR;
        break;
      default:
        buttonColor = DEFAULT_BUTTON_COLOR;
    }

    if (this.svgEl) {
      this.svgEl.style.setProperty('--yonxao-mindmap-button-color', buttonColor);
    }
  },
};
