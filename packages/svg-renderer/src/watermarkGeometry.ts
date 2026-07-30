export interface WatermarkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface WatermarkViewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WatermarkPoint {
  x: number;
  y: number;
}

export interface WatermarkSize {
  width: number;
  height: number;
}

export interface NormalWatermarkGeometryConfig {
  type: string;
  arrangement: string;
  position: string;
  text: string;
  fontSize: number;
  width: number;
  height: number;
  gapX: number;
  gapY: number;
  offsetX: number;
  offsetY: number;
}

export interface SignatureWatermarkGeometryConfig {
  text: string;
  position: string;
  fontSize: number;
  barHeight: number;
  paddingX: number;
}

export interface SignatureCornerGeometry {
  point: WatermarkPoint;
  size: WatermarkSize;
  radius: number;
  text: WatermarkPoint & {
    anchor: 'start' | 'middle' | 'end';
    baseline: 'text-before-edge' | 'middle' | 'text-after-edge';
  };
}

export interface SignatureBarGeometry {
  bar: WatermarkViewport;
  contentClip: WatermarkViewport;
  text: WatermarkPoint;
  bounds: WatermarkBounds;
}

const MAX_TILED_WATERMARK_COUNT = 500;
const MIN_TILE_STEP = 1;
const SIGNATURE_TEXT_MIN_WIDTH_UNITS = 4;
const SIGNATURE_TEXT_WIDTH_FACTOR = 0.62;
const SIGNATURE_TEXT_HEIGHT_FACTOR = 1.5;
const NORMAL_TEXT_MIN_WIDTH_UNITS = 2;
const NORMAL_TEXT_WIDTH_FACTOR = 0.62;
const NORMAL_TEXT_HEIGHT_FACTOR = 1.35;
const SIGNATURE_CORNER_RADIUS_MAX = 8;

export function watermarkPositionPoint(
  bounds: WatermarkBounds,
  position: string,
  width: number,
  height: number,
  paddingX: number,
  paddingY = paddingX
): WatermarkPoint {
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

  return {
    x:
      horizontal === 'left'
        ? bounds.minX + paddingX
        : horizontal === 'right'
          ? bounds.maxX - width - paddingX
          : (bounds.minX + bounds.maxX - width) / 2,
    y:
      vertical === 'top'
        ? bounds.minY + paddingY
        : vertical === 'bottom'
          ? bounds.maxY - height - paddingY
          : (bounds.minY + bounds.maxY - height) / 2,
  };
}

export function watermarkCornerTextAnchor(position: string): 'start' | 'middle' | 'end' {
  if (position.endsWith('left')) return 'start';
  if (position.endsWith('right')) return 'end';
  return 'middle';
}

export function watermarkCornerTextBaseline(
  position: string
): 'text-before-edge' | 'middle' | 'text-after-edge' {
  if (position.startsWith('top')) return 'text-before-edge';
  if (position.startsWith('bottom')) return 'text-after-edge';
  return 'middle';
}

export function watermarkCornerTextPoint(
  point: WatermarkPoint,
  size: WatermarkSize,
  position: string
): SignatureCornerGeometry['text'] {
  const anchor = watermarkCornerTextAnchor(position);
  const baseline = watermarkCornerTextBaseline(position);
  return {
    x:
      anchor === 'start'
        ? point.x
        : anchor === 'end'
          ? point.x + size.width
          : point.x + size.width / 2,
    y:
      baseline === 'text-before-edge'
        ? point.y
        : baseline === 'text-after-edge'
          ? point.y + size.height
          : point.y + size.height / 2,
    anchor,
    baseline,
  };
}

