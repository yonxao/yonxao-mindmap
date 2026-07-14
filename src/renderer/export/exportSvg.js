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
import { renderEquationSvg } from '../../utils/equationSvg.js';

const EXPORT_EQUATION_CAPTURE_PADDING = 2;

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
    const BufferCtor = globalThis.Buffer;
    if (typeof BufferCtor?.from !== 'function') return false;

    const buffer = await blob.arrayBuffer();
    const image = electron.nativeImage.createFromBuffer(BufferCtor.from(buffer));
    if (image.isEmpty && image.isEmpty()) return false;

    electron.clipboard.writeImage(image);
    return true;
  },

  electronClipboardModule() {
    const runtimeRequire =
      typeof globalThis.require === 'function'
        ? globalThis.require
        : typeof window !== 'undefined' && typeof window.require === 'function'
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
    const exportSvg = await this.createExportSvgElement();
    await this.inlineExportSvgImages(exportSvg);
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

  async createExportSvgElement() {
    if (!this.mapEl || !this.root) {
      throw new Error('当前没有可导出的导图。');
    }

    // 当前渲染边界已经包含高级结构及其布局占位；重新布局只会得到主题边界并可能改写现有坐标。
    const bounds =
      this.renderedMapBounds ||
      layoutTree(this.root, this.collapsedIds, this.config, this.topicRichTextLayoutOptions())
        .bounds;
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
    const backgroundColor = this.resolveCssColor('--background-primary', '#ffffff');
    // 导出 SVG 脱离 Obsidian 后仍需要解析概要背景和结构文字描边中的主题变量。
    // 如果只内联 fill/stroke 展示属性，导出样式表的类规则仍会覆盖它们并回退到浅色。
    exportSvg.style.setProperty('--background-primary', backgroundColor);

    exportSvg.appendChild(this.createExportSvgStyle());
    exportSvg.appendChild(
      svg('rect', {
        x: viewBox.x,
        y: viewBox.y,
        width: viewBox.width,
        height: viewBox.height,
        fill: backgroundColor,
      })
    );

    // 临时移除当前导图 DOM 中的焦点/选中样式，避免克隆后残留视觉状态；
    // 先保存原元素及对应类名，克隆完成后即刻恢复，保证用户操作不被打断。
    const transientFocusElements = Array.from(
      this.mapEl.querySelectorAll('.is-keyboard-focused, .is-structure-selected, .is-selected')
    );
    const transientFocusClasses = transientFocusElements.map((element) =>
      ['is-keyboard-focused', 'is-structure-selected', 'is-selected'].filter((className) =>
        element.classList.contains(className)
      )
    );
    for (const element of transientFocusElements) {
      element.classList.remove('is-keyboard-focused', 'is-structure-selected', 'is-selected');
    }

    let mapClone;
    try {
      mapClone = this.mapEl.cloneNode(true);
      this.inlineExportSvgComputedStyles(this.mapEl, mapClone);
    } finally {
      // 无论克隆是否成功，都必须恢复原元素的焦点/选中样式。
      transientFocusElements.forEach((element, index) => {
        element.classList.add(...transientFocusClasses[index]);
      });
    }
    await this.replaceExportEquationForeignObjects(this.mapEl, mapClone);
    this.cleanupExportMapClone(mapClone);
    this.inlineExportSvgColors(mapClone);
    // 签名水印跟随当前 viewBox；导出时改用导出视口，保证位置不受用户平移影响。
    this.syncSignatureWatermarkToViewBox(mapClone, viewBox);
    exportSvg.appendChild(mapClone);
    return exportSvg;
  },

  createExportSvgStyle() {
    const styleEl = svg('style');
    styleEl.textContent = `
      .yonxao-mindmap-connector{fill:none;stroke-width:${CONNECTOR_STROKE_WIDTH};stroke-linecap:round;stroke-linejoin:round;opacity:.62}
      /* 高级结构（边界框、摘要括号、关系路径、标签）的 SVG 样式，导出为独立文件时需显式声明。 */
      .yonxao-mindmap-boundary-frame{fill:color-mix(in srgb,var(--structure-color,#64748b) 8%,transparent);stroke:var(--structure-color,#64748b);stroke-width:1.5;stroke-dasharray:7 5;opacity:.78}
      .yonxao-mindmap-summary path,.yonxao-mindmap-relation-path{fill:none;stroke:var(--structure-color,#64748b);stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .yonxao-mindmap-summary>path,.yonxao-mindmap-relation-path{opacity:.78}
      .yonxao-mindmap-relation-path{stroke-dasharray:6 5}
      .yonxao-mindmap-relation-arrow{fill:context-stroke}
      .yonxao-mindmap-structure-label{fill:var(--structure-color,#64748b);font-size:13px;font-weight:600;paint-order:stroke;stroke:var(--background-primary,#fff);stroke-width:4px;stroke-linejoin:round}
      .yonxao-mindmap-summary-label-box{fill:var(--background-primary,#fff);stroke:var(--structure-color,#64748b);stroke-width:1.5}
      .yonxao-mindmap-boundary-label-box{fill:var(--structure-color,#64748b);stroke:var(--structure-color,#64748b);stroke-width:1.5}
      .yonxao-mindmap-boundary-label{fill:#fff;stroke:none}
      .yonxao-mindmap-topic-card{stroke-width:1.4}
      .yonxao-mindmap-topic-default .yonxao-mindmap-topic-card{stroke-width:1.6}
      .yonxao-mindmap-topic-tree-table .yonxao-mindmap-topic-card{stroke-width:1.5}
      .yonxao-mindmap-topic-tree-table-root .yonxao-mindmap-topic-card{stroke-width:2}
      .yonxao-mindmap-topic-text{letter-spacing:0;dominant-baseline:auto;user-select:none}
      .yonxao-mindmap-topic-icon path{fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-width:2}
    `;
    return styleEl;
  },

  /*
   * 递归遍历源 SVG 和克隆 SVG，将计算后样式内联到克隆元素上。
   * 使用 TreeWalker 并行遍历两棵树，保持节点一一对应。
   */
  inlineExportSvgComputedStyles(sourceRoot, cloneRoot) {
    if (typeof window === 'undefined' || !sourceRoot || !cloneRoot) return;

    this.inlineExportElementComputedStyle(sourceRoot, cloneRoot);
    const sourceWalker = document.createTreeWalker(sourceRoot, NodeFilter.SHOW_ELEMENT);
    const cloneWalker = document.createTreeWalker(cloneRoot, NodeFilter.SHOW_ELEMENT);

    while (sourceWalker.nextNode() && cloneWalker.nextNode()) {
      this.inlineExportElementComputedStyle(sourceWalker.currentNode, cloneWalker.currentNode);
    }
  },

  /*
   * 将单个 SVG 图形元素的计算后样式（fill/stroke/font 等）内联到克隆元素。
   * 只处理 path/rect/text 等可见图形元素，跳过容器元素。
   * 导出的 SVG 脱离 Obsidian 上下文后无法访问 CSS 变量，
   * 因此需要把计算后的具体色值写死到属性上。
   */
  inlineExportElementComputedStyle(sourceEl, cloneEl) {
    if (!sourceEl || !cloneEl || typeof window === 'undefined') return;
    const tagName = String(sourceEl.tagName || '').toLowerCase();
    const isSvgGraphic = /^(path|rect|circle|ellipse|line|polyline|polygon|text|tspan)$/.test(
      tagName
    );
    if (!isSvgGraphic) return;

    const computed = window.getComputedStyle(sourceEl);
    const attributes = [
      'fill',
      'stroke',
      'stroke-width',
      'stroke-linecap',
      'stroke-linejoin',
      'stroke-dasharray',
      'stroke-opacity',
      'fill-opacity',
      'opacity',
      'font-family',
      'font-size',
      'font-weight',
      'font-style',
      'text-anchor',
      'dominant-baseline',
      'paint-order',
    ];

    for (const attribute of attributes) {
      const value = computed.getPropertyValue(attribute).trim();
      if (!value || value === 'normal' || value === 'auto') continue;
      cloneEl.setAttribute(attribute, value);
    }

    const textDecorationLine = computed.getPropertyValue('text-decoration-line').trim();
    if (textDecorationLine && textDecorationLine !== 'none') {
      cloneEl.setAttribute('text-decoration', textDecorationLine);
    }

    const filter = computed.getPropertyValue('filter').trim();
    if (filter && filter !== 'none') cloneEl.style.filter = filter;
  },

  /*
   * 将导出 SVG 中的所有图片引用内联为 data URL。
   * 导出的 SVG 是独立文件，无法依赖 Obsidian 资源路径解析，
   * 因此需要把 vault 内图片读取为 base64 数据内嵌到 SVG 中。
   */
  async inlineExportSvgImages(exportSvg) {
    const imageElements = Array.from(exportSvg.querySelectorAll('image[href]'));
    // 平铺水印可能引用数百次同一图片；同一次导出只读取或请求一次相同资源。
    const dataUrlPromises = new Map();
    await Promise.all(
      imageElements.map(async (imageEl) => {
        const href = String(imageEl.getAttribute('href') || '').trim();
        const source = String(imageEl.getAttribute('data-image-source') || '').trim();
        const cacheKey = `${source}\u0000${href}`;
        if (!dataUrlPromises.has(cacheKey)) {
          dataUrlPromises.set(cacheKey, this.resolveExportImageDataUrl(imageEl));
        }
        const dataUrl = await dataUrlPromises.get(cacheKey);
        if (!dataUrl) return;
        imageEl.setAttribute('href', dataUrl);
        imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUrl);
      })
    );
  },

  /*
   * 解析图片元素的 data URL：已内联的直接返回；
   * Obsidian vault 内图片通过 vault.readBinary 读取后转为 data URL；
   * 外部 URL 通过 fetch 获取后转为 data URL。
   */
  async resolveExportImageDataUrl(imageEl) {
    const href = String(imageEl.getAttribute('href') || '').trim();
    if (!href || /^data:/i.test(href)) return href;

    const source = String(imageEl.getAttribute('data-image-source') || '').trim();
    const linkedFile = this.resolveExportImageFile(source);
    if (linkedFile) {
      try {
        const buffer = await this.plugin.app.vault.readBinary(linkedFile);
        return await this.blobToDataUrl(
          new Blob([buffer], { type: this.exportImageMimeType(linkedFile.path || source) })
        );
      } catch (_error) {
        return '';
      }
    }

    try {
      const response = await fetch(href);
      if (!response.ok) return '';
      return await this.blobToDataUrl(await response.blob());
    } catch (_error) {
      return '';
    }
  },

  resolveExportImageFile(source) {
    if (!source) return null;
    const app = this.plugin?.app;
    const sourcePath = this.ctx?.sourcePath || '';
    return app?.metadataCache?.getFirstLinkpathDest?.(source, sourcePath) || null;
  },

  blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('图片数据读取失败。'));
      reader.readAsDataURL(blob);
    });
  },

  exportImageMimeType(path) {
    const extension = String(path || '')
      .split('?')[0]
      .split('#')[0]
      .split('.')
      .pop()
      ?.toLowerCase();
    if (extension === 'svg') return 'image/svg+xml';
    if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
    if (extension === 'gif') return 'image/gif';
    if (extension === 'webp') return 'image/webp';
    if (extension === 'avif') return 'image/avif';
    return 'image/png';
  },

  /*
   * 替换导出 SVG 中的公式 foreignObject 为纯 SVG。
   * foreignObject 在导出为独立 SVG 或绘制到 canvas 时无法正确渲染，
   * 因此需要将其替换为 MathJax 输出的 SVG 或轻量兜底 SVG。
   */
  async replaceExportEquationForeignObjects(sourceRoot, cloneRoot) {
    const sourceElements = Array.from(
      sourceRoot.querySelectorAll('.yonxao-mindmap-topic-equation-rendered')
    );
    const cloneElements = Array.from(
      cloneRoot.querySelectorAll('.yonxao-mindmap-topic-equation-rendered')
    );

    for (let index = 0; index < cloneElements.length; index += 1) {
      const sourceElement = sourceElements[index];
      const cloneElement = cloneElements[index];
      if (!sourceElement || !cloneElement) continue;
      if (await this.replaceExportEquationForeignObject(sourceElement, cloneElement)) continue;
      this.showExportEquationFallback(cloneElement);
    }
  },

  /*
   * 替换单个公式 foreignObject：优先使用 Electron capturePage 截图实际渲染区，
   * 其次使用 MathJax SVG 克隆，最后使用轻量方程 SVG 兜底。
   * 兜底公式的尺寸和偏移仍取自页面中真实 MathJax 区块的定位，
   * 避免复制图片里的公式字号、基线、分式高度明显偏离预览。
   */
  async replaceExportEquationForeignObject(sourceElement, cloneElement) {
    const sourceMathSvg = sourceElement.querySelector('mjx-container svg, svg');
    const placement = this.exportEquationPlacement(sourceElement, cloneElement, sourceMathSvg);
    const capturedImage = sourceMathSvg
      ? null
      : await this.createExportEquationCapturedImage(sourceElement, placement);
    if (capturedImage) {
      cloneElement.replaceWith(capturedImage);
      return true;
    }

    const exportSvg =
      sourceMathSvg?.cloneNode(true) || (await this.createExportEquationSvg(sourceElement));
    if (!exportSvg) return false;

    /*
     * MathJax 的 HTML foreignObject 不能安全绘制到 canvas。导出时把公式替换成纯 SVG，
     * 但尺寸和偏移仍取自页面里真实渲染出的 MathJax/HTML 区块，避免兜底 SVG 与预览
     * 在字号、垂直居中、分式高度上出现明显偏差。
     */
    this.applyExportEquationSvgPlacement(exportSvg, placement);
    cloneElement.replaceWith(exportSvg);
    return true;
  },

  async createExportEquationCapturedImage(sourceElement, placement) {
    const electronWindow = this.currentElectronWindowForElementCapture();
    const mathContentEl = this.exportEquationContentElement(sourceElement, null);
    const rect = mathContentEl?.getBoundingClientRect?.();
    if (!electronWindow?.capturePage || !rect?.width || !rect?.height) return null;
    if (!this.isRectFullyVisibleInViewport(rect, EXPORT_EQUATION_CAPTURE_PADDING)) return null;

    try {
      const padding = EXPORT_EQUATION_CAPTURE_PADDING;
      const captureRect = {
        x: Math.max(0, Math.floor(rect.left - padding)),
        y: Math.max(0, Math.floor(rect.top - padding)),
        width: Math.ceil(rect.width + padding * 2),
        height: Math.ceil(rect.height + padding * 2),
      };
      const nativeImage = await electronWindow.capturePage(captureRect);
      const dataUrl = this.nativeImageToDataUrl(nativeImage);
      if (!dataUrl) return null;

      return svg('image', {
        href: dataUrl,
        x: placement.x - padding,
        y: placement.y - padding,
        width: captureRect.width,
        height: captureRect.height,
        preserveAspectRatio: 'none',
        class: 'yonxao-mindmap-topic-equation-export',
      });
    } catch (_error) {
      return null;
    }
  },

  /*
   * 获取当前 Electron 窗口对象用于 capturePage。
   * 依次尝试 @electron/remote、electron.remote、window.electron 等候选，
   * 兼容 Obsidian 不同版本的模块暴露方式。
   */
  currentElectronWindowForElementCapture() {
    const runtimeRequire =
      typeof globalThis.require === 'function'
        ? globalThis.require
        : typeof window !== 'undefined' && typeof window.require === 'function'
          ? window.require
          : null;

    if (runtimeRequire) {
      try {
        const remote = runtimeRequire('@electron/remote');
        const currentWindow = remote?.getCurrentWindow?.();
        if (currentWindow?.capturePage) return currentWindow;
      } catch (_error) {
        // Obsidian may not expose @electron/remote; try the legacy Electron remote bridge below.
      }

      try {
        const electron = runtimeRequire('electron');
        const currentWindow = electron?.remote?.getCurrentWindow?.();
        if (currentWindow?.capturePage) return currentWindow;
      } catch (_error) {
        // Continue with Obsidian-provided bridge candidates below.
      }
    }

    const bridgedWindow =
      typeof window === 'undefined'
        ? null
        : window.electron?.remote?.getCurrentWindow?.() ||
          window.electronWindow ||
          this.plugin?.app?.workspace?.containerEl?.win?.electronWindow;
    return bridgedWindow?.capturePage ? bridgedWindow : null;
  },

  nativeImageToDataUrl(nativeImage) {
    if (typeof nativeImage?.toDataURL === 'function') {
      const dataUrl = nativeImage.toDataURL();
      if (dataUrl?.startsWith('data:image/')) return dataUrl;
    }

    const png = nativeImage?.toPNG?.();
    if (!png?.length || typeof png.toString !== 'function') return null;
    return `data:image/png;base64,${png.toString('base64')}`;
  },

  /*
   * 检查矩形区域是否完全可见在视口内（含内边距容差）。
   * 用于判断 Electron capturePage 能否截取到完整的公式渲染区域。
   */
  isRectFullyVisibleInViewport(rect, padding = 0) {
    if (typeof window === 'undefined') return false;
    return (
      rect.left - padding >= 0 &&
      rect.top - padding >= 0 &&
      rect.right + padding <= window.innerWidth &&
      rect.bottom + padding <= window.innerHeight
    );
  },

  /*
   * 创建导出用的公式 SVG：优先使用 MathJax tex2svgPromise 渲染，
   * 失败时回退到轻量 equationSvg 渲染器兜底。
   * Obsidian 可能只暴露 CHTML 输出（不支持 SVG 转换），此时直接走兜底。
   */
  async createExportEquationSvg(sourceElement) {
    const source = String(sourceElement.getAttribute('data-equation-source') || '').trim();
    if (!source || typeof window === 'undefined') return null;

    const mathJax = window.MathJax;
    if (mathJax) {
      try {
        await mathJax.startup?.promise;
        const container =
          typeof mathJax.tex2svgPromise === 'function'
            ? await mathJax.tex2svgPromise(source, { display: true })
            : typeof mathJax.tex2svg === 'function'
              ? mathJax.tex2svg(source, { display: true })
              : null;
        const svgEl = container?.querySelector?.('svg') || null;
        if (svgEl) {
          const exportSvg = svgEl.cloneNode(true);
          exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
          return exportSvg;
        }
      } catch (_error) {
        // 当前 Obsidian 可能只暴露 CHTML 输出；继续使用轻量 SVG 兜底渲染。
      }
    }

    return renderEquationSvg(source, {
      fontSize: this.exportEquationFontSize(sourceElement),
      color: this.exportEquationColor(sourceElement),
    });
  },

  exportEquationPlacement(sourceElement, cloneElement, sourceMathSvg) {
    const x = Number(cloneElement.getAttribute('x')) || 0;
    const y = Number(cloneElement.getAttribute('y')) || 0;
    const fallbackWidth = Number(cloneElement.getAttribute('width')) || 40;
    const fallbackHeight = Number(cloneElement.getAttribute('height')) || 24;
    const mathContentEl = this.exportEquationContentElement(sourceElement, sourceMathSvg);
    const foreignObjectRect = sourceElement.getBoundingClientRect?.();
    const mathContentRect = mathContentEl?.getBoundingClientRect?.();

    if (
      foreignObjectRect?.width &&
      foreignObjectRect?.height &&
      mathContentRect?.width &&
      mathContentRect?.height
    ) {
      return {
        x: x + (mathContentRect.left - foreignObjectRect.left),
        y: y + (mathContentRect.top - foreignObjectRect.top),
        width: mathContentRect.width,
        height: mathContentRect.height,
        color: this.exportEquationColor(mathContentEl),
      };
    }

    return {
      x,
      y,
      width: fallbackWidth,
      height: fallbackHeight,
      color: this.exportEquationColor(sourceElement),
    };
  },

  applyExportEquationSvgPlacement(exportSvg, placement) {
    exportSvg.setAttribute('x', placement.x);
    exportSvg.setAttribute('y', placement.y);
    exportSvg.setAttribute('width', placement.width);
    exportSvg.setAttribute('height', placement.height);
    exportSvg.setAttribute('overflow', 'visible');
    exportSvg.setAttribute('preserveAspectRatio', 'xMinYMid meet');
    exportSvg.classList.add('yonxao-mindmap-topic-equation-export');
    exportSvg.style.color = placement.color;
    exportSvg.style.fill = placement.color;
  },

  exportEquationFontSize(sourceElement) {
    const host = sourceElement.querySelector('.yonxao-mindmap-topic-equation-host');
    const value =
      (host && window.getComputedStyle(host).fontSize) ||
      window.getComputedStyle(sourceElement).fontSize;
    return Number.parseFloat(value) || 16;
  },

  exportEquationColor(element) {
    if (typeof window === 'undefined' || !element) {
      return this.resolveCssColor('--text-normal', '#1f2328');
    }
    return (
      window.getComputedStyle(element).color || this.resolveCssColor('--text-normal', '#1f2328')
    );
  },

  exportEquationContentElement(sourceElement, sourceMathSvg) {
    return (
      sourceMathSvg ||
      sourceElement.querySelector(
        'mjx-container, .math, .math-block, .yonxao-mindmap-topic-equation-host'
      ) ||
      sourceElement
    );
  },

  showExportEquationFallback(cloneElement) {
    const groupEl = cloneElement.closest('.yonxao-mindmap-topic-equation-block');
    cloneElement.remove();
    if (!groupEl) return;
    groupEl.classList.remove('is-equation-rendered');
    for (const textEl of groupEl.querySelectorAll('.yonxao-mindmap-topic-equation-text')) {
      textEl.setAttribute('opacity', '1');
      textEl.style.opacity = '1';
    }
  },

  cleanupExportMapClone(mapClone) {
    const selectors = [
      '.yonxao-mindmap-toggle',
      '.yonxao-mindmap-topic-edit',
      '.yonxao-mindmap-topic-sibling-actions',
      '.yonxao-mindmap-topic-subtopic-add',
      '.yonxao-mindmap-drop-indicator',
      '.yonxao-mindmap-relation-controls', // 关系线编辑手柄（拖拽、删除），导出时不需要交互控件。
      '.yonxao-mindmap-structure-hit-target', // 结构不可见点击区，导出时不显示且不应参与 DOM。
      'title',
    ];
    for (const element of mapClone.querySelectorAll(selectors.join(','))) {
      element.remove();
    }
    // 导出图片前移除主题焦点高亮，避免导出/复制图片中残留焦点框
    for (const element of mapClone.querySelectorAll('.is-keyboard-focused')) {
      element.classList.remove('is-keyboard-focused');
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
