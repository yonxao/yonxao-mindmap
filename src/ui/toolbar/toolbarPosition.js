/*
 * 文件作用：
 * 工具栏定位方法集合，负责四角吸附、inside/outside 位置和拖拽后的最近角落计算。
 *
 * 实现逻辑：
 * 拖拽结束后将 corner/placement 写回配置区，后续重建仍保持用户位置。
 *
 * 调用链：
 * toolbar drag events -> toolbarPositionMethods -> runtimeConfigSaveMethods。
 */

import {
  Notice,
  setIcon,
  TOOLBAR_CORNERS,
  TOOLBAR_PLACEMENTS,
  setMindConfigPath,
  clamp,
} from '../../shared/rendererShared.js';
import { ICON_DRAG_HANDLE } from '../../icons/iconNames.js';

const TOOLBAR_POSITION_GAP = 8;

export const toolbarPositionMethods = {
  createToolbarDragHandle(toolbar) {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'yonxao-mindmap-toolbar-button yonxao-mindmap-toolbar-drag-handle';
    handle.setAttribute('aria-label', this.t('toolbar.dragHandle'));

    try {
      setIcon(handle, ICON_DRAG_HANDLE);
    } catch (_error) {
      handle.textContent = '+';
    }

    toolbar.appendChild(handle);
    this.registerDomEvent(handle, 'pointerdown', (event) => {
      this.handleToolbarPointerDown(event);
    });
    this.registerDomEvent(handle, 'pointermove', (event) => {
      this.handleToolbarPointerMove(event);
    });
    this.registerDomEvent(handle, 'pointerup', (event) => {
      this.handleToolbarPointerUp(event);
    });
    this.registerDomEvent(handle, 'pointercancel', (event) => {
      this.handleToolbarPointerUp(event);
    });
  },

  handleToolbarPointerDown(event) {
    if (!this.toolbarEl || !this.hostEl) return;

    event.preventDefault();
    event.stopPropagation();

    const toolbarRect = this.toolbarEl.getBoundingClientRect();
    const hostRect = this.hostEl.getBoundingClientRect();
    this.toolbarDragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: toolbarRect.left - hostRect.left,
      startY: toolbarRect.top - hostRect.top,
    };

    this.toolbarEl.classList.add('is-dragging-toolbar');

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer Capture 只是增强拖拽稳定性，不支持时仍可依赖普通 pointermove。
    }
  },

  handleToolbarPointerMove(event) {
    if (!this.toolbarDragState || !this.toolbarEl) return;

    event.preventDefault();
    const nextX = this.toolbarDragState.startX + event.clientX - this.toolbarDragState.startClientX;
    const nextY = this.toolbarDragState.startY + event.clientY - this.toolbarDragState.startClientY;
    this.setToolbarPosition(nextX, nextY);
  },

  handleToolbarPointerUp(event) {
    if (!this.toolbarDragState || !this.toolbarEl) return;

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 未捕获指针时释放会失败，可以安全忽略。
    }

    this.toolbarDragState = null;
    this.toolbarEl.classList.remove('is-dragging-toolbar');

    const snap = this.nearestToolbarSnap();
    if (!snap) return;

    this.rawConfig = setMindConfigPath(
      this.rawConfig,
      ['interaction', 'toolbar', 'corner'],
      snap.corner
    );
    this.rawConfig = setMindConfigPath(
      this.rawConfig,
      ['interaction', 'toolbar', 'placement'],
      snap.placement
    );
    this.rememberViewModeConfig();
    this.refreshNormalizedConfig();
    this.scheduleApplyToolbarPosition();
    Promise.resolve(this.saveRuntimeConfigToFile()).catch((error) => {
      new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
    });
  },

  applyToolbarPosition() {
    if (!this.toolbarEl) return;

    this.setToolbarSnap(this.config.toolbar.corner, this.config.toolbar.placement);
  },

  scheduleApplyToolbarPosition() {
    if (this.pendingToolbarFrame || typeof window === 'undefined') return;

    this.pendingToolbarFrame = window.requestAnimationFrame(() => {
      this.pendingToolbarFrame = null;
      this.applyToolbarPosition();
    });
  },

  setToolbarPosition(x, y) {
    if (!this.toolbarEl || !this.hostEl) return;

    const hostRect = this.hostEl.getBoundingClientRect();
    const toolbarRect = this.toolbarEl.getBoundingClientRect();
    if (!hostRect.width || !toolbarRect.width || !toolbarRect.height) {
      this.scheduleApplyToolbarPosition();
      return;
    }

    const maxLeft = Math.max(
      TOOLBAR_POSITION_GAP,
      window.innerWidth - toolbarRect.width - TOOLBAR_POSITION_GAP
    );
    const maxTop = Math.max(
      TOOLBAR_POSITION_GAP,
      window.innerHeight - toolbarRect.height - TOOLBAR_POSITION_GAP
    );
    const left = clamp(hostRect.left + x, TOOLBAR_POSITION_GAP, maxLeft);
    const top = clamp(hostRect.top + y, TOOLBAR_POSITION_GAP, maxTop);

    this.toolbarEl.style.left = `${Math.round(left)}px`;
    this.toolbarEl.style.top = `${Math.round(top)}px`;
  },

  setToolbarSnap(corner, placement) {
    const point = this.toolbarSnapPoint(corner, placement);
    if (!point) {
      this.scheduleApplyToolbarPosition();
      return;
    }

    this.toolbarEl.style.left = `${Math.round(point.left)}px`;
    this.toolbarEl.style.top = `${Math.round(point.top)}px`;
  },

  toolbarSnapPoint(corner, placement) {
    if (!this.toolbarEl || !this.hostEl) return null;

    const hostRect = this.hostEl.getBoundingClientRect();
    const toolbarRect = this.toolbarEl.getBoundingClientRect();
    if (!hostRect.width || !hostRect.height || !toolbarRect.width || !toolbarRect.height) {
      return null;
    }

    const [vertical, horizontal] = String(corner || '').split('-');
    const isRight = horizontal === 'right';
    const isBottom = vertical === 'bottom';
    const left = isRight
      ? hostRect.right - toolbarRect.width - TOOLBAR_POSITION_GAP
      : hostRect.left + TOOLBAR_POSITION_GAP;
    let top = isBottom
      ? hostRect.bottom - toolbarRect.height - TOOLBAR_POSITION_GAP
      : hostRect.top + TOOLBAR_POSITION_GAP;

    if (placement === 'outside') {
      top = isBottom
        ? hostRect.bottom + TOOLBAR_POSITION_GAP
        : hostRect.top - toolbarRect.height - TOOLBAR_POSITION_GAP;
    }

    const maxLeft = Math.max(
      TOOLBAR_POSITION_GAP,
      window.innerWidth - toolbarRect.width - TOOLBAR_POSITION_GAP
    );
    const maxTop = Math.max(
      TOOLBAR_POSITION_GAP,
      window.innerHeight - toolbarRect.height - TOOLBAR_POSITION_GAP
    );
    return {
      left: clamp(left, TOOLBAR_POSITION_GAP, maxLeft),
      top: clamp(top, TOOLBAR_POSITION_GAP, maxTop),
    };
  },

  nearestToolbarSnap() {
    if (!this.toolbarEl) return null;

    const toolbarRect = this.toolbarEl.getBoundingClientRect();
    const currentCenter = {
      x: toolbarRect.left + toolbarRect.width / 2,
      y: toolbarRect.top + toolbarRect.height / 2,
    };
    let best = null;

    for (const corner of TOOLBAR_CORNERS) {
      for (const placement of TOOLBAR_PLACEMENTS) {
        const point = this.toolbarSnapPoint(corner, placement);
        if (!point) continue;

        const centerX = point.left + toolbarRect.width / 2;
        const centerY = point.top + toolbarRect.height / 2;
        const distance = Math.hypot(currentCenter.x - centerX, currentCenter.y - centerY);
        if (!best || distance < best.distance) {
          best = { corner, placement, distance };
        }
      }
    }

    return best;
  },
};
