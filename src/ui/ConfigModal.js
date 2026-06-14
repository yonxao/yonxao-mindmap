/*
 * 文件作用：
 * 这里定义可视化配置弹框，让用户不用手写 YAML 也能调整 yxmm 配置区。
 *
 * 主要功能：
 * - 基础：幕布高度、源码高度、工具栏位置。
 * - 主题：主题名、默认主题颜色。
 * - 结构：布局类型、主题最大宽度。
 * - 字体：全局字体与 1/2/3 级标题字体。
 * - 源码：Tab 调整主题级别开关。
 * - 高级：直接编辑配置 YAML。
 *
 * 调用链：
 * YonxaoMindmapRenderer.createToolbar() -> openConfigModal() -> ConfigModal.onOpen()
 */

import { Modal, Notice } from 'obsidian';

import {
  cloneConfig,
  deleteConfigValue,
  getConfigValue,
  numberFromInput,
  parseDraftConfigText,
  setConfigValue,
  stringifyDraftConfig,
} from '../config/configDraft.js';
import {
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  normalizeMindConfig,
} from '../config/mindConfig.js';
import { createTranslator } from '../i18n/messages.js';
import {
  CUSTOM_FONT_VALUE,
  getLocalizedFontFamilyGroups,
  isPresetFontValue,
} from './fontOptions.js';

const RAINBOW_THEME_NAMES = new Set(['rainbow', 'pastel-rainbow', 'neon-rainbow']);

/*
 * 作用：
 * Obsidian 原生 Modal，用于编辑当前 yxmm 代码块配置区。
 */
export class ConfigModal extends Modal {
  constructor(app, options) {
    super(app);
    this.t = options.t || createTranslator('en');
    this.title = options.title || this.t('configModal.title');
    this.initialConfig = cloneConfig(options.rawConfig);
    this.draftConfig = cloneConfig(options.rawConfig);
    this.onApply = options.onApply;
    this.activeTab = 'basic';
    this.formEl = null;
    this.advancedInputEl = null;
    this.statusEl = null;
  }

  /*
   * 作用：
   * 打开弹框时创建整体结构。
   */
  onOpen() {
    this.modalEl.classList.add('yonxao-mindmap-config-modal-host');
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('yonxao-mindmap-config-modal');

    const headerEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-header' });
    headerEl.createEl('h2', { text: this.title });

    const tabsEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-tabs' });
    for (const [id, label] of this.tabOptions()) {
      const button = tabsEl.createEl('button', {
        cls: 'yonxao-mindmap-config-tab',
        text: label,
      });
      button.type = 'button';
      button.classList.toggle('is-active', id === this.activeTab);
      button.addEventListener('click', () => {
        this.activeTab = id;
        this.render();
      });
    }

    this.formEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-body' });
    this.statusEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-status' });

    const actionsEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-actions' });
    this.createActionButton(actionsEl, this.t('configModal.actions.apply'), async () => {
      await this.applyDraft(false);
    });
    this.createActionButton(actionsEl, this.t('configModal.actions.saveAndClose'), async () => {
      await this.applyDraft(true);
    });
    this.createActionButton(actionsEl, this.t('configModal.actions.cancel'), () => {
      this.close();
    });

    this.render();
  }

  /*
   * 作用：
   * 关闭弹框时清理 DOM。
   */
  onClose() {
    this.contentEl.empty();
  }

  /*
   * 作用：
   * 根据当前 tab 重新绘制表单。
   */
  render() {
    if (!this.formEl) return;

    this.formEl.empty();
    const normalized = normalizeMindConfig(this.draftConfig);

    if (this.activeTab === 'basic') {
      this.renderBasicTab(normalized);
    } else if (this.activeTab === 'theme') {
      this.renderThemeTab(normalized);
    } else if (this.activeTab === 'layout') {
      this.renderLayoutTab(normalized);
    } else if (this.activeTab === 'font') {
      this.renderFontTab(normalized);
    } else if (this.activeTab === 'source') {
      this.renderSourceTab(normalized);
    } else {
      this.renderAdvancedTab();
    }

    this.updateTabs();
    this.updateStatus('');
  }

  /*
   * 作用：
   * 更新 tab 激活状态。
   */
  updateTabs() {
    for (const tab of this.contentEl.querySelectorAll('.yonxao-mindmap-config-tab')) {
      tab.classList.toggle('is-active', tab.textContent === this.tabLabel(this.activeTab));
    }
  }

