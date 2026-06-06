/*
 * 文件作用：
 * 这里放和 Obsidian 嵌入块外壳相关的小工具。
 *
 * 主要功能：
 * - markYonxaoMindmapEmbedWrapper：给 Live Preview 的 .cm-embed-block 外壳加 class，方便 CSS 解除裁剪。
 * - renderPluginError：插件初始化阶段出错时，在当前代码块位置显示可读错误。
 *
 * 调用链位置：
 * YonxaoMindmapPlugin / YonxaoMindmapRenderer -> embed 工具 -> Obsidian DOM 外壳
 */

/*
 * 作用：
 * 给 Obsidian Live Preview 的嵌入块外壳打上插件专用 class。
 *
 * 调用链：
 * Renderer.mount() -> markYonxaoMindmapEmbedWrapper() -> styles/80-live-preview.css。
 */
export function markYonxaoMindmapEmbedWrapper(hostEl) {
  /*
   * Live Preview 中，Obsidian 会把代码块渲染结果包在 .cm-embed-block 外壳里。
   *
   * 这里延迟到下一帧查找外壳并打 class，让 CSS 能精准调整当前 yxmm 嵌入块的外层行为。
   * 现在不会隐藏 Obsidian 自带的“编辑这个块”按钮，只用于避免外层裁剪插件浮层。
   * 阅读视图没有 .cm-embed-block，查找不到时什么都不做。
   */
  const applyClass = () => {
    const embedBlock = hostEl.closest && hostEl.closest('.cm-embed-block');
    if (embedBlock) {
      embedBlock.classList.add('yonxao-mindmap-cm-embed-block');
    }
  };

  if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(applyClass);
  } else {
    setTimeout(applyClass, 0);
  }
}

/*
 * 作用：
 * 在插件初始化阶段发生异常时，把错误显示到当前代码块位置。
 */
export function renderPluginError(hostEl, error) {
  const message = error && error.message ? error.message : String(error || '未知错误');
  console.error('yonxao-mindmap: render failed', error);

  hostEl.textContent = '';
  const errorEl = document.createElement('div');
  errorEl.className = 'yonxao-mindmap-plugin-error';
  errorEl.textContent = `yonxao-mindmap 渲染失败：${message}`;
  hostEl.appendChild(errorEl);
}
