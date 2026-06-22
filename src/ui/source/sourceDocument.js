/*
 * 文件作用：
 * 源码文档方法集合，负责配置区、正文区拆分、组合和同步。
 *
 * 实现逻辑：
 * 用户编辑源码时，本模块把两个输入区域重新拼成完整 yxmm 内容。
 *
 * 调用链：
 * SourceView -> sourceDocumentMethods -> documentPersistenceMethods。
 */

export const sourceDocumentMethods = {
  syncSourceInput() {
    if (!this.sourceInputEl) return;
    const sections = this.splitSourceForEditor(this.source);
    if (this.sourceConfigInputEl) {
      this.sourceConfigInputEl.value = sections.config;
    }
    this.sourceInputEl.value = sections.body;
    this.sourceLineCount = this.sourceInputLineCount();
    this.sourceDirty = false;
    this.updateSourceConfigEditor();
    this.updateSourceBodyEditor();
    this.updateSourceStatus();
  },

  splitSourceForEditor(source) {
    const text = String(source || '');
    const lines = text.split(/\r?\n/);
    const firstContentIndex = lines.findIndex((line) => line.trim() !== '');

    if (firstContentIndex === -1 || lines[firstContentIndex].trim() !== '---') {
      return {
        config: '',
        body: text,
      };
    }

    const endIndex = lines.findIndex(
      (line, index) => index > firstContentIndex && line.trim() === '---'
    );
    if (endIndex === -1) {
      return {
        config: '',
        body: text,
      };
    }

    return {
      config: lines.slice(firstContentIndex + 1, endIndex).join('\n'),
      body: [...lines.slice(0, firstContentIndex), ...lines.slice(endIndex + 1)]
        .join('\n')
        .trimStart(),
    };
  },

  composeSourceFromSourceInputs() {
    const configText = String(this.sourceConfigInputEl?.value || '').trim();
    const bodyText = String(this.sourceInputEl?.value || '').trim();
    if (!configText) return bodyText;

    return ['---', configText, '---', '', bodyText].join('\n').trimEnd();
  },
};