  /*
   * 作用：
   * 基础配置：高度和工具栏位置。
   */
  renderBasicTab(normalized) {
    this.createSection(this.t('configModal.basic.section'));
    this.createNumberField(
      this.t('configModal.basic.canvasHeight'),
      ['canvas', 'height'],
      normalized.canvas.height,
      {
        min: 96,
        max: 1800,
        step: 10,
        placeholder: this.t('configModal.basic.placeholder.auto'),
        help: this.t('configModal.basic.canvasHeight.help'),
      }
    );
    this.createNumberField(
      this.t('configModal.basic.sourceHeight'),
      ['source', 'height'],
      normalized.source.height,
      {
        min: 96,
        max: 1800,
        step: 10,
        placeholder: this.t('configModal.basic.placeholder.auto'),
        help: this.t('configModal.basic.sourceHeight.help'),
      }
    );
    this.createNumberField(
      this.t('configModal.basic.toolbarX'),
      ['toolbar', 'x'],
      normalized.toolbar.x,
      {
        min: 0,
        max: 10000,
        step: 1,
        placeholder: this.t('configModal.basic.placeholder.default'),
      }
    );
    this.createNumberField(
      this.t('configModal.basic.toolbarY'),
      ['toolbar', 'y'],
      normalized.toolbar.y,
      {
        min: 0,
        max: 10000,
        step: 1,
        placeholder: this.t('configModal.basic.placeholder.default'),
      }
    );
    this.createToggleField(
      this.t('configModal.basic.wheelZoom'),
      ['interaction', 'wheelZoom'],
      normalized.interaction.wheelZoom,
      {
        omitWhenFalse: true,
        help: this.t('configModal.basic.wheelZoom.help'),
      }
    );
    this.createInlineResetButton(this.t('configModal.basic.resetToolbar'), [
      ['toolbar', 'x'],
      ['toolbar', 'y'],
    ]);
  }

  /*
   * 作用：
   * 主题配置：主题名和默认颜色。
   */
  renderThemeTab(normalized) {
    this.createSection(this.t('configModal.theme.section'));
    const themeField = this.createSelectTextField(
      this.t('configModal.theme.scheme'),
      ['theme'],
      normalized.theme,
      this.themeOptions()
    );
    const colorField = this.createColorTextField(
      this.t('configModal.theme.defaultTopicColor'),
      ['topic', 'defaultColor'],
      normalized.topic.defaultColor,
      this.t('configModal.theme.defaultTopicColor.help')
    );
    const warningEl = this.createWarning('');
    const updateWarning = () => {
      this.updateThemeOverrideWarning(warningEl);
    };

    for (const element of [
      themeField.select,
      themeField.input,
      colorField.colorInput,
      colorField.textInput,
    ]) {
      element.addEventListener('input', updateWarning);
      element.addEventListener('change', updateWarning);
    }
    updateWarning();
  }

  /*
   * 作用：
   * 结构配置：布局类型和主题宽度。
   */
  renderLayoutTab(normalized) {
    this.createSection(this.t('configModal.layout.section'));
    this.createSelectField(
      this.t('configModal.layout.type'),
      ['layout'],
      normalized.layout,
      this.layoutOptionGroups()
    );
    this.createNumberField(
      this.t('configModal.layout.topicMaxWidth'),
      ['topic', 'maxWidth'],
      normalized.topic.maxWidth,
      {
        min: 120,
        max: 800,
        step: 10,
      }
    );
    this.createSelectField(
      this.t('configModal.layout.connectorStyle'),
      ['connector', 'style'],
      normalized.connector.style,
      this.connectorOptions()
    );
  }

  /*
   * 作用：
   * 字体配置：全局字体和按层级覆盖。
   */
  renderFontTab(normalized) {
    this.createSection(this.t('configModal.font.globalSection'));
    this.createFontFamilyField(
      this.t('configModal.font.family'),
      ['font', 'family'],
      normalized.font.family,
      {
        help: this.t('configModal.font.family.help'),
      }
    );
    this.createNumberField(
      this.t('configModal.font.size'),
      ['font', 'size'],
      normalized.font.size,
      {
        min: FONT_SIZE_MIN,
        max: FONT_SIZE_MAX,
        step: 1,
        help: this.t('configModal.font.size.help'),
      }
    );
    this.createNumberField(
      this.t('configModal.font.weight'),
      ['font', 'weight'],
      normalized.font.weight,
      {
        min: FONT_WEIGHT_MIN,
        max: FONT_WEIGHT_MAX,
        step: 10,
        help: this.t('configModal.font.weight.help'),
      }
    );
    this.createNumberField(
      this.t('configModal.font.lineHeight'),
      ['font', 'lineHeight'],
      normalized.font.lineHeight,
      {
        min: FONT_LINE_HEIGHT_MIN,
        max: FONT_LINE_HEIGHT_MAX,
        step: 1,
        help: this.t('configModal.font.lineHeight.help'),
      }
    );

    this.createSection(this.t('configModal.font.levelSection'));
    for (const level of ['1', '2', '3']) {
      this.createLevelFontGroup(level);
    }
  }

