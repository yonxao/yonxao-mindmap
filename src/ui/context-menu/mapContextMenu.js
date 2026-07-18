/*
 * 文件作用：
 * 导图空白处右键菜单方法集合，负责复制、导出、适配视图、删除脑图和配置入口。
 *
 * 实现逻辑：
 * 菜单项只分派到 renderer 能力，避免上下文菜单持有额外业务状态。
 *
 * 调用链：
 * SVG/contextmenu -> mapContextMenuMethods -> renderer actions。
 */

import { Menu, Notice, CODE_BLOCK_NAME, findFenceBySection } from '../../shared/rendererShared.js';
import { ZOOM_IN_FACTOR, ZOOM_OUT_FACTOR } from '../../constants.js';
import {
  ICON_UNDO_TOPIC_CHANGE,
  ICON_REDO_TOPIC_CHANGE,
  ICON_COPY_BODY,
  ICON_COPY_INDENTED_BODY,
  ICON_COPY_SOURCE,
  ICON_COPY_CONFIG,
  ICON_EXPORT_PNG,
  ICON_COPY_PNG,
  ICON_TOGGLE_SOURCE,
  ICON_TOGGLE_MAP,
  ICON_CONFIG,
  ICON_FIT_VIEW,
  ICON_ORIGINAL_SIZE,
  ICON_WINDOW_FULLSCREEN_ENTER,
  ICON_WINDOW_FULLSCREEN_EXIT,
  ICON_FULLSCREEN_ENTER,
  ICON_FULLSCREEN_EXIT,
  ICON_ZOOM_IN,
  ICON_ZOOM_OUT,
  ICON_RESET_COLLAPSE,
  ICON_DELETE_MINDMAP,
} from '../../icons/iconNames.js';

