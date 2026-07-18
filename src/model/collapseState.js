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

export const collapseStateMethods = {
  toggleTopicCollapse(topic) {
    if (!topic || !topic.subtopics.length) return;

    const id = topic.id;
    // 折叠状态只保存主题 id，不改原始树。这样重置和重新布局都很直接。
    if (this.collapsedIds.has(id)) {
      this.collapsedIds.delete(id);
    } else {
      this.collapsedIds.add(id);
    }
    this.renderMap(true);
  },

  collapseTopicDescendants(topic) {
    this.forEachTopicWithSubtopics(topic, (current) => {
      this.collapsedIds.add(current.id);
    });
    this.renderMap(true);
  },

  expandTopicDescendants(topic) {
    this.forEachTopicWithSubtopics(topic, (current) => {
      this.collapsedIds.delete(current.id);
    });
    this.renderMap(true);
  },

  resetCollapsedTopics() {
    this.collapsedIds.clear();
    this.renderMap(true);
  },

  forEachTopicWithSubtopics(topic, callback) {
    if (!topic || !topic.subtopics.length) return;

    callback(topic);
    for (const subtopic of topic.subtopics) {
      this.forEachTopicWithSubtopics(subtopic, callback);
    }
  },
};