  /*
   * 作用：
   * 源码编辑配置。
   */
  renderSourceTab(normalized) {
    this.createSection(this.t('configModal.source.section'));
    this.createToggleField(
      this.t('configModal.source.tabIndent'),
      ['source', 'enableTabIndent'],
      normalized.source.enableTabIndent
    );
    this.createNumberField(
      this.t('configModal.source.height'),
      ['source', 'height'],
      normalized.source.height,
      {
        min: 96,
        max: 1800,
        step: 10,
        placeholder: this.t('configModal.basic.placeholder.auto'),
      }
    );
  }

  /*
   * 作用：
   * 高级 YAML 编辑。
   */
  renderAdvancedTab() {
    this.createSection(this.t('configModal.advanced.section'));
    this.advancedInputEl = this.formEl.createEl('textarea', {
      cls: 'yonxao-mindmap-config-yaml',
    });
    this.advancedInputEl.spellcheck = false;
    this.advancedInputEl.value = stringifyDraftConfig(this.draftConfig);
    this.advancedInputEl.addEventListener('input', () => {
      try {
        this.draftConfig = parseDraftConfigText(this.advancedInputEl.value);
        this.updateStatus(this.t('configModal.status.valid'));
      } catch (error) {
        this.updateStatus(
          this.t('configModal.status.invalid', { message: error.message || String(error) }),
          true
        );
      }
    });
  }

  /*
   * 作用：
   * 创建层级字体配置组。
   */
  createLevelFontGroup(level) {
    const groupEl = this.formEl.createDiv({ cls: 'yonxao-mindmap-config-level' });
    const titleEl = groupEl.createDiv({ cls: 'yonxao-mindmap-config-level-title' });
    titleEl.setText(this.t('configModal.font.levelTitle', { marks: '#'.repeat(Number(level)) }));
    const clearButton = titleEl.createEl('button', {
      text: this.t('configModal.font.clearLevel'),
      cls: 'yonxao-mindmap-config-small-button',
    });
    clearButton.type = 'button';
    clearButton.addEventListener('click', () => {
      deleteConfigValue(this.draftConfig, ['font', 'levels', level]);
      this.render();
    });

    this.createNumberField(this.t('configModal.font.size'), ['font', 'levels', level, 'size'], '', {
      min: FONT_SIZE_MIN,
      max: FONT_SIZE_MAX,
      step: 1,
      parentEl: groupEl,
    });
    this.createNumberField(
      this.t('configModal.font.weight'),
      ['font', 'levels', level, 'weight'],
      '',
      {
        min: FONT_WEIGHT_MIN,
        max: FONT_WEIGHT_MAX,
        step: 10,
        parentEl: groupEl,
      }
    );
    this.createNumberField(
      this.t('configModal.font.lineHeight'),
      ['font', 'levels', level, 'lineHeight'],
      '',
      {
        min: FONT_LINE_HEIGHT_MIN,
        max: FONT_LINE_HEIGHT_MAX,
        step: 1,
        parentEl: groupEl,
      }
    );
    this.createFontFamilyField(
      this.t('configModal.font.family'),
      ['font', 'levels', level, 'family'],
      '',
      {
        parentEl: groupEl,
      }
    );
  }

  /*
   * 作用：
   * 创建表单分区标题。
   */
  createSection(title) {
    this.formEl.createDiv({ cls: 'yonxao-mindmap-config-section', text: title });
  }

  /*
   * 作用：
   * 创建一条轻量提示，用于解释配置项之间的影响关系。
   */
  createWarning(message) {
    return this.formEl.createDiv({ cls: 'yonxao-mindmap-config-warning', text: message });
  }

