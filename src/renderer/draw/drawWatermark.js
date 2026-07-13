/*
 * 文件作用：
 * 绘制导图水印 SVG 图层。普通水印绑定内容边界，签名水印绑定视口；画布与导出复用同一图层。
 */

import {
  DEFAULT_MIND_CONFIG,
  MAP_CONTENT_LAYER_ATTRIBUTE,
  svg,
} from '../../shared/rendererShared.js';

// 超大导图和极密间距下限制单次创建的平铺元素数量，避免水印拖慢主渲染。
const MAX_TILED_WATERMARK_COUNT = 500;
const MIN_TILE_STEP = 1;
const NORMAL_WATERMARK_POSITION_PADDING = 16;
const SIGNATURE_TEXT_MIN_WIDTH_UNITS = 4;
const SIGNATURE_TEXT_WIDTH_FACTOR = 0.62;
const SIGNATURE_TEXT_HEIGHT_FACTOR = 1.5;
const SIGNATURE_CORNER_RADIUS_MAX = 8;
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

    const textWidth = Math.max(
      config.fontSize * SIGNATURE_TEXT_MIN_WIDTH_UNITS,
      [...config.text].length * config.fontSize * SIGNATURE_TEXT_WIDTH_FACTOR
    );
    const textHeight = config.fontSize * SIGNATURE_TEXT_HEIGHT_FACTOR;
    const point = this.watermarkPositionPoint(
      bounds,
      config.position,
      textWidth,
      textHeight,
      config.padding
    );
    layer.appendChild(
      svg('rect', {
        'data-watermark-corner-background': 'true',
        x: point.x,
        y: point.y,
        width: textWidth,
        height: textHeight,
        rx: Math.min(SIGNATURE_CORNER_RADIUS_MAX, textHeight / 3),
        fill: colors.background,
        opacity: config.opacity * SIGNATURE_BACKGROUND_OPACITY_FACTOR,
      })
    );
    const textEl = this.createWatermarkText(
      config.text,
      point.x + textWidth / 2,
      point.y + textHeight / 2,
      {
        color: colors.text,
        fontSize: config.fontSize,
        opacity: config.opacity,
      }
    );
    textEl.setAttribute('data-watermark-corner-text', 'true');
    layer.appendChild(textEl);
    return { layer, bounds: { ...bounds } };
  },

  renderSignatureWatermarkBar(layer, bounds, config, colors) {
    const isTop = config.position.startsWith('top');
    const barY = isTop ? bounds.minY - config.barHeight : bounds.maxY;
    const barWidth = bounds.maxX - bounds.minX;
    layer.classList.add('is-bar');
    const contentClipId = `${this.sourceViewIdPrefix}-watermark-bar-content-clip`;
    const defs = svg('defs');
    const contentClipPath = svg('clipPath', { id: contentClipId });
    contentClipPath.appendChild(
      svg('rect', {
        'data-watermark-bar-content-clip': 'true',
        x: bounds.minX,
        y: bounds.minY,
        width: barWidth,
        height: bounds.maxY - bounds.minY,
      })
    );
    defs.appendChild(contentClipPath);
    layer.appendChild(defs);
    layer.appendChild(
      svg('rect', {
        'data-watermark-bar-background': 'true',
        x: bounds.minX,
        y: barY,
        width: barWidth,
        height: config.barHeight,
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
        x: bounds.minX,
        y: barY,
        width: barWidth,
        height: config.barHeight,
        fill: colors.text,
        opacity: Math.min(
          SIGNATURE_BAR_TINT_OPACITY_MAX,
          config.opacity * SIGNATURE_BAR_TINT_OPACITY_FACTOR
        ),
      })
    );
    const textEl = this.createWatermarkText(
      config.text,
      bounds.maxX - config.padding,
      barY + config.barHeight / 2,
      {
        color: colors.text,
        fontSize: config.fontSize,
        opacity: config.opacity,
        anchor: 'end',
      }
    );
    textEl.setAttribute('data-watermark-bar-text', 'true');
    layer.appendChild(textEl);
    return {
      layer,
      bounds: {
        ...bounds,
        minY: isTop ? barY : bounds.minY,
        maxY: isTop ? bounds.maxY : bounds.maxY + config.barHeight,
      },
    };
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
    const isTop = config.position.startsWith('top');
    const y = isTop ? viewport.y : viewport.y + viewport.height - config.barHeight;
    const contentY = isTop ? viewport.y + config.barHeight : viewport.y;
    const contentHeight = Math.max(0, viewport.height - config.barHeight);

    for (const backgroundEl of layer.querySelectorAll('[data-watermark-bar-background]')) {
      backgroundEl.setAttribute('x', viewport.x);
      backgroundEl.setAttribute('y', y);
      backgroundEl.setAttribute('width', viewport.width);
      backgroundEl.setAttribute('height', config.barHeight);
    }
    const textEl = layer.querySelector('[data-watermark-bar-text]');
    textEl?.setAttribute('x', viewport.x + viewport.width - config.padding);
    textEl?.setAttribute('y', y + config.barHeight / 2);

    const contentClipEl = layer.querySelector('[data-watermark-bar-content-clip]');
    contentClipEl?.setAttribute('x', viewport.x);
    contentClipEl?.setAttribute('y', contentY);
    contentClipEl?.setAttribute('width', viewport.width);
    contentClipEl?.setAttribute('height', contentHeight);
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
    const point = this.watermarkPositionPoint(
      {
        minX: viewport.x,
        minY: viewport.y,
        maxX: viewport.x + viewport.width,
        maxY: viewport.y + viewport.height,
      },
      config.position,
      width,
      height,
      config.padding
    );
    backgroundEl.setAttribute('x', point.x);
    backgroundEl.setAttribute('y', point.y);
    textEl.setAttribute('x', point.x + width / 2);
    textEl.setAttribute('y', point.y + height / 2);
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
      const point = this.watermarkPositionPoint(
        bounds,
        config.position,
        config.width,
        config.height,
        NORMAL_WATERMARK_POSITION_PADDING
      );
      contentLayer.appendChild(
        this.createNormalWatermarkElement(
          config,
          point.x + config.offsetX,
          point.y + config.offsetY,
          config.width,
          config.height,
          imageHref
        )
      );
    }
    layer.appendChild(contentLayer);
    return { layer, bounds: { ...bounds } };
  },

  appendTiledWatermarks(layer, bounds, config, imageHref) {
    const stepX = Math.max(MIN_TILE_STEP, config.width + config.gapX);
    const stepY = Math.max(MIN_TILE_STEP, config.height + config.gapY);
    const estimatedColumns = Math.ceil((bounds.maxX - bounds.minX + config.width * 2) / stepX);
    const estimatedRows = Math.ceil((bounds.maxY - bounds.minY + config.height * 2) / stepY);
    const densityScale = Math.max(
      1,
      Math.ceil(Math.sqrt((estimatedColumns * estimatedRows) / MAX_TILED_WATERMARK_COUNT))
    );
    const safeStepX = stepX * densityScale;
    const safeStepY = stepY * densityScale;
    const anchor = this.watermarkPositionPoint(
      bounds,
      config.position,
      config.width,
      config.height,
      0
    );
    let startX = anchor.x + config.offsetX;
    let startY = anchor.y + config.offsetY;
    while (startX > bounds.minX - config.width) startX -= safeStepX;
    while (startY > bounds.minY - config.height) startY -= safeStepY;
    while (startX + safeStepX <= bounds.minX - config.width) startX += safeStepX;
    while (startY + safeStepY <= bounds.minY - config.height) startY += safeStepY;

    let renderedCount = 0;
    for (let y = startY; y <= bounds.maxY + config.height; y += safeStepY) {
      for (let x = startX; x <= bounds.maxX + config.width; x += safeStepX) {
        if (renderedCount >= MAX_TILED_WATERMARK_COUNT) return;
        layer.appendChild(
          this.createNormalWatermarkElement(config, x, y, config.width, config.height, imageHref)
        );
        renderedCount += 1;
      }
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

  createWatermarkText(text, x, y, options = {}) {
    const textEl = svg('text', {
      x,
      y,
      fill: options.color,
      'font-size': options.fontSize,
      'font-family': 'var(--font-text, system-ui, sans-serif)',
      'text-anchor': options.anchor || 'middle',
      'dominant-baseline': 'middle',
      opacity: options.opacity,
    });
    textEl.textContent = text;
    return textEl;
  },

  watermarkPositionPoint(bounds, position, width, height, padding) {
    const horizontal = position.endsWith('left')
      ? 'left'
      : position.endsWith('right')
        ? 'right'
        : 'center';
    const vertical = position.startsWith('top')
      ? 'top'
      : position.startsWith('bottom')
        ? 'bottom'
        : 'center';
    const x =
      horizontal === 'left'
        ? bounds.minX + padding
        : horizontal === 'right'
          ? bounds.maxX - width - padding
          : (bounds.minX + bounds.maxX - width) / 2;
    const y =
      vertical === 'top'
        ? bounds.minY + padding
        : vertical === 'bottom'
          ? bounds.maxY - height - padding
          : (bounds.minY + bounds.maxY - height) / 2;
    return { x, y };
  },
};
