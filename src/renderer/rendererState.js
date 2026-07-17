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

import { SESSION_VIEW_MODE_EXPIRY_MS } from '../shared/rendererShared.js';
import {
  codeBlockMemoryKey,
  deleteSessionMemory,
  getSessionMemory,
  setSessionMemory,
} from '../shared/sessionMemory.js';

// 源码状态只用于跨过 Obsidian 重建后的短暂提示，不应像视图模式一样长时间保留。
const SOURCE_STATUS_MEMORY_EXPIRY_MS = 8000;
const VIEW_MODE_MEMORY_MAX_ENTRIES = 200;
const SOURCE_STATUS_MEMORY_MAX_ENTRIES = 100;
const TOPIC_FOCUS_MEMORY_MAX_ENTRIES = 200;

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
      // 源码视图是懒创建的；重建时如果直接套 is-source-mode class 而不创建 DOM，会出现空白框。
      this.ensureSourceViewCreated();
      this.syncSourceInput();
      this.restoreRememberedSourceStatus();
      this.scheduleSourceModeHeight();
    }

    this.updateToggleViewButton();
  },

  rememberViewModeConfig() {
    this.writeSessionViewMode(this.isSourceMode ? 'source' : 'map');
  },

  readSessionViewMode() {
    const key = this.viewModeMemoryKey();
    const record = getSessionMemory(this.constructor.viewModeMemory, key);
    return record?.mode || 'map';
  },

  writeSessionViewMode(mode, source = this.source) {
    setSessionMemory(
      this.constructor.viewModeMemory,
      this.viewModeMemoryKey(source),
      { mode },
      {
        ttlMs: SESSION_VIEW_MODE_EXPIRY_MS,
        maxEntries: VIEW_MODE_MEMORY_MAX_ENTRIES,
      }
    );
  },

  writeSourceStatusMemory(type, messageKey, source = this.source) {
    setSessionMemory(
      this.constructor.sourceStatusMemory,
      this.viewModeMemoryKey(source),
      { type, messageKey },
      {
        ttlMs: SOURCE_STATUS_MEMORY_EXPIRY_MS,
        maxEntries: SOURCE_STATUS_MEMORY_MAX_ENTRIES,
      }
    );
  },

  rememberSourceModeAcrossSave(nextSource, status = null) {
    /*
     * 保存源码时有两个容易丢状态的窗口：
     * 1. vault.modify() 触发 Obsidian 立即重建，新 renderer 可能抢在旧实例保存后续状态前启动；
     * 2. sectionInfo 不可用时，viewModeMemoryKey() 会退回到源码前缀，保存前后的源码不同会得到两个 key。
     *
     * 因此这里同时写“旧源码 key”和“新源码 key”。sectionInfo 可用时两个 key 会自然合并成同一个行号 key；
     * sectionInfo 不可用时也能覆盖保存前后两种 fallback key，避免偶发回到导图模式。
     */
    const sources = new Set([String(this.source || ''), String(nextSource || '')]);
    for (const source of sources) {
      this.writeSessionViewMode('source', source);
      if (status?.type && status?.messageKey) {
        this.writeSourceStatusMemory(status.type, status.messageKey, source);
      }
    }
  },

  restoreRememberedSourceStatus() {
    const key = this.viewModeMemoryKey();
    const record = getSessionMemory(this.constructor.sourceStatusMemory, key);
    if (!record) return;

    // 状态提示是一次性的：新实例接手显示后即删除，避免很久以后再次打开还看到旧的“已保存”。
    deleteSessionMemory(this.constructor.sourceStatusMemory, key);
    if (!record.messageKey) return;

    this.updateSourceStatus(this.t(record.messageKey), record.type);
  },

  viewModeMemoryKey(source = this.source) {
    return codeBlockMemoryKey(this.ctx, this.hostEl, this.editorContext, source);
  },

  topicFocusMemoryKey() {
    return codeBlockMemoryKey(this.ctx, this.hostEl, this.editorContext, this.source);
  },

  readRememberedTopicFocusState() {
    const key = this.topicFocusMemoryKey();
    const record = getSessionMemory(this.constructor.topicFocusMemory, key);
    if (!record) return null;

    return {
      topicId: record.topicId || '',
      focusSvg: Boolean(record.focusSvg),
    };
  },

  rememberFocusedTopic(options = {}) {
    if (!this.focusedTopicId) {
      const key = this.topicFocusMemoryKey();
      deleteSessionMemory(this.constructor.topicFocusMemory, key);
      return;
    }

    this.rememberTopicFocusState(this.focusedTopicId, options);
  },

  rememberTopicFocusState(topicId, options = {}) {
    if (!topicId) return;

    const key = this.topicFocusMemoryKey();
    setSessionMemory(
      this.constructor.topicFocusMemory,
      key,
      {
        topicId,
        focusSvg: Boolean(options.focusSvg),
      },
      {
        ttlMs: SESSION_VIEW_MODE_EXPIRY_MS,
        maxEntries: TOPIC_FOCUS_MEMORY_MAX_ENTRIES,
      }
    );
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
