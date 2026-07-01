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
  cloneTopicSubtree,
  insertSiblingTopic,
  removeTopicById,
  assignIds,
  createMindTopic,
  parseMindDocument,
  refreshTreeLevels,
  serializeTopic,
} from '../shared/rendererShared.js';

// 新增主题时的默认显示文字
const DEFAULT_NEW_TOPIC_TEXT = '新主题';

let sharedTopicClipboard = null;

async function writeSystemClipboardText(text) {
  if (!navigator.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_error) {
    return false;
  }
}

async function readSystemClipboardText() {
  if (!navigator.clipboard?.readText) return '';

  try {
    return await navigator.clipboard.readText();
  } catch (_error) {
    return '';
  }
}

function cloneClipboardTopicSnapshot(options = {}) {
  if (!sharedTopicClipboard?.topicSnapshot) return null;
  return cloneTopicSubtree(sharedTopicClipboard.topicSnapshot, {
    includeAttributes: Boolean(options.includeAttributes),
    includeSubtopics: Boolean(options.includeSubtopics),
  });
}

function createTopicFromText(text, level) {
  return createMindTopic(String(text || '').trim(), {}, [], 0, level);
}

function parseTopicsFromClipboardText(text, options = {}) {
  const source = String(text || '').trim();
  if (!source) return [];

  try {
    const document = parseMindDocument(source);
    const topics = document.root?._virtual ? document.root.subtopics : [document.root];
    return topics
      .map((topic) =>
        cloneTopicSubtree(topic, {
          includeAttributes: Boolean(options.includeAttributes),
          includeSubtopics: Boolean(options.includeSubtopics),
        })
      )
      .filter(Boolean);
  } catch (_error) {
    return [];
  }
}

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

  async copyTopicContentForShortcut(topic) {
    if (!topic || topic._virtual) return false;

    const text = topic.text || '';
    sharedTopicClipboard = {
      mode: 'content',
      text,
      topicSnapshot: createTopicFromText(text, topic.level || 1),
    };
    await writeSystemClipboardText(text);
    new Notice(this.t('notice.topicCopied'));
    return true;
  },

  async cutTopicContentForShortcut(topic) {
    if (!this.canEditMindMap()) return false;
    if (!topic || topic === this.root || topic._virtual) {
      new Notice(this.t('notice.rootCannotDelete'));
      return false;
    }
    if (!this.confirmDeleteTopic(topic)) return false;

    const parentTopic = this.findTopicParentInTree(topic.id);
    sharedTopicClipboard = {
      mode: 'content',
      text: topic.text || '',
      topicSnapshot: createTopicFromText(topic.text || '', topic.level || 1),
    };
    await writeSystemClipboardText(topic.text || '');

    this.closeTopicEditor();
    this.closeInlineTextEditor(false);
    const removed = removeTopicById(this.root, topic.id);
    if (!removed) return false;

    assignIds(this.root, '0');
    if (parentTopic?.id) {
      this.rememberTopicFocusState(parentTopic.id, { focusSvg: true });
    }
    const saved = await this.saveTreeToSourceAndFile(this.t('notice.topicCut'));
    if (saved && parentTopic?.id) {
      this.setFocusedTopic(parentTopic.id, { focusSvg: true, ensureInView: true });
    }
    return saved;
  },

  async pasteTopicContentForShortcut(topic) {
    if (!this.canEditMindMap()) return false;
    if (!topic || topic._virtual) return false;

    let text = sharedTopicClipboard?.text || '';
    if (!text) {
      text = await readSystemClipboardText();
    }
    text = String(text || '').trim();
    if (!text) {
      new Notice(this.t('notice.topicClipboardEmpty'));
      return false;
    }

    const pastedTopic = createTopicFromText(text, (topic.level || 1) + 1);
    topic.subtopics.push(pastedTopic);
    this.collapsedIds.delete(topic.id);
    assignIds(this.root, '0');
    refreshTreeLevels(this.root);

    const topicId = pastedTopic.id;
    this.rememberTopicFocusState(topicId, { focusSvg: true });
    const saved = await this.saveTreeToSourceAndFile(this.t('notice.topicPasted'));
    return saved ? { saved, topicId } : false;
  },

  async copyTopicWithAttributesForShortcut(topic) {
    if (!topic || topic._virtual) return false;

    const topicSnapshot = cloneTopicSubtree(topic, {
      includeAttributes: true,
      includeSubtopics: true,
    });
    sharedTopicClipboard = {
      mode: 'topic',
      text: topic.text || '',
      topicSnapshot,
    };
    await writeSystemClipboardText(serializeTopic(topicSnapshot, 0));
    new Notice(this.t('notice.topicWithAttributesCopied'));
    return true;
  },

  async pasteTopicWithAttributesForShortcut(topic) {
    if (!this.canEditMindMap()) return false;
    if (!topic || topic._virtual) return false;

    const snapshot = cloneClipboardTopicSnapshot({
      includeAttributes: true,
      includeSubtopics: true,
    });
    const pastedTopics = snapshot
      ? [snapshot]
      : await this.createTopicsFromSystemClipboardForPaste(topic);

    if (!pastedTopics.length) {
      new Notice(this.t('notice.topicClipboardEmpty'));
      return false;
    }

    for (const pastedTopic of pastedTopics) {
      topic.subtopics.push(pastedTopic);
    }
    this.collapsedIds.delete(topic.id);
    assignIds(this.root, '0');
    refreshTreeLevels(this.root);

    const topicId = pastedTopics[0].id;
    this.rememberTopicFocusState(topicId, { focusSvg: true });
    const saved = await this.saveTreeToSourceAndFile(this.t('notice.topicPasted'));
    return saved ? { saved, topicId } : false;
  },

  async createTopicsFromSystemClipboardForPaste(topic) {
    const clipboardText = await readSystemClipboardText();
    const pastedTopics = parseTopicsFromClipboardText(clipboardText, {
      includeAttributes: true,
      includeSubtopics: true,
    });

    if (!pastedTopics.length && String(clipboardText || '').trim()) {
      return [createTopicFromText(clipboardText, (topic.level || 1) + 1)];
    }

    return pastedTopics;
  },
};
