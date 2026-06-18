/*
 * 文件作用：
 * 这里定义可视化配置弹框，让用户不用手写 YAML 也能调整 yxmm 配置区。
 *
 * 主要功能：
 * - 基础：幕布高度、源码高度、工具栏位置和交互开关。
 * - 主题：主题名、默认主题颜色。
 * - 布局：布局类型、连线、子主题展开和主题最大宽度。
 * - 字体：全局字体与 1/2/3 级标题字体。
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
  DEFAULT_FONT_FAMILY,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  TOPIC_MAX_WIDTH_MAX,
  TOPIC_MAX_WIDTH_MIN,
  TOOLBAR_CORNERS,
  TOOLBAR_PLACEMENTS,
  VIEW_FIT_MODES,
  canonicalizeMindConfig,
  mergeMindConfigObjects,
  normalizeMindConfig,
} from '../config/mindConfig.js';
import { createTranslator } from '../i18n/messages.js';
import {
  CUSTOM_FONT_VALUE,
  getLocalizedFontFamilyGroups,
  isValidFontFamilyInput,
  normalizeFontFamilyInput,
} from './fontOptions.js';
import { clamp } from '../utils/math.js';

const RAINBOW_THEME_NAMES = new Set(['rainbow', 'pastel-rainbow', 'neon-rainbow']);

// 只有传统思维导图布局支持用户选择曲线、直线、折线；其他布局都有更强的结构语义，连接线固定走各自的折线绘制逻辑。
const CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS = new Set([
  'mindmap-right',
  'mindmap-left',
  'mindmap-bidirectional',
  'mindmap-up',
  'mindmap-down',
  'mindmap-vertical',
]);

const BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS = new Set([
  'radial',
  'tree-table',
  'tree-table-stepped',
]);

/*
 * 作用：
 * 对外提供“当前布局是否允许设置连线线型”的统一判断。
 */
export function isConnectorStyleConfigurableLayout(layout) {
  return CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS.has(String(layout || ''));
}

/*
 * 作用：
 * 判断当前布局是否支持普通主题的子主题展开方式。
 */
export function isBranchExpansionSupportedLayout(layout) {
  return !BRANCH_EXPANSION_UNSUPPORTED_LAYOUTS.has(String(layout || ''));
}

/*
 * 作用：
 * 判断当前布局和实际线型是否允许编辑子主题展开方式。
 */
export function isBranchExpansionConfigurable(layout, connectorStyle) {
  if (!isBranchExpansionSupportedLayout(layout)) return false;
  if (isConnectorStyleConfigurableLayout(layout)) return connectorStyle === 'elbow';
  return true;
}

/*
 * 作用：
 * Obsidian 原生 Modal，用于编辑当前 yxmm 代码块配置区。
 */
export class ConfigModal extends Modal {
  constructor(app, options) {
    super(app);
    this.t = options.t || createTranslator('en');
    this.title = options.title || this.t('configModal.title');
    this.baseConfig = cloneConfig(canonicalizeMindConfig(options.baseConfig));
    this.initialConfig = cloneConfig(canonicalizeMindConfig(options.rawConfig));
    this.draftConfig = cloneConfig(canonicalizeMindConfig(options.rawConfig));
    this.onApply = options.onApply;
    this.activeTab = 'basic';
    this.formEl = null;
    this.advancedInputEl = null;
    this.statusEl = null;
    this.dragState = null;
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
    this.installModalDrag(headerEl);

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
    this.dragState = null;
    this.modalEl.classList.remove('is-dragging-config-modal');
    this.modalEl.style.position = '';
    this.modalEl.style.left = '';
    this.modalEl.style.top = '';
    this.modalEl.style.margin = '';
    this.modalEl.style.transform = '';
    this.contentEl.empty();
  }

  /*
   * 作用：
   * 给配置弹框标题栏增加拖动能力。
   */
  installModalDrag(headerEl) {
    headerEl.addEventListener('pointerdown', (event) => {
      this.startModalDrag(event);
    });
    headerEl.addEventListener('pointermove', (event) => {
      this.handleModalDragMove(event);
    });
    headerEl.addEventListener('pointerup', (event) => {
      this.finishModalDrag(event);
    });
    headerEl.addEventListener('pointercancel', (event) => {
      this.finishModalDrag(event);
    });
  }