  /*
   * 作用：
   * 创建数字输入框。
   */
  createNumberField(label, path, normalizedValue, options = {}) {
    const fieldEl = this.createField(label, options.parentEl, options.help);
    const input = fieldEl.createEl('input');
    input.type = 'number';
    input.min = String(options.min ?? '');
    input.max = String(options.max ?? '');
    input.step = String(options.step ?? 1);
    input.placeholder = options.placeholder || '';
    input.value = String(getConfigValue(this.draftConfig, path, normalizedValue ?? '') ?? '');
    input.addEventListener('input', () => {
      setConfigValue(this.draftConfig, path, numberFromInput(input.value));
    });
  }

  /*
   * 作用：
   * 创建下拉选择框。
   */
  createSelectField(label, path, value, options) {
    const fieldEl = this.createField(label);
    const select = fieldEl.createEl('select');
    for (const optionConfig of options) {
      if (Array.isArray(optionConfig)) {
        const [optionValue, optionLabel] = optionConfig;
        const option = select.createEl('option', { text: optionLabel });
        option.value = optionValue;
        continue;
      }

      const group = select.createEl('optgroup');
      group.label = optionConfig.group;
      for (const [optionValue, optionLabel] of optionConfig.options) {
        const option = group.createEl('option', { text: optionLabel });
        option.value = optionValue;
      }
    }
    select.value = String(getConfigValue(this.draftConfig, path, value));
    select.addEventListener('change', () => {
      setConfigValue(this.draftConfig, path, select.value);
    });
  }

  /*
   * 作用：
   * 创建“下拉 + 文本输入”组合，适合熟悉配置的人直接输入。
   */
  createSelectTextField(label, path, value, options, fieldOptions = {}) {
    const fieldEl = this.createField(label, fieldOptions.parentEl);
    const rowEl = fieldEl.createDiv({ cls: 'yonxao-mindmap-config-combo' });
    const select = rowEl.createEl('select');
    const input = rowEl.createEl('input');
    input.type = 'text';

    for (const [optionValue, optionLabel] of options) {
      const option = select.createEl('option', { text: optionLabel });
      option.value = optionValue;
    }

    input.value = String(getConfigValue(this.draftConfig, path, value) || '');
    select.value = options.some(([optionValue]) => optionValue === input.value) ? input.value : '';
    select.addEventListener('change', () => {
      input.value = select.value;
      setConfigValue(this.draftConfig, path, input.value);
    });
    input.addEventListener('input', () => {
      setConfigValue(this.draftConfig, path, input.value.trim());
      select.value = options.some(([optionValue]) => optionValue === input.value)
        ? input.value
        : '';
    });
    return { select, input };
  }

  /*
   * 作用：
   * 创建字体选择控件。
   *
   * 实现逻辑：
   * 下拉框提供常用字体预设；右侧输入框允许用户直接填写 CSS font-family。
   * 选择“继承上级字体”会删除当前路径配置，选择“自定义”则等待用户在输入框填写具体字体。
   */
  createFontFamilyField(label, path, value, fieldOptions = {}) {
    const fieldEl = this.createField(label, fieldOptions.parentEl, fieldOptions.help);
    const rowEl = fieldEl.createDiv({ cls: 'yonxao-mindmap-config-combo' });
    const select = rowEl.createEl('select');
    const input = rowEl.createEl('input');
    input.type = 'text';
    input.placeholder = '"LXGW WenKai", "Source Han Sans SC", sans-serif';

    this.appendFontOptions(select);

    const rawValue = getConfigValue(this.draftConfig, path, value);
    input.value =
      typeof rawValue === 'string' || typeof rawValue === 'number' ? String(rawValue) : '';
    this.syncFontSelect(select, input.value);

    select.addEventListener('change', () => {
      if (select.value === CUSTOM_FONT_VALUE) {
        if (isPresetFontValue(input.value)) {
          input.value = '';
          deleteConfigValue(this.draftConfig, path);
        }
        input.focus();
        return;
      }

      input.value = select.value;
      setConfigValue(this.draftConfig, path, input.value);
    });

    input.addEventListener('input', () => {
      const nextValue = input.value.trim();
      setConfigValue(this.draftConfig, path, nextValue);
      this.syncFontSelect(select, nextValue);
    });

    return { select, input };
  }

  /*
   * 作用：
   * 根据输入框里的字体值同步下拉框选中项。
   */
  syncFontSelect(select, value) {
    if (!value) {
      select.value = '';
      return;
    }

    select.value = isPresetFontValue(value) ? value : CUSTOM_FONT_VALUE;
  }

