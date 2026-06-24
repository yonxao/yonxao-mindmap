/*
 * 文件作用：
 * 这里定义 Obsidian 偏好设置中的第三方插件设置页。
 *
 * 当前职责：
 * - 显示 yonxao-mindmap 的全局默认值配置面板入口。
 * - 复用 ConfigModal 提供下拉框、输入框和高级 YAML 编辑能力。
 * - 保存后写入 Obsidian 插件 data.json，并通知当前已渲染的导图刷新默认配置。
 *
 * 调用链：
 * YonxaoMindmapPlugin.onload() -> addSettingTab() -> YonxaoMindmapSettingTab.display()
 */

import { Notice, PluginSettingTab, Setting } from 'obsidian';

import {
  canonicalizeMindConfig,
  hasMeaningfulConfig,
  normalizeMindConfig,
} from '../config/mindConfig.js';
import { LANGUAGE_OPTIONS } from '../i18n/messages.js';
import {
  ConfigModal,
  isBranchExpansionConfigurable,
  isBranchExpansionSupportedLayout,
  isConnectorStyleConfigurableLayout,
} from './ConfigModal.js';

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
      text: this.t('settings.description'),
    });

    this.renderLanguageSetting(containerEl);
    this.renderGlobalDefaultValueConfigPanelSetting(containerEl);
    this.renderGlobalDefaultValueConfigSummary(containerEl);
  }

  /*
   * 作用：
   * 创建语言选择项。
   *
   * 执行逻辑：
   * 用户选择语言后立即保存到插件 data.json，并重新绘制当前设置页。
   */
  renderLanguageSetting(containerEl) {
    new Setting(containerEl)
      .setName(this.t('settings.language.name'))
      .setDesc(this.t('settings.language.desc'))
      .addDropdown((dropdown) => {
        for (const [value, label] of LANGUAGE_OPTIONS) {
          dropdown.addOption(value, label);
        }

        dropdown.setValue(this.yonxaoPlugin.getLanguage());
        dropdown.onChange(async (value) => {
          await this.yonxaoPlugin.updateLanguage(value);
          this.display();
        });
      });
  }

  /*
   * 作用：
   * 创建“编辑全局默认值配置面板”和“恢复内置默认值”两个主要操作。
   */
  renderGlobalDefaultValueConfigPanelSetting(containerEl) {
    new Setting(containerEl)
      .setName(this.t('settings.globalDefaultValueConfigPanel.name'))
      .setDesc(this.t('settings.globalDefaultValueConfigPanel.desc'))
      .addButton((button) => {
        button.setButtonText(this.t('settings.globalDefaultValueConfigPanel.edit')).onClick(() => {
          this.openGlobalDefaultValueConfigPanel();
        });
      })
      .addButton((button) => {
        button
          .setButtonText(this.t('settings.globalDefaultValueConfigPanel.reset'))
          .onClick(async () => {
            await this.yonxaoPlugin.updateGlobalDefaultValueConfig({});
            new Notice(this.t('settings.globalDefaultValueConfigPanel.resetNotice'));
            this.display();
          });
      });
  }

  /*
   * 作用：
   * 打开复用的全局默认值配置面板，并把保存结果写入插件 settings。
   */
  openGlobalDefaultValueConfigPanel() {
    const modal = new ConfigModal(this.app, {
      title: this.t('configModal.globalDefaultValueTitle'),
      t: this.t.bind(this),
      rawConfig: this.yonxaoPlugin.getGlobalDefaultValueConfig(),
      onApply: async (nextConfig) => {
        const sanitizedConfig = this.sanitizeGlobalDefaultValueConfig(nextConfig);
        await this.yonxaoPlugin.updateGlobalDefaultValueConfig(sanitizedConfig);
        this.display();
        new Notice(this.t('settings.globalDefaultValueConfigPanel.savedNotice'));
        return true;
      },
    });
    modal.open();
  }

  /*
   * 作用：
   * 清理用户输入，只保留当前配置区结构支持的字段。
   */
  sanitizeGlobalDefaultValueConfig(config) {
    return canonicalizeMindConfig(config || {});
  }

  /*
   * 作用：
   * 展示当前全局默认值配置的简短摘要，方便用户不打开面板也能知道当前状态。
   */
  renderGlobalDefaultValueConfigSummary(containerEl) {
    const rawConfig = this.yonxaoPlugin.getGlobalDefaultValueConfig();
    const normalized = normalizeMindConfig(rawConfig);
    const summaryEl = containerEl.createDiv({ cls: 'setting-item-description' });

    if (!hasMeaningfulConfig(rawConfig)) {
      summaryEl.setText(this.t('settings.globalDefaultValueConfigPanel.empty'));
      return;
    }

    /*
     * 摘要只展示最常用的几项。
     * 具体完整配置仍然以弹框的“高级”页为准，避免设置页变成第二套编辑器。
     */
    summaryEl.createEl('p', {
      text: this.t('settings.globalDefaultValueConfigPanel.summaryTitle'),
    });
    const listEl = summaryEl.createEl('ul');
    const connectorSummary = isConnectorStyleConfigurableLayout(normalized.layout)
      ? normalized.connector.style
      : this.t('settings.summary.connector.fixedElbow');
    const branchExpansionSummary = isBranchExpansionConfigurable(
      normalized.layout,
      normalized.connector.style
    )
      ? normalized.branch.expansion
      : isBranchExpansionSupportedLayout(normalized.layout)
        ? this.t('settings.summary.branchExpansion.elbowOnly')
        : this.t('settings.summary.branchExpansion.unsupported');

    for (const item of [
      `${this.t('settings.summary.theme')}: ${normalized.theme}`,
      `${this.t('settings.summary.layout')}: ${normalized.layout}`,
      `${this.t('settings.summary.connector')}: ${connectorSummary}`,
      `${this.t('settings.summary.branchExpansion')}: ${branchExpansionSummary}`,
      `${this.t('settings.summary.wheelZoom')}: ${
        normalized.interaction.wheelZoom
          ? this.t('settings.summary.enabled')
          : this.t('settings.summary.disabled')
      }`,
      `${this.t('settings.summary.fontFamily')}: ${normalized.font.family}`,
      `${this.t('settings.summary.fontSize')}: ${normalized.font.size}`,
    ]) {
      listEl.createEl('li', { text: item });
    }
  }

  /*
   * 作用：
   * 设置页内部的翻译快捷方法。
   */
  t(key, replacements) {
    return this.yonxaoPlugin.t(key, replacements);
  }
}
