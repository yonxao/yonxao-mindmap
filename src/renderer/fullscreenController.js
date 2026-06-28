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
  },

  applyWindowFullscreenExited() {
    if (!this.hostEl) return;

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
  },

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
  },

  applyFullscreenExited() {
    this.isFullscreen = false;
    this.hostEl?.classList.remove('is-fullscreen');
    this.restoreToolbarToBody();
    this.updateFullscreenButton();
    this.scheduleFitView();
    this.scheduleApplyToolbarPosition();
  },

  cleanupWindowFullscreenOverlay() {
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
    this.registerDomEvent(this.svgEl, 'pointerdown', (event) => this.handlePanPointerDown(event));
    this.registerDomEvent(this.svgEl, 'pointermove', (event) => this.handlePanPointerMove(event));
    this.registerDomEvent(this.svgEl, 'pointerup', (event) => this.handlePanPointerUp(event));
    this.registerDomEvent(this.svgEl, 'pointercancel', (event) => this.handlePanPointerUp(event));
  },
};
