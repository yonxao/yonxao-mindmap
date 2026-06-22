/*
 * 文件作用：
 * 配置弹框高级页方法集合，负责 YAML 文本编辑和语法状态反馈。
 *
 * 实现逻辑：
 * 高级页直接编辑 draftConfig 的 YAML 表示，解析成功后同步到结构化草稿。
 *
 * 调用链：
 * ConfigModal.render() -> advancedTabMethods -> configDraft/yamlConfig。
 */

import {
  parseDraftConfigText,
  stringifyDraftConfig,
  canonicalizeMindConfig,
} from './configModalShared.js';

export const advancedTabMethods = {
  renderAdvancedTab() {
    this.createSection(this.t('configModal.advanced.section'));
    this.advancedInputEl = this.formEl.createEl('textarea', {
      cls: 'yonxao-mindmap-config-yaml',
    });
    this.advancedInputEl.spellcheck = false;
    this.advancedInputEl.value = stringifyDraftConfig(this.draftConfig);
    this.advancedInputEl.addEventListener('input', () => {
      try {
        this.draftConfig = canonicalizeMindConfig(parseDraftConfigText(this.advancedInputEl.value));
        this.updateStatus(this.t('configModal.status.valid'));
      } catch (error) {
        this.updateStatus(
          this.t('configModal.status.invalid', { message: error.message || String(error) }),
          true
        );
      }
    });
  },
};
