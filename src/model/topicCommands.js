/*
 * 文件作用：
 * 主题编辑命令集合，负责新增、删除、移动和复制主题等面向 UI 的操作。
 *
 * 实现逻辑：
 * 方法内部复用 topicTreeActions 的纯树操作，并在成功后同步源码和重新渲染。
 *
 * 调用链：
 * YonxaoMindmapRenderer -> topicCommandMethods -> topicTreeActions -> serializeMindDocument。
 */

import {
  Notice,
  countTopicDescendants,
  insertSiblingTopic,
  removeTopicById,
  assignIds,
  createMindTopic,
} from '../shared/rendererShared.js';

// 新增主题时的默认显示文字
const DEFAULT_NEW_TOPIC_TEXT = '新主题';

export const topicCommandMethods = {
  async addSubtopicFromContextMenu(topic) {
    if (!this.canEditMindMap()) return false;
    if (!topic || topic._virtual) return false;

    const subtopic = createMindTopic(DEFAULT_NEW_TOPIC_TEXT, {}, [], 0, (topic.level || 1) + 1);
    topic.subtopics.push(subtopic);
    this.collapsedIds.delete(topic.id);
    assignIds(this.root, '0');

    // 保存可能触发 Obsidian 重建代码块；先记住新主题，避免新实例恢复到旧焦点。
    const topicId = subtopic.id;
    this.rememberTopicFocusState(topicId, { focusSvg: true });
    const saved = await this.saveTreeToSourceAndFile(this.t('notice.subtopicAdded'));
    return saved ? { saved, topicId } : false;
  },

  async addSiblingFromContextMenu(topic, position) {
    if (!this.canEditMindMap()) return false;
    if (!topic || topic === this.root || topic._virtual) return false;

    const sibling = createMindTopic(DEFAULT_NEW_TOPIC_TEXT, {}, [], 0, topic.level || 1);
    const inserted = insertSiblingTopic(this.root, topic.id, sibling, position);
    if (!inserted) {
      new Notice(this.t('notice.rootCannotAddSibling'));
      return false;
    }

    assignIds(this.root, '0');
    // 保存可能触发 Obsidian 重建代码块；先记住新主题，避免新实例恢复到旧焦点。
    const topicId = sibling.id;
    this.rememberTopicFocusState(topicId, { focusSvg: true });
    const saved = await this.saveTreeToSourceAndFile(this.t('notice.siblingTopicAdded'));
    return saved ? { saved, topicId } : false;
  },

  async deleteTopicFromContextMenu(topic) {
    if (!this.canEditMindMap()) return false;

    if (!topic || topic === this.root || topic._virtual) {
      new Notice(this.t('notice.rootCannotDelete'));
      return false;
    }

    if (!this.confirmDeleteTopic(topic)) return false;

    this.closeTopicEditor();
    this.closeInlineTextEditor(false);
    const removed = removeTopicById(this.root, topic.id);
    if (!removed) return false;

    assignIds(this.root, '0');
    return this.saveTreeToSourceAndFile(this.t('notice.topicDeleted'));
  },

  confirmDeleteTopic(topic) {
    const descendantCount = countTopicDescendants(topic);
    const message =
      descendantCount > 0
        ? this.t('confirm.deleteTopicWithDescendants', {
            topic: topic.text,
            count: descendantCount,
          })
        : this.t('confirm.deleteTopic', { topic: topic.text });

    return window.confirm(message);
  },
};
