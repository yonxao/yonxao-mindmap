/*
 * 文件作用：
 * 读取移动端 WebView / Obsidian 暴露的视口安全区域。
 *
 * 使用边界：
 * - CSS 可以直接使用 env(safe-area-inset-*)。
 * - JS 定位 body 级浮层时需要像素值，用这里统一读取，避免状态栏下方出现不可点击控件。
 */

let safeAreaProbeEl = null;

function readCssPixelVariable(...names) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  const rootStyle = window.getComputedStyle(document.documentElement);
  for (const name of names) {
    const rawValue = rootStyle.getPropertyValue(name).trim();
    const value = Number.parseFloat(rawValue);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function readEnvSafeAreaInsets() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }

  /*
   * 工具栏拖拽会高频读取安全区。复用一个隐藏探针，避免 pointermove 中反复
   * 创建/删除 DOM；状态栏方向变化后 computed style 会随 env() 自动更新。
   */
  if (!safeAreaProbeEl?.isConnected) {
    safeAreaProbeEl = document.createElement('div');
    safeAreaProbeEl.className = 'yonxao-mindmap-safe-area-probe';
    safeAreaProbeEl.style.cssText = [
      'position: fixed',
      'visibility: hidden',
      'pointer-events: none',
      'width: 0',
      'height: 0',
      'padding-top: env(safe-area-inset-top, 0px)',
      'padding-right: env(safe-area-inset-right, 0px)',
      'padding-bottom: env(safe-area-inset-bottom, 0px)',
      'padding-left: env(safe-area-inset-left, 0px)',
    ].join(';');
    document.body.appendChild(safeAreaProbeEl);
  }

  const style = window.getComputedStyle(safeAreaProbeEl);
  const insets = {
    top: Number.parseFloat(style.paddingTop) || 0,
    right: Number.parseFloat(style.paddingRight) || 0,
    bottom: Number.parseFloat(style.paddingBottom) || 0,
    left: Number.parseFloat(style.paddingLeft) || 0,
  };
  return insets;
}

export function readViewportSafeAreaInsets() {
  const envInsets = readEnvSafeAreaInsets();
  return {
    top: Math.max(
      readCssPixelVariable('--safe-area-inset-top', '--ion-safe-area-top'),
      envInsets.top
    ),
    right: Math.max(
      readCssPixelVariable('--safe-area-inset-right', '--ion-safe-area-right'),
      envInsets.right
    ),
    bottom: Math.max(
      readCssPixelVariable('--safe-area-inset-bottom', '--ion-safe-area-bottom'),
      envInsets.bottom
    ),
    left: Math.max(
      readCssPixelVariable('--safe-area-inset-left', '--ion-safe-area-left'),
      envInsets.left
    ),
  };
}
