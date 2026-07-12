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
/*
 * 任务列表切换正则。
 *
 * 分组 1：原始缩进、列表符号和左方括号，例如 "  - ["。
 * 分组 2：任务状态字符，只允许空格、x、X。
 * 分组 3：右方括号、后续空格和任务正文。
 *
 * 只替换分组 2，可以最大限度保留用户原始书写格式。
 */
const TASK_LIST_TOGGLE_PATTERN = /^(\s*[-*+]\s+\[)([ xX])(\]\s+.+)$/;

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

function setSharedTopicClipboard(text, topicSnapshot) {
  sharedTopicClipboard = {
    text: text || '',
    topicSnapshot,
  };
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
  /*
   * 切换主题内容中的某一行任务项。
   *
   * sourceLineIndex 来自 richText 解析阶段的原始行号，不使用渲染后的列表下标；
   * 这样即使主题内容中有段落、空行、图片或备注，也能精确改回 topic.text 的对应行。
   */
  async toggleTopicTaskItem(topic, sourceLineIndex, options = {}) {
    // 阅读视图和不可编辑上下文不能改 Markdown。
    if (!this.canEditMindMap()) return false;
    // 虚拟主题不是用户真实输入内容，不能写回某一行任务状态。
    if (!topic || topic._virtual) return false;

    // lineIndex 是 topic.text 的行号；先转成 Number，避免字符串参与后续数组访问。
    const lineIndex = Number(sourceLineIndex);
    // 行号必须是非负整数；无效行号说明解析数据不能安全写回。
    if (!Number.isInteger(lineIndex) || lineIndex < 0) return false;

    // previousText 用于保存失败时恢复内存树。
    const previousText = topic.text || '';
    // 按硬换行拆分，确保 sourceLineIndex 能直接对应 topic.text 的原始行。
    const lines = String(previousText).split('\n');
    // 取出目标行；如果行号越界，后续正则不会匹配并安全返回 false。
    const line = lines[lineIndex] || '';
    // 只允许任务列表行被切换，普通无序列表或段落不能被误改。
    const match = line.match(TASK_LIST_TOGGLE_PATTERN);
    // 目标行不是任务项时直接放弃，避免把用户正文改坏。
    if (!match) return false;

    // 只替换方括号里的状态字符，其他空格、列表符号和正文全部保持原样。
    // x/X 都视为已完成；切回未完成时统一写为空格。
    const nextMarker = match[2].toLowerCase() === 'x' ? ' ' : 'x';
    // 用保留下来的分组重新拼回原行，只改变任务状态字符。
    lines[lineIndex] = `${match[1]}${nextMarker}${match[3]}`;
    // 先更新内存树，后续 serializeMindDocument 会从 this.root 生成新源码。
    topic.text = lines.join('\n');

    // 如果正在内联编辑同一个主题，先关闭编辑框，避免编辑框里的旧内容覆盖勾选结果。
    this.closeInlineTextEditor(false);
    // 保存可能触发 Obsidian 重建代码块，提前记住焦点主题方便新实例恢复。
    this.rememberTopicFocusState(topic.id, { focusSvg: true });
    /*
     * 任务勾选不会改变主题盒尺寸，调用方可以传 render:false 做轻量保存；
     * 保存入口仍会写撤销快照、同步源码，并处理全屏待保存等通用边界。
     */
    const saved = await this.saveTreeToSourceAndFile(this.t('notice.topicContentSaved'), {
      // options.render 默认 true；复选框点击会传 false 来避免不必要重绘。
      render: options.render !== false,
      // options.notice 默认 true；复选框点击会传 false 来避免高频提示。
      notice: options.notice !== false,
    });
    // 保存失败时恢复 topic.text，否则后续任何保存都可能把失败状态写进文件。
    if (!saved) {
      // 保存失败时回滚内存树，避免 SVG 已回滚但后续序列化仍带着失败状态。
      topic.text = previousText;
      return false;
    }
    return true;
  },

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
    setSharedTopicClipboard(text, createTopicFromText(text, topic.level || 1));
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
    setSharedTopicClipboard(
      topic.text || '',
      createTopicFromText(topic.text || '', topic.level || 1)
    );
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
    setSharedTopicClipboard(topic.text || '', topicSnapshot);
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
      // 粘贴时递归移除所有子主题的 stable id，避免粘贴后的主题与源主题共享同一稳定 ID，
      // 导致结构定义引用冲突。新的 stable id 会在后续 assignIds 中重新分配。
      const removeStableIds = (current) => {
        delete current.attributes?.id;
        for (const subtopic of current.subtopics || []) removeStableIds(subtopic);
      };
      removeStableIds(pastedTopic);
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
