/*
 * 文件作用：
 * SVG/PNG 导出方法集合，负责克隆 SVG、内联样式、移除控件并生成图片数据。
 *
 * 实现逻辑：
 * 导出时重新计算 bounds，保证图片内容完整且不包含编辑按钮等交互控件。
 *
 * 调用链：
 * 右键菜单/工具栏 -> exportSvgMethods -> browser canvas/clipboard/download。
 */

import {
  Notice,
  VIEWBOX_MARGIN_X,
  VIEWBOX_MARGIN_Y,
  layoutTree,
  svg,
  CONNECTOR_STROKE_WIDTH,
  EXPORT_MAX_CANVAS_SIDE,
  EXPORT_MAX_DEVICE_PIXEL_RATIO,
  EXPORT_MIN_PIXEL_SCALE,
  EXPORT_FILENAME_MAX_LENGTH,
} from '../../shared/rendererShared.js';

export const exportSvgMethods = {
  async exportMapPng() {
    const blob = await this.renderMapPngBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.exportFileBaseName()}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    new Notice(this.t('notice.imageExported'));
    return true;
  },

  async copyMapPng() {
    const blob = await this.renderMapPngBlob();
    if (await this.writeImageBlobToElectronClipboard(blob)) {
      new Notice(this.t('notice.imageCopied'));
      return true;
    }

    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      new Notice(this.t('notice.imageClipboardUnsupported'));
      return false;
    }

    try {
      await this.focusForClipboardWrite();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (error) {
      if (
        String(error?.message || error)
          .toLowerCase()
          .includes('document is not focused')
      ) {
        new Notice(this.t('notice.imageClipboardFocusRequired'));
        return false;
      }
      throw error;
    }
    new Notice(this.t('notice.imageCopied'));
    return true;
  },

  async writeImageBlobToElectronClipboard(blob) {
    const electron = this.electronClipboardModule();
    if (!electron?.clipboard || !electron?.nativeImage) return false;

    const buffer = await blob.arrayBuffer();
    const image = electron.nativeImage.createFromBuffer(Buffer.from(buffer));
    if (image.isEmpty && image.isEmpty()) return false;

    electron.clipboard.writeImage(image);
    return true;
  },

  electronClipboardModule() {
    const runtimeRequire =
      typeof globalThis.require === 'function'
        ? globalThis.require
        : typeof window?.require === 'function'
          ? window.require
          : null;
    if (!runtimeRequire) return null;

    try {
      return runtimeRequire('electron');
    } catch (_error) {
      return null;
    }
  },

  async focusForClipboardWrite() {
    window.focus();
    this.svgEl?.focus?.();
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  },

  async renderMapPngBlob() {
    const exportSvg = this.createExportSvgElement();
    const svgText = new XMLSerializer().serializeToString(exportSvg);
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    try {
      const image = new Image();
      image.decoding = 'async';
      const loaded = new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = () => reject(new Error('导图图片生成失败。'));
      });
      image.src = url;
      await loaded;

      const width = Number(exportSvg.getAttribute('width')) || image.width;
      const height = Number(exportSvg.getAttribute('height')) || image.height;
      const scale = this.exportPixelScale(width, height);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('PNG 导出失败。');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      return await new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('PNG 导出失败。'));
          }
        }, 'image/png');
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  createExportSvgElement() {
    if (!this.mapEl || !this.root) {
      throw new Error('当前没有可导出的导图。');
    }

    const bounds = layoutTree(this.root, this.collapsedIds, this.config).bounds;
    const viewBox = {
      x: bounds.minX - VIEWBOX_MARGIN_X,
      y: bounds.minY - VIEWBOX_MARGIN_Y,
      width: bounds.maxX - bounds.minX + VIEWBOX_MARGIN_X * 2,
      height: bounds.maxY - bounds.minY + VIEWBOX_MARGIN_Y * 2,
    };
    const exportSvg = svg('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      width: Math.ceil(viewBox.width),
      height: Math.ceil(viewBox.height),
      viewBox: `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`,
    });

    exportSvg.appendChild(this.createExportSvgStyle());
    exportSvg.appendChild(
      svg('rect', {
        x: viewBox.x,
        y: viewBox.y,
        width: viewBox.width,
        height: viewBox.height,
        fill: this.resolveCssColor('--background-primary', '#ffffff'),
      })
    );

    const mapClone = this.mapEl.cloneNode(true);
    this.cleanupExportMapClone(mapClone);
    this.inlineExportSvgColors(mapClone);
    exportSvg.appendChild(mapClone);
    return exportSvg;
  },

  createExportSvgStyle() {
    const styleEl = svg('style');
    styleEl.textContent = `
      .yonxao-mindmap-connector{fill:none;stroke-width:${CONNECTOR_STROKE_WIDTH};stroke-linecap:round;stroke-linejoin:round;opacity:.62}
      .yonxao-mindmap-topic-card{stroke-width:1.4}
      .yonxao-mindmap-topic-default .yonxao-mindmap-topic-card{stroke-width:1.6}
      .yonxao-mindmap-topic-tree-table .yonxao-mindmap-topic-card{stroke-width:1.5}
      .yonxao-mindmap-topic-tree-table-root .yonxao-mindmap-topic-card{stroke-width:2}
      .yonxao-mindmap-topic-text{letter-spacing:0;dominant-baseline:auto;user-select:none}
      .yonxao-mindmap-topic-icon path{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:2}
    `;
    return styleEl;
  },

  cleanupExportMapClone(mapClone) {
    const selectors = [
      '.yonxao-mindmap-toggle',
      '.yonxao-mindmap-topic-edit',
      '.yonxao-mindmap-topic-sibling-actions',
      '.yonxao-mindmap-topic-subtopic-add',
      '.yonxao-mindmap-drop-indicator',
      'title',
    ];
    for (const element of mapClone.querySelectorAll(selectors.join(','))) {
      element.remove();
    }
  },

  inlineExportSvgColors(mapClone) {
    const textColor = this.resolveCssColor('--text-normal', '#1f2328');
    const borderColor = this.resolveCssColor('--background-modifier-border', '#d0d7de');
    const defaultTopicBorderColor = this.resolveCssColor(
      '--background-modifier-border-hover',
      borderColor
    );
    const defaultConnectorColor = this.resolveCssColor(
      '--yonxao-mindmap-default-connector',
      textColor
    );
    const backgroundColor = this.resolveCssColor('--background-primary', '#ffffff');

    for (const textEl of mapClone.querySelectorAll('.yonxao-mindmap-topic-text')) {
      textEl.setAttribute('fill', textColor);
    }
    for (const cardEl of mapClone.querySelectorAll('.yonxao-mindmap-topic-card')) {
      this.replaceSvgVarAttribute(cardEl, 'fill', backgroundColor);
      const defaultTopicEl = cardEl.closest('.yonxao-mindmap-topic-default');
      this.replaceSvgVarAttribute(
        cardEl,
        'stroke',
        defaultTopicEl ? defaultTopicBorderColor : borderColor
      );
    }
    for (const pathEl of mapClone.querySelectorAll('.yonxao-mindmap-connector')) {
      this.replaceSvgVarAttribute(pathEl, 'stroke', defaultConnectorColor);
      if (!pathEl.getAttribute('stroke')) pathEl.setAttribute('stroke', defaultConnectorColor);
    }
    for (const iconEl of mapClone.querySelectorAll('.yonxao-mindmap-topic-icon *')) {
      this.replaceSvgVarAttribute(iconEl, 'stroke', textColor);
      this.replaceSvgVarAttribute(iconEl, 'fill', backgroundColor, { replaceMissing: false });
    }
  },

  replaceSvgVarAttribute(element, attribute, fallback, options = {}) {
    const value = element.getAttribute(attribute);
    if (
      (options.replaceMissing !== false && !value) ||
      value?.includes('var(') ||
      value === 'currentColor'
    ) {
      element.setAttribute(attribute, fallback);
    }
  },

  resolveCssColor(variableName, fallback) {
    if (typeof window === 'undefined') return fallback;

    for (const element of [this.svgEl, this.hostEl]) {
      if (!element) continue;
      const value = window.getComputedStyle(element).getPropertyValue(variableName).trim();
      if (value) return value;
    }

    return fallback;
  },

  exportPixelScale(width, height) {
    const deviceScale =
      typeof window === 'undefined'
        ? 1
        : Math.min(window.devicePixelRatio || 1, EXPORT_MAX_DEVICE_PIXEL_RATIO);
    return Math.max(
      EXPORT_MIN_PIXEL_SCALE,
      Math.min(deviceScale, EXPORT_MAX_CANVAS_SIDE / width, EXPORT_MAX_CANVAS_SIDE / height)
    );
  },

  exportFileBaseName() {
    const rootText = String(this.root?._virtual ? 'yonxao-mindmap' : this.root?.text || 'mindmap')
      .split(/\r?\n/)[0]
      .trim();
    return (rootText || 'mindmap')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .slice(0, EXPORT_FILENAME_MAX_LENGTH);
  },
};