export const mapContextMenuMethods = {
  openMapContextMenu(event) {
    // 右键空白处时清除主题焦点，避免导图整体获得焦点后自动高亮一级主题
    this.clearFocusedTopic();

    // 复用主题菜单的菜单实例管理，关闭上一个跨实例右键菜单
    this._closeCurrentContextMenu();
    const menu = new Menu();
    menu.setUseNativeMenu(false);
    this.plugin._currentContextMenu = menu;
    this._setupMenuAutoClose(menu);

    if (this.canEditMindMap()) {
      this.addTopicContextMenuItem(
        menu,
        this.t('configModal.shortcuts.action.undoTopicChange'),
        ICON_UNDO_TOPIC_CHANGE,
        () => this.undoTopicChange()
      );
      this.addTopicContextMenuItem(
        menu,
        this.t('configModal.shortcuts.action.redoTopicChange'),
        ICON_REDO_TOPIC_CHANGE,
        () => this.redoTopicChange()
      );
      menu.addSeparator();
    }

    this.addMapViewContextMenuItems(menu);
    menu.addSeparator();

    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyBody'), ICON_COPY_BODY, () =>
      this.copyPlainBody()
    );
    this.addTopicContextMenuItem(
      menu,
      this.t('contextMenu.copyIndentedBody'),
      ICON_COPY_INDENTED_BODY,
      () => this.copyIndentedBody()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copySource'), ICON_COPY_SOURCE, () =>
      this.copyFullSource()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyConfig'), ICON_COPY_CONFIG, () =>
      this.copyConfigSource()
    );
    menu.addSeparator();

    this.addTopicContextMenuItem(menu, this.t('contextMenu.exportPng'), ICON_EXPORT_PNG, () =>
      this.exportMapPng()
    );
    this.addTopicContextMenuItem(menu, this.t('contextMenu.copyPng'), ICON_COPY_PNG, () =>
      this.copyMapPng()
    );
    menu.addSeparator();

    this.addTopicContextMenuItem(
      menu,
      this.t('contextMenu.deleteMindMap'),
      ICON_DELETE_MINDMAP,
      () => this.deleteMindMap()
    );

    menu.showAtMouseEvent(event);
  },

  addMapViewContextMenuItems(menu) {
    const toggleViewLabel = this.isSourceMode
      ? this.t('toolbar.showMap')
      : this.t('toolbar.showSource');
    const toggleViewIcon = this.isSourceMode ? ICON_TOGGLE_MAP : ICON_TOGGLE_SOURCE;
    const windowFullscreenLabel = this.isWindowFullscreen
      ? this.t('toolbar.exitWindowFullscreen')
      : this.t('toolbar.enterWindowFullscreen');
    const windowFullscreenIcon = this.isWindowFullscreen
      ? ICON_WINDOW_FULLSCREEN_EXIT
      : ICON_WINDOW_FULLSCREEN_ENTER;
    const fullscreenLabel = this.isFullscreen
      ? this.t('toolbar.exitFullscreen')
      : this.t('toolbar.enterFullscreen');
    const fullscreenIcon = this.isFullscreen ? ICON_FULLSCREEN_EXIT : ICON_FULLSCREEN_ENTER;

    this.addTopicContextMenuItem(menu, toggleViewLabel, toggleViewIcon, () =>
      this.toggleSourceMode()
    );
    this.addTopicContextMenuItem(menu, this.t('toolbar.config'), ICON_CONFIG, () =>
      this.openConfigModal()
    );
    this.addTopicContextMenuItem(menu, this.t('toolbar.fitView'), ICON_FIT_VIEW, () =>
      this.fitView()
    );
    this.addTopicContextMenuItem(menu, this.t('toolbar.originalSize'), ICON_ORIGINAL_SIZE, () =>
      this.showOriginalSizeView()
    );
    this.addTopicContextMenuItem(menu, windowFullscreenLabel, windowFullscreenIcon, () =>
      this.toggleWindowFullscreen()
    );
    this.addTopicContextMenuItem(menu, fullscreenLabel, fullscreenIcon, () =>
      this.toggleFullscreen()
    );
    this.addTopicContextMenuItem(menu, this.t('toolbar.zoomIn'), ICON_ZOOM_IN, () =>
      this.zoomAtCenter(ZOOM_IN_FACTOR)
    );
    this.addTopicContextMenuItem(menu, this.t('toolbar.zoomOut'), ICON_ZOOM_OUT, () =>
      this.zoomAtCenter(ZOOM_OUT_FACTOR)
    );
    this.addTopicContextMenuItem(menu, this.t('toolbar.resetCollapse'), ICON_RESET_COLLAPSE, () =>
      this.resetCollapsedTopics()
    );
  },

  /*
   * 作用：
   * 删除当前 yxmm 代码块（含围栏标记）。
   *
   * 实现逻辑：
   * 通过 Obsidian sectionInfo 定位当前代码块的行号范围，
   * 读取 Markdown 文件全文，删除围栏起始到结束的所有行，再写回文件。
   */
  async deleteMindMap() {
    const file = this.getMarkdownFile();
    if (!file) {
      new Notice('yonxao-mindmap: 找不到当前 Markdown 文件，无法删除。');
      return;
    }

    const sectionInfo =
      this.ctx && typeof this.ctx.getSectionInfo === 'function'
        ? this.ctx.getSectionInfo(this.hostEl)
        : null;

    const originalMarkdown = await this.plugin.app.vault.read(file);
    const eol = originalMarkdown.includes('\r\n') ? '\r\n' : '\n';
    const lines = originalMarkdown.split(/\r?\n/);

    const fence = findFenceBySection(lines, CODE_BLOCK_NAME, sectionInfo);
    if (!fence) {
      new Notice('yonxao-mindmap: 未定位到当前代码块，删除失败。');
      return;
    }

    // 删除整个围栏范围（起始行到结束行，含 fence markers）
    lines.splice(fence.start, fence.end - fence.start + 1);
    const cleanedMarkdown = lines.join(eol);

    await this.plugin.app.vault.modify(file, cleanedMarkdown);
  },
};
