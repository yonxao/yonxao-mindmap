/*
 * 文件作用：
 * 绘制导图水印 SVG 图层。普通水印绑定内容边界，签名水印绑定视口；画布与导出复用同一图层。
 */

import {
  DEFAULT_MIND_CONFIG,
  MAP_CONTENT_LAYER_ATTRIBUTE,
  svg,
} from '../../shared/rendererShared.js';
import {
  normalWatermarkElementSize as coreNormalWatermarkElementSize,
  signatureCornerWatermarkGeometry,
  signatureWatermarkBarGeometry,
  signatureWatermarkBarViewportGeometry,
  tiledWatermarkPlacements,
  watermarkCornerTextAnchor as coreWatermarkCornerTextAnchor,
  watermarkCornerTextBaseline as coreWatermarkCornerTextBaseline,
  watermarkCornerTextPoint,
  watermarkPositionPoint as coreWatermarkPositionPoint,
} from '@yonxao/mindmap-svg-renderer';

const NORMAL_WATERMARK_POSITION_PADDING = 16;
const SIGNATURE_BACKGROUND_OPACITY_FACTOR = 0.72;
const SIGNATURE_BAR_TINT_OPACITY_FACTOR = 0.18;
const SIGNATURE_BAR_TINT_OPACITY_MAX = 0.12;
const DEFAULT_SIGNATURE_CONFIG = DEFAULT_MIND_CONFIG.watermark.signature;

