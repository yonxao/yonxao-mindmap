/*
 * 文件作用：
 * 悬浮工具栏方法集合，负责创建工具栏、显隐、拖拽入口和生命周期清理。
 *
 * 实现逻辑：
 * 工具栏挂载在 body 或全屏宿主中，通过 renderer 状态更新按钮可用性。
 *
 * 调用链：
 * YonxaoMindmapRenderer -> floatingToolbarMethods -> toolbarButtons/toolbarPosition。
 */

import {
  ICON_TOGGLE_SOURCE,
  ICON_CONFIG,
  ICON_FIT_VIEW,
  ICON_WINDOW_FULLSCREEN_ENTER,
  ICON_FULLSCREEN_ENTER,
  ICON_ZOOM_IN,
  ICON_ZOOM_OUT,
  ICON_RESET_COLLAPSE,
} from '../../icons/iconNames.js';

const TOOLBAR_ZOOM_IN_FACTOR = 0.82;
const TOOLBAR_ZOOM_OUT_FACTOR = 1.18;
const TOOLBAR_HIDE_DELAY_MS = 140;
const TOOLBAR_SCROLL_WHEEL_QUIET_MS = 260;
const TOOLBAR_SCROLL_MIDDLE_BUTTON_QUIET_MS = 700;
const TOOLBAR_VIEWPORT_MARGIN = 64;
export const floatingToolbarMethods = {
  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'yonxao-mindmap-toolbar';
    this.toolbarEl = toolbar;
    document.body.appendChild(toolbar);

    this.installToolbarVisibilityEvents();
    this.installToolbarEventBoundary();

    this.createToolbarDragHandle(toolbar);

    // 源码/导图切换按钮和配置按钮始终可用；其它按钮只对导图视图有意义。
    this.toggleViewButton = this.createToolbarButton(
      toolbar,
      this.t('toolbar.showSource'),
      ICON_TOGGLE_SOURCE,
      async () => {
        await this.toggleSourceMode();
      }
    );

    this.createToolbarButton(toolbar, this.t('toolbar.config'), ICON_CONFIG, () => {
      this.openConfigModal();
    });

    this.viewFitButton = this.createToolbarButton(
      toolbar,
      this.t('toolbar.fitView'),
      ICON_FIT_VIEW,
      () => this.toggleViewFitMode()
    );
    this.mapActionButtons.push(this.viewFitButton);
    this.windowFullscreenButton = this.createToolbarButton(
      toolbar,
      this.t('toolbar.enterWindowFullscreen'),
      ICON_WINDOW_FULLSCREEN_ENTER,
      () => this.toggleWindowFullscreen()
    );
    this.mapActionButtons.push(this.windowFullscreenButton);
    this.fullscreenButton = this.createToolbarButton(
      toolbar,
      this.t('toolbar.enterFullscreen'),
      ICON_FULLSCREEN_ENTER,
      () => this.toggleFullscreen()
    );
    this.mapActionButtons.push(this.fullscreenButton);
    this.mapActionButtons.push(
      this.createToolbarButton(toolbar, this.t('toolbar.zoomIn'), ICON_ZOOM_IN, () =>
        this.zoomAtCenter(TOOLBAR_ZOOM_IN_FACTOR)
      )
    );
    this.mapActionButtons.push(
      this.createToolbarButton(toolbar, this.t('toolbar.zoomOut'), ICON_ZOOM_OUT, () =>
        this.zoomAtCenter(TOOLBAR_ZOOM_OUT_FACTOR)
      )
    );
    this.mapActionButtons.push(
      this.createToolbarButton(
        toolbar,
        this.t('toolbar.resetCollapse'),
        ICON_RESET_COLLAPSE,
        () => {
          this.collapsedIds.clear();
          this.renderMap(true);
        }
      )
    );

    this.updateToggleViewButton();
    this.updateFullscreenButton();
    this.updateWindowFullscreenButton();
    if (typeof document !== 'undefined') {
      this.registerDomEvent(document, 'fullscreenchange', () => this.handleFullscreenChange());
    }
  },

  installToolbarVisibilityEvents() {
    const show = () => this.showToolbar();
    const scheduleHide = () => this.scheduleHideToolbar();

    this.registerDomEvent(this.hostEl, 'mouseenter', show);
    this.registerDomEvent(this.hostEl, 'mouseleave', scheduleHide);
    this.registerDomEvent(this.hostEl, 'focusin', show);
    this.registerDomEvent(this.hostEl, 'focusout', scheduleHide);
    this.registerDomEvent(this.toolbarEl, 'mouseenter', show);
    this.registerDomEvent(this.toolbarEl, 'mouseleave', scheduleHide);
    this.registerDomEvent(this.toolbarEl, 'focusin', show);
    this.registerDomEvent(this.toolbarEl, 'focusout', scheduleHide);
    this.registerDomEvent(this.hostEl, 'wheel', () =>
      this.handleToolbarScroll(TOOLBAR_SCROLL_WHEEL_QUIET_MS)
    );
    this.registerDomEvent(this.hostEl, 'pointerdown', (event) => {
      if (event.button === 1) this.handleToolbarScroll(TOOLBAR_SCROLL_MIDDLE_BUTTON_QUIET_MS);
    });
  },

  installToolbarScrollListeners() {
    const targets = new Set([window, document]);
    let element = this.hostEl;
    while (element && element !== document.body) {
      if (this.isScrollableElement(element)) {
        targets.add(element);
      }
      element = element.parentElement;
    }

    const listener = () => this.handleToolbarScroll();
    for (const target of targets) {
      target.addEventListener('scroll', listener, { capture: true, passive: true });
      this.register(() => {
        target.removeEventListener('scroll', listener, { capture: true });
      });
    }
  },

  isScrollableElement(element) {
    if (!element || element === document.documentElement) return false;
    const style = window.getComputedStyle(element);
    const overflow = `${style.overflow} ${style.overflowY} ${style.overflowX}`;
    if (!/(auto|scroll|overlay)/.test(overflow)) return false;
    return element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth;
  },

  installToolbarEventBoundary() {
    for (const eventName of [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'pointerdown',
      'pointerup',
      'keydown',
      'keyup',
      'wheel',
    ]) {
      this.registerDomEvent(this.toolbarEl, eventName, (event) => {
        event.stopPropagation();
      });
    }
  },

  showToolbar() {
    if (!this.toolbarEl) return;
    if (this.pendingToolbarHideTimer) {
      window.clearTimeout(this.pendingToolbarHideTimer);
      this.pendingToolbarHideTimer = null;
    }
    if (this.suppressToolbarDuringScroll) {
      this.hideToolbar();
      return;
    }
    if (!this.isToolbarHostNearViewport()) {
      this.hideToolbar();
      return;
    }
    this.applyToolbarPosition();
    this.toolbarEl.classList.add('is-visible');
    this.scheduleApplyToolbarPosition();
  },

  scheduleHideToolbar() {
    if (this.pendingToolbarHideTimer) {
      window.clearTimeout(this.pendingToolbarHideTimer);
    }
    this.pendingToolbarHideTimer = window.setTimeout(() => {
      this.pendingToolbarHideTimer = null;
      if (this.shouldKeepToolbarVisible()) return;
      this.hideToolbar();
    }, TOOLBAR_HIDE_DELAY_MS);
  },

  hideToolbar() {
    this.toolbarEl?.classList.remove('is-visible');
  },

  shouldKeepToolbarVisible() {
    if (this.toolbarDragState) return true;
    if (this.suppressToolbarDuringScroll) return false;
    const activeElement = document.activeElement;
    return Boolean(
      this.hostEl?.matches?.(':hover') ||
      this.toolbarEl?.matches?.(':hover') ||
      (activeElement && this.hostEl?.contains(activeElement)) ||
      (activeElement && this.toolbarEl?.contains(activeElement))
    );
  },

  handleToolbarScroll(quietMs = 180) {
    if (!this.toolbarEl) return;
    this.suppressToolbarDuringScroll = true;
    this.hideToolbar();

    if (this.pendingToolbarScrollTimer) {
      window.clearTimeout(this.pendingToolbarScrollTimer);
    }

    this.pendingToolbarScrollTimer = window.setTimeout(() => {
      this.pendingToolbarScrollTimer = null;
      this.suppressToolbarDuringScroll = false;
      if (this.shouldKeepToolbarVisible()) {
        this.showToolbar();
      }
    }, quietMs);
  },

  isToolbarHostNearViewport() {
    if (!this.hostEl) return false;
    const rect = this.hostEl.getBoundingClientRect();
    const margin = TOOLBAR_VIEWPORT_MARGIN;
    return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
  },
};
