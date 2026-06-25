/*
 * 文件作用：
 * 渲染器上下文方法集合，负责生命周期注册、源码解析、渲染入口和统一重绘。
 *
 * 实现逻辑：
 * 这些方法连接 Obsidian 代码块上下文、解析器、布局渲染和 UI 状态，是各分片共享的协调层。
 *
 * 调用链：
 * Markdown code block processor -> YonxaoMindmapRenderer -> rendererContextMethods。
 */

import {
  Notice,
  setIcon,
  canonicalizeMindConfig,
  hasMeaningfulConfig,
  serializeMindSource,
  markYonxaoMindmapEmbedWrapper,
  assignIds,
  createMindTopic,
  parseMindDocument,
  serializeMindDocument,
  ConfigModal,
} from '../shared/rendererShared.js';

export const rendererContextMethods = {
  onunload() {
    this.closeTopicEditor();
    this.closeInlineTextEditor(false);
    this.cleanupFullscreenOverlay();
    this.hostEl?.classList.remove('is-fullscreen');
    this.restoreToolbarToBody();
    if (this.topicEditorEl) {
      this.topicEditorEl.remove();
    }
    this.topicEditorEl = null;
    this.topicEditorFields = null;
    this.topicEditorInheritedValues = null;
    if (this.topicContentEditorEl) {
      this.topicContentEditorEl.remove();
    }
    this.topicContentEditorEl = null;
    this.topicContentEditorInput = null;
    if (this.pendingToolbarHideTimer) {
      window.clearTimeout(this.pendingToolbarHideTimer);
      this.pendingToolbarHideTimer = null;
    }
    if (this.pendingToolbarScrollTimer) {
      window.clearTimeout(this.pendingToolbarScrollTimer);
      this.pendingToolbarScrollTimer = null;
    }
    if (this.toolbarEl) {
      this.toolbarEl.remove();
    }
    this.toolbarEl = null;
    if (this.containerResizeObserver) {
      this.containerResizeObserver.disconnect();
      this.containerResizeObserver = null;
    }
  },

  mount() {
    this.hostEl.textContent = '';
    this.hostEl.classList.add('yonxao-mindmap-host');
    markYonxaoMindmapEmbedWrapper(this.hostEl);
    let parseError = '';

    // 先解析，再创建 DOM。解析失败时给用户一个清晰的错误块，避免空白区域。
    try {
      this.root = this.parseAndApplyDocument(this.source);
    } catch (error) {
      parseError = `源码解析失败：${error.message || String(error)}`;
    }

    if (!this.root) {
      parseError = parseError || '源码为空，请在源码模式中编辑后保存。';
      this.root = createMindTopic('Mind', {}, []);
      assignIds(this.root, '0');
    }

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'yonxao-mindmap-container';
    this.hostEl.appendChild(this.containerEl);

    this.createToolbar();
    this.createSvg();
    this.createSourceView();
    this.createTopicEditor();
    this.createHeightResizeHandle();
    this.applyRuntimeConfigToView();
    this.installContainerResizeObserver();
    this.installEventBoundary();
    this.renderMap(true);
    if (parseError) {
      this.showSourceMode(parseError);
    }
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();

    this.registerDomEvent(window, 'resize', () => {
      this.scheduleFitView();
      this.scheduleApplyToolbarPosition();
    });
    this.installToolbarScrollListeners();
  },

  parseAndApplyDocument(source) {
    const document = parseMindDocument(source);
    this.rawConfig = canonicalizeMindConfig(document.rawConfig || {});
    this.refreshNormalizedConfig();
    this.hasConfigBlock = document.hasConfig;
    return document.root;
  },

  canEditMindMap() {
    if (this.editorContext) return true;
    if (!this.hostEl || !this.hostEl.closest) return false;

    if (this.hostEl.closest('.markdown-reading-view, .markdown-preview-view')) {
      return false;
    }

    return Boolean(this.hostEl.closest('.markdown-source-view, .cm-embed-block, .cm-editor'));
  },

  applyRuntimeConfigToView() {
    this.applyConfiguredCanvasHeight();
    this.applyConfiguredViewMode();
    this.scheduleApplyToolbarPosition();
  },

  installContainerResizeObserver() {
    if (
      !this.containerEl ||
      typeof window === 'undefined' ||
      typeof window.ResizeObserver !== 'function'
    ) {
      return;
    }

    this.containerResizeObserver = new window.ResizeObserver((entries) => {
      const entry = entries[0];
      const width =
        entry?.contentRect?.width || this.containerEl?.getBoundingClientRect().width || 0;
      if (!width || Math.abs(width - this.lastObservedContainerWidth) < 1) return;

      this.lastObservedContainerWidth = width;
      this.scheduleFitView();
      this.scheduleApplyToolbarPosition();
    });
    this.containerResizeObserver.observe(this.containerEl);
  },

  installEventBoundary() {
    /*
     * Live Preview 不是普通网页环境：Obsidian 的外层仍然是一个 CodeMirror 编辑器。
     * 如果插件内部的 click / keydown / input 等事件继续向外冒泡，外层编辑器可能会尝试接管焦点、
     * 弹出“编辑这个区块”的内置按钮，或者把 textarea 的按键当成 Markdown 编辑器按键处理。
     *
     * 这里做一个“事件边界”：事件仍然可以在插件内部正常流动，所以工具栏、SVG 主题、源码编辑框都能工作；
     * 但事件到达 yonxao-mindmap 根元素后就停止，不再交给 CodeMirror/Obsidian 的嵌入块控制层。
     * 阅读视图里启用这个边界也没有副作用，因为它只作用于当前导图容器内部。
     */
    for (const eventName of [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'pointerdown',
      'pointerup',
      'keydown',
      'keyup',
      'input',
      'change',
      'wheel',
    ]) {
      this.registerDomEvent(this.hostEl, eventName, (event) => {
        event.stopPropagation();
      });
    }
  },

  async toggleSourceMode() {
    // 如果用户在源码模式已经改过内容，切回导图前先尝试保存。
    // 这样可以保证“导图视图看到的内容”和“Markdown 文件里的源码”是一致的。
    if (this.isSourceMode && this.sourceDirty) {
      const saved = await this.saveFromSourceView();
      if (!saved) return;
    }

    this.isSourceMode = !this.isSourceMode;
    this.containerEl.classList.toggle('is-source-mode', this.isSourceMode);
    this.hostEl.classList.toggle('is-source-mode', this.isSourceMode);
    this.rememberViewModeConfig();

    // 源码模式只是用来核对 yxmm 文本，缩放/适配这些 SVG 操作在这里禁用掉。
    for (const button of this.mapActionButtons) {
      button.disabled = this.isSourceMode;
    }

    if (this.isSourceMode) {
      this.closeTopicEditor();
      this.syncSourceInput();
      this.scheduleSourceModeHeight();
    } else {
      this.applyConfiguredCanvasHeight();
      this.renderMap(true, { growManualHeight: true });
    }

    this.updateToggleViewButton();
  },

  showSourceMode(statusMessage) {
    this.isSourceMode = true;
    this.containerEl.classList.add('is-source-mode');
    this.hostEl.classList.add('is-source-mode');

    for (const button of this.mapActionButtons) {
      button.disabled = true;
    }

    this.closeTopicEditor();
    this.syncSourceInput();
    this.updateSourceStatus(statusMessage);
    this.rememberViewModeConfig();
    this.updateToggleViewButton();
    this.scheduleSourceModeHeight();
  },

  updateToggleViewButton() {
    if (!this.toggleViewButton) return;

    const label = this.isSourceMode ? this.t('toolbar.showMap') : this.t('toolbar.showSource');
    const icon = this.isSourceMode ? 'git-branch' : 'code-2';
    this.toggleViewButton.setAttribute('aria-label', label);
    this.toggleViewButton.setAttribute('aria-pressed', String(this.isSourceMode));
    this.toggleViewButton.textContent = '';

    try {
      setIcon(this.toggleViewButton, icon);
    } catch (_error) {
      this.toggleViewButton.textContent = this.isSourceMode
        ? this.t('toolbar.mapFallback')
        : this.t('toolbar.sourceFallback');
    }
  },

  updateViewFitButton() {
    if (!this.viewFitButton) return;

    const isFit = this.currentViewFitMode === 'fit';
    const label = isFit ? this.t('toolbar.originalSize') : this.t('toolbar.fitView');
    const icon = isFit ? 'minimize' : 'maximize';
    this.viewFitButton.setAttribute('aria-label', label);
    this.viewFitButton.setAttribute('aria-pressed', String(isFit));
    this.viewFitButton.textContent = '';

    try {
      setIcon(this.viewFitButton, icon);
    } catch (_error) {
      this.viewFitButton.textContent = label;
    }
  },

  updateFullscreenButton() {
    if (!this.fullscreenButton) return;

    const label = this.isFullscreen
      ? this.t('toolbar.exitFullscreen')
      : this.t('toolbar.enterFullscreen');
    const icon = this.isFullscreen ? 'minimize-2' : 'maximize-2';
    this.fullscreenButton.setAttribute('aria-label', label);
    this.fullscreenButton.setAttribute('aria-pressed', String(this.isFullscreen));
    this.fullscreenButton.textContent = '';

    try {
      setIcon(this.fullscreenButton, icon);
    } catch (_error) {
      this.fullscreenButton.textContent = label;
    }
  },

  openConfigModal() {
    const modal = new ConfigModal(this.plugin.app, {
      t: this.t.bind(this),
      baseConfig: this.plugin?.getGlobalDefaultValueConfig?.() || {},
      rawConfig: this.documentConfigForSave(this.rawConfig),
      onApply: async (nextConfig) => this.applyConfigFromModal(nextConfig),
    });
    modal.open();
  },

  async applyConfigFromModal(nextConfig) {
    const rawConfig = this.documentConfigForSave(nextConfig);
    const shouldWriteConfig = hasMeaningfulConfig(rawConfig);
    let nextRoot = this.root;
    let nextSource;

    if (this.isSourceMode && this.sourceInputEl) {
      let document;

      try {
        document = parseMindDocument(this.composeSourceFromSourceInputs());
      } catch (error) {
        new Notice(`yonxao-mindmap: 源码解析失败，暂未保存配置：${error.message || String(error)}`);
        this.updateSourceStatus('源码解析失败，请修正后再保存配置。');
        return false;
      }

      if (!document.root) {
        new Notice('yonxao-mindmap: 源码为空，暂未保存配置。');
        this.updateSourceStatus('源码为空，暂未保存配置。');
        return false;
      }

      nextRoot = document.root;
      nextSource = serializeMindSource(
        rawConfig,
        document.body,
        shouldWriteConfig,
        this.plugin?.getGlobalDefaultValueConfig?.() || {}
      );
    } else {
      nextSource = serializeMindDocument(
        this.root,
        rawConfig,
        shouldWriteConfig,
        this.plugin?.getGlobalDefaultValueConfig?.() || {}
      );
    }

    const saved = await this.saveSourceToMarkdownFile(nextSource);
    if (!saved) return false;

    this.root = nextRoot;
    this.source = nextSource;
    this.rawConfig = canonicalizeMindConfig(rawConfig);
    this.refreshNormalizedConfig();
    this.hasConfigBlock = shouldWriteConfig;
    this.syncSourceInput();
    this.applyRuntimeConfigToView();

    if (this.isSourceMode) {
      this.scheduleSourceModeHeight();
    } else {
      this.renderMap(true);
    }

    new Notice(this.t('notice.configSaved'));
    return { saved: true, rawConfig };
  },
};
