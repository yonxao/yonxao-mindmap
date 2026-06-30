/*
 * 文件作用：
 * 渲染器状态方法集合，负责源码/导图视图模式记忆、提示信息和翻译兜底。
 *
 * 实现逻辑：
 * 视图模式按代码块位置短时缓存，避免源码模式切换导致重建后丢失用户当前视图。
 *
 * 调用链：
 * YonxaoMindmapRenderer -> rendererStateMethods -> toolbar/source/map 状态同步。
 */

import {
  SESSION_VIEW_MODE_EXPIRY_MS,
  VIEW_MODE_KEY_SOURCE_TRUNCATE_LENGTH,
} from '../shared/rendererShared.js';

export const rendererStateMethods = {
  applyConfiguredViewMode() {
    const shouldUseSourceMode = this.readSessionViewMode() === 'source';
    this.isSourceMode = shouldUseSourceMode;

    if (this.containerEl) {
      this.containerEl.classList.toggle('is-source-mode', this.isSourceMode);
    }
    this.hostEl?.classList.toggle('is-source-mode', this.isSourceMode);

    for (const button of this.mapActionButtons) {
      button.disabled = this.isSourceMode;
    }

    if (this.isSourceMode) {
      this.closeTopicEditor();
      this.syncSourceInput();
      this.scheduleSourceModeHeight();
    }

    this.updateToggleViewButton();
  },

  rememberViewModeConfig() {
    this.writeSessionViewMode(this.isSourceMode ? 'source' : 'map');
  },

  readSessionViewMode() {
    const key = this.viewModeMemoryKey();
    const record = this.constructor.viewModeMemory.get(key);
    if (!record || record.expiresAt < Date.now()) {
      this.constructor.viewModeMemory.delete(key);
      return 'map';
    }

    return record.mode;
  },

  writeSessionViewMode(mode) {
    this.constructor.viewModeMemory.set(this.viewModeMemoryKey(), {
      mode,
      expiresAt: Date.now() + SESSION_VIEW_MODE_EXPIRY_MS,
    });
  },

  viewModeMemoryKey() {
    const sourcePath = this.ctx?.sourcePath || 'unknown';
    const sectionInfo =
      this.ctx && typeof this.ctx.getSectionInfo === 'function'
        ? this.ctx.getSectionInfo(this.hostEl)
        : null;

    if (sectionInfo) {
      return `${sourcePath}:${sectionInfo.lineStart}`;
    }

    return `${sourcePath}:${String(this.source || '').slice(0, VIEW_MODE_KEY_SOURCE_TRUNCATE_LENGTH)}`;
  },

  topicFocusMemoryKey() {
    const sourcePath = this.ctx?.sourcePath || 'unknown';
    const sectionInfo =
      this.ctx && typeof this.ctx.getSectionInfo === 'function'
        ? this.ctx.getSectionInfo(this.hostEl)
        : null;

    if (sectionInfo) {
      return `${sourcePath}:${sectionInfo.lineStart}`;
    }

    if (this.editorContext && Number.isFinite(this.editorContext.contentFrom)) {
      return `${sourcePath}:editor:${this.editorContext.contentFrom}`;
    }

    return `${sourcePath}:${String(this.source || '').slice(0, VIEW_MODE_KEY_SOURCE_TRUNCATE_LENGTH)}`;
  },

  readRememberedTopicFocusState() {
    const key = this.topicFocusMemoryKey();
    const record = this.constructor.topicFocusMemory.get(key);
    if (!record || record.expiresAt < Date.now()) {
      this.constructor.topicFocusMemory.delete(key);
      return null;
    }

    return {
      topicId: record.topicId || '',
      focusSvg: Boolean(record.focusSvg),
    };
  },

  rememberFocusedTopic(options = {}) {
    if (!this.focusedTopicId) {
      const key = this.topicFocusMemoryKey();
      this.constructor.topicFocusMemory.delete(key);
      return;
    }

    this.rememberTopicFocusState(this.focusedTopicId, options);
  },

  rememberTopicFocusState(topicId, options = {}) {
    if (!topicId) return;

    const key = this.topicFocusMemoryKey();
    this.constructor.topicFocusMemory.set(key, {
      topicId,
      focusSvg: Boolean(options.focusSvg),
      expiresAt: Date.now() + SESSION_VIEW_MODE_EXPIRY_MS,
    });
  },

  t(key, replacements) {
    return this.plugin?.t?.(key, replacements) || key;
  },

  renderMessage(message, isError) {
    if (!this.hostEl) return;
    this.hostEl.textContent = '';
    const messageEl = document.createElement('div');
    messageEl.className = isError
      ? 'yonxao-mindmap-message yonxao-mindmap-message-error'
      : 'yonxao-mindmap-message';
    messageEl.textContent = message;
    this.hostEl.appendChild(messageEl);
  },
};
