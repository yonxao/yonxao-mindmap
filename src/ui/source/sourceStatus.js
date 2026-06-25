/*
 * 文件作用：
 * 源码状态方法集合，负责 dirty/synced/error 状态文案和源码模式高度刷新。
 *
 * 实现逻辑：
 * 状态只反映当前源码输入与渲染器源码之间的同步关系，不直接保存文件。
 *
 * 调用链：
 * SourceView -> sourceStatusMethods -> renderer state。
 */

import { CANVAS_MIN_HEIGHT, clamp } from '../../shared/rendererShared.js';

const SOURCE_EXTRA_LINE_MULTIPLIER = 2;

export const sourceStatusMethods = {
  updateSourceStatus(message) {
    if (!this.sourceStatusEl) return;

    if (message) {
      this.sourceStatusEl.textContent = message;
      return;
    }

    this.sourceStatusEl.textContent = this.sourceDirty
      ? this.t('source.status.dirty')
      : this.t('source.status.synced');
  },

  scheduleSourceModeHeight() {
    if (this.pendingSourceHeightFrame || typeof window === 'undefined') return;

    this.pendingSourceHeightFrame = window.requestAnimationFrame(() => {
      this.pendingSourceHeightFrame = null;
      this.applySourceModeHeight();
    });
  },

  scheduleSourceModeHeightIfLineCountChanged() {
    const nextLineCount = this.sourceInputLineCount();
    if (nextLineCount === this.sourceLineCount) return;

    this.sourceLineCount = nextLineCount;
    this.scheduleSourceModeHeight();
  },

  applySourceModeHeight() {
    const activeInputEl = this.activeSourceInputEl();
    if (!this.isSourceMode || !this.containerEl || !this.sourceEl || !activeInputEl) {
      return;
    }

    const configuredHeight = this.config.source.height;
    if (configuredHeight) {
      this.manualSourceHeight = true;
      this.containerEl.style.height = `${Math.round(configuredHeight)}px`;
      return;
    }

    this.manualSourceHeight = false;

    const sourceStyle = window.getComputedStyle(this.sourceEl);
    const inputStyle = window.getComputedStyle(activeInputEl);
    const sourcePadding =
      parseFloat(sourceStyle.paddingTop || '0') + parseFloat(sourceStyle.paddingBottom || '0');
    const sourceGap = parseFloat(sourceStyle.gap || '0');
    const statusHeight = this.sourceStatusEl
      ? this.sourceStatusEl.getBoundingClientRect().height
      : 0;
    const lineHeight = parseFloat(inputStyle.lineHeight || '0') || 20;
    const lineCount = this.sourceInputLineCount();
    const inputPadding =
      parseFloat(inputStyle.paddingTop || '0') + parseFloat(inputStyle.paddingBottom || '0');
    const inputHeight = lineCount * lineHeight + inputPadding;
    const extraSpace = lineHeight * SOURCE_EXTRA_LINE_MULTIPLIER;
    const nextHeight = clamp(
      inputHeight + sourcePadding + sourceGap + statusHeight + extraSpace,
      CANVAS_MIN_HEIGHT,
      this.maxManualHeight()
    );

    this.containerEl.style.height = `${Math.round(nextHeight)}px`;
  },

  sourceInputLineCount() {
    const inputEl = this.activeSourceInputEl();
    if (!inputEl) return 1;
    return Math.max(1, inputEl.value.split(/\r?\n/).length);
  },
};
