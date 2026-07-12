/*
 * 文件作用：
 * 全屏控制方法集合，负责物理全屏覆盖层、窗口全屏覆盖层和工具栏归位。
 *
 * 实现逻辑：
 * 物理全屏通过 body 级覆盖层承载 hostEl，避免 Obsidian/CodeMirror 重渲染移除全屏元素。
 * 窗口全屏不使用 requestFullscreen API，而是通过 CSS 类控制 hostEl 填满 Obsidian 窗口区域。
 *
 * 调用链：
 * 工具栏按钮/快捷操作 -> fullscreenControllerMethods -> document fullscreen API / CSS class toggle。
 */

import { Notice, svg, CONNECTOR_STROKE_WIDTH } from '../shared/rendererShared.js';

export const fullscreenControllerMethods = {
  async toggleFullscreen() {
    if (!this.hostEl || typeof document === 'undefined') return;
    if (this._fullscreenRequestPending) return;

    // 如果处于窗口全屏状态，先退出窗口全屏
    if (this.isWindowFullscreen) {
      this.toggleWindowFullscreen();
    }

    if (this.isFullscreen) {
      if (typeof document.exitFullscreen === 'function') {
        await document.exitFullscreen();
      }
      return;
    }

    this.rememberFullscreenEntryState();
    this._canEditBeforeFullscreen = this.canEditMindMap();
    this._fsOverlay = this.moveHostIntoBodyOverlay(
      'yonxao-mindmap-fs-overlay',
      '_fsOverlay',
      '_hostElParent',
      '_hostElNextSibling'
    );

    if (typeof this._fsOverlay.requestFullscreen !== 'function') {
      this.cleanupFullscreenOverlay();
      new Notice('yonxao-mindmap: 当前环境不支持全屏查看。');
      return;
    }

    this.moveToolbarIntoFullscreenHost();
    this.hostEl.classList.add('is-fullscreen');
    this._fullscreenRequestPending = true;
    try {
      await this._fsOverlay.requestFullscreen();
      if (this._fullscreenRequestPending && this.isOwnPhysicalFullscreenElement()) {
        this.applyFullscreenEntered();
      }
    } catch (error) {
      this._fullscreenRequestPending = false;
      this.hostEl?.classList.remove('is-fullscreen');
      this.restoreToolbarToBody();
      this.cleanupFullscreenOverlay();
      throw error;
    }
  },

  toggleWindowFullscreen() {
    if (!this.hostEl || typeof document === 'undefined') return;

    // 如果处于物理屏幕全屏状态，先退出物理屏幕全屏
    if (this.isFullscreen) {
      if (typeof document.exitFullscreen === 'function') {
        document.exitFullscreen();
      }
      // 等待全屏退出后再进入窗口全屏
      setTimeout(() => {
        this.toggleWindowFullscreen();
      }, 100);
      return;
    }

    if (this.isWindowFullscreen) {
      this.applyWindowFullscreenExited();
    } else {
      this.applyWindowFullscreenEntered();
    }
  },

  applyWindowFullscreenEntered() {
    if (!this.hostEl) return;

    /*
     * 缓存进入覆盖层前的编辑能力状态。
     *
     * 全屏会把 hostEl 移出 Obsidian 编辑器的 DOM 树（挂到 body 下的覆盖层），
     * 导致 canEditMindMap() 通过 hostEl.closest() 无法再定位到编辑容器，
     * 从而让添加/编辑/删除主题等操作失效。
     * 这里提前缓存编辑能力，在全屏期间覆盖 canEditMindMap() 的判断。
     */
    this.rememberFullscreenEntryState();
    this._canEditBeforeFullscreen = this.canEditMindMap();

    this._wfOverlay = this.moveHostIntoBodyOverlay(
      'yonxao-mindmap-wf-overlay',
      '_wfOverlay',
      '_wfHostElParent',
      '_wfHostElNextSibling'
    );

    this.moveToolbarIntoFullscreenHost();
    this.isWindowFullscreen = true;
    this.updateWindowFullscreenButton();
    this.applyFullscreenViewEntered();
  },

  applyWindowFullscreenExited() {
    if (!this.hostEl) return;
    this._canEditBeforeFullscreen = undefined;

    this.restoreHostFromBodyOverlay('_wfOverlay', '_wfHostElParent', '_wfHostElNextSibling');

    this.restoreToolbarToBody();
    this.isWindowFullscreen = false;
    this.updateWindowFullscreenButton();
    this.applyFullscreenViewExited();
  },

  /*
   * 全屏幕状态变更处理。注意全屏幕 API 的事件可能来自本插件之外（如 Obsidian 本身
   * 或其他插件），因此需要双重守卫：进入全屏时检查 hostEl 是否标记了 is-fullscreen，
   * 退出全屏时检查 isFullscreen 内部状态。避免误触发其他全屏实例的状态切换。
   */
  handleFullscreenChange() {
    if (typeof document === 'undefined') return;

    if (document.fullscreenElement) {
      if (
        !this.hostEl?.classList.contains('is-fullscreen') ||
        !this.isOwnPhysicalFullscreenElement(document.fullscreenElement)
      ) {
        return;
      }
      this.applyFullscreenEntered();
    } else {
      if (
        !this.isFullscreen &&
        !this._fullscreenRequestPending &&
        !this.hostEl?.classList.contains('is-fullscreen')
      ) {
        return;
      }
      this._fullscreenRequestPending = false;
      this.cleanupFullscreenOverlay();
      this.applyFullscreenExited();
    }
  },

  isOwnPhysicalFullscreenElement(
    element = typeof document === 'undefined' ? null : document.fullscreenElement
  ) {
    return Boolean(element && (element === this.hostEl || element === this._fsOverlay));
  },

  isPhysicalFullscreenActiveOrPending() {
    if (typeof document === 'undefined') {
      return Boolean(this.isFullscreen || this._fullscreenRequestPending);
    }

    return Boolean(
      this.isFullscreen ||
      this._fullscreenRequestPending ||
      this.hostEl?.classList.contains('is-fullscreen') ||
      this.isOwnPhysicalFullscreenElement(document.fullscreenElement)
    );
  },

  isFullscreenViewportActive() {
    return Boolean(
      this.isPhysicalFullscreenActiveOrPending() ||
      this.isWindowFullscreen ||
      this._wfOverlay ||
      this.hostEl?.classList.contains('is-window-fullscreen')
    );
  },

  /*
   * 全屏和窗口全屏都要先把 hostEl 移到 body 级覆盖层。
   *
   * 业务边界：
   * - 不直接对编辑视图里的 hostEl 请求物理全屏，避免 Obsidian/CodeMirror 重建代码块时
   *   把浏览器的 fullscreenElement 从 DOM 中移除。
   * - 保存原父节点和 nextSibling，退出时尽量回到原位置；如果 nextSibling 已被重建移除，
   *   则退化为 appendChild，保证 hostEl 仍回到原父节点。
   */
  moveHostIntoBodyOverlay(className, overlayKey, parentKey, nextSiblingKey) {
    const overlay = document.createElement('div');
    overlay.className = className;
    this[parentKey] = this.hostEl.parentNode;
    this[nextSiblingKey] = this.hostEl.nextSibling;
    document.body.appendChild(overlay);
    overlay.appendChild(this.hostEl);
    this[overlayKey] = overlay;
    return overlay;
  },

  restoreHostFromBodyOverlay(overlayKey, parentKey, nextSiblingKey) {
    const parent = this[parentKey];
    const nextSibling = this[nextSiblingKey];
    if (parent && this.hostEl) {
      if (nextSibling && nextSibling.parentNode === parent) {
        parent.insertBefore(this.hostEl, nextSibling);
      } else {
        parent.appendChild(this.hostEl);
      }
    }

    this[overlayKey]?.remove();
    this[overlayKey] = null;
    this[parentKey] = null;
    this[nextSiblingKey] = null;
  },

  rememberFullscreenEntryState() {
    this._fullscreenFocusTopicId = this.focusedTopicId || '';
    this._fullscreenScrollSnapshot = this.captureFullscreenScrollSnapshot();
  },

  captureFullscreenScrollSnapshot() {
    if (typeof document === 'undefined') return null;

    const snapshot = [];
    if (typeof window !== 'undefined') {
      snapshot.push({
        type: 'window',
        x:
          window.scrollX ||
          document.scrollingElement?.scrollLeft ||
          document.documentElement?.scrollLeft ||
          0,
        y:
          window.scrollY ||
          document.scrollingElement?.scrollTop ||
          document.documentElement?.scrollTop ||
          0,
      });
    }

    let element = this.hostEl?.parentElement || null;
    while (element && element !== document.body && element !== document.documentElement) {
      if (this.isFullscreenScrollSnapshotElement(element)) {
        snapshot.push({
          type: 'element',
          element,
          left: element.scrollLeft || 0,
          top: element.scrollTop || 0,
        });
      }
      element = element.parentElement;
    }

    return snapshot;
  },

  isFullscreenScrollSnapshotElement(element) {
    return Boolean(
      element &&
      (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth)
    );
  },

  restoreFullscreenScrollSnapshot() {
    const snapshot = this._fullscreenScrollSnapshot;
    if (!snapshot?.length) {
      this._fullscreenScrollSnapshot = null;
      return;
    }

    const restore = () => {
      for (const entry of snapshot) {
        if (entry.type === 'window' && typeof window !== 'undefined') {
          window.scrollTo(entry.x || 0, entry.y || 0);
        } else if (entry.type === 'element' && entry.element?.isConnected) {
          entry.element.scrollLeft = entry.left || 0;
          entry.element.scrollTop = entry.top || 0;
        }
      }
    };

    restore();
    if (typeof window !== 'undefined') {
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(restore);
      }
      window.setTimeout(restore, 0);
    }
    this._fullscreenScrollSnapshot = null;
  },

  cleanupFullscreenOverlay() {
    this._fullscreenRequestPending = false;
    this._canEditBeforeFullscreen = undefined;
    this._fullscreenFocusTopicId = '';
    if (!this._fsOverlay) return;
    this._restoreBodyFloatPanelsToBody();
    this.restoreHostFromBodyOverlay('_fsOverlay', '_hostElParent', '_hostElNextSibling');
    this.restoreFullscreenScrollSnapshot();
  },

  applyFullscreenEntered() {
    this._fullscreenRequestPending = false;
    this.isFullscreen = true;
    this.updateFullscreenButton();
    this.applyFullscreenViewEntered();
  },

  applyFullscreenExited() {
    this._fullscreenRequestPending = false;
    this.isFullscreen = false;
    this.hostEl?.classList.remove('is-fullscreen');
    this.restoreToolbarToBody();
    this.updateFullscreenButton();
    this.applyFullscreenViewExited();
  },

  /*
   * 物理全屏和窗口全屏进入后的 UI 收尾保持一致：
   * - 刷新视图和工具栏位置；
   * - 将 body 级浮层移入当前全屏容器，避免被 top layer / 覆盖层遮挡；
   * - 恢复 SVG DOM 焦点，确保 Alt/Option 快捷键还能继续响应。
   */
  applyFullscreenViewEntered() {
    this.showToolbar();
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();
    this._moveBodyFloatPanelsIntoContainer();
    this.restoreMapFocusAfterFullscreenToggle();
  },

  /*
   * 退出两类全屏后同样走统一收尾。_restoreBodyFloatPanelsToBody() 是幂等的，
   * 因此物理全屏在 cleanupFullscreenOverlay() 已恢复过浮层时再次调用也安全。
   */
  applyFullscreenViewExited() {
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();
    this._restoreBodyFloatPanelsToBody();
    this.restoreFullscreenScrollSnapshot();
    // 刷写全屏期间的待保存数据
    this._flushPendingFullscreenSave();
    this.restoreMapFocusAfterFullscreenToggle();
    this._fullscreenFocusTopicId = '';
  },

  /*
   * 作用：
   * 刷写全屏期间缓存的待保存数据。
   *
   * 全屏模式下编辑（新增/删除/移动主题等）不会实时写入文件，而是暂存
   * _pendingFullscreenSave。退出全屏时在此处统一写入，避免 Obsidian
   * 重渲染导致全屏异常退出。
   *
   * 注意：此方法是异步的，但调用方不 await 它，因为退出全屏时无需等待
   * 写入完成即可恢复 UI。
   */
  _flushPendingFullscreenSave() {
    if (!this._pendingFullscreenSave) return;
    const pending = this._pendingFullscreenSave;
    const pendingFocusTopicId = this.focusedTopicId;
    this._pendingFullscreenSave = null;

    this.rememberMapFocusBeforeFullscreenSave(pendingFocusTopicId);

    Promise.resolve()
      .then(() => this.saveSourceToMarkdownFile(pending))
      .then((saved) => {
        if (saved) {
          this.clearFullscreenDraftSnapshot();
          new Notice('yonxao-mindmap: 配置已保存。');
        }
      })
      .catch((error) => {
        console.warn('yonxao-mindmap: 全屏待保存数据写入失败', error);
      })
      .finally(() => {
        this.restoreMapFocusAfterFullscreenSave(pendingFocusTopicId);
      });
  },

  rememberMapFocusBeforeFullscreenSave(topicId) {
    if (!topicId) return;

    /*
     * 全屏期间 hostEl 会被移到 body 覆盖层，此时 getSectionInfo(hostEl)
     * 可能失效，保存主题时写入的焦点记忆会落到不稳定的源码片段 key 上。
     * 退出全屏后 hostEl 已回到原代码块位置，写文件前再记一次，保证
     * Obsidian 重建代码块的新 renderer 能用稳定 key 找回主题焦点。
     */
    this.rememberTopicFocusState(topicId, { focusSvg: true });
  },

  restoreMapFocusAfterFullscreenSave(topicId) {
    if (!this.svgEl || this.isSourceMode) return;

    /*
     * 退出全屏后的待保存写入和 Obsidian Notice 都发生在异步回调里。
     * 如果只在退出全屏当下恢复焦点，后续保存提示仍可能让 SVG 失去 DOM 焦点。
     * 因此保存完成后再按退出前的主题补一次“主题选中 + SVG 焦点”。
     */
    if (topicId && this.setFocusedTopic(topicId, { focusSvg: true, ensureInView: true })) {
      this.scheduleMapKeyboardFocusRestore();
      return;
    }

    const fallbackTopic = this.ensureFocusedTopic();
    if (fallbackTopic) {
      this.scheduleMapKeyboardFocusRestore();
    }
  },

  /*
   * 作用：
   * 返回 body 级浮动元素（右键菜单、主题编辑面板等）应挂载的容器。
   *
   * 全屏时这些元素必须挂在全屏元素内，否则会被浏览器顶层（top layer）
   * 或全屏覆盖层（z-index: 9998/9999）遮挡。
   */
  _bodyFloatContainer() {
    if (document.fullscreenElement) return document.fullscreenElement;
    if (this._fsOverlay) return this._fsOverlay;
    if (this._wfOverlay) return this._wfOverlay;
    return document.body;
  },

  /*
   * 作用：
   * 进入全屏时，将 body 级浮动面板移入全屏容器，避免被遮挡。
   *
   * 当前处理的面板：
   * - 主题编辑面板（topicEditorEl）
   * - 长文本编辑浮层（topicContentEditorEl）
   */
  _moveBodyFloatPanelsIntoContainer() {
    const container = this._bodyFloatContainer();
    if (container === document.body) return;

    if (
      this.topicEditorEl &&
      !this.topicEditorEl.hidden &&
      this.topicEditorEl.parentNode !== container
    ) {
      this._topicEditorBodyParent = this.topicEditorEl.parentNode;
      container.appendChild(this.topicEditorEl);
    }
    if (
      this.topicContentEditorEl &&
      !this.topicContentEditorEl.hidden &&
      this.topicContentEditorEl.parentNode !== container
    ) {
      this._topicContentEditorBodyParent = this.topicContentEditorEl.parentNode;
      container.appendChild(this.topicContentEditorEl);
    }
  },

  /*
   * 作用：
   * 退出全屏时，将 body 级浮动面板恢复回 document.body。
   */
  _restoreBodyFloatPanelsToBody() {
    if (this._topicEditorBodyParent && this.topicEditorEl) {
      this._topicEditorBodyParent.appendChild(this.topicEditorEl);
    }
    this._topicEditorBodyParent = null;
    if (this._topicContentEditorBodyParent && this.topicContentEditorEl) {
      this._topicContentEditorBodyParent.appendChild(this.topicContentEditorEl);
    }
    this._topicContentEditorBodyParent = null;
  },

  cleanupWindowFullscreenOverlay() {
    this._canEditBeforeFullscreen = undefined;
    this._fullscreenFocusTopicId = '';
    this._restoreBodyFloatPanelsToBody();
    this.restoreHostFromBodyOverlay('_wfOverlay', '_wfHostElParent', '_wfHostElNextSibling');
    this.isWindowFullscreen = false;
  },

  restoreMapFocusAfterFullscreenToggle(
    topicId = this._fullscreenFocusTopicId || this.focusedTopicId
  ) {
    if (!this.svgEl || this.isSourceMode) return;
    const restoreTopicId = topicId || '';

    /*
     * 全屏会把 hostEl 移入/移出 body 级覆盖层，浏览器可能把 DOM 焦点落到 body。
     * 立即和延迟各补一次 SVG 焦点，保证 Alt/Option 全屏快捷键能连续进入和退出。
     */
    const focusSvg = () => {
      if (!this.svgEl || !this.hostEl?.isConnected || this.isSourceMode) return;
      if (restoreTopicId && this.topicById.get(restoreTopicId)?._layout) {
        this.setFocusedTopic(restoreTopicId, { focusSvg: true, ensureInView: false });
        return;
      }
      this.svgEl.focus({ preventScroll: true });
    };

    focusSvg();
    if (typeof window !== 'undefined') {
      window.setTimeout(focusSvg, 0);
    }
  },

  moveToolbarIntoFullscreenHost() {
    if (!this.toolbarEl || !this.hostEl || this.toolbarEl.parentElement === this.hostEl) return;

    this.hostEl.appendChild(this.toolbarEl);
  },

  restoreToolbarToBody() {
    if (!this.toolbarEl || typeof document === 'undefined') return;
    if (this.toolbarEl.parentElement === document.body) return;

    document.body.appendChild(this.toolbarEl);
  },

  createSvg() {
    this.svgEl = svg('svg', {
      class: 'yonxao-mindmap-svg',
      role: 'img',
      'aria-label': 'Mind map',
      tabindex: '0',
      /* 导出 PDF 会复制当前 DOM，顶部对齐可避免长 SVG 在跨页幕布中垂直居中产生空白页。 */
      preserveAspectRatio: 'xMidYMin meet',
    });
    this.svgEl.style.setProperty(
      '--yonxao-mindmap-connector-stroke-width',
      String(CONNECTOR_STROKE_WIDTH)
    );
    this.mapEl = svg('g', { class: 'yonxao-mindmap-map' });
    this.svgEl.appendChild(this.mapEl);
    this.containerEl.appendChild(this.svgEl);

    this.registerDomEvent(this.svgEl, 'click', (event) => this.handleTopicClick(event));
    this.registerDomEvent(this.svgEl, 'dblclick', (event) => this.handleTopicDoubleClick(event));
    this.registerDomEvent(this.svgEl, 'contextmenu', (event) => this.handleTopicContextMenu(event));
    this.registerDomEvent(this.svgEl, 'pointerover', (event) => this.handleTopicPointerOver(event));
    this.registerDomEvent(this.svgEl, 'pointerout', (event) => this.handleTopicPointerOut(event));
    this.registerDomEvent(this.svgEl, 'wheel', (event) => this.handleWheel(event));
    this.registerDomEvent(this.svgEl, 'focus', () => this.handleMapFocus());
    // focusin 比 focus 更早触发且能冒泡，用于捕获结构元素（边界/摘要/关系）的焦点进入。
    this.registerDomEvent(this.svgEl, 'focusin', (event) => this.handleMindStructureFocus?.(event));
    this.registerDomEvent(this.svgEl, 'blur', (event) => this.handleMapBlur(event));
    this.registerDomEvent(this.svgEl, 'keydown', (event) => this.handleMapKeyDown(event));
    // pointerdown 优先检查是否命中结构控件（如关系线拖拽手柄），命中后不再启动平移。
    this.registerDomEvent(this.svgEl, 'pointerdown', (event) => {
      if (this.handleStructureControlPointerDown?.(event)) return;
      this.handlePanPointerDown(event);
    });
    this.registerDomEvent(this.svgEl, 'pointermove', (event) => this.handlePanPointerMove(event));
    this.registerDomEvent(this.svgEl, 'pointerup', (event) => this.handlePanPointerUp(event));
    this.registerDomEvent(this.svgEl, 'pointercancel', (event) => this.handlePanPointerUp(event));
  },
};
