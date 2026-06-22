/*
 * 文件作用：
 * 文档持久化方法集合，负责把源码模式或可视化编辑结果写回当前 Markdown 代码块。
 *
 * 实现逻辑：
 * 读取 Obsidian sectionInfo 定位当前 yxmm 围栏，只替换围栏内部内容，避免影响同文档其他代码块。
 *
 * 调用链：
 * 源码视图/主题编辑/配置保存 -> documentPersistenceMethods -> markdown/codeBlock。
 */

import { Notice, CODE_BLOCK_NAME, replaceCodeBlockSource } from '../shared/rendererShared.js';

export const documentPersistenceMethods = {
  async saveSourceToMarkdownFile(nextSource) {
    if (this.editorContext) {
      return this.saveSourceToEditor(nextSource);
    }

    // 这里是真正“落盘”的地方。
    // 注意：插件渲染出来的 DOM/SVG 只是阅读模式里的界面，改 DOM 并不会自动修改 .md 文件。
    // 要保存，必须使用 Obsidian 的 vault API 读取并修改当前 Markdown 文件。
    const file = this.getMarkdownFile();
    if (!file) {
      new Notice('yonxao-mindmap: 找不到当前 Markdown 文件，无法保存。');
      return false;
    }

    // sectionInfo 是 Obsidian 对“当前渲染片段”的定位信息。
    // 代码块保存时最怕改错同文件里的另一个 yxmm，所以先用 sectionInfo 缩小查找范围。
    const sectionInfo =
      this.ctx && typeof this.ctx.getSectionInfo === 'function'
        ? this.ctx.getSectionInfo(this.hostEl)
        : null;

    // vault.read / vault.modify 是 Obsidian 官方的数据入口。
    // 不直接用浏览器 File API，是因为 vault API 会处理 Obsidian 的缓存、同步和文件适配层。
    const originalMarkdown = await this.plugin.app.vault.read(file);
    const replacedMarkdown = replaceCodeBlockSource(
      originalMarkdown,
      CODE_BLOCK_NAME,
      this.source,
      nextSource,
      sectionInfo
    );

    if (replacedMarkdown === null) {
      new Notice('yonxao-mindmap: 未定位到当前 yxmm 代码块，保存失败。');
      return false;
    }

    await this.plugin.app.vault.modify(file, replacedMarkdown);
    return true;
  },

  saveSourceToEditor(nextSource) {
    const context = this.editorContext;
    if (!context || !context.view) {
      new Notice('yonxao-mindmap: 找不到当前编辑器，无法保存。');
      return false;
    }

    context.view.dispatch({
      changes: {
        from: context.contentFrom,
        to: context.contentTo,
        insert: nextSource,
      },
    });
    context.contentTo = context.contentFrom + nextSource.length;

    return true;
  },

  getMarkdownFile() {
    // ctx.sourcePath 是当前代码块所在的 Markdown 文件路径，相对于 vault 根目录。
    // getAbstractFileByPath 可能返回文件，也可能返回文件夹；这里用 children 字段排除文件夹。
    const sourcePath = this.ctx && this.ctx.sourcePath;
    if (!sourcePath || !this.plugin || !this.plugin.app) return null;

    const file = this.plugin.app.vault.getAbstractFileByPath(sourcePath);
    if (!file || file.children) return null;
    return file;
  },
};
