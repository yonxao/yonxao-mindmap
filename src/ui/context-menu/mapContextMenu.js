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
    menu.addSeparator();

    this.addTopicContextMenuItem(menu, this.t('contextMenu.deleteMindMap'), 'trash-2', () =>
      this.deleteMindMap()
    );

    menu.showAtMouseEvent(event);
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
