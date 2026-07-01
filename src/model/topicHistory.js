/*
 * 文件作用：
 * 导图主题历史记录方法集合，负责撤销和重做经主题树保存入口产生的变更。
 *
 * 实现逻辑：
 * saveTreeToSourceAndFile() 写入新源码前，会把当前源码压入撤销栈。
 * 撤销/重做时直接恢复完整 yxmm 源码，再重新解析、同步源码视图并渲染导图。
 */

import {
  Notice,
  parseMindDocument,
  VIEW_MODE_KEY_SOURCE_TRUNCATE_LENGTH,
} from '../shared/rendererShared.js';

// 每个代码块最多保留的撤销快照数量，避免大导图多次编辑后无限增长。
const MAX_TOPIC_HISTORY_SIZE = 80;
// 主题历史只用于跨 Obsidian 短时重建恢复，不做长期持久化。
const TOPIC_HISTORY_MEMORY_EXPIRY_MS = 30 * 60 * 1000;

export const topicHistoryMethods = {
  initializeTopicHistoryMemory() {
    const record = this.readTopicHistoryMemory();
    if (!record) return;

    this.topicUndoStack = [...record.undoStack];
    this.topicRedoStack = [...record.redoStack];
  },

  topicHistoryMemoryKey() {
    const sourcePath = this.ctx?.sourcePath || 'unknown';
    const sectionInfo =
      this.ctx && typeof this.ctx.getSectionInfo === 'function'
        ? this.ctx.getSectionInfo(this.hostEl)
        : null;

    if (sectionInfo) {
      return `${sourcePath}:history:${sectionInfo.lineStart}`;
    }

    if (this.editorContext && Number.isFinite(this.editorContext.contentFrom)) {
      return `${sourcePath}:history:editor:${this.editorContext.contentFrom}`;
    }

    const sourcePreview = String(this.source || '').slice(0, VIEW_MODE_KEY_SOURCE_TRUNCATE_LENGTH);
    return `${sourcePath}:history:${sourcePreview}`;
  },

  readTopicHistoryMemory() {
    const key = this.topicHistoryMemoryKey();
    const record = this.constructor.topicHistoryMemory.get(key);
    if (!record || record.expiresAt < Date.now()) {
      this.constructor.topicHistoryMemory.delete(key);
      return null;
    }

    return {
      undoStack: record.undoStack || [],
      redoStack: record.redoStack || [],
    };
  },

  writeTopicHistoryMemory() {
    const key = this.topicHistoryMemoryKey();
    if (!this.topicUndoStack.length && !this.topicRedoStack.length) {
      this.constructor.topicHistoryMemory.delete(key);
      return;
    }

    this.constructor.topicHistoryMemory.set(key, {
      undoStack: [...this.topicUndoStack],
      redoStack: [...this.topicRedoStack],
      expiresAt: Date.now() + TOPIC_HISTORY_MEMORY_EXPIRY_MS,
    });
  },

  pushTopicUndoSnapshot(source) {
    if (this.suppressTopicHistorySnapshot) return;

    const snapshot = String(source || '');
    if (!snapshot.trim()) return;
    if (this.topicUndoStack[this.topicUndoStack.length - 1] === snapshot) return;

    this.topicUndoStack.push(snapshot);
    if (this.topicUndoStack.length > MAX_TOPIC_HISTORY_SIZE) {
      this.topicUndoStack.splice(0, this.topicUndoStack.length - MAX_TOPIC_HISTORY_SIZE);
    }
    this.topicRedoStack.length = 0;
    this.writeTopicHistoryMemory();
  },

  async undoTopicChange() {
    if (!this.topicUndoStack.length) {
      new Notice(this.t('notice.undoUnavailable'));
      return false;
    }

    const previousSource = this.topicUndoStack.pop();
    const currentSource = String(this.source || '');
    // 保存 Markdown 可能立即触发 Obsidian 重建代码块，所以先写回共享历史。
    this.topicRedoStack.push(currentSource);
    this.writeTopicHistoryMemory();

    const applied = await this.applyTopicHistorySource(
      previousSource,
      this.t('notice.undoApplied')
    );
    if (applied) return true;

    this.topicUndoStack.push(previousSource);
    this.topicRedoStack.pop();
    this.writeTopicHistoryMemory();
    return false;
  },

  async redoTopicChange() {
    if (!this.topicRedoStack.length) {
      new Notice(this.t('notice.redoUnavailable'));
      return false;
    }

    const nextSource = this.topicRedoStack.pop();
    const currentSource = String(this.source || '');
    // 同 undo：先移动历史栈并写回，避免代码块重建后丢失 redo 后的 undo 状态。
    this.topicUndoStack.push(currentSource);
    this.writeTopicHistoryMemory();

    const applied = await this.applyTopicHistorySource(nextSource, this.t('notice.redoApplied'));
    if (applied) return true;

    this.topicRedoStack.push(nextSource);
    this.topicUndoStack.pop();
    this.writeTopicHistoryMemory();
    return false;
  },

  async applyTopicHistorySource(source, successMessage) {
    const nextSource = String(source || '');
    let document;

    try {
      document = parseMindDocument(nextSource);
    } catch (error) {
      new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      return false;
    }

    if (!document.root) return false;

    if (this.isFullscreen || this.isWindowFullscreen) {
      // 全屏期间直接写 Markdown 会触发 Obsidian 重建代码块并打断全屏。
      // 这里复用全屏待保存流程，退出全屏后再统一落盘。
      this.applyTopicHistoryDocument(document, nextSource);
      this._pendingFullscreenSave = nextSource;
      this.writeFullscreenDraftSnapshot(nextSource);
      new Notice(successMessage);
      return true;
    }

    this.suppressTopicHistorySnapshot = true;
    let saved;
    try {
      saved = await this.saveSourceToMarkdownFile(nextSource);
    } finally {
      this.suppressTopicHistorySnapshot = false;
    }
    if (!saved) return false;

    this.applyTopicHistoryDocument(document, nextSource);
    new Notice(successMessage);
    return true;
  },

  applyTopicHistoryDocument(document, nextSource) {
    this.root = document.root;
    this.source = nextSource;
    this.rawConfig = document.rawConfig || {};
    this.refreshNormalizedConfig();
    this.hasConfigBlock = document.hasConfig;
    this.syncSourceInput();
    this.applyRuntimeConfigToView();
    this.renderMap(true);
  },
};