  /*
   * 作用：
   * 把字体预设按类型渲染成 optgroup。
   */
  appendFontOptions(select) {
    for (const group of getLocalizedFontFamilyGroups(this.t)) {
      const groupEl = select.createEl('optgroup');
      groupEl.label = group.group;

      for (const [optionValue, optionLabel] of group.options) {
        const option = groupEl.createEl('option', { text: optionLabel });
        option.value = optionValue;
      }
    }
  }

  /*
   * 作用：
   * 创建颜色选择 + 文本输入组合。
   */
  createColorTextField(label, path, value, help) {
    const fieldEl = this.createField(label, undefined, help);
    const rowEl = fieldEl.createDiv({ cls: 'yonxao-mindmap-config-combo' });
    const colorInput = rowEl.createEl('input');
    const textInput = rowEl.createEl('input');
    colorInput.type = 'color';
    textInput.type = 'text';
    const rawValue = getConfigValue(this.draftConfig, path, value);
    const currentValue =
      typeof rawValue === 'string' || typeof rawValue === 'number' ? String(rawValue) : '';

    textInput.value = currentValue;
    colorInput.value = /^#[0-9a-f]{6}$/i.test(currentValue) ? currentValue : '#3b82f6';

    colorInput.addEventListener('input', () => {
      textInput.value = colorInput.value;
      setConfigValue(this.draftConfig, path, colorInput.value);
    });
    textInput.addEventListener('input', () => {
      setConfigValue(this.draftConfig, path, textInput.value.trim());
    });
    return { colorInput, textInput };
  }

  /*
   * 作用：
   * 创建开关配置项。
   */
  createToggleField(label, path, value, options = {}) {
    const fieldEl = this.createField(label, undefined, options.help);
    const input = fieldEl.createEl('input');
    input.type = 'checkbox';
    input.checked = Boolean(getConfigValue(this.draftConfig, path, value));
    input.addEventListener('change', () => {
      if (options.omitWhenFalse && !input.checked) {
        deleteConfigValue(this.draftConfig, path);
      } else {
        setConfigValue(this.draftConfig, path, input.checked);
      }
    });
  }

  /*
   * 作用：
   * 创建通用字段容器。
   */
  createField(label, parentEl, help) {
    const fieldEl = (parentEl || this.formEl).createDiv({ cls: 'yonxao-mindmap-config-field' });
    const labelEl = fieldEl.createEl('label');
    labelEl.setText(label);
    const controlEl = fieldEl.createDiv({ cls: 'yonxao-mindmap-config-control' });
    if (help) {
      controlEl.createDiv({ cls: 'yonxao-mindmap-config-help', text: help });
    }
    return controlEl;
  }

  /*
   * 作用：
   * 创建批量清除按钮。
   */
  createInlineResetButton(label, paths) {
    const button = this.formEl.createEl('button', {
      text: label,
      cls: 'yonxao-mindmap-config-secondary-button',
    });
    button.type = 'button';
    button.addEventListener('click', () => {
      for (const path of paths) {
        deleteConfigValue(this.draftConfig, path);
      }
      this.render();
    });
  }

