/*
 * 文件作用：
 * 配置面板字段工厂方法集合，负责数字、下拉、开关、颜色、字体和帮助文案控件。
 *
 * 实现逻辑：
 * 字段工厂统一处理路径读写、继承态样式、禁用态样式和 input/change 事件。
 *
 * 调用链：
 * 各 Tab 方法 -> configFieldMethods -> configDraft/configModalState。
 */

import {
  Notice,
  deleteConfigValue,
  getConfigValue,
  numberFromInput,
  setConfigValue,
  BUTTON_COLOR_PRESETS,
  DEFAULT_BUTTON_COLOR,
  DEFAULT_FONT_FAMILY,
  CUSTOM_FONT_VALUE,
  appendFontOptionsToSelect,
  isValidFontFamilyInput,
  normalizeFontFamilyInput,
} from './configModalShared.js';

function configFieldValueEquals(left, right) {
  if (typeof left === 'boolean' || typeof right === 'boolean') {
    return Boolean(left) === Boolean(right);
  }
  return String(left ?? '').trim() === String(right ?? '').trim();
}

function isConfigHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
}

export const configFieldMethods = {
  createSection(title) {
    this.formEl.createDiv({ cls: 'yonxao-mindmap-config-section', text: title });
  },

  createWarning(message) {
    return this.formEl.createDiv({ cls: 'yonxao-mindmap-config-warning', text: message });
  },

  createNumberField(label, path, normalizedValue, options = {}) {
    const inheritedValue = this.prepareConfigFieldDefault(path, normalizedValue ?? '');
    const fieldEl = this.createField(label, options.parentEl, options.help);
    this.syncInheritedValueStyle(fieldEl, path);
    const input = fieldEl.createEl('input');
    input.type = 'number';
    input.min = String(options.min ?? '');
    input.max = String(options.max ?? '');
    input.step = String(options.step ?? 1);
    input.value = String(getConfigValue(this.draftConfig, path, inheritedValue) ?? '');
    input.disabled = Boolean(options.disabled);
    this.setConfigInputInheritedValue(input, inheritedValue, options.placeholder || '');
    input.addEventListener('input', () => {
      this.setConfigValueOrDeleteInherited(
        path,
        numberFromInput(input.value),
        input._yonxaoMindmapInheritedValue
      );
      this.syncInheritedValueStyle(fieldEl, path);
    });
    input.addEventListener('blur', () => {
      this.restoreConfigInputInheritedValue(input);
    });
    input._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return input;
  },

  createTextField(label, path, normalizedValue, options = {}) {
    const inheritedValue = this.prepareConfigFieldDefault(path, normalizedValue ?? '');
    const fieldEl = this.createField(label, options.parentEl, options.help);
    this.syncInheritedValueStyle(fieldEl, path);
    const input = fieldEl.createEl('input');
    input.type = options.type || 'text';
    input.value = String(getConfigValue(this.draftConfig, path, inheritedValue) ?? '');
    input.placeholder = options.placeholder || '';
    input.disabled = Boolean(options.disabled);
    this.setConfigInputInheritedValue(input, inheritedValue, options.placeholder || '');
    input.addEventListener('input', () => {
      this.setConfigValueOrDeleteInherited(
        path,
        input.value.trim(),
        input._yonxaoMindmapInheritedValue
      );
      this.syncInheritedValueStyle(fieldEl, path);
    });
    input.addEventListener('blur', () => this.restoreConfigInputInheritedValue(input));
    input._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return input;
  },

  createSelectField(label, path, value, options, fieldOptions = {}) {
    const inheritedValue = this.prepareConfigFieldDefault(path, value);
    const fieldEl = this.createField(label, fieldOptions.parentEl, fieldOptions.help);
    this.syncInheritedValueStyle(fieldEl, path);
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
    select.value = String(getConfigValue(this.draftConfig, path, inheritedValue));
    select._yonxaoMindmapInheritedValue = inheritedValue;
    select.addEventListener('change', () => {
      this.setConfigValueOrDeleteInherited(path, select.value, select._yonxaoMindmapInheritedValue);
      this.syncInheritedValueStyle(fieldEl, path);
    });
    select._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return select;
  },

  createDisabledConnectorStyleField() {
    const fieldEl = this.createField(
      this.t('configModal.structure.connectorStyle'),
      undefined,
      this.t('configModal.structure.connectorStyle.fixedHelp')
    );
    fieldEl.parentElement?.classList.add('is-disabled-value');
    const select = fieldEl.createEl('select');
    const option = select.createEl('option', { text: this.t('configModal.connector.elbow') });
    option.value = 'elbow';
    select.value = 'elbow';
    select.disabled = true;
    this.appendFieldHelp(fieldEl);
  },

  createSelectTextField(label, path, value, options, fieldOptions = {}) {
    const inheritedValue = this.prepareConfigFieldDefault(path, value ?? '');
    const fieldEl = this.createField(label, fieldOptions.parentEl, fieldOptions.help);
    this.syncInheritedValueStyle(fieldEl, path);
    const rowEl = fieldEl.createDiv({ cls: 'yonxao-mindmap-config-combo' });
    const select = rowEl.createEl('select');
    const input = rowEl.createEl('input');
    input.type = 'text';

    for (const [optionValue, optionLabel] of options) {
      const option = select.createEl('option', { text: optionLabel });
      option.value = optionValue;
    }

    input.value = String(getConfigValue(this.draftConfig, path, inheritedValue) || '');
    this.setConfigInputInheritedValue(input, inheritedValue);
    select._yonxaoMindmapInheritedValue = inheritedValue;
    const syncSelectValue = () => {
      select.value = options.some(([optionValue]) => optionValue === input.value)
        ? input.value
        : '';
    };
    syncSelectValue();
    select.addEventListener('change', () => {
      input.value = select.value;
      this.setConfigValueOrDeleteInherited(path, input.value, input._yonxaoMindmapInheritedValue);
      syncSelectValue();
      this.syncInheritedValueStyle(fieldEl, path);
    });
    input.addEventListener('input', () => {
      this.setConfigValueOrDeleteInherited(
        path,
        input.value.trim(),
        input._yonxaoMindmapInheritedValue
      );
      syncSelectValue();
      this.syncInheritedValueStyle(fieldEl, path);
    });
    input.addEventListener('blur', () => {
      this.restoreConfigInputInheritedValue(input);
      syncSelectValue();
    });
    select._yonxaoMindmapControlEl = fieldEl;
    input._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return { select, input };
  },

  createFontFamilyField(label, path, value, fieldOptions = {}) {
    let inheritedValue = this.prepareConfigFieldDefault(path, value ?? '');
    const fieldEl = this.createField(label, fieldOptions.parentEl, fieldOptions.help);
    this.syncInheritedValueStyle(fieldEl, path);
    const rowEl = fieldEl.createDiv({ cls: 'yonxao-mindmap-config-combo' });
    const select = rowEl.createEl('select');
    const input = rowEl.createEl('input');
    input.type = 'text';

    const explicitValue = getConfigValue(this.draftConfig, path, undefined);
    inheritedValue =
      typeof inheritedValue === 'string' || typeof inheritedValue === 'number'
        ? normalizeFontFamilyInput(String(inheritedValue))
        : '';
    const allowInherit = fieldOptions.allowInherit !== false;
    if (!allowInherit && !inheritedValue && path.join('.') === 'font.family') {
      inheritedValue = DEFAULT_FONT_FAMILY;
    }
    this.setConfigInputInheritedValue(
      input,
      inheritedValue,
      this.t('topicEditor.fontCustomPlaceholder')
    );
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
        deleteConfigValue(this.draftConfig, path);
        this.setConfigInputInheritedValue(
          input,
          inheritedValue,
          this.t('topicEditor.fontCustomPlaceholder')
        );
        if (document.activeElement === input) {
          select.value = allowInherit ? '' : CUSTOM_FONT_VALUE;
          input.value = '';
        } else if (allowInherit) {
          this.syncConfigFontInheritedField(select, input, inheritedValue, allowInherit);
        } else {
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
      if (configFieldValueEquals(nextValue, inheritedValue)) {
        deleteConfigValue(this.draftConfig, path);
        this.syncConfigFontInheritedField(select, input, inheritedValue, allowInherit);
      } else {
        setConfigValue(this.draftConfig, path, nextValue);
        this.syncConfigFontField(select, input, nextValue);
      }
      this.updateStatus('');
      return true;
    };
    if (input.value && !isValidFontFamilyInput(input.value)) {
      input.setCustomValidity(this.t('topicEditor.fontFamily.invalid'));
    }

    select.addEventListener('change', () => {
      if (select.value === CUSTOM_FONT_VALUE) {
        input.setCustomValidity('');
        deleteConfigValue(this.draftConfig, path);
        input.value = '';
        this.setConfigInputInheritedValue(
          input,
          inheritedValue,
          this.t('topicEditor.fontCustomPlaceholder')
        );
        input.focus();
        this.updateStatus('');
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
      if (configFieldValueEquals(select.value, inheritedValue)) {
        deleteConfigValue(this.draftConfig, path);
        this.syncConfigFontInheritedField(select, input, inheritedValue, allowInherit);
      } else {
        setConfigValue(this.draftConfig, path, select.value);
      }
      this.syncInheritedValueStyle(fieldEl, path);
    });

    input.addEventListener('input', () => {
      if (normalizeFontFamilyInput(input.value)) select.value = CUSTOM_FONT_VALUE;
      if (validateAndStore()) this.syncInheritedValueStyle(fieldEl, path);
    });
    input.addEventListener('blur', () => {
      if (!normalizeFontFamilyInput(input.value)) {
        if (allowInherit) {
          this.syncConfigFontInheritedField(select, input, inheritedValue, allowInherit);
        } else {
          this.syncConfigFontField(select, input, inheritedValue);
        }
        this.syncInheritedValueStyle(fieldEl, path);
      }
    });

    select._yonxaoMindmapControlEl = fieldEl;
    input._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return {
      select,
      input,
      controlEl: fieldEl,
      setInheritedValue: (nextValue) => {
        inheritedValue =
          typeof nextValue === 'string' || typeof nextValue === 'number'
            ? normalizeFontFamilyInput(String(nextValue))
            : '';
        this.setConfigInputInheritedValue(
          input,
          inheritedValue,
          this.t('topicEditor.fontCustomPlaceholder')
        );
      },
    };
  },

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
  },

  syncConfigFontInheritedField(select, input, inheritedValue, allowInherit) {
    if (allowInherit) {
      select.value = '';
      input.value = inheritedValue || '';
      return;
    }

    this.syncConfigFontField(select, input, inheritedValue);
  },

  findConfigFontPresetIndex(select, value) {
    const normalizedValue = normalizeFontFamilyInput(value);
    const options = Array.from(select.options);
    for (let index = 0; index < options.length; index += 1) {
      const option = options[index];
      if (option.value === CUSTOM_FONT_VALUE) continue;
      if (normalizeFontFamilyInput(option.value) === normalizedValue) return index;
    }
    return -1;
  },

  appendFontOptions(select, options = {}) {
    appendFontOptionsToSelect(select, this.t, options);
  },

  /* 所有配置颜色统一使用“值输入、原生色盘、预设色块”的横向组合布局。 */
  createColorTextField(label, path, value, options = {}) {
    const inheritedValue = this.prepareConfigFieldDefault(path, value ?? '');
    const fieldEl = this.createField(label, options.parentEl, options.help);
    this.syncInheritedValueStyle(fieldEl, path);
    const rowEl = fieldEl.createDiv({ cls: 'yonxao-mindmap-config-color-control' });
    const textInput = rowEl.createEl('input');
    textInput.type = 'text';
    textInput.value = String(getConfigValue(this.draftConfig, path, inheritedValue) || '');
    this.setConfigInputInheritedValue(textInput, inheritedValue);
    const colorInput = rowEl.createEl('input');
    colorInput.type = 'color';
    colorInput.value = this.configColorPickerValue(textInput.value, inheritedValue);
    colorInput.setAttribute('aria-label', this.t('configModal.color.customColor'));
    const swatchesEl = rowEl.createDiv({ cls: 'yonxao-mindmap-config-color-swatches' });
    textInput._yonxaoMindmapControlEl = fieldEl;
    colorInput._yonxaoMindmapControlEl = fieldEl;

    const storeColor = (nextColor) => {
      textInput.value = nextColor;
      colorInput.value = this.configColorPickerValue(nextColor, inheritedValue);
      this.setConfigValueOrDeleteInherited(path, nextColor, inheritedValue);
      this.syncInheritedValueStyle(fieldEl, path);
      this.updateActionButtons();
    };
    textInput.addEventListener('input', () => storeColor(textInput.value.trim()));
    textInput.addEventListener('blur', () => {
      this.restoreConfigInputInheritedValue(textInput);
      colorInput.value = this.configColorPickerValue(textInput.value, inheritedValue);
    });
    colorInput.addEventListener('input', () => storeColor(colorInput.value));

    const presetColors = options.allowTransparent
      ? ['transparent', ...BUTTON_COLOR_PRESETS]
      : BUTTON_COLOR_PRESETS;
    for (const color of presetColors) {
      const button = swatchesEl.createEl('button', {
        cls: 'yonxao-mindmap-config-color-swatch',
        type: 'button',
      });
      if (color === 'transparent') {
        button.classList.add('is-transparent');
      } else {
        button.style.backgroundColor = color;
      }
      button.setAttribute(
        'aria-label',
        color === 'transparent' ? options.transparentLabel || color : color
      );
      button.addEventListener('click', () => storeColor(color));
    }

    this.appendFieldHelp(fieldEl);
    return { colorInput, textInput, fieldEl };
  },

  createToggleField(label, path, value, options = {}) {
    const inheritedValue = Boolean(this.prepareConfigFieldDefault(path, value));
    const fieldEl = this.createField(label, undefined, options.help);
    this.syncInheritedValueStyle(fieldEl, path);
    fieldEl.parentElement?.classList.add('is-toggle');
    const switchEl = fieldEl.createEl('label', { cls: 'yonxao-mindmap-config-switch' });
    const input = switchEl.createEl('input');
    input.type = 'checkbox';
    input.checked = Boolean(getConfigValue(this.draftConfig, path, inheritedValue));
    input._yonxaoMindmapInheritedValue = inheritedValue;
    input.disabled = Boolean(options.disabled);
    const trackEl = switchEl.createSpan({ cls: 'yonxao-mindmap-config-switch-track' });
    trackEl.createSpan({ cls: 'yonxao-mindmap-config-switch-thumb' });
    input.addEventListener('change', () => {
      if (options.omitWhenFalse && !input.checked) {
        deleteConfigValue(this.draftConfig, path);
      } else {
        this.setConfigValueOrDeleteInherited(
          path,
          input.checked,
          input._yonxaoMindmapInheritedValue
        );
      }
      this.syncInheritedValueStyle(fieldEl, path);
    });
    input._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return input;
  },

  /*
   * 作用：
   * 设置配置值，或者在值等于继承值时删除配置路径（恢复继承态）。
   *
   * 业务规则：
   * - 值等于继承值时删除配置路径，恢复继承态。
   * - 值为空时委托 setConfigValue 删除路径，用户清空输入框的意图就是恢复继承默认值。
   * - 其他情况写入配置值。
   *
   * 参数：
   * - path：配置路径数组。
   * - value：要设置的值。
   * - inheritedValue：该路径的继承值（来自上层配置或默认值）。
   *
   * 边界条件：
   * - 空字符串 ''、null、undefined 由底层 setConfigValue 统一视为"恢复继承态"。
   * - 对于数字输入框，用户清空输入时 numberFromInput('') 返回 ''，会触发删除配置路径。
   */
  setConfigValueOrDeleteInherited(path, value, inheritedValue) {
    if (configFieldValueEquals(value, inheritedValue)) {
      deleteConfigValue(this.draftConfig, path);
      return;
    }

    setConfigValue(this.draftConfig, path, value);
  },

  prepareConfigFieldDefault(path, fallbackValue) {
    /*
     * 默认/继承值必须基于"删除当前字段后的有效配置"计算。
     * 如果把当前 normalized 值当 fallback，导图高度这类可选字段会把用户刚输入的值误判成默认值并删除。
     */
    const defaultValue = this.configDefaultValueForPath
      ? this.configDefaultValueForPath(path, '')
      : fallbackValue;
    const explicitValue = getConfigValue(this.draftConfig, path, undefined);
    if (
      explicitValue !== undefined &&
      explicitValue !== null &&
      configFieldValueEquals(explicitValue, defaultValue)
    ) {
      /*
       * "保存全部配置项"启用时，不要自动删除与默认值相等的路径。
       * 否则切换到其他选项卡再切回来时，draft 中的默认值会被清掉，
       * 高级选项卡中的 YAML 内容就会逐渐"缩水"。
       */
      if (getConfigValue(this.draftConfig, ['display', 'saveFullConfig'], false)) {
        return defaultValue;
      }

      /*
       * 性能优化：先做简单的值比较，值相等时才调用昂贵的冗余判断。
       * isDraftConfigPathRedundant 会做两次 normalize 和两次 JSON.stringify，
       * 只有在值恰好等于默认值的边界情况下才需要进一步确认是否真的冗余。
       */
      const isRedundant = !this.isDraftConfigPathRedundant || this.isDraftConfigPathRedundant(path);
      if (isRedundant) {
        deleteConfigValue(this.draftConfig, path);
      }
    }
    return defaultValue;
  },

  setConfigInputInheritedValue(input, inheritedValue, fallbackValue = '') {
    if (!input) return;
    input._yonxaoMindmapInheritedValue = inheritedValue;
    /*
     * 空输入框展示继承值时只更新 placeholder，不写入 value。
     * 这样用户清空字段时能看到默认来源，保存时仍会删除当前路径以继承上层配置。
     */
    const text = String(inheritedValue ?? '').trim();
    input.placeholder = text || String(fallbackValue ?? '').trim();
  },

  restoreConfigInputInheritedValue(input, selectText = false) {
    if (!input || String(input.value || '').trim()) return;
    this.showConfigInputDefaultValue(input, selectText);
  },

  showConfigInputDefaultValue(input, selectText = false) {
    if (!input) return;
    const inheritedValue = input._yonxaoMindmapInheritedValue;
    input.value =
      inheritedValue === null || inheritedValue === undefined ? '' : String(inheritedValue);
    if (selectText && input.value && document.activeElement === input) {
      input.select?.();
    }
  },

  /*
   * 作用：
   * 同步数字输入框的继承值显示，并根据配置状态更新样式。
   *
   * 参数：
   * - input：数字输入框 DOM 元素。
   * - path：配置路径数组，用于判断当前字段是否为显式配置。
   * - value：当前继承值（来自上层配置或默认值）。
   * - options.preserveExplicit：是否保留显式配置。
   *     - true：被动同步场景（如全局字段变化联动级别字段），只更新继承来源显示，
   *       不删除用户已有的显式配置，避免误删用户数据。
   *     - false/默认：主动编辑场景，如果输入值等于继承值则删除当前配置路径，
   *       恢复为继承态。
   *
   * 边界条件：
   * - 当前焦点在输入框且输入为空时，只更新样式不覆盖值，避免打断用户输入。
   * - 输入值为空时，继承值显示在 placeholder 中，不写入 value。
   */
  syncInheritedNumberInput(input, path, value, options = {}) {
    if (!input) return;

    const nextValue = value === null || value === undefined ? '' : String(value);
    this.setConfigInputInheritedValue(input, nextValue);
    if (this.hasDraftConfigPath(path)) {
      if (options.preserveExplicit) {
        this.syncInheritedValueStyle(input._yonxaoMindmapControlEl, path);
        return;
      }
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

  configColorPickerValue(value, inheritedValue = '') {
    if (isConfigHexColor(value)) return String(value).trim();
    if (isConfigHexColor(inheritedValue)) return String(inheritedValue).trim();
    return DEFAULT_BUTTON_COLOR;
  },

  setFieldDisabled(input, disabled) {
    if (!input) return;
    input.disabled = Boolean(disabled);
    input._yonxaoMindmapControlEl?.parentElement?.classList.toggle(
      'is-disabled-value',
      Boolean(disabled)
    );
  },

  setFieldHidden(input, hidden) {
    if (!input) return;
    input.disabled = Boolean(hidden);
    const fieldEl = input._yonxaoMindmapControlEl?.parentElement;
    if (fieldEl) {
      fieldEl.style.display = hidden ? 'none' : '';
    }
  },

  createField(label, parentEl, help) {
    const fieldEl = (parentEl || this.formEl).createDiv({ cls: 'yonxao-mindmap-config-field' });
    const labelEl = fieldEl.createEl('label');
    labelEl.setText(label);
    const controlEl = fieldEl.createDiv({ cls: 'yonxao-mindmap-config-control' });
    controlEl._yonxaoMindmapHelp = help || '';
    return controlEl;
  },

  appendFieldHelp(controlEl) {
    const help = controlEl?._yonxaoMindmapHelp;
    if (!help) return;
    controlEl.createDiv({ cls: 'yonxao-mindmap-config-help', text: help });
    controlEl._yonxaoMindmapHelp = '';
  },

  createActionButton(parentEl, label, onClick) {
    const button = parentEl.createEl('button', { text: label });
    button.type = 'button';
    button.addEventListener('click', () => {
      Promise.resolve(onClick()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
    });
    return button;
  },
};
