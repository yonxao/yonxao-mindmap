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
  FONT_LEVEL_KEYS,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  TEXT_ALIGN_VALUES,
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
    this.createSelectField(
      this.t('configModal.font.align'),
      ['font', 'align'],
      normalized.font.align,
      this.textAlignOptions(),
      {
        help: this.t('configModal.font.align.help'),
      }
    );

    this.createSection(this.t('configModal.font.levelSection'));
    const levelFontGroups = [];
    for (const levelKey of FONT_LEVEL_KEYS) {
      const level = levelKey.replace('level', '');
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
    titleEl.setText(this.t(`configModal.font.levelTitle${level}`));
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

  textAlignOptions() {
    return TEXT_ALIGN_VALUES.map((value) => [value, this.t(`configModal.font.align.${value}`)]);
  },

  installLevelFontInheritanceSync(globalFields, levelFontGroups) {
    /*
     * 全局字体项只联动同名级别字段。
     * 例如改全局字号时不触碰级别字重/行高，避免被动同步误删用户的显式配置。
     */
    const bindFieldSync = (controls, fontKey) => {
      const sync = () => {
        this.syncLevelFontInheritedField(levelFontGroups, fontKey);
      };
      for (const control of controls.filter(Boolean)) {
        control.addEventListener('input', sync);
        control.addEventListener('change', sync);
      }
    };

    bindFieldSync([globalFields.family?.select, globalFields.family?.input], 'family');
    bindFieldSync([globalFields.size], 'size');
    bindFieldSync([globalFields.weight], 'weight');
    bindFieldSync([globalFields.lineHeight], 'lineHeight');
  },

  syncLevelFontInheritedField(levelFontGroups, fontKey) {
    const normalized = normalizeMindConfig(this.effectiveDraftConfig());
    for (const group of levelFontGroups) {
      const path = ['font', group.levelKey, fontKey];
      const fallbackValue = normalized.font[fontKey] ?? '';
      const inheritedValue = this.configDefaultValueForPath
        ? this.configDefaultValueForPath(path, fallbackValue)
        : fallbackValue;

      if (fontKey === 'family') {
        this.syncInheritedFontFamilyField(group.fields.family, path, inheritedValue, {
          preserveExplicit: true,
        });
        continue;
      }

      this.syncInheritedNumberInput(
        group.fields[fontKey],
        path,
        inheritedValue,
        /*
         * 这里是全局字段变化触发的被动回显，只更新继承来源。
         * 显式 levelN 字段是否消除，应由用户编辑该字段时决定。
         */
        { preserveExplicit: true }
      );
    }
  },

  syncInheritedFontFamilyField(field, path, value, options = {}) {
    if (!field) return;

    const nextValue =
      typeof value === 'string' || typeof value === 'number'
        ? normalizeFontFamilyInput(String(value))
        : '';
    field.setInheritedValue?.(nextValue);
    if (this.hasDraftConfigPath(path)) {
      if (options.preserveExplicit) {
        this.syncInheritedValueStyle(field.controlEl, path);
        return;
      }
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
};
