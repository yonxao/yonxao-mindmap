/*
 * 文件作用：
 * 折叠状态方法集合，负责读取、写入、批量展开/折叠和重置主题折叠状态。
 *
 * 实现逻辑：
 * 这些方法以 renderer 实例上的 collapsedIds、root 和 topicById 为状态源，操作后触发重绘或保存。
 *
 * 调用链：
 * YonxaoMindmapRenderer -> collapseStateMethods -> 渲染层/右键菜单/工具栏折叠命令。
 */

import {
  collapseTopicDescendants,
  expandTopicDescendants,
  forEachTopicWithSubtopics,
  resetCollapsedTopics,
  toggleTopicCollapsed,
} from '@yonxao/mindmap-core';

export const collapseStateMethods = {
  toggleTopicCollapse(topic) {
    if (toggleTopicCollapsed(this.collapsedIds, topic)) this.renderMap(true);
  },

  collapseTopicDescendants(topic) {
    collapseTopicDescendants(this.collapsedIds, topic);
    this.renderMap(true);
  },

  expandTopicDescendants(topic) {
    expandTopicDescendants(this.collapsedIds, topic);
    this.renderMap(true);
  },

  resetCollapsedTopics() {
    resetCollapsedTopics(this.collapsedIds);
    this.renderMap(true);
  },

  forEachTopicWithSubtopics(topic, callback) {
    forEachTopicWithSubtopics(topic, callback);
  },
};