  /*
   * 作用：
   * 记录配置弹框拖动起点，并把 Obsidian 默认居中的弹框转换为固定坐标。
   */
  startModalDrag(event) {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = this.modalEl.getBoundingClientRect();
    this.modalEl.style.position = 'fixed';
    this.modalEl.style.left = `${Math.round(rect.left)}px`;
    this.modalEl.style.top = `${Math.round(rect.top)}px`;
    this.modalEl.style.margin = '0';
    this.modalEl.style.transform = 'none';

    this.dragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    this.modalEl.classList.add('is-dragging-config-modal');

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer Capture 不可用时，仍可在标题区域内完成基础拖动。
    }
  }

  /*
   * 作用：
   * 处理配置弹框拖动中的位置更新。
   */
  handleModalDragMove(event) {
    const state = this.dragState;
    if (!state || event.pointerId !== state.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    const nextLeft = state.startLeft + event.clientX - state.startClientX;
    const nextTop = state.startTop + event.clientY - state.startClientY;
    const { left, top } = this.clampModalPosition(nextLeft, nextTop);
    this.modalEl.style.left = `${Math.round(left)}px`;
    this.modalEl.style.top = `${Math.round(top)}px`;
  }

  /*
   * 作用：
   * 结束配置弹框拖动。
   */
  finishModalDrag(event) {
    const state = this.dragState;
    if (!state || event.pointerId !== state.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 没有捕获到指针时释放会失败，这里安全忽略。
    }

    this.dragState = null;
    this.modalEl.classList.remove('is-dragging-config-modal');
  }

  /*
   * 作用：
   * 限制配置弹框拖动后仍停留在窗口可视区域内。
   */
  clampModalPosition(left, top) {
    const gap = 12;
    const rect = this.modalEl.getBoundingClientRect();
    const maxLeft = Math.max(gap, window.innerWidth - rect.width - gap);
    const maxTop = Math.max(gap, window.innerHeight - rect.height - gap);
    return {
      left: clamp(left, gap, maxLeft),
      top: clamp(top, gap, maxTop),
    };
  }

  /*
   * 作用：
   * 根据当前 tab 重新绘制表单。
   */
  render() {
    if (!this.formEl) return;

    this.formEl.empty();
    this.formEl.classList.toggle('is-advanced', this.activeTab === 'advanced');
    const normalized = normalizeMindConfig(this.effectiveDraftConfig());

    if (this.activeTab === 'basic') {
      this.renderBasicTab(normalized);
    } else if (this.activeTab === 'theme') {
      this.renderThemeTab(normalized);
    } else if (this.activeTab === 'layout') {
      this.renderLayoutTab(normalized);
    } else if (this.activeTab === 'font') {
      this.renderFontTab(normalized);
    } else {
      this.renderAdvancedTab();
    }

    this.updateTabs();
    this.updateStatus('');
  }

  /*
   * 作用：
   * 计算弹框当前实际展示的配置。
   *
   * 关键点：
   * 文档配置弹框需要用插件全局默认配置回填显示值；但保存时仍只提交 draftConfig，
   * 避免把全局默认配置无意义地写入当前代码块。
   */
  effectiveDraftConfig() {
    return mergeMindConfigObjects(this.baseConfig, this.draftConfig);
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
      ['basic', 'canvasHeight'],
      normalized.canvas.height,
      {
        min: 96,
        max: 1800,
        step: 10,
        placeholder: this.t('configModal.basic.placeholder.auto'),
        help: this.t('configModal.basic.canvasHeight.help'),
      }
    );
    this.createSelectField(
      this.t('configModal.basic.viewFit'),
      ['basic', 'viewFit'],
      normalized.view.fit,
      this.viewFitOptions(),
      {
        help: this.t('configModal.basic.viewFit.help'),
      }
    );
    this.createNumberField(
      this.t('configModal.basic.sourceHeight'),
      ['basic', 'sourceHeight'],
      normalized.source.height,
      {
        min: 96,
        max: 1800,
        step: 10,
        placeholder: this.t('configModal.basic.placeholder.auto'),
        help: this.t('configModal.basic.sourceHeight.help'),
      }
    );
    this.createSelectField(
      this.t('configModal.basic.toolbarCorner'),
      ['basic', 'toolbar', 'corner'],
      normalized.toolbar.corner,
      this.toolbarCornerOptions()
    );
    this.createSelectField(
      this.t('configModal.basic.toolbarPlacement'),
      ['basic', 'toolbar', 'placement'],
      normalized.toolbar.placement,
      this.toolbarPlacementOptions()
    );
    this.createSection(this.t('configModal.basic.featureSection'));
    this.createToggleField(
      this.t('configModal.basic.tabIndent'),
      ['basic', 'tabIndent'],
      normalized.source.enableTabIndent,
      {
        help: this.t('configModal.basic.tabIndent.help'),
      }
    );
    this.createToggleField(
      this.t('configModal.basic.wheelZoom'),
      ['basic', 'wheelZoom'],
      normalized.interaction.wheelZoom,
      {
        help: this.t('configModal.basic.wheelZoom.help'),
      }
    );
  }

  /*
   * 作用：
   * 主题配置：主题名和默认颜色。
   */
  renderThemeTab(normalized) {
    this.createSection(this.t('configModal.theme.section'));
    const themeField = this.createSelectTextField(
      this.t('configModal.theme.scheme'),
      ['theme', 'scheme'],
      normalized.theme,
      this.themeOptions()
    );
    const colorField = this.createColorTextField(
      this.t('configModal.theme.defaultTopicColor'),
      ['theme', 'defaultTopicColor'],
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
   * 布局配置：布局类型、连线、子主题展开和主题宽度。
   */
  renderLayoutTab(normalized) {
    this.createSection(this.t('configModal.layout.section'));
    const layoutSelect = this.createSelectField(
      this.t('configModal.layout.type'),
      ['layout', 'type'],
      normalized.layout,
      this.layoutOptionGroups()
    );
    layoutSelect.addEventListener('change', () => {
      // 布局类型会影响后续字段是否可编辑，因此切换布局后立刻重绘结构页，避免保留已经不适用的线型控件。
      this.render();
    });

    if (this.isConnectorStyleConfigurable(normalized.layout)) {
      const connectorSelect = this.createSelectField(
        this.t('configModal.layout.connectorStyle'),
        ['layout', 'connectorStyle'],
        normalized.connector.style,
        this.connectorOptions()
      );
      connectorSelect.addEventListener('change', () => {
        this.render();
      });
    } else {
      this.createDisabledConnectorStyleField();
    }

    if (this.isBranchExpansionConfigurable(normalized.layout, normalized.connector.style)) {
      this.createSelectField(
        this.t('configModal.layout.branchExpansion'),
        ['layout', 'branchExpansion'],
        normalized.branch.expansion,
        this.branchExpansionOptions()
      );
    } else {
      this.createDisabledBranchExpansionField(normalized.layout, normalized.connector.style);
    }

    this.createTopicMaxWidthGroup(normalized);
  }

  /*
   * 作用：
   * 创建主题最大宽度配置组。
   *
   * 实现逻辑：
   * 全局值写入 layout.topicMaxWidth.global；一级到三级主题写入 level1/level2/level3。
   * 级别输入留空时不写配置，渲染时自然继承全局主题最大宽度。
   */
  createTopicMaxWidthGroup(normalized) {
    this.createSection(this.t('configModal.layout.topicMaxWidthSection'));
    const inputOptions = {
      min: TOPIC_MAX_WIDTH_MIN,
      max: TOPIC_MAX_WIDTH_MAX,
      step: 10,
    };

    this.createNumberField(
      this.t('configModal.layout.topicMaxWidthGlobal'),
      ['layout', 'topicMaxWidth', 'global'],
      normalized.topic.maxWidth,
      {
        ...inputOptions,
        help: this.t('configModal.layout.topicMaxWidth.help'),
      }
    );

    for (const level of ['1', '2', '3']) {
      const levelKey = `level${level}`;
      const levelTopic = normalized.topic.levels[level] || {};
      this.createNumberField(
        this.t(`configModal.layout.topicMaxWidthLevel${level}`),
        ['layout', 'topicMaxWidth', levelKey],
        levelTopic.maxWidth || '',
        {
          ...inputOptions,
          placeholder: this.t('configModal.layout.topicMaxWidthInherit'),
        }
      );
    }
  }

  /*
   * 作用：
   * 字体配置：全局字体和按层级覆盖。
   */
  renderFontTab(normalized) {
    this.createSection(this.t('configModal.font.globalSection'));
    const globalFontFamilyField = this.createFontFamilyField(
      this.t('configModal.font.family'),
      ['font', 'family'],
      normalized.font.family,
      {
        help: this.t('configModal.font.family.help'),
        allowInherit: false,
      }
    );
    /* 强制回填全局字体 */
    if (globalFontFamilyField && normalized.font.family) {
      this.syncConfigFontField(
        globalFontFamilyField.select,
        globalFontFamilyField.input,
        normalized.font.family
      );
    }
    const globalSizeInput = this.createNumberField(
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
    const globalWeightInput = this.createNumberField(
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
    const globalLineHeightInput = this.createNumberField(
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
    const levelFontGroups = [];
    for (const level of ['1', '2', '3']) {
      levelFontGroups.push(this.createLevelFontGroup(level, normalized));
    }
    this.installLevelFontInheritanceSync(
      {
        family: globalFontFamilyField,
        size: globalSizeInput,
        weight: globalWeightInput,
        lineHeight: globalLineHeightInput,
      },
      levelFontGroups
    );
    /* 初始渲染：继承全局字体的层级输入框填充全局输入框的值 */
    for (const group of levelFontGroups) {
      const field = group.fields.family;
      if (field && !this.hasDraftConfigPath(['font', group.levelKey, 'family'])) {
        field.input.value = globalFontFamilyField.input.value;
      }
    }
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
        this.draftConfig = canonicalizeMindConfig(parseDraftConfigText(this.advancedInputEl.value));
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
  createLevelFontGroup(level, normalized) {
    const levelKey = `level${level}`;
    const levelFont = normalized.font.levels[level] || {};
    const groupEl = this.formEl.createDiv({ cls: 'yonxao-mindmap-config-level' });
    const titleEl = groupEl.createDiv({ cls: 'yonxao-mindmap-config-level-title' });
    titleEl.setText(this.t('configModal.font.levelTitle', { marks: '#'.repeat(Number(level)) }));
    const clearButton = titleEl.createEl('button', {
      text: this.t('configModal.font.clearLevel'),
      cls: 'yonxao-mindmap-config-small-button',
    });
    clearButton.type = 'button';
    clearButton.addEventListener('click', () => {
      deleteConfigValue(this.draftConfig, ['font', levelKey]);
      this.render();
    });

    const sizeInput = this.createNumberField(
      this.t('configModal.font.size'),
      ['font', levelKey, 'size'],
      levelFont.size || this.inheritedLevelFontValue(normalized, 'size'),
      {
        min: FONT_SIZE_MIN,
        max: FONT_SIZE_MAX,
        step: 1,
        parentEl: groupEl,
      }
    );
    const weightInput = this.createNumberField(
      this.t('configModal.font.weight'),
      ['font', levelKey, 'weight'],
      levelFont.weight || this.inheritedLevelFontValue(normalized, 'weight'),
      {
        min: FONT_WEIGHT_MIN,
        max: FONT_WEIGHT_MAX,
        step: 10,
        parentEl: groupEl,
      }
    );
    const lineHeightInput = this.createNumberField(
      this.t('configModal.font.lineHeight'),
      ['font', levelKey, 'lineHeight'],
      levelFont.lineHeight || this.inheritedLevelFontValue(normalized, 'lineHeight'),
      {
        min: FONT_LINE_HEIGHT_MIN,
        max: FONT_LINE_HEIGHT_MAX,
        step: 1,
        parentEl: groupEl,
      }
    );
    const familyField = this.createFontFamilyField(
      this.t('configModal.font.family'),
      ['font', levelKey, 'family'],
      levelFont.family || this.inheritedLevelFontValue(normalized, 'family'),
      {
        parentEl: groupEl,
        allowInherit: true,
      }
    );

    return {
      levelKey,
      fields: {
        family: familyField,
        size: sizeInput,
        weight: weightInput,
        lineHeight: lineHeightInput,
      },
    };
  }

  inheritedLevelFontValue(normalized, key) {
    return normalized.font[key] || '';
  }

  /*
   * 作用：
   * 全局字体字段变化后，实时刷新仍处于“继承全局字体”状态的层级字段。
   *
   * 关键点：
   * 这里只更新没有显式写入 font.level1/2/3 的字段；已经自定义过的层级覆盖不联动。
   */
  installLevelFontInheritanceSync(globalFields, levelFontGroups) {
    const sync = () => {
      this.syncLevelFontInheritedFields(levelFontGroups);
    };
    const controls = [
      globalFields.family?.select,
      globalFields.family?.input,
      globalFields.size,
      globalFields.weight,
      globalFields.lineHeight,
    ].filter(Boolean);

    for (const control of controls) {
      control.addEventListener('input', sync);
      control.addEventListener('change', sync);
    }
  }

  syncLevelFontInheritedFields(levelFontGroups) {
    const normalized = normalizeMindConfig(this.effectiveDraftConfig());
    for (const group of levelFontGroups) {
      this.syncInheritedFontFamilyField(
        group.fields.family,
        ['font', group.levelKey, 'family'],
        normalized.font.family
      );
      this.syncInheritedNumberInput(
        group.fields.size,
        ['font', group.levelKey, 'size'],
        normalized.font.size
      );
      this.syncInheritedNumberInput(
        group.fields.weight,
        ['font', group.levelKey, 'weight'],
        normalized.font.weight
      );
      this.syncInheritedNumberInput(
        group.fields.lineHeight,
        ['font', group.levelKey, 'lineHeight'],
        normalized.font.lineHeight
      );
    }
  }

  syncInheritedFontFamilyField(field, path, value) {
    if (!field || this.hasDraftConfigPath(path)) return;

    const nextValue =
      typeof value === 'string' || typeof value === 'number'
        ? normalizeFontFamilyInput(String(value))
        : '';
    field.setInheritedValue?.(nextValue);
    this.syncConfigFontField(field.select, field.input, '');
    if (nextValue) field.input.value = nextValue;
    this.syncInheritedValueStyle(field.controlEl, path);
  }

  syncInheritedNumberInput(input, path, value) {
    if (!input || this.hasDraftConfigPath(path)) return;

    input.value = value === null || value === undefined ? '' : String(value);
    this.syncInheritedValueStyle(input._yonxaoMindmapControlEl, path);
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
    this.applyInheritedValueStyle(fieldEl, path);
    const input = fieldEl.createEl('input');
    input.type = 'number';
    input.min = String(options.min ?? '');
    input.max = String(options.max ?? '');
    input.step = String(options.step ?? 1);
    input.placeholder = options.placeholder || '';
    input.value = String(getConfigValue(this.draftConfig, path, normalizedValue ?? '') ?? '');
    input.addEventListener('input', () => {
      setConfigValue(this.draftConfig, path, numberFromInput(input.value));
      this.syncInheritedValueStyle(fieldEl, path);
    });
    input._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return input;
  }

  /*
   * 作用：
   * 创建下拉选择框。
   */
  createSelectField(label, path, value, options, fieldOptions = {}) {
    const fieldEl = this.createField(label, fieldOptions.parentEl, fieldOptions.help);
    this.applyInheritedValueStyle(fieldEl, path);
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
      this.syncInheritedValueStyle(fieldEl, path);
    });
    this.appendFieldHelp(fieldEl);
    return select;
  }

  /*
   * 作用：
   * 非思维导图布局不开放连线线型配置，展示一个禁用下拉框作为明确反馈。
   *
   * 实现逻辑：
   * - UI 上固定显示“折线”，和实际渲染逻辑一致。
   * - 不主动写入 connector.style，避免用户只是切换布局查看时产生额外配置噪音。
   */
  createDisabledConnectorStyleField() {
    const fieldEl = this.createField(
      this.t('configModal.layout.connectorStyle'),
      undefined,
      this.t('configModal.layout.connectorStyle.fixedHelp')
    );
    fieldEl.parentElement?.classList.add('is-disabled-value');
    const select = fieldEl.createEl('select');
    const option = select.createEl('option', { text: this.t('configModal.connector.elbow') });
    option.value = 'elbow';
    select.value = 'elbow';
    select.disabled = true;
    this.appendFieldHelp(fieldEl);
  }

  /*
   * 作用：
   * 创建“下拉 + 文本输入”组合，适合熟悉配置的人直接输入。
   */
  createSelectTextField(label, path, value, options, fieldOptions = {}) {
    const fieldEl = this.createField(label, fieldOptions.parentEl);
    this.applyInheritedValueStyle(fieldEl, path);
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
      this.syncInheritedValueStyle(fieldEl, path);
    });
    input.addEventListener('input', () => {
      setConfigValue(this.draftConfig, path, input.value.trim());
      select.value = options.some(([optionValue]) => optionValue === input.value)
        ? input.value
        : '';
      this.syncInheritedValueStyle(fieldEl, path);
    });
    this.appendFieldHelp(fieldEl);
    return { select, input };
  }

  /*
   * 作用：
   * 创建字体选择控件。
   *
   * 实现逻辑：
   * 下拉框提供常用字体预设；右侧输入框允许用户直接填写 CSS font-family。
   * 允许继承时，选择“继承全局字体”会删除当前路径配置；
   * 选择“自定义”则等待用户在输入框填写具体字体。
   */
  createFontFamilyField(label, path, value, fieldOptions = {}) {
    const fieldEl = this.createField(label, fieldOptions.parentEl, fieldOptions.help);
    this.applyInheritedValueStyle(fieldEl, path);
    const rowEl = fieldEl.createDiv({ cls: 'yonxao-mindmap-config-combo' });
    const select = rowEl.createEl('select');
    const input = rowEl.createEl('input');
    input.type = 'text';
    input.placeholder = '';

    const explicitValue = getConfigValue(this.draftConfig, path, undefined);
    let inheritedValue =
      typeof value === 'string' || typeof value === 'number'
        ? normalizeFontFamilyInput(String(value))
        : '';
    const allowInherit = fieldOptions.allowInherit !== false;
    if (!allowInherit && !inheritedValue && path.join('.') === 'font.family') {
      inheritedValue = DEFAULT_FONT_FAMILY;
    }
    this.appendFontOptions(select, { includeInherit: allowInherit });
    const hasExplicitValue = this.hasDraftConfigPath(path);
    const currentValue =
      typeof explicitValue === 'string' || typeof explicitValue === 'number'
        ? normalizeFontFamilyInput(String(explicitValue))
        : inheritedValue;
    this.syncConfigFontField(select, input, hasExplicitValue || !allowInherit ? currentValue : '');

    const validateAndStore = () => {
      const nextValue = normalizeFontFamilyInput(input.value);
      if (!nextValue) {
        input.setCustomValidity('');
        if (allowInherit) {
          deleteConfigValue(this.draftConfig, path);
          select.value = '';
          input.value = inheritedValue;
        } else {
          deleteConfigValue(this.draftConfig, path);
          this.syncConfigFontField(select, input, inheritedValue);
        }
        this.updateStatus('');
        return true;
      }

      if (!isValidFontFamilyInput(nextValue)) {
        input.setCustomValidity(this.t('topicEditor.fontFamily.invalid'));
        this.updateStatus(this.t('topicEditor.fontFamily.invalid'), true);
        return false;
      }

      input.setCustomValidity('');
      setConfigValue(this.draftConfig, path, nextValue);
      this.syncConfigFontField(select, input, nextValue);
      this.updateStatus('');
      return true;
    };
    if (input.value && !isValidFontFamilyInput(input.value)) {
      input.setCustomValidity(this.t('topicEditor.fontFamily.invalid'));
    }

    select.addEventListener('change', () => {
      if (select.value === CUSTOM_FONT_VALUE) {
        input.setCustomValidity('');
        input.value = '';
        input.focus();
        this.syncInheritedValueStyle(fieldEl, path);
        return;
      }

      if (!select.value) {
        if (!allowInherit) {
          input.setCustomValidity('');
          input.value = '';
          deleteConfigValue(this.draftConfig, path);
          this.syncConfigFontField(select, input, inheritedValue);
          this.syncInheritedValueStyle(fieldEl, path);
          return;
        }

        deleteConfigValue(this.draftConfig, path);
        input.setCustomValidity('');
        input.value = inheritedValue;
        select.value = '';
        this.syncInheritedValueStyle(fieldEl, path);
        return;
      }

      input.value = select.value;
      input.setCustomValidity('');
      setConfigValue(this.draftConfig, path, select.value);
      this.syncInheritedValueStyle(fieldEl, path);
    });

    input.addEventListener('input', () => {
      if (normalizeFontFamilyInput(input.value)) select.value = CUSTOM_FONT_VALUE;
      if (validateAndStore()) this.syncInheritedValueStyle(fieldEl, path);
    });

    select._yonxaoMindmapControlEl = fieldEl;
    input._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return {
      select,
      input,
      controlEl: fieldEl,
      setInheritedValue(nextValue) {
        inheritedValue =
          typeof nextValue === 'string' || typeof nextValue === 'number'
            ? normalizeFontFamilyInput(String(nextValue))
            : '';
      },
    };
  }

  /*
   * 作用：
   * 同步配置面板中的字体下拉框。
   *
   * 这里故意和主题编辑面板 setTopicEditorFontFamilyValue() 保持同一套判断：
   * - 空值选“继承”
   * - 命中预设则直接 select.value = fontFamily
   * - 否则选“自定义”
   */
  syncConfigFontField(select, input, value) {
    if (!value) {
      select.value = '';
      input.value = '';
      return;
    }

    const fontFamily = normalizeFontFamilyInput(value);
    const presetIndex = this.findConfigFontPresetIndex(select, fontFamily);
    if (presetIndex >= 0) {
      select.selectedIndex = presetIndex;
      select.value = select.options[presetIndex].value;
      input.value = fontFamily;
      return;
    }

    select.value = CUSTOM_FONT_VALUE;
    input.value = fontFamily;
  }

  findConfigFontPresetIndex(select, value) {
    const normalizedValue = normalizeFontFamilyInput(value);
    const options = Array.from(select.options);
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      if (option.value === CUSTOM_FONT_VALUE) continue;
      if (normalizeFontFamilyInput(option.value) === normalizedValue) return index;
    }
    return -1;
  }

  /*
   * 作用：
   * 把字体预设按类型渲染成 optgroup。
   */
  appendFontOptions(select, options = {}) {
    for (const group of getLocalizedFontFamilyGroups(this.t, options)) {
      const groupEl = document.createElement('optgroup');
      groupEl.label = group.group;

      for (const [optionValue, optionLabel] of group.options) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionLabel;
        groupEl.appendChild(option);
      }

      select.appendChild(groupEl);
    }
  }

  /*
   * 作用：
   * 创建颜色选择 + 文本输入组合。
   */
  createColorTextField(label, path, value, help) {
    const fieldEl = this.createField(label, undefined, help);
    this.applyInheritedValueStyle(fieldEl, path);
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
      this.syncInheritedValueStyle(fieldEl, path);
    });
    textInput.addEventListener('input', () => {
      setConfigValue(this.draftConfig, path, textInput.value.trim());
      this.syncInheritedValueStyle(fieldEl, path);
    });
    this.appendFieldHelp(fieldEl);
    return { colorInput, textInput };
  }

  /*
   * 作用：
   * 创建开关配置项。
   */
  createToggleField(label, path, value, options = {}) {
    const fieldEl = this.createField(label, undefined, options.help);
    this.applyInheritedValueStyle(fieldEl, path);
    fieldEl.parentElement?.classList.add('is-toggle');
    const switchEl = fieldEl.createEl('label', { cls: 'yonxao-mindmap-config-switch' });
    const input = switchEl.createEl('input');
    input.type = 'checkbox';
    input.checked = Boolean(getConfigValue(this.draftConfig, path, value));
    const trackEl = switchEl.createSpan({ cls: 'yonxao-mindmap-config-switch-track' });
    trackEl.createSpan({ cls: 'yonxao-mindmap-config-switch-thumb' });
    input.addEventListener('change', () => {
      if (options.omitWhenFalse && !input.checked) {
        deleteConfigValue(this.draftConfig, path);
      } else {
        setConfigValue(this.draftConfig, path, input.checked);
      }
      this.syncInheritedValueStyle(fieldEl, path);
    });
    this.appendFieldHelp(fieldEl);
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
    controlEl._yonxaoMindmapHelp = help || '';
    return controlEl;
  }

  /*
   * 作用：
   * 把字段说明固定追加到控件之后，保持“名称 / 配置值”先对齐，说明再跟在配置值下方。
   */
  appendFieldHelp(controlEl) {
    const help = controlEl?._yonxaoMindmapHelp;
    if (!help) return;
    controlEl.createDiv({ cls: 'yonxao-mindmap-config-help', text: help });
    controlEl._yonxaoMindmapHelp = '';
  }

  /*
   * 作用：
   * 判断某个配置路径是否由当前草稿显式提供。
   */
  hasDraftConfigPath(path) {
    let current = this.draftConfig;
    for (const key of path) {
      if (!current || typeof current !== 'object') return false;
      if (!Object.prototype.hasOwnProperty.call(current, key)) return false;
      current = current[key];
    }
    return true;
  }

  /*
   * 作用：
   * 给“从全局默认或内置默认回填”的控件添加轻量默认值样式。
   */
  applyInheritedValueStyle(controlEl, path) {
    this.syncInheritedValueStyle(controlEl, path);
  }

  /*
   * 作用：
   * 根据当前草稿是否显式包含路径，同步默认值/自定义值视觉状态。
   */
  syncInheritedValueStyle(controlEl, path) {
    const isInherited = !this.hasDraftConfigPath(path);
    controlEl.classList.toggle('is-inherited-value', isInherited);
    controlEl.parentElement?.classList.toggle('is-inherited-value', isInherited);
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
    const invalidField = this.contentEl.querySelector(
      'input:invalid, textarea:invalid, select:invalid'
    );
    if (invalidField) {
      invalidField.focus();
      this.updateStatus(invalidField.validationMessage, true);
      return;
    }

    if (this.activeTab === 'advanced' && this.advancedInputEl) {
      this.draftConfig = canonicalizeMindConfig(parseDraftConfigText(this.advancedInputEl.value));
    }

    this.draftConfig = canonicalizeMindConfig(this.draftConfig);
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
   * 返回打开导图时的视图适配选项。
   */
  viewFitOptions() {
    return VIEW_FIT_MODES.map((mode) => [mode, this.t(`configModal.viewFit.${mode}`)]);
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
        options: [
          ['fishbone-left', this.t('configModal.layout.fishboneLeft')],
          ['fishbone-right', this.t('configModal.layout.fishboneRight')],
        ],
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
   * 返回子主题展开方式下拉框选项。
   */
  branchExpansionOptions() {
    return [
      ['side', this.t('configModal.branchExpansion.side')],
      ['hanging', this.t('configModal.branchExpansion.hanging')],
    ];
  }

  /*
   * 作用：
   * 工具栏吸附角落选项。
   */
  toolbarCornerOptions() {
    const labels = {
      'top-left': this.t('configModal.toolbarCorner.topLeft'),
      'top-right': this.t('configModal.toolbarCorner.topRight'),
      'bottom-left': this.t('configModal.toolbarCorner.bottomLeft'),
      'bottom-right': this.t('configModal.toolbarCorner.bottomRight'),
    };
    return TOOLBAR_CORNERS.map((value) => [value, labels[value]]);
  }

  /*
   * 作用：
   * 工具栏在幕布内侧/外侧的选项。
   */
  toolbarPlacementOptions() {
    const labels = {
      inside: this.t('configModal.toolbarPlacement.inside'),
      outside: this.t('configModal.toolbarPlacement.outside'),
    };
    return TOOLBAR_PLACEMENTS.map((value) => [value, labels[value]]);
  }

  /*
   * 作用：
   * 判断当前布局是否允许用户手动选择连接线线型。
   */
  isConnectorStyleConfigurable(layout) {
    return isConnectorStyleConfigurableLayout(layout);
  }

  /*
   * 作用：
   * 判断当前布局和线型是否允许配置子主题展开方式。
   */
  isBranchExpansionConfigurable(layout, connectorStyle) {
    return isBranchExpansionConfigurable(layout, connectorStyle);
  }

  /*
   * 作用：
   * 当前布局或线型不支持时展示只读反馈，避免写入不会生效的配置噪音。
   */
  createDisabledBranchExpansionField(layout, connectorStyle) {
    const help = !isBranchExpansionSupportedLayout(layout)
      ? this.t('configModal.layout.branchExpansion.unsupportedHelp')
      : connectorStyle === 'elbow'
        ? this.t('configModal.layout.branchExpansion.unsupportedHelp')
        : this.t('configModal.layout.branchExpansion.elbowOnlyHelp');
    const fieldEl = this.createField(this.t('configModal.layout.branchExpansion'), undefined, help);
    fieldEl.parentElement?.classList.add('is-disabled-value');
    const select = fieldEl.createEl('select');
    const option = select.createEl('option', { text: this.t('configModal.branchExpansion.side') });
    option.value = 'side';
    select.value = 'side';
    select.disabled = true;
    this.appendFieldHelp(fieldEl);
  }

  /*
   * 作用：
   * 判断是否需要提示“默认主题颜色会覆盖彩虹主题自动配色”。
   */
  shouldWarnDefaultColorOverridesTheme() {
    const normalized = normalizeMindConfig(this.effectiveDraftConfig());
    const theme = String(normalized.theme || '').trim();
    const defaultColor = normalized.topic.defaultColor;
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
