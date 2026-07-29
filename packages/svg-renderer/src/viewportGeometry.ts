import type { LayoutBounds, Point } from '@yonxao/mindmap-core';
import {
  FOCUS_RATIO_BIASED,
  FOCUS_RATIO_BIAS_THRESHOLD,
  FOCUS_RATIO_CENTER,
  VIEWBOX_MARGIN_X,
  VIEWBOX_MARGIN_Y,
  VIEWBOX_MAX_DIMENSION,
  VIEWBOX_MIN_DIMENSION,
} from './renderConstants.js';

export interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function canvasToMapX(canvasX: number, viewBox: ViewBox, canvasWidth: number): number {
  return (canvasX * viewBox.width) / canvasWidth + viewBox.x;
}

export function canvasToMapY(canvasY: number, viewBox: ViewBox, canvasHeight: number): number {
  return (canvasY * viewBox.height) / canvasHeight + viewBox.y;
}

export function rootFocusPoint(bounds: LayoutBounds, rootBox?: ViewBox | null): Point {
  if (rootBox) {
    return {
      x: rootBox.x + rootBox.width / 2,
      y: rootBox.y + rootBox.height / 2,
    };
  }

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

export function originalSizeFocusRatio(negativeSpan: number, positiveSpan: number): number {
  if (positiveSpan > negativeSpan * FOCUS_RATIO_BIAS_THRESHOLD) return FOCUS_RATIO_BIASED;
  if (negativeSpan > positiveSpan * FOCUS_RATIO_BIAS_THRESHOLD) {
    return 1 - FOCUS_RATIO_BIASED;
  }
  return FOCUS_RATIO_CENTER;
}

export function originalSizeAxisStart(
  min: number,
  max: number,
  viewportSize: number,
  focus: number,
  focusRatio: number
): number {
  const contentSize = max - min;
  if (contentSize <= viewportSize) {
    return min - (viewportSize - contentSize) / 2;
  }
  return clamp(focus - viewportSize * focusRatio, min, max - viewportSize);
}

export function originalSizeViewBox(
  bounds: LayoutBounds,
  viewport: ViewportSize,
  focusX: number,
  focusY: number
): ViewBox {
  const minX = bounds.minX - VIEWBOX_MARGIN_X;
  const maxX = bounds.maxX + VIEWBOX_MARGIN_X;
  const minY = bounds.minY - VIEWBOX_MARGIN_Y;
  const maxY = bounds.maxY + VIEWBOX_MARGIN_Y;
  const leftSpan = Math.max(0, focusX - minX);
  const rightSpan = Math.max(0, maxX - focusX);
  const topSpan = Math.max(0, focusY - minY);
  const bottomSpan = Math.max(0, maxY - focusY);

  return {
    x: originalSizeAxisStart(
      minX,
      maxX,
      viewport.width,
      focusX,
      originalSizeFocusRatio(leftSpan, rightSpan)
    ),
    y: originalSizeAxisStart(
      minY,
      maxY,
      viewport.height,
      focusY,
      originalSizeFocusRatio(topSpan, bottomSpan)
    ),
    width: viewport.width,
    height: viewport.height,
  };
}

export function fitViewBox(
  contentViewBox: ViewBox,
  viewportWidth: number,
  maxScale: number
): ViewBox {
  if (!viewportWidth || !maxScale) return contentViewBox;
  const minWidthForScale = viewportWidth / maxScale;
  const width = Math.max(contentViewBox.width, minWidthForScale);
  return {
    x: contentViewBox.x - (width - contentViewBox.width) / 2,
    y: contentViewBox.y,
    width,
    height: contentViewBox.height,
  };
}

export function fullscreenFitViewBox(contentViewBox: ViewBox, viewport: ViewportSize): ViewBox {
  if (!viewport.height || !contentViewBox.width || !contentViewBox.height) return contentViewBox;

  const viewportRatio = viewport.width / viewport.height;
  const contentRatio = contentViewBox.width / contentViewBox.height;
  if (!Number.isFinite(viewportRatio) || !Number.isFinite(contentRatio)) return contentViewBox;

  if (contentRatio > viewportRatio) {
    const height = contentViewBox.width / viewportRatio;
    return {
      x: contentViewBox.x,
      y: contentViewBox.y - (height - contentViewBox.height) / 2,
      width: contentViewBox.width,
      height,
    };
  }

  const width = contentViewBox.height * viewportRatio;
  return {
    x: contentViewBox.x - (width - contentViewBox.width) / 2,
    y: contentViewBox.y,
    width,
    height: contentViewBox.height,
  };
}

export function zoomViewBox(
  viewBox: ViewBox,
  factor: number,
  centerX: number,
  centerY: number
): ViewBox {
  const nextWidth = clamp(viewBox.width * factor, VIEWBOX_MIN_DIMENSION, VIEWBOX_MAX_DIMENSION);
  const nextHeight = clamp(viewBox.height * factor, VIEWBOX_MIN_DIMENSION, VIEWBOX_MAX_DIMENSION);
  const widthRatio = nextWidth / viewBox.width;
  const heightRatio = nextHeight / viewBox.height;

  return {
    x: centerX - (centerX - viewBox.x) * widthRatio,
    y: centerY - (centerY - viewBox.y) * heightRatio,
    width: nextWidth,
    height: nextHeight,
  };
}
