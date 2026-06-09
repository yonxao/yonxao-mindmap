/*
 * 文件作用：
 * 这里定义可视化配置弹框，让用户不用手写 YAML 也能调整 yxmm 配置区。
 *
 * 主要功能：
 * - 基础：画布高度、源码高度、工具栏位置。
 * - 主题：主题名、默认节点颜色。
 * - 结构：一级分支方向、节点最大宽度。
 * - 字体：全局字体与 1/2/3 级标题字体。
 * - 源码：Tab 调整标题级别开关。
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
import { CUSTOM_FONT_VALUE, FONT_FAMILY_GROUPS, isPresetFontValue } from './fontOptions.js';
import { MIND_THEME_OPTIONS } from '../theme/mindThemes.js';

const RAINBOW_THEME_NAMES = new Set(['rainbow', 'pastel-rainbow', 'neon-rainbow']);

/*
 * 作用：
 * Obsidian 原生 Modal，用于编辑当前 yxmm 代码块配置区。
 */
export class ConfigModal extends Modal {
  constructor(app, options) {
    super(app);
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
    headerEl.createEl('h2', { text: '思维导图配置' });

    const tabsEl = contentEl.createDiv({ cls: 'yonxao-mindmap-config-tabs' });
    for (const [id, label] of [
      ['basic', '基础'],
      ['theme', '主题'],
      ['layout', '结构'],
      ['font', '字体'],
      ['source', '源码'],
      ['advanced', '高级'],
    ]) {
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
    this.createActionButton(actionsEl, '应用', async () => {
      await this.applyDraft(false);
    });
    this.createActionButton(actionsEl, '保存并关闭', async () => {
      await this.applyDraft(true);
    });
    this.createActionButton(actionsEl, '取消', () => {
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
    this.createSection('基础配置');
    this.createNumberField('脑图高度', ['canvas', 'height'], normalized.canvas.height, {
      min: 96,
      max: 1800,
      step: 10,
      placeholder: '自动',
      help: '留空表示自动高度。拖动画布底部也会写入这个值。',
    });
    this.createNumberField('源码高度', ['source', 'height'], normalized.source.height, {
      min: 96,
      max: 1800,
      step: 10,
      placeholder: '自动',
      help: '源码模式独立高度，不影响脑图高度。',
    });
    this.createNumberField('工具栏 X', ['toolbar', 'x'], normalized.toolbar.x, {
      min: 0,
      max: 10000,
      step: 1,
      placeholder: '默认',
    });
    this.createNumberField('工具栏 Y', ['toolbar', 'y'], normalized.toolbar.y, {
      min: 0,
      max: 10000,
      step: 1,
      placeholder: '默认',
    });
    this.createInlineResetButton('重置工具栏位置', [
      ['toolbar', 'x'],
      ['toolbar', 'y'],
    ]);
  }

  /*
   * 作用：
   * 主题配置：主题名和默认颜色。
   */
  renderThemeTab(normalized) {
    this.createSection('主题');
    const themeField = this.createSelectTextField(
      '主题方案',
      ['theme'],
      normalized.theme,
      MIND_THEME_OPTIONS
    );
    const colorField = this.createColorTextField(
      '统一节点颜色',
      ['node', 'defaultColor'],
      normalized.node.defaultColor,
      '留空则使用当前主题的自动配色。填写后会覆盖主题自动配色，但节点属性 color 仍然优先。'
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
   * 结构配置：布局方向和节点宽度。
   */
  renderLayoutTab(normalized) {
    this.createSection('结构');
    this.createSelectField(
      '一级分支方向',
      ['layout', 'defaultDirection'],
      normalized.layout.defaultDirection,
      [
        ['balanced', '平衡'],
        ['right', '全部右侧'],
        ['left', '全部左侧'],
      ]
    );
    this.createNumberField('节点最大宽度', ['node', 'maxWidth'], normalized.node.maxWidth, {
      min: 120,
      max: 800,
      step: 10,
    });
  }

  /*
   * 作用：
   * 字体配置：全局字体和按层级覆盖。
   */
  renderFontTab(normalized) {
    this.createSection('全局字体');
    this.createFontFamilyField('字体', ['font', 'family'], normalized.font.family, {
      help: '可以选择内置字体预设，也可以选择“自定义”后输入 CSS 字体族，例如 "LXGW WenKai", "Source Han Sans SC", sans-serif。',
    });
    this.createNumberField('字号', ['font', 'size'], normalized.font.size, {
      min: FONT_SIZE_MIN,
      max: FONT_SIZE_MAX,
      step: 1,
      help: '字号单位是像素，控制节点文字大小。',
    });
    this.createNumberField('字重', ['font', 'weight'], normalized.font.weight, {
      min: FONT_WEIGHT_MIN,
      max: FONT_WEIGHT_MAX,
      step: 10,
      help: '字重遵循 CSS 标准范围 100-900。',
    });
    this.createNumberField('行高', ['font', 'lineHeight'], normalized.font.lineHeight, {
      min: FONT_LINE_HEIGHT_MIN,
      max: FONT_LINE_HEIGHT_MAX,
      step: 1,
      help: '行高是 SVG 文本每行之间的像素距离，建议约为字号的 1.3-1.5 倍。',
    });

    this.createSection('按层级覆盖');
    for (const level of ['1', '2', '3']) {
      this.createLevelFontGroup(level);
    }
  }

  /*
   * 作用：
   * 源码编辑配置。
   */
  renderSourceTab(normalized) {
    this.createSection('源码模式');
    this.createToggleField(
      'Tab 调整标题级别',
      ['source', 'enableTabIndent'],
      normalized.source.enableTabIndent
    );
    this.createNumberField('源码高度', ['source', 'height'], normalized.source.height, {
      min: 96,
      max: 1800,
      step: 10,
      placeholder: '自动',
    });
  }

  /*
   * 作用：
   * 高级 YAML 编辑。
   */
  renderAdvancedTab() {
    this.createSection('高级配置');
    this.advancedInputEl = this.formEl.createEl('textarea', {
      cls: 'yonxao-mindmap-config-yaml',
    });
    this.advancedInputEl.spellcheck = false;
    this.advancedInputEl.value = stringifyDraftConfig(this.draftConfig);
    this.advancedInputEl.addEventListener('input', () => {
      try {
        this.draftConfig = parseDraftConfigText(this.advancedInputEl.value);
        this.updateStatus('配置语法有效。');
      } catch (error) {
        this.updateStatus(`配置语法错误：${error.message || String(error)}`, true);
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
    titleEl.setText(`${'#'.repeat(Number(level))} 层级`);
    const clearButton = titleEl.createEl('button', {
      text: '清除本层',
      cls: 'yonxao-mindmap-config-small-button',
    });
    clearButton.type = 'button';
    clearButton.addEventListener('click', () => {
      deleteConfigValue(this.draftConfig, ['font', 'levels', level]);
      this.render();
    });

    this.createNumberField('字号', ['font', 'levels', level, 'size'], '', {
      min: FONT_SIZE_MIN,
      max: FONT_SIZE_MAX,
      step: 1,
      parentEl: groupEl,
    });
    this.createNumberField('字重', ['font', 'levels', level, 'weight'], '', {
      min: FONT_WEIGHT_MIN,
      max: FONT_WEIGHT_MAX,
      step: 10,
      parentEl: groupEl,
    });
    this.createNumberField('行高', ['font', 'levels', level, 'lineHeight'], '', {
      min: FONT_LINE_HEIGHT_MIN,
      max: FONT_LINE_HEIGHT_MAX,
      step: 1,
      parentEl: groupEl,
    });
    this.createFontFamilyField('字体', ['font', 'levels', level, 'family'], '', {
      parentEl: groupEl,
    });
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
    for (const [optionValue, optionLabel] of options) {
      const option = select.createEl('option', { text: optionLabel });
      option.value = optionValue;
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
    for (const group of FONT_FAMILY_GROUPS) {
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
  createToggleField(label, path, value) {
    const fieldEl = this.createField(label);
    const input = fieldEl.createEl('input');
    input.type = 'checkbox';
    input.checked = Boolean(getConfigValue(this.draftConfig, path, value));
    input.addEventListener('change', () => {
      setConfigValue(this.draftConfig, path, input.checked);
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
    this.updateStatus('配置已保存。');
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
      basic: '基础',
      theme: '主题',
      layout: '结构',
      font: '字体',
      source: '源码',
      advanced: '高级',
    }[tab];
  }

  /*
   * 作用：
   * 判断是否需要提示“统一节点颜色会覆盖彩虹主题自动配色”。
   */
  shouldWarnUnifiedColorOverridesTheme() {
    const theme = String(getConfigValue(this.draftConfig, ['theme'], '') || '').trim();
    const defaultColor = getConfigValue(this.draftConfig, ['node', 'defaultColor'], '');
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
    const shouldWarn = this.shouldWarnUnifiedColorOverridesTheme();
    warningEl.setText(
      shouldWarn ? '当前主题会按分支自动配色；填写统一节点颜色后，主题的彩虹分支色将不会显示。' : ''
    );
    warningEl.hidden = !shouldWarn;
  }
}
