/*
 * 文件作用：
 * 全屏控制方法集合，负责阅读视图覆盖层、编辑视图原生全屏和工具栏归位。
 *
 * 实现逻辑：
 * 阅读视图通过 body 级覆盖层承载 hostEl，编辑视图直接请求 hostEl 全屏，退出时恢复 DOM 位置和视口。
 * 窗口全屏不使用 requestFullscreen API，而是通过 CSS 类控制 hostEl 填满 Obsidian 窗口区域。
 *
 * 调用链：
 * 工具栏按钮/快捷操作 -> fullscreenControllerMethods -> document fullscreen API / CSS class toggle。
 */

import { Notice, svg, CONNECTOR_STROKE_WIDTH } from '../shared/rendererShared.js';

export const fullscreenControllerMethods = {
  async toggleFullscreen() {
    if (!this.hostEl || typeof document === 'undefined') return;

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

    if (!this.canEditMindMap()) {
      this._fsOverlay = document.createElement('div');
      this._fsOverlay.className = 'yonxao-mindmap-fs-overlay';
      this._hostElParent = this.hostEl.parentNode;
      this._hostElNextSibling = this.hostEl.nextSibling;
      this._fsOverlay.appendChild(this.hostEl);
      document.body.appendChild(this._fsOverlay);
      this.moveToolbarIntoFullscreenHost();
      this.hostEl.classList.add('is-fullscreen');
      try {
        await this._fsOverlay.requestFullscreen();
      } catch (error) {
        this.cleanupFullscreenOverlay();
        throw error;
      }
      return;
    }

    if (typeof this.hostEl.requestFullscreen !== 'function') {
      new Notice('yonxao-mindmap: 当前环境不支持全屏查看。');
      return;
    }

    this.moveToolbarIntoFullscreenHost();
    this.hostEl.classList.add('is-fullscreen');
    try {
      await this.hostEl.requestFullscreen();
    } catch (error) {
      this.hostEl.classList.remove('is-fullscreen');
      this.restoreToolbarToBody();
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
     * 缓存窗口全屏前的编辑能力状态。
     *
     * 窗口全屏会把 hostEl 移出 Obsidian 编辑器的 DOM 树（挂到 body 下的覆盖层），
     * 导致 canEditMindMap() 通过 hostEl.closest() 无法再定位到编辑容器，
     * 从而让添加/编辑/删除主题等操作失效。
     * 这里提前缓存编辑能力，在窗口全屏期间覆盖 canEditMindMap() 的判断。
     */
    this._canEditBeforeFullscreen = this.canEditMindMap();

    // 统一使用 body 级覆盖层，避免编辑视图下 position: fixed 受 CodeMirror
    // 祖先容器的 transform/will-change 影响导致导图消失。
    this._wfOverlay = document.createElement('div');
    this._wfOverlay.className = 'yonxao-mindmap-wf-overlay';
    this._wfHostElParent = this.hostEl.parentNode;
    this._wfHostElNextSibling = this.hostEl.nextSibling;
    this._wfOverlay.appendChild(this.hostEl);
    document.body.appendChild(this._wfOverlay);

    this.moveToolbarIntoFullscreenHost();
    this.isWindowFullscreen = true;
    this.updateWindowFullscreenButton();
    this.showToolbar();
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();
    this._moveBodyFloatPanelsIntoContainer();
  },

  applyWindowFullscreenExited() {
    if (!this.hostEl) return;
    this._canEditBeforeFullscreen = undefined;

    // 恢复 hostEl 到原位置
    if (this._wfHostElParent) {
      if (
        this._wfHostElNextSibling &&
        this._wfHostElNextSibling.parentNode === this._wfHostElParent
      ) {
        this._wfHostElParent.insertBefore(this.hostEl, this._wfHostElNextSibling);
      } else {
        this._wfHostElParent.appendChild(this.hostEl);
      }
    }
    if (this._wfOverlay) {
      this._wfOverlay.remove();
      this._wfOverlay = null;
    }
    this._wfHostElParent = null;
    this._wfHostElNextSibling = null;

    this.restoreToolbarToBody();
    this.isWindowFullscreen = false;
    this.updateWindowFullscreenButton();
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();
    this._restoreBodyFloatPanelsToBody();
    // 刷写全屏期间的待保存数据
    this._flushPendingFullscreenSave();
  },

  /*

  /*
   * 全屏幕状态变更处理。注意全屏幕 API 的事件可能来自本插件之外（如 Obsidian 本身
   * 或其他插件），因此需要双重守卫：进入全屏时检查 hostEl 是否标记了 is-fullscreen，
   * 退出全屏时检查 isFullscreen 内部状态。避免误触发其他全屏实例的状态切换。
   */
  handleFullscreenChange() {
    if (typeof document === 'undefined') return;

    if (document.fullscreenElement) {
      if (!this.hostEl?.classList.contains('is-fullscreen')) return;
      this.applyFullscreenEntered();
    } else {
      if (!this.isFullscreen) return;
      this.cleanupFullscreenOverlay();
      this.applyFullscreenExited();
    }
  },

  cleanupFullscreenOverlay() {
    if (!this._fsOverlay) return;
    this._canEditBeforeFullscreen = undefined;
    this._restoreBodyFloatPanelsToBody();
    if (this._hostElParent) {
      if (this._hostElNextSibling && this._hostElNextSibling.parentNode === this._hostElParent) {
        this._hostElParent.insertBefore(this.hostEl, this._hostElNextSibling);
      } else {
        this._hostElParent.appendChild(this.hostEl);
      }
    }
    this._fsOverlay.remove();
    this._fsOverlay = null;
    this._hostElParent = null;
    this._hostElNextSibling = null;
  },

  applyFullscreenEntered() {
    this.isFullscreen = true;
    this.showToolbar();
    this.updateFullscreenButton();
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();
    // 将 body 级浮动面板移入全屏元素，避免被浏览器顶层遮挡
    this._moveBodyFloatPanelsIntoContainer();
  },

  applyFullscreenExited() {
    this.isFullscreen = false;
    this.hostEl?.classList.remove('is-fullscreen');
    this.restoreToolbarToBody();
    this.updateFullscreenButton();
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();
    // 将 body 级浮动面板恢复回 document.body
    this._restoreBodyFloatPanelsToBody();
    // 刷写全屏期间的待保存数据
    this._flushPendingFullscreenSave();
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
    this._pendingFullscreenSave = null;
    Promise.resolve(this.saveSourceToMarkdownFile(pending))
      .then((saved) => {
        if (saved) {
          new Notice('yonxao-mindmap: 配置已保存。');
        }
      })
      .catch((error) => {
        console.warn('yonxao-mindmap: 全屏待保存数据写入失败', error);
      });
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
    this._restoreBodyFloatPanelsToBody();
    if (this._wfHostElParent) {
      if (
        this._wfHostElNextSibling &&
        this._wfHostElNextSibling.parentNode === this._wfHostElParent
      ) {
        this._wfHostElParent.insertBefore(this.hostEl, this._wfHostElNextSibling);
      } else if (this.hostEl) {
        this._wfHostElParent.appendChild(this.hostEl);
      }
    }
    if (this._wfOverlay) {
      this._wfOverlay.remove();
      this._wfOverlay = null;
    }
    this._wfHostElParent = null;
    this._wfHostElNextSibling = null;
    this.isWindowFullscreen = false;
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
    this.registerDomEvent(this.svgEl, 'blur', () => this.handleMapBlur());
    this.registerDomEvent(this.svgEl, 'keydown', (event) => this.handleMapKeyDown(event));
    this.registerDomEvent(this.svgEl, 'pointerdown', (event) => this.handlePanPointerDown(event));
    this.registerDomEvent(this.svgEl, 'pointermove', (event) => this.handlePanPointerMove(event));
    this.registerDomEvent(this.svgEl, 'pointerup', (event) => this.handlePanPointerUp(event));
    this.registerDomEvent(this.svgEl, 'pointercancel', (event) => this.handlePanPointerUp(event));
  },
};
