/*
 * 文件作用：
 * 配置面板规则方法集合，负责连线线型、下挂展开、主题色覆盖等可配置性判断。
 *
 * 实现逻辑：
 * 这些方法只读取 normalized/draft 配置并返回 UI 状态，避免 Tab 文件重复判断布局能力。
 *
 * 调用链：
 * ConfigModal/Tab 方法 -> configModalRuleMethods -> mindConfig 默认集合。
 */

import {
  BRANCH_EXPANSIONS,
  CONNECTOR_STYLES,
  LAYOUT_OPTION_GROUPS,
  THEME_SCHEMES,
  TOPIC_CONTROL_VISIBILITY_MODES,
  TOOLBAR_CORNERS,
  TOOLBAR_PLACEMENTS,
  VIEW_FIT_MODES,
  isConnectorStyleConfigurableLayout,
  isBranchExpansionConfigurable,
} from './configModalShared.js';

export const configModalRuleMethods = {
  tabLabel(tab) {
    return {
      basic: this.t('configModal.tabs.basic'),
      theme: this.t('configModal.tabs.theme'),
      layout: this.t('configModal.tabs.layout'),
      font: this.t('configModal.tabs.font'),
      advanced: this.t('configModal.tabs.advanced'),
    }[tab];
  },

  tabOptions() {
    return [
      ['basic', this.t('configModal.tabs.basic')],
      ['theme', this.t('configModal.tabs.theme')],
      ['layout', this.t('configModal.tabs.layout')],
      ['font', this.t('configModal.tabs.font')],
      ['advanced', this.t('configModal.tabs.advanced')],
    ];
  },

  themeOptions() {
    const labels = {
      default: this.t('configModal.theme.default'),
      ocean: this.t('configModal.theme.ocean'),
      forest: this.t('configModal.theme.forest'),
      sunset: this.t('configModal.theme.sunset'),
      mono: this.t('configModal.theme.mono'),
      rainbow: this.t('configModal.theme.rainbow'),
      'pastel-rainbow': this.t('configModal.theme.pastelRainbow'),
      'neon-rainbow': this.t('configModal.theme.neonRainbow'),
    };
    return THEME_SCHEMES.map((value) => [value, labels[value]]);
  },

  viewFitOptions() {
    return VIEW_FIT_MODES.map((mode) => [mode, this.t(`configModal.viewFit.${mode}`)]);
  },

  topicControlVisibilityOptions() {
    return TOPIC_CONTROL_VISIBILITY_MODES.map((mode) => [
      mode,
      this.t(`configModal.topicControlVisibility.${mode}`),
    ]);
  },

  layoutOptionGroups() {
    const groupLabels = {
      mindmap: this.t('configModal.layout.group.mindmap'),
      tree: this.t('configModal.layout.group.tree'),
      org: this.t('configModal.layout.group.org'),
      timeline: this.t('configModal.layout.group.timeline'),
      radial: this.t('configModal.layout.group.radial'),
      fishbone: this.t('configModal.layout.group.fishbone'),
      treeTable: this.t('configModal.layout.group.treeTable'),
    };
    const optionLabels = {
      'mindmap-right': this.t('configModal.layout.mindmapRight'),
      'mindmap-left': this.t('configModal.layout.mindmapLeft'),
      'mindmap-bidirectional': this.t('configModal.layout.mindmapBidirectional'),
      'mindmap-up': this.t('configModal.layout.mindmapUp'),
      'mindmap-down': this.t('configModal.layout.mindmapDown'),
      'mindmap-vertical': this.t('configModal.layout.mindmapVertical'),
      tree: this.t('configModal.layout.tree'),
      'tree-right': this.t('configModal.layout.treeRight'),
      'tree-left': this.t('configModal.layout.treeLeft'),
      org: this.t('configModal.layout.org'),
      'org-right': this.t('configModal.layout.orgRight'),
      timeline: this.t('configModal.layout.timeline'),
      'timeline-up': this.t('configModal.layout.timelineUp'),
      'timeline-down': this.t('configModal.layout.timelineDown'),
      radial: this.t('configModal.layout.radial'),
      'fishbone-left': this.t('configModal.layout.fishboneLeft'),
      'fishbone-right': this.t('configModal.layout.fishboneRight'),
      'tree-table': this.t('configModal.layout.treeTable'),
      'tree-table-stepped': this.t('configModal.layout.treeTableStepped'),
    };
    return LAYOUT_OPTION_GROUPS.map((group) => ({
      group: groupLabels[group.group],
      options: group.options.map((value) => [value, optionLabels[value]]),
    }));
  },

  connectorOptions() {
    const labels = {
      curve: this.t('configModal.connector.curve'),
      straight: this.t('configModal.connector.straight'),
      elbow: this.t('configModal.connector.elbow'),
    };
    return CONNECTOR_STYLES.map((value) => [value, labels[value]]);
  },

  branchExpansionOptions() {
    const labels = {
      side: this.t('configModal.branchExpansion.side'),
      hanging: this.t('configModal.branchExpansion.hanging'),
    };
    return BRANCH_EXPANSIONS.map((value) => [value, labels[value]]);
  },

  toolbarCornerOptions() {
    const labels = {
      'top-left': this.t('configModal.toolbarCorner.topLeft'),
      'top-right': this.t('configModal.toolbarCorner.topRight'),
      'bottom-left': this.t('configModal.toolbarCorner.bottomLeft'),
      'bottom-right': this.t('configModal.toolbarCorner.bottomRight'),
    };
    return TOOLBAR_CORNERS.map((value) => [value, labels[value]]);
  },

  toolbarPlacementOptions() {
    const labels = {
      inside: this.t('configModal.toolbarPlacement.inside'),
      outside: this.t('configModal.toolbarPlacement.outside'),
    };
    return TOOLBAR_PLACEMENTS.map((value) => [value, labels[value]]);
  },

  isConnectorStyleConfigurable(layout) {
    return isConnectorStyleConfigurableLayout(layout);
  },

  isBranchExpansionConfigurable(layout, connectorStyle) {
    return isBranchExpansionConfigurable(layout, connectorStyle);
  },
};
