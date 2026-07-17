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
  setTooltip,
  canonicalizeMindConfig,
  hasMeaningfulConfig,
  markYonxaoMindmapEmbedWrapper,
  assignIds,
  createMindTopic,
  parseMindDocument,
  serializeMindDocument,
  ConfigModal,
  RESIZE_WIDTH_EPSILON,
} from '../shared/rendererShared.js';

import {
  ICON_TOGGLE_SOURCE,
  ICON_TOGGLE_MAP,
  ICON_FIT_VIEW,
  ICON_ORIGINAL_SIZE,
  ICON_FULLSCREEN_ENTER,
  ICON_FULLSCREEN_EXIT,
  ICON_WINDOW_FULLSCREEN_ENTER,
  ICON_WINDOW_FULLSCREEN_EXIT,
} from '../icons/iconNames.js';

export const rendererContextMethods = {
  onunload() {
    // 卸载时取消正在进行的结构控制柄拖拽，避免未释放的指针事件残留。
    this.cancelStructureControlDrag?.();
    // 移除结构选中底部操作栏 DOM，避免卸载后仍有浮层挂载在 body 上。
    this.removeStructureSelectionBar?.();
    this.closeTopicEditor();
    this.closeInlineTextEditor(false);
    this.hideTopicAdornmentPopover?.();
    this.closeTopicImagePreview?.();
    this.fullscreenConfirmEl?.remove();
    this.fullscreenConfirmEl = null;
    // 在清理全屏之前先刷写待保存数据，避免 Obsidian 重渲染导致数据丢失
    if (this._pendingFullscreenSave) {
      this._flushPendingFullscreenSave();
    }
    this.cleanupFullscreenOverlay();
    this.cleanupWindowFullscreenOverlay();
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
    if (this.pendingFitFrame) {
      window.cancelAnimationFrame(this.pendingFitFrame);
      this.pendingFitFrame = null;
    }
    if (this.pendingToolbarFrame) {
      window.cancelAnimationFrame(this.pendingToolbarFrame);
      this.pendingToolbarFrame = null;
    }
    if (this.pendingSourceHeightFrame) {
      window.cancelAnimationFrame(this.pendingSourceHeightFrame);
      this.pendingSourceHeightFrame = null;
    }
    if (this.pendingMapFocusFrame) {
      window.cancelAnimationFrame(this.pendingMapFocusFrame);
      this.pendingMapFocusFrame = null;
    }
    if (this.pendingTopicImageNaturalSizeFrame) {
      window.cancelAnimationFrame(this.pendingTopicImageNaturalSizeFrame);
      this.pendingTopicImageNaturalSizeFrame = null;
    }
    if (this.pendingMapFocusTimer) {
      window.clearTimeout(this.pendingMapFocusTimer);
      this.pendingMapFocusTimer = null;
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
      // 空代码块：创建兜底根主题，默认展示导图模式而非源码模式
      this.root = createMindTopic('yonxao-mindmap', {}, []);
      assignIds(this.root, '0');
    }
    this.initializeTopicHistoryMemory();
    const rememberedTopicFocus = this.readRememberedTopicFocusState();
    this.focusedTopicId = rememberedTopicFocus?.topicId || '';
    this.initializeFullscreenDraftRecovery();

    this.containerEl = document.createElement('div');
    this.containerEl.className = 'yonxao-mindmap-container';
    this.renderFullscreenDraftRecoveryPrompt();
    this.hostEl.appendChild(this.containerEl);

    this.createToolbar();
    this.createSvg();
    // 源码视图延迟到首次切换源码模式时创建（ensureSourceViewCreated），
    // 避免 mount 时创建大量 DOM 影响首次渲染速度。
    this.createTopicEditor();
    this.createHeightResizeHandle();
    this.applyRuntimeConfigToView();
    this.installContainerResizeObserver();
    this.installEventBoundary();
    this.renderMap(true);
    if (rememberedTopicFocus?.focusSvg && this.focusedTopicId) {
      this.scheduleMapKeyboardFocusRestore();
    }
    if (parseError) {
      this.showSourceMode(parseError);
    }
    this.scheduleApplyToolbarPosition();

    this.registerDomEvent(window, 'resize', () => {
      this.scheduleFitView();
      this.scheduleApplyToolbarPosition();
    });
    this.installToolbarScrollListeners();
  },

  parseAndApplyDocument(source) {
    const document = parseMindDocument(source);
    // 解析后的高级结构定义保存在实例上，供 layout/render 阶段绘制关联、概要和外框。
    this.structures = document.structures || [];
    this.rawConfig = canonicalizeMindConfig(document.rawConfig || {});
    this.refreshNormalizedConfig();
    this.hasConfigBlock = document.hasConfig;
    return document.root;
  },

  canEditMindMap() {
    if (this.editorContext) return true;
    if (!this.hostEl || !this.hostEl.closest) return false;

    /*
     * 全屏时 hostEl 被移到了 body 下的覆盖层，不再位于 Obsidian 编辑器的 DOM 树内，
     * 无法通过 closest() 判断编辑模式。此时使用进入覆盖层前缓存的编辑能力状态。
     */
    if (
      (this.isFullscreen ||
        this._fullscreenRequestPending ||
        this.isWindowFullscreen ||
        this._fsOverlay ||
        this._wfOverlay) &&
      this._canEditBeforeFullscreen !== undefined
    ) {
      return this._canEditBeforeFullscreen;
    }

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
      if (!width || Math.abs(width - this.lastObservedContainerWidth) < RESIZE_WIDTH_EPSILON) {
        return;
      }

      this.lastObservedContainerWidth = width;
      this.scheduleFitView();
      this.scheduleApplyToolbarPosition();
    });
    this.containerResizeObserver.observe(this.containerEl);

    // renderMap(true) 已处理首次适配，记录当前容器宽度避免 ResizeObserver
    // 首次回调重复触发 scheduleFitView
    if (this.containerEl) {
      const initialWidth = this.containerEl.getBoundingClientRect().width || 0;
      if (initialWidth) {
        this.lastObservedContainerWidth = initialWidth;
      }
    }
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
  /*
   * 作用：
   * 确保源码视图已创建。延迟创建可减少 mount 时的 DOM 创建量。
   * 首次切换源码模式时创建，后续复用。
   */
  ensureSourceViewCreated() {
    if (this.sourceEl) return;
    this.createSourceView();
  },
  async toggleSourceMode() {
    // 如果用户在源码模式已经改过内容，切回导图前先尝试保存。
    // 这样可以保证“导图视图看到的内容”和“Markdown 文件里的源码”是一致的。
    if (this.isSourceMode && this.sourceDirty) {
      const saved = await this.saveFromSourceView();
      if (!saved) return;
    }

    if (!this.isSourceMode && this.structureSelection) {
      this.cancelStructureSelection?.({ render: false });
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
      this.ensureSourceViewCreated();
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
    this.ensureSourceViewCreated();
    this.syncSourceInput();
    this.updateSourceStatus(statusMessage);
    this.rememberViewModeConfig();
    this.updateToggleViewButton();
    this.scheduleSourceModeHeight();
  },

  updateToggleViewButton() {
    if (!this.toggleViewButton) return;

    const label = this.isSourceMode ? this.t('toolbar.showMap') : this.t('toolbar.showSource');
    const icon = this.isSourceMode ? ICON_TOGGLE_MAP : ICON_TOGGLE_SOURCE;
    this.toggleViewButton.setAttribute('aria-label', label);
    this.toggleViewButton.setAttribute('aria-pressed', String(this.isSourceMode));
    setTooltip(this.toggleViewButton, label);
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
    const icon = isFit ? ICON_ORIGINAL_SIZE : ICON_FIT_VIEW;
    this.viewFitButton.setAttribute('aria-label', label);
    this.viewFitButton.setAttribute('aria-pressed', String(isFit));
    setTooltip(this.viewFitButton, label);
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
    const icon = this.isFullscreen ? ICON_FULLSCREEN_EXIT : ICON_FULLSCREEN_ENTER;
    this.fullscreenButton.setAttribute('aria-label', label);
    this.fullscreenButton.setAttribute('aria-pressed', String(this.isFullscreen));
    setTooltip(this.fullscreenButton, label);
    this.fullscreenButton.textContent = '';

    try {
      setIcon(this.fullscreenButton, icon);
    } catch (_error) {
      this.fullscreenButton.textContent = label;
    }
  },

  updateWindowFullscreenButton() {
    if (!this.windowFullscreenButton) return;

    const label = this.isWindowFullscreen
      ? this.t('toolbar.exitWindowFullscreen')
      : this.t('toolbar.enterWindowFullscreen');
    const icon = this.isWindowFullscreen
      ? ICON_WINDOW_FULLSCREEN_EXIT
      : ICON_WINDOW_FULLSCREEN_ENTER;
    this.windowFullscreenButton.setAttribute('aria-label', label);
    this.windowFullscreenButton.setAttribute('aria-pressed', String(this.isWindowFullscreen));
    setTooltip(this.windowFullscreenButton, label);
    this.windowFullscreenButton.textContent = '';

    try {
      setIcon(this.windowFullscreenButton, icon);
    } catch (_error) {
      this.windowFullscreenButton.textContent = label;
    }
  },

  async openConfigModal() {
    // 防止在打开配置面板期间重复点击产生无限个不可见实例
    if (this._configModalOpen) return;
    this._configModalOpen = true;

    // 全屏模式下 Obsidian Modal 会被浏览器 top layer 或覆盖层遮挡，
    // 先退出全屏再打开面板，确保用户能看到配置界面。
    if (this.isFullscreen || this.isWindowFullscreen) {
      if (typeof document.exitFullscreen === 'function' && document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch (_error) {
          // 退出全屏失败时静默处理，仍然尝试打开面板
        }
      }
      if (this.isWindowFullscreen) {
        this.toggleWindowFullscreen();
      }
    }

    const modal = new ConfigModal(this.plugin.app, {
      t: this.t.bind(this),
      baseConfig: this.plugin?.getGlobalDefaultValueConfig?.() || {},
      rawConfig: this.documentConfigForSave(this.rawConfig),
      sourcePath: this.ctx?.sourcePath || '',
      watermarkUnlocked: this.plugin.isWatermarkUnlocked(),
      onUnlockWatermark: () => this.plugin.unlockWatermark(),
      onApply: async (nextConfig) => this.applyConfigFromModal(nextConfig),
    });
    modal.open();

    // 模态框关闭后释放锁，允许再次打开
    const originalOnClose = modal.onClose;
    modal.onClose = () => {
      this._configModalOpen = false;
      originalOnClose.call(modal);
    };
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
      // 源码模式保存配置时，用新解析的结构数据更新实例状态。
      this.structures = document.structures || [];
      // 序列化时传入 structures，保证 `@structures` 块在配置变更后仍保留且同步更新。
      nextSource = serializeMindDocument(
        document.root,
        rawConfig,
        shouldWriteConfig,
        this.plugin?.getGlobalDefaultValueConfig?.() || {},
        document.structures || []
      );
    } else {
      // 导图模式下 structures 由实例持有，序列化时直接传入即可。
      nextSource = serializeMindDocument(
        this.root,
        rawConfig,
        shouldWriteConfig,
        this.plugin?.getGlobalDefaultValueConfig?.() || {},
        this.structures
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