export function signatureCornerWatermarkGeometry(
  bounds: WatermarkBounds,
  config: Pick<SignatureWatermarkGeometryConfig, 'text' | 'position' | 'fontSize' | 'paddingX'> & {
    paddingY: number;
  }
): SignatureCornerGeometry {
  const size = {
    width: Math.max(
      config.fontSize * SIGNATURE_TEXT_MIN_WIDTH_UNITS,
      [...config.text].length * config.fontSize * SIGNATURE_TEXT_WIDTH_FACTOR
    ),
    height: config.fontSize * SIGNATURE_TEXT_HEIGHT_FACTOR,
  };
  const point = watermarkPositionPoint(
    bounds,
    config.position,
    size.width,
    size.height,
    config.paddingX,
    config.paddingY
  );

  return {
    point,
    size,
    radius: Math.min(SIGNATURE_CORNER_RADIUS_MAX, size.height / 3),
    text: watermarkCornerTextPoint(point, size, config.position),
  };
}

export function normalWatermarkElementSize(
  config: Pick<
    NormalWatermarkGeometryConfig,
    'type' | 'arrangement' | 'text' | 'fontSize' | 'width' | 'height'
  >
): WatermarkSize {
  if (config.type === 'image' || config.arrangement === 'tiled') {
    return { width: config.width, height: config.height };
  }

  const textLength = [...String(config.text || '')].length;
  return {
    width: Math.max(
      config.fontSize * NORMAL_TEXT_MIN_WIDTH_UNITS,
      textLength * config.fontSize * NORMAL_TEXT_WIDTH_FACTOR
    ),
    height: config.fontSize * NORMAL_TEXT_HEIGHT_FACTOR,
  };
}

export function tiledWatermarkPlacements(
  bounds: WatermarkBounds,
  config: NormalWatermarkGeometryConfig
): WatermarkPoint[] {
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
  const anchor = watermarkPositionPoint(bounds, config.position, config.width, config.height, 0);
  let startX = anchor.x + config.offsetX;
  let startY = anchor.y + config.offsetY;

  while (startX > bounds.minX - config.width) startX -= safeStepX;
  while (startY > bounds.minY - config.height) startY -= safeStepY;
  while (startX + safeStepX <= bounds.minX - config.width) startX += safeStepX;
  while (startY + safeStepY <= bounds.minY - config.height) startY += safeStepY;

  const placements: WatermarkPoint[] = [];
  for (let y = startY; y <= bounds.maxY + config.height; y += safeStepY) {
    for (let x = startX; x <= bounds.maxX + config.width; x += safeStepX) {
      if (placements.length >= MAX_TILED_WATERMARK_COUNT) return placements;
      placements.push({ x, y });
    }
  }
  return placements;
}

export function signatureWatermarkBarGeometry(
  bounds: WatermarkBounds,
  config: Pick<SignatureWatermarkGeometryConfig, 'position' | 'barHeight' | 'paddingX'>
): SignatureBarGeometry {
  const isTop = config.position.startsWith('top');
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const y = isTop ? bounds.minY - config.barHeight : bounds.maxY;

  return {
    bar: { x: bounds.minX, y, width, height: config.barHeight },
    contentClip: { x: bounds.minX, y: bounds.minY, width, height },
    text: { x: bounds.maxX - config.paddingX, y: y + config.barHeight / 2 },
    bounds: {
      ...bounds,
      minY: isTop ? y : bounds.minY,
      maxY: isTop ? bounds.maxY : bounds.maxY + config.barHeight,
    },
  };
}

export function signatureWatermarkBarViewportGeometry(
  viewport: WatermarkViewport,
  config: Pick<SignatureWatermarkGeometryConfig, 'position' | 'barHeight' | 'paddingX'>
): Omit<SignatureBarGeometry, 'bounds'> {
  const isTop = config.position.startsWith('top');
  const y = isTop ? viewport.y : viewport.y + viewport.height - config.barHeight;

  return {
    bar: { x: viewport.x, y, width: viewport.width, height: config.barHeight },
    contentClip: {
      x: viewport.x,
      y: isTop ? viewport.y + config.barHeight : viewport.y,
      width: viewport.width,
      height: Math.max(0, viewport.height - config.barHeight),
    },
    text: {
      x: viewport.x + viewport.width - config.paddingX,
      y: y + config.barHeight / 2,
    },
  };
}
