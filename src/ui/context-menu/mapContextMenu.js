/*
 * 文件作用：
 * 导图空白处右键菜单方法集合，负责复制、导出、适配视图和配置入口。
 *
 * 实现逻辑：
 * 菜单项只分派到 renderer 能力，避免上下文菜单持有额外业务状态。
 *
 * 调用链：
 * SVG/contextmenu -> mapContextMenuMethods -> renderer actions。
 */

import { Menu } from '../../shared/rendererShared.js';

export const mapContextMenuMethods = {
  openMapContextMenu(event) {
    const menu = new Menu();

    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyBody'), 'copy', () =>
      this.copyPlainBody()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyIndentedBody'), 'list-tree', () =>
      this.copyIndentedBody()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copySource'), 'file-code', () =>
      this.copyFullSource()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyConfig'), 'settings', () =>
      this.copyConfigSource()
    );
    menu.addSeparator();

    this.addTopicContextMenuItem(menu, this.t('contextMenu.exportPng'), 'download', () =>
      this.exportMapPng()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyPng'), 'image', () =>
      this.copyMapPng()
    );
    menu.addSeparator();

    this.addTopicContextMenuItem(menu, this.t('toolbar.fitView'), 'scan', () => this.fitView());
    this.addTopicContextMenuItem(menu, this.t('toolbar.originalSize'), 'maximize', () =>
      this.showOriginalSizeView()
    );

    menu.showAtMouseEvent(event);
  },
};
