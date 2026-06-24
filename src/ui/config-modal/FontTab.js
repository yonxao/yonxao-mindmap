/*
 * 文件作用：
 * 配置面板字体页方法集合，负责全局字体和按主题级别字体覆盖。
 *
 * 实现逻辑：
 * 全局字体字段作为默认值，level1/level2/level3 字段可继承或覆盖全局字体配置。
 *
 * 调用链：
 * ConfigModal.render() -> fontTabMethods -> fontOptions/configFields。
 */

import {
  deleteConfigValue,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  normalizeMindConfig,
  normalizeFontFamilyInput,
} from './configModalShared.js';

export const fontTabMethods = {
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
    /*
     * 全局字体字段不提供“继承上层”的空状态。
     * 没有显式配置时显示运行时默认字体，但保存时仍会裁剪和默认值相同的路径。
     */
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
    /*
     * 层级字体允许继承全局字体。
     * 初始显示继承值，用户清空字段时再退回 placeholder，避免误以为空值会被保存。
     */
    for (const group of levelFontGroups) {
      const field = group.fields.family;
      if (field && !this.hasDraftConfigPath(['font', group.levelKey, 'family'])) {
        field.input.value = globalFontFamilyField.input.value;
      }
    }
  },

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
  },

  inheritedLevelFontValue(normalized, key) {
    return normalized.font[key] || '';
  },

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
  },

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
  },

  syncInheritedFontFamilyField(field, path, value) {
    if (!field) return;

    const nextValue =
      typeof value === 'string' || typeof value === 'number'
        ? normalizeFontFamilyInput(String(value))
        : '';
    field.setInheritedValue?.(nextValue);
    if (this.hasDraftConfigPath(path)) {
      if (normalizeFontFamilyInput(field.input.value) === nextValue) {
        deleteConfigValue(this.draftConfig, path);
        this.syncConfigFontInheritedField(field.select, field.input, nextValue, true);
        this.syncInheritedValueStyle(field.controlEl, path);
      }
      return;
    }

    if (document.activeElement === field.input && !normalizeFontFamilyInput(field.input.value)) {
      this.syncInheritedValueStyle(field.controlEl, path);
      return;
    }

    this.syncConfigFontField(field.select, field.input, '');
    if (nextValue) field.input.value = nextValue;
    this.syncInheritedValueStyle(field.controlEl, path);
  },

  syncInheritedNumberInput(input, path, value) {
    if (!input) return;

    const nextValue = value === null || value === undefined ? '' : String(value);
    this.setConfigInputInheritedValue(input, nextValue);
    if (this.hasDraftConfigPath(path)) {
      if (String(input.value ?? '').trim() === nextValue) {
        deleteConfigValue(this.draftConfig, path);
        this.syncInheritedValueStyle(input._yonxaoMindmapControlEl, path);
      }
      return;
    }

    if (document.activeElement === input && !String(input.value || '').trim()) {
      this.syncInheritedValueStyle(input._yonxaoMindmapControlEl, path);
      return;
    }

    input.value = nextValue;
    this.syncInheritedValueStyle(input._yonxaoMindmapControlEl, path);
  },
};