export const watermarkDrawMethods = {
  renderWatermark(bounds) {
    const config = this.config.watermark;
    if (!this.plugin?.isWatermarkUnlocked?.() || !config?.enabled) {
      return { layer: null, bounds: { ...bounds } };
    }

    if (config.mode === 'signature') {
      return this.renderSignatureWatermark(bounds, config.signature);
    }
    return this.renderNormalWatermark(bounds, config.normal);
  },

  renderSignatureWatermark(bounds, config) {
    const colors = this.resolveSignatureWatermarkColors(config);
    const layer = svg('g', {
      class: 'yonxao-mindmap-watermark-layer is-signature',
      'pointer-events': 'none',
    });
    if (config.style === 'bar') {
      return this.renderSignatureWatermarkBar(layer, bounds, config, colors);
    }
    layer.classList.add('is-corner');

    const geometry = signatureCornerWatermarkGeometry(bounds, config);
    layer.appendChild(
      svg('rect', {
        'data-watermark-corner-background': 'true',
        x: geometry.point.x,
        y: geometry.point.y,
        width: geometry.size.width,
        height: geometry.size.height,
        rx: geometry.radius,
        fill: colors.background,
        opacity: config.opacity * SIGNATURE_BACKGROUND_OPACITY_FACTOR,
      })
    );
    const textEl = this.createWatermarkText(config.text, geometry.text.x, geometry.text.y, {
      color: colors.text,
      fontSize: config.fontSize,
      opacity: config.opacity,
      anchor: geometry.text.anchor,
      baseline: geometry.text.baseline,
    });
    textEl.setAttribute('data-watermark-corner-text', 'true');
    layer.appendChild(textEl);
    return { layer, bounds: { ...bounds } };
  },

  renderSignatureWatermarkBar(layer, bounds, config, colors) {
    const geometry = signatureWatermarkBarGeometry(bounds, config);
    layer.classList.add('is-bar');
    const contentClipId = `${this.sourceViewIdPrefix}-watermark-bar-content-clip`;
    const defs = svg('defs');
    const contentClipPath = svg('clipPath', { id: contentClipId });
    contentClipPath.appendChild(
      svg('rect', {
        'data-watermark-bar-content-clip': 'true',
        ...geometry.contentClip,
      })
    );
    defs.appendChild(contentClipPath);
    layer.appendChild(defs);
    layer.appendChild(
      svg('rect', {
        'data-watermark-bar-background': 'true',
        ...geometry.bar,
        fill: colors.background,
        opacity: config.opacity,
      })
    );
    /*
     * 水印条即使没有显式背景色，也保留一层随签名文字颜色变化的浅色底，
     * 用于区分水印条区域；角落签名仍保持真正的透明背景。
     */
    layer.appendChild(
      svg('rect', {
        'data-watermark-bar-background': 'true',
        ...geometry.bar,
        fill: colors.text,
        opacity: Math.min(
          SIGNATURE_BAR_TINT_OPACITY_MAX,
          config.opacity * SIGNATURE_BAR_TINT_OPACITY_FACTOR
        ),
      })
    );
    const textEl = this.createWatermarkText(config.text, geometry.text.x, geometry.text.y, {
      color: colors.text,
      fontSize: config.fontSize,
      opacity: config.opacity,
      anchor: 'end',
    });
    textEl.setAttribute('data-watermark-bar-text', 'true');
    layer.appendChild(textEl);
    return { layer, bounds: geometry.bounds };
  },

  /*
   * 内置签名颜色直接保留为 Obsidian CSS 变量，由浏览器在深浅主题切换时自动重新计算；
   * 不能在渲染时解析成固定色值，否则切换主题但导图未重绘时颜色不会变化。
   * 用户显式选择其他颜色后仍保持其配置值。
   */
  resolveSignatureWatermarkColors(config) {
    const defaultTextColor =
      String(config.color || '').toLowerCase() === DEFAULT_SIGNATURE_CONFIG.color;
    const defaultBackgroundColor =
      String(config.backgroundColor || '').toLowerCase() ===
      DEFAULT_SIGNATURE_CONFIG.backgroundColor;
    return {
      text: defaultTextColor ? `var(--text-muted, ${config.color})` : config.color,
      background: defaultBackgroundColor ? 'transparent' : config.backgroundColor,
    };
  },

  /*
   * 水印条属于视口层：每次 viewBox 变化后重新铺满当前视口宽度，并固定在顶部或底部。
   * 初次适配仍使用扩展后的 renderedMapBounds 为水印条预留高度，避免主题和水印条重叠。
   */
  syncSignatureWatermarkBar(root, viewport) {
    const layer = root?.querySelector?.('.yonxao-mindmap-watermark-layer.is-bar');
    if (!layer || !viewport) return;
    const config = this.config.watermark?.signature;
    if (!config) return;
    const geometry = signatureWatermarkBarViewportGeometry(viewport, config);

    for (const backgroundEl of layer.querySelectorAll('[data-watermark-bar-background]')) {
      backgroundEl.setAttribute('x', geometry.bar.x);
      backgroundEl.setAttribute('y', geometry.bar.y);
      backgroundEl.setAttribute('width', geometry.bar.width);
      backgroundEl.setAttribute('height', geometry.bar.height);
    }
    const textEl = layer.querySelector('[data-watermark-bar-text]');
    textEl?.setAttribute('x', geometry.text.x);
    textEl?.setAttribute('y', geometry.text.y);

    const contentClipEl = layer.querySelector('[data-watermark-bar-content-clip]');
    contentClipEl?.setAttribute('x', geometry.contentClip.x);
    contentClipEl?.setAttribute('y', geometry.contentClip.y);
    contentClipEl?.setAttribute('width', geometry.contentClip.width);
    contentClipEl?.setAttribute('height', geometry.contentClip.height);
    const clipId = contentClipEl?.parentElement?.getAttribute('id');
    if (!clipId || !layer.parentElement) return;
    for (const child of layer.parentElement.children) {
      if (!child.hasAttribute(MAP_CONTENT_LAYER_ATTRIBUTE)) continue;
      child.setAttribute('clip-path', `url(#${clipId})`);
    }
  },

  /* 角落签名同样以当前视口为定位基准，避免导图内容较窄时“右下”看起来偏向中间。 */
  syncSignatureCornerWatermark(root, viewport) {
    const layer = root?.querySelector?.('.yonxao-mindmap-watermark-layer.is-corner');
    if (!layer || !viewport) return;
    const config = this.config.watermark?.signature;
    const backgroundEl = layer.querySelector('[data-watermark-corner-background]');
    const textEl = layer.querySelector('[data-watermark-corner-text]');
    if (!config || !backgroundEl || !textEl) return;
    const width = Number(backgroundEl.getAttribute('width')) || 0;
    const height = Number(backgroundEl.getAttribute('height')) || 0;
    const point = coreWatermarkPositionPoint(
      {
        minX: viewport.x,
        minY: viewport.y,
        maxX: viewport.x + viewport.width,
        maxY: viewport.y + viewport.height,
      },
      config.position,
      width,
      height,
      config.paddingX,
      config.paddingY
    );
    const textPoint = watermarkCornerTextPoint(point, { width, height }, config.position);
    backgroundEl.setAttribute('x', point.x);
    backgroundEl.setAttribute('y', point.y);
    textEl.setAttribute('x', textPoint.x);
    textEl.setAttribute('text-anchor', textPoint.anchor);
    textEl.setAttribute('y', textPoint.y);
    textEl.setAttribute('dominant-baseline', textPoint.baseline);
  },

  syncSignatureWatermarkToViewBox(root = this.mapEl, viewport = this.viewBox) {
    this.syncSignatureWatermarkBar(root, viewport);
    this.syncSignatureCornerWatermark(root, viewport);
  },

  renderNormalWatermark(bounds, config) {
    const layer = svg('g', {
      class: `yonxao-mindmap-watermark-layer is-normal is-${config.type}`,
      'pointer-events': 'none',
    });
    const clipId = `${this.sourceViewIdPrefix}-watermark-clip`;
    const defs = svg('defs');
    const clipPath = svg('clipPath', { id: clipId });
    clipPath.appendChild(
      svg('rect', {
        x: bounds.minX,
        y: bounds.minY,
        width: bounds.maxX - bounds.minX,
        height: bounds.maxY - bounds.minY,
      })
    );
    defs.appendChild(clipPath);
    layer.appendChild(defs);
    const contentLayer = svg('g', { 'clip-path': `url(#${clipId})` });
    // 图片地址只解析一次；平铺时复用结果，避免数百次重复查询 vault 元数据。
    const imageHref =
      config.type === 'image'
        ? this.resolveTopicImageHref({ source: config.imageSource })
        : undefined;
    if (config.type === 'image' && !imageHref) {
      layer.appendChild(contentLayer);
      return { layer, bounds: { ...bounds } };
    }

    if (config.arrangement === 'tiled') {
      this.appendTiledWatermarks(contentLayer, bounds, config, imageHref);
    } else {
      const size = this.normalWatermarkElementSize(config);
      const point = this.watermarkPositionPoint(
        bounds,
        config.position,
        size.width,
        size.height,
        NORMAL_WATERMARK_POSITION_PADDING
      );
      contentLayer.appendChild(
        this.createNormalWatermarkElement(
          config,
          point.x + config.offsetX,
          point.y + config.offsetY,
          size.width,
          size.height,
          imageHref
        )
      );
    }
    layer.appendChild(contentLayer);
    return { layer, bounds: { ...bounds } };
  },

  appendTiledWatermarks(layer, bounds, config, imageHref) {
    for (const { x, y } of tiledWatermarkPlacements(bounds, config)) {
      layer.appendChild(
        this.createNormalWatermarkElement(config, x, y, config.width, config.height, imageHref)
      );
    }
  },

  createNormalWatermarkElement(config, x, y, width, height, imageHref) {
    const group = svg('g', {
      transform: `rotate(${config.rotation} ${x + width / 2} ${y + height / 2})`,
      opacity: config.opacity,
    });
    if (config.type === 'image') {
      group.appendChild(
        svg('image', {
          x,
          y,
          width,
          height,
          href: imageHref,
          'data-image-source': config.imageSource,
          preserveAspectRatio: 'xMidYMid meet',
          crossorigin: 'anonymous',
        })
      );
      return group;
    }

    group.appendChild(
      this.createWatermarkText(config.text, x + width / 2, y + height / 2, {
        color: config.color,
        fontSize: config.fontSize,
      })
    );
    return group;
  },

  normalWatermarkElementSize(config) {
    return coreNormalWatermarkElementSize(config);
  },

  createWatermarkText(text, x, y, options = {}) {
    const textEl = svg('text', {
      x,
      y,
      fill: options.color,
      'font-size': options.fontSize,
      'font-family': 'var(--font-text, system-ui, sans-serif)',
      'text-anchor': options.anchor || 'middle',
      'dominant-baseline': options.baseline || 'middle',
      opacity: options.opacity,
    });
    textEl.textContent = text;
    return textEl;
  },

  watermarkPositionPoint(bounds, position, width, height, paddingX, paddingY = paddingX) {
    return coreWatermarkPositionPoint(bounds, position, width, height, paddingX, paddingY);
  },

  /*
   * 根据 position 语义将 SVG text-anchor 映射为标准值。
   * left→start（左对齐）、right→end（右对齐）、其余→middle（居中）。
   */
  watermarkCornerTextAnchor(position) {
    return coreWatermarkCornerTextAnchor(position);
  },

  /*
   * 根据锚点对齐模式计算文字的 x 坐标。
   * start 对齐时文字左侧与背景左侧对齐，end 对齐时文字右侧与背景右侧对齐。
   */
  watermarkCornerTextX(x, width, position) {
    return watermarkCornerTextPoint({ x, y: 0 }, { width, height: 0 }, position).x;
  },

  /*
   * 根据 position 语义将 SVG dominant-baseline 映射为标准值。
   * top→text-before-edge（顶对齐）、bottom→text-after-edge（底对齐）、其余→middle（居中）。
   */
  watermarkCornerTextBaseline(position) {
    return coreWatermarkCornerTextBaseline(position);
  },

  /*
   * 根据基线对齐模式计算文字的 y 坐标。
   * text-before-edge 时文字顶部与背景顶部对齐，text-after-edge 时文字底部与背景底部对齐。
   */
  watermarkCornerTextY(y, height, position) {
    return watermarkCornerTextPoint({ x: 0, y }, { width: 0, height }, position).y;
  },
};