  /*
   * 作用：
   * 创建底部操作按钮。
   */
  createActionButton(parentEl, label, onClick) {
    const button = parentEl.createEl('button', { text: label });
    button.type = 'button';
    button.addEventListener('click', () => {
      Promise.resolve(onClick()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
    });
    return button;
  }

  /*
   * 作用：
   * 应用配置草稿。
   */
  async applyDraft(closeAfterApply) {
    if (this.activeTab === 'advanced' && this.advancedInputEl) {
      this.draftConfig = parseDraftConfigText(this.advancedInputEl.value);
    }

    const saved = await this.onApply(cloneConfig(this.draftConfig));
    if (!saved) return;

    this.initialConfig = cloneConfig(this.draftConfig);
    this.updateStatus(this.t('configModal.status.saved'));
    if (closeAfterApply) this.close();
  }

  /*
   * 作用：
   * 显示状态文本。
   */
  updateStatus(message, isError) {
    if (!this.statusEl) return;
    this.statusEl.textContent = message || '';
    this.statusEl.classList.toggle('is-error', Boolean(isError));
  }

  /*
   * 作用：
   * 根据 tab id 返回显示文本。
   */
  tabLabel(tab) {
    return {
      basic: this.t('configModal.tabs.basic'),
      theme: this.t('configModal.tabs.theme'),
      layout: this.t('configModal.tabs.layout'),
      font: this.t('configModal.tabs.font'),
      source: this.t('configModal.tabs.source'),
      advanced: this.t('configModal.tabs.advanced'),
    }[tab];
  }

  /*
   * 作用：
   * 返回配置弹框 tab 选项。
   */
  tabOptions() {
    return [
      ['basic', this.t('configModal.tabs.basic')],
      ['theme', this.t('configModal.tabs.theme')],
      ['layout', this.t('configModal.tabs.layout')],
      ['font', this.t('configModal.tabs.font')],
      ['source', this.t('configModal.tabs.source')],
      ['advanced', this.t('configModal.tabs.advanced')],
    ];
  }

  /*
   * 作用：
   * 返回主题色系下拉框选项。
   */
  themeOptions() {
    return [
      ['default', this.t('configModal.theme.default')],
      ['ocean', this.t('configModal.theme.ocean')],
      ['forest', this.t('configModal.theme.forest')],
      ['sunset', this.t('configModal.theme.sunset')],
      ['mono', this.t('configModal.theme.mono')],
      ['rainbow', this.t('configModal.theme.rainbow')],
      ['pastel-rainbow', this.t('configModal.theme.pastelRainbow')],
      ['neon-rainbow', this.t('configModal.theme.neonRainbow')],
    ];
  }

  /*
   * 作用：
   * 返回布局类型分组下拉框选项。
   */
  layoutOptionGroups() {
    return [
      {
        group: this.t('configModal.layout.group.mindmap'),
        options: [
          ['mindmap-right', this.t('configModal.layout.mindmapRight')],
          ['mindmap-left', this.t('configModal.layout.mindmapLeft')],
          ['mindmap-bidirectional', this.t('configModal.layout.mindmapBidirectional')],
          ['mindmap-up', this.t('configModal.layout.mindmapUp')],
          ['mindmap-down', this.t('configModal.layout.mindmapDown')],
          ['mindmap-vertical', this.t('configModal.layout.mindmapVertical')],
        ],
      },
      {
        group: this.t('configModal.layout.group.tree'),
        options: [
          ['tree', this.t('configModal.layout.tree')],
          ['tree-right', this.t('configModal.layout.treeRight')],
          ['tree-left', this.t('configModal.layout.treeLeft')],
        ],
      },
      {
        group: this.t('configModal.layout.group.org'),
        options: [
          ['org', this.t('configModal.layout.org')],
          ['org-right', this.t('configModal.layout.orgRight')],
        ],
      },
      {
        group: this.t('configModal.layout.group.timeline'),
        options: [
          ['timeline', this.t('configModal.layout.timeline')],
          ['timeline-up', this.t('configModal.layout.timelineUp')],
          ['timeline-down', this.t('configModal.layout.timelineDown')],
        ],
      },
      {
        group: this.t('configModal.layout.group.radial'),
        options: [['radial', this.t('configModal.layout.radial')]],
      },
      {
        group: this.t('configModal.layout.group.fishbone'),
        options: [['fishbone-left', this.t('configModal.layout.fishboneLeft')]],
      },
      {
        group: this.t('configModal.layout.group.treeTable'),
        options: [
          ['tree-table', this.t('configModal.layout.treeTable')],
          ['tree-table-stepped', this.t('configModal.layout.treeTableStepped')],
        ],
      },
    ];
  }

  /*
   * 作用：
   * 返回连线线型下拉框选项。
   */
  connectorOptions() {
    return [
      ['curve', this.t('configModal.connector.curve')],
      ['straight', this.t('configModal.connector.straight')],
      ['elbow', this.t('configModal.connector.elbow')],
    ];
  }

  /*
   * 作用：
   * 判断是否需要提示“默认主题颜色会覆盖彩虹主题自动配色”。
   */
  shouldWarnDefaultColorOverridesTheme() {
    const theme = String(getConfigValue(this.draftConfig, ['theme'], '') || '').trim();
    const defaultColor = getConfigValue(this.draftConfig, ['topic', 'defaultColor'], '');
    const hasDefaultColor =
      typeof defaultColor === 'string'
        ? defaultColor.trim() !== ''
        : typeof defaultColor === 'number';

    return RAINBOW_THEME_NAMES.has(theme) && hasDefaultColor;
  }

  /*
   * 作用：
   * 按当前草稿配置更新主题冲突提示。
   */
  updateThemeOverrideWarning(warningEl) {
    const shouldWarn = this.shouldWarnDefaultColorOverridesTheme();
    warningEl.setText(shouldWarn ? this.t('configModal.theme.overrideWarning') : '');
    warningEl.hidden = !shouldWarn;
  }
}
