/*
 * 文件作用：
 * 这里定义 Obsidian 偏好设置中的第三方插件设置页。
 *
 * 当前职责：
 * - 显示 yonxao-mindmap 的全局默认配置入口。
 * - 复用 ConfigModal 提供下拉框、输入框和高级 YAML 编辑能力。
 * - 保存后写入 Obsidian 插件 data.json，并通知当前已渲染的导图刷新默认配置。
 *
 * 调用链：
 * YonxaoMindmapPlugin.onload() -> addSettingTab() -> YonxaoMindmapSettingTab.display()
 */

import { Notice, PluginSettingTab, Setting } from 'obsidian';

import {
  deleteMindConfigPath,
  hasMeaningfulConfig,
  normalizeMindConfig,
} from '../config/mindConfig.js';
import { ConfigModal } from './ConfigModal.js';

/*
 * 作用：
 * Obsidian 第三方插件偏好设置页。
 */
export class YonxaoMindmapSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);

    // 保存具体插件实例，避免和 Obsidian PluginSettingTab 内部字段语义混淆。
    this.yonxaoPlugin = plugin;
  }

  /*
   * 作用：
   * 每次用户打开或刷新插件设置页时重新绘制页面内容。
   */
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass('yonxao-mindmap-settings');

    containerEl.createEl('h2', { text: 'yonxao-mindmap' });
    containerEl.createEl('p', {
      text: '这里配置的是插件级别的全局默认配置。单个 yxmm 代码块顶部的配置区仍然优先，适合给某一张导图做局部覆盖。',
    });

    this.renderGlobalDefaultConfigSetting(containerEl);
    this.renderGlobalDefaultConfigSummary(containerEl);
  }

  /*
   * 作用：
   * 创建“编辑全局默认配置”和“恢复内置默认值”两个主要操作。
   */
  renderGlobalDefaultConfigSetting(containerEl) {
    new Setting(containerEl)
      .setName('全局默认配置')
      .setDesc('作为所有 yxmm 代码块的基础配置；文档配置区和主题属性会继续覆盖它。')
      .addButton((button) => {
        button.setButtonText('编辑默认配置').onClick(() => {
          this.openGlobalDefaultConfigModal();
        });
      })
      .addButton((button) => {
        button.setButtonText('恢复内置默认值').onClick(async () => {
          await this.yonxaoPlugin.updateGlobalDefaultConfig({});
          new Notice('yonxao-mindmap: 已恢复插件内置默认配置。');
          this.display();
        });
      });
  }

  /*
   * 作用：
   * 打开复用的可视化配置弹框，并把保存结果写入插件 settings。
   */
  openGlobalDefaultConfigModal() {
    const modal = new ConfigModal(this.app, {
      title: '全局默认配置',
      rawConfig: this.yonxaoPlugin.getGlobalDefaultConfig(),
      onApply: async (nextConfig) => {
        const sanitizedConfig = this.sanitizeGlobalDefaultConfig(nextConfig);
        await this.yonxaoPlugin.updateGlobalDefaultConfig(sanitizedConfig);
        this.display();
        new Notice('yonxao-mindmap: 全局默认配置已保存。');
        return true;
      },
    });
    modal.open();
  }

  /*
   * 作用：
   * 清理不适合放进插件级默认配置的临时字段。
   *
   * 关键点：
   * view.mode 是单个代码块当前会话的显示状态，不应该成为全局默认值。
   * 其余字段保持原样，让用户可以用高级 YAML 自己填写插件支持的配置项。
   */
  sanitizeGlobalDefaultConfig(config) {
    return deleteMindConfigPath(config || {}, ['view', 'mode']);
  }

  /*
   * 作用：
   * 展示当前全局默认配置的简短摘要，方便用户不打开弹框也能知道当前状态。
   */
  renderGlobalDefaultConfigSummary(containerEl) {
    const rawConfig = this.yonxaoPlugin.getGlobalDefaultConfig();
    const normalized = normalizeMindConfig(rawConfig);
    const summaryEl = containerEl.createDiv({ cls: 'setting-item-description' });

    if (!hasMeaningfulConfig(rawConfig)) {
      summaryEl.setText('当前未设置全局默认配置，所有导图使用插件内置默认值。');
      return;
    }

    /*
     * 摘要只展示最常用的几项。
     * 具体完整配置仍然以弹框的“高级”页为准，避免设置页变成第二套编辑器。
     */
    summaryEl.createEl('p', { text: '当前全局默认配置摘要：' });
    const listEl = summaryEl.createEl('ul');
    for (const item of [
      `主题色系：${normalized.theme}`,
      `布局类型：${normalized.layout}`,
      `连线线型：${normalized.connector.style}`,
      `鼠标滚轮缩放：${normalized.interaction.wheelZoom ? '开启' : '关闭'}`,
      `主题字体：${normalized.font.family}`,
      `主题字号：${normalized.font.size}`,
    ]) {
      listEl.createEl('li', { text: item });
    }
  }
}
