/*
 * 文件作用：
 * 工具栏按钮方法集合，负责按钮创建、图标绑定、tooltip 和状态刷新。
 *
 * 实现逻辑：
 * 按钮事件只调用 renderer 已有能力，避免工具栏直接处理业务状态。
 *
 * 调用链：
 * FloatingToolbar -> toolbarButtonMethods -> renderer actions。
 */

import { Notice, setIcon, setTooltip } from '../../shared/rendererShared.js';

export const toolbarButtonMethods = {
  createToolbarButton(toolbar, label, icon, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yonxao-mindmap-toolbar-button';
    button.setAttribute('aria-label', label);
    setTooltip(button, label);

    try {
      setIcon(button, icon);
    } catch (_error) {
      button.textContent = label;
    }

    toolbar.appendChild(button);
    this.registerDomEvent(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      Promise.resolve(onClick()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
    });
    return button;
  },
};
