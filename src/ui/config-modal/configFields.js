/*
 * 文件作用：
 * 配置弹框字段工厂方法集合，负责数字、下拉、开关、颜色、字体和帮助文案控件。
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
  DEFAULT_FONT_FAMILY,
  CUSTOM_FONT_VALUE,
  getLocalizedFontFamilyGroups,
  isValidFontFamilyInput,
  normalizeFontFamilyInput,
} from './configModalShared.js';

export const configFieldMethods = {
  createSection(title) {
    this.formEl.createDiv({ cls: 'yonxao-mindmap-config-section', text: title });
  },

  createWarning(message) {
    return this.formEl.createDiv({ cls: 'yonxao-mindmap-config-warning', text: message });
  },

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
    input.disabled = Boolean(options.disabled);
    input.addEventListener('input', () => {
      setConfigValue(this.draftConfig, path, numberFromInput(input.value));
      this.syncInheritedValueStyle(fieldEl, path);
    });
    input._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return input;
  },

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
    select._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return select;
  },

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
  },

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
  },

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
  },

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

    const swatches = fieldEl.createDiv({ cls: 'yonxao-mindmap-config-color-swatches' });
    for (const color of BUTTON_COLOR_PRESETS) {
      const button = swatches.createEl('button', { type: 'button' });
      button.className = 'yonxao-mindmap-config-color-swatch';
      button.style.backgroundColor = color;
      button.setAttribute('aria-label', color);
      button.dataset.color = color;
      button.addEventListener('click', (event) => {
        event.preventDefault();
        textInput.value = color;
        colorInput.value = color;
        setConfigValue(this.draftConfig, path, color);
        this.syncInheritedValueStyle(fieldEl, path);
        this.updateActionButtons();
      });
    }

    this.appendFieldHelp(fieldEl);
    return { colorInput, textInput, fieldEl };
  },

  createToggleField(label, path, value, options = {}) {
    const fieldEl = this.createField(label, undefined, options.help);
    this.applyInheritedValueStyle(fieldEl, path);
    fieldEl.parentElement?.classList.add('is-toggle');
    const switchEl = fieldEl.createEl('label', { cls: 'yonxao-mindmap-config-switch' });
    const input = switchEl.createEl('input');
    input.type = 'checkbox';
    input.checked = Boolean(getConfigValue(this.draftConfig, path, value));
    input.disabled = Boolean(options.disabled);
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
    input._yonxaoMindmapControlEl = fieldEl;
    this.appendFieldHelp(fieldEl);
    return input;
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
