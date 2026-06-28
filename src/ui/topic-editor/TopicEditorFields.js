/*
 * 文件作用：
 * 主题编辑字段方法集合，负责文本、颜色、图标、字体和尺寸输入控件。
 *
 * 实现逻辑：
 * 字段创建时同步继承态样式，让用户看出当前值来自主题、级别配置还是全局配置。
 *
 * 调用链：
 * TopicEditorPanel -> topicEditorFieldMethods -> font/color/config helpers。
 */

import {
  Notice,
  setIcon,
  ICON_PATHS,
  normalizeIcon,
  CUSTOM_FONT_VALUE,
  getLocalizedFontFamilyGroups,
  isValidFontFamilyInput,
  isPresetFontValue,
  normalizeFontFamilyInput,
  svg,
  TOPIC_EDITOR_DEFAULT_COLOR,
  TOPIC_EDITOR_COLOR_SWATCHES,
} from '../../shared/rendererShared.js';
import { ICON_EDITOR_EXPAND } from '../../icons/iconNames.js';

export const topicEditorFieldMethods = {
  createTopicEditorContentField(contentInput) {
    const field = document.createElement('div');
    field.className = 'yonxao-mindmap-topic-editor-field yonxao-mindmap-topic-editor-text-control';

    const labelColumn = document.createElement('div');
    labelColumn.className = 'yonxao-mindmap-topic-editor-text-label';

    const labelText = document.createElement('span');
    labelText.textContent = this.t('topicEditor.content');

    const expandButton = document.createElement('button');
    expandButton.type = 'button';
    expandButton.className =
      'yonxao-mindmap-topic-editor-icon-button yonxao-mindmap-topic-editor-text-expand';

    try {
      setIcon(expandButton, ICON_EDITOR_EXPAND);
    } catch (_error) {
      expandButton.textContent = '...';
    }

    const expandButtonText = document.createElement('span');
    expandButtonText.className = 'yonxao-mindmap-topic-editor-sr-only';
    expandButtonText.textContent = this.t('topicEditor.expandText');
    expandButton.appendChild(expandButtonText);

    labelColumn.appendChild(labelText);

    const inputColumn = document.createElement('div');
    inputColumn.className = 'yonxao-mindmap-topic-editor-text-input-column';
    inputColumn.appendChild(contentInput);

    field.appendChild(labelColumn);
    field.appendChild(inputColumn);
    field.appendChild(expandButton);

    this.registerDomEvent(expandButton, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openTopicContentEditor();
    });

    return field;
  },

  createTopicEditorFontFamilyField() {
    const field = document.createElement('div');
    field.className = 'yonxao-mindmap-topic-editor-font-family';

    const select = document.createElement('select');
    select.className = 'yonxao-mindmap-topic-editor-input';
    this.appendTopicEditorFontOptions(select);

    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.className = 'yonxao-mindmap-topic-editor-input';
    customInput.placeholder = this.t('topicEditor.fontCustomPlaceholder');
    customInput.hidden = true;

    const valueInput = document.createElement('input');
    valueInput.type = 'hidden';

    field.appendChild(select);
    field.appendChild(customInput);
    field.appendChild(valueInput);
    field._select = select;
    field._customInput = customInput;
    field._valueInput = valueInput;

    this.registerDomEvent(select, 'change', () => {
      if (select.value === '') {
        this.setTopicEditorFontFamilyValue(this.topicEditorInheritedValues?.fontFamily || '', {
          custom: false,
        });
        this.updateTopicEditorActionState();
        return;
      }

      if (select.value === CUSTOM_FONT_VALUE) {
        customInput.hidden = false;
        valueInput.value = normalizeFontFamilyInput(customInput.value);
        this.setTopicEditorCustomState(
          field,
          this.isTopicEditorExplicitValue('fontFamily', valueInput.value)
        );
        this.updateTopicEditorActionState();
        customInput.focus();
        return;
      }

      customInput.hidden = true;
      customInput.value = '';
      customInput.setCustomValidity('');
      valueInput.value = select.value;
      this.setTopicEditorCustomState(
        field,
        this.isTopicEditorExplicitValue('fontFamily', select.value)
      );
      this.updateTopicEditorActionState();
    });

    this.registerDomEvent(customInput, 'input', () => {
      const nextValue = normalizeFontFamilyInput(customInput.value);
      this.setTopicEditorCustomState(
        field,
        this.isTopicEditorExplicitValue('fontFamily', nextValue)
      );
      this.updateTopicEditorActionState();
      if (!nextValue) {
        customInput.setCustomValidity('');
        valueInput.value = '';
        return;
      }

      if (!isValidFontFamilyInput(nextValue)) {
        customInput.setCustomValidity(this.t('topicEditor.fontFamily.invalid'));
        return;
      }

      customInput.setCustomValidity('');
      valueInput.value = nextValue;
    });
    this.registerDomEvent(customInput, 'blur', () => {
      if (this.isTopicEditorCustomValue(field) || customInput.value) return;
      this.setTopicEditorFontFamilyValue(this.topicEditorInheritedValues?.fontFamily || '', {
        custom: false,
      });
      this.updateTopicEditorActionState();
    });

    return field;
  },

  appendTopicEditorFontOptions(select) {
    const translate = (key, replacements) => this.t(key, replacements);
    for (const group of getLocalizedFontFamilyGroups(translate)) {
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

  setTopicEditorFontFamilyValue(value, options = {}) {
    const fields = this.topicEditorFields;
    if (!fields?.fontFamily || !fields.fontFamilyField) return;

    const fontFamily = String(value || '').trim();
    const select = fields.fontFamilyField._select;
    const customInput = fields.fontFamilyField._customInput;
    fields.fontFamily.value = fontFamily;
    this.setTopicEditorCustomState(
      fields.fontFamilyField,
      Boolean(options.custom) && this.isTopicEditorExplicitValue('fontFamily', fontFamily)
    );

    if (!fontFamily) {
      select.value = '';
      customInput.value = '';
      customInput.hidden = true;
      customInput.setCustomValidity('');
      return;
    }

    if (isPresetFontValue(fontFamily)) {
      select.value = fontFamily;
      customInput.value = '';
      customInput.hidden = true;
      customInput.setCustomValidity('');
      return;
    }

    select.value = CUSTOM_FONT_VALUE;
    customInput.value = fontFamily;
    customInput.hidden = false;
    customInput.setCustomValidity(
      isValidFontFamilyInput(fontFamily) ? '' : this.t('topicEditor.fontFamily.invalid')
    );
  },

  createTopicEditorNumberInput({ min, max, step, placeholder }) {
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'yonxao-mindmap-topic-editor-input';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.placeholder = placeholder;
    return input;
  },

  createTopicEditorColorField() {
    const field = document.createElement('div');
    field.className = 'yonxao-mindmap-topic-editor-color';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'yonxao-mindmap-topic-editor-input';
    input.placeholder = TOPIC_EDITOR_DEFAULT_COLOR;

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.className = 'yonxao-mindmap-topic-editor-color-picker';
    picker.value = TOPIC_EDITOR_DEFAULT_COLOR;

    const swatches = document.createElement('div');
    swatches.className = 'yonxao-mindmap-topic-editor-swatches';
    for (const color of TOPIC_EDITOR_COLOR_SWATCHES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'yonxao-mindmap-topic-editor-swatch';
      button.style.backgroundColor = color;
      button.setAttribute('aria-label', color);
      button.dataset.color = color;
      swatches.appendChild(button);
    }

    field.appendChild(input);
    field.appendChild(picker);
    field.appendChild(swatches);
    field._textInput = input;
    field._colorPicker = picker;

    this.registerDomEvent(input, 'input', () => {
      this.setTopicEditorColorValue(input.value, {
        updateText: false,
        custom: this.isTopicEditorExplicitValue('color', input.value),
      });
    });
    this.registerDomEvent(picker, 'input', () => {
      this.setTopicEditorColorValue(picker.value, {
        custom: this.isTopicEditorExplicitValue('color', picker.value),
      });
    });
    this.registerDomEvent(swatches, 'click', (event) => {
      const swatch = event.target?.closest?.('.yonxao-mindmap-topic-editor-swatch');
      if (!swatch) return;
      event.preventDefault();
      this.setTopicEditorColorValue(swatch.dataset.color || '', {
        custom: this.isTopicEditorExplicitValue('color', swatch.dataset.color || ''),
      });
    });

    return field;
  },

  setTopicEditorColorValue(value, options = {}) {
    const fields = this.topicEditorFields;
    if (!fields?.color || !fields.colorField) return;

    const text = String(value || '').trim();
    fields.color.value = text;
    this.setTopicEditorCustomState(
      fields.colorField,
      Boolean(options.custom) && this.isTopicEditorExplicitValue('color', text)
    );
    if (options.updateText !== false) {
      fields.colorField._textInput.value = text;
    }

    if (/^#[0-9a-f]{6}$/i.test(text)) {
      fields.colorField._colorPicker.value = text;
    }
    this.updateTopicEditorActionState();
  },

  createTopicEditorIconPicker() {
    const picker = document.createElement('div');
    picker.className = 'yonxao-mindmap-topic-editor-icon-picker';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yonxao-mindmap-topic-editor-icon-button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'yonxao-mindmap-topic-editor-icon-menu';
    menu.hidden = true;
    menu.setAttribute('role', 'listbox');

    for (const iconName of ['', ...Object.keys(ICON_PATHS)]) {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'yonxao-mindmap-topic-editor-icon-option';
      option.dataset.icon = iconName;
      option.setAttribute('role', 'option');
      this.renderTopicEditorIconOption(option, iconName);
      menu.appendChild(option);
    }

    picker.appendChild(button);
    picker.appendChild(menu);
    picker._button = button;
    picker._menu = menu;

    this.registerDomEvent(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const nextOpen = menu.hidden;
      menu.hidden = !nextOpen;
      button.setAttribute('aria-expanded', String(nextOpen));
    });
    this.registerDomEvent(menu, 'click', (event) => {
      const option = event.target?.closest?.('.yonxao-mindmap-topic-editor-icon-option');
      if (!option) return;
      event.preventDefault();
      event.stopPropagation();
      this.setTopicEditorIconValue(option.dataset.icon || '', {
        custom: this.isTopicEditorExplicitValue('icon', option.dataset.icon || ''),
      });
      this.updateTopicEditorActionState();
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    });

    return picker;
  },

  renderTopicEditorIconOption(container, iconName) {
    container.textContent = '';
    const preview = document.createElement('span');
    preview.className = 'yonxao-mindmap-topic-editor-icon-preview';
    preview.appendChild(this.createTopicEditorIconSvg(iconName));

    const name = document.createElement('span');
    name.textContent = iconName || this.t('topicEditor.noIcon');

    container.appendChild(preview);
    container.appendChild(name);
  },

  createTopicEditorIconSvg(iconName) {
    const iconSvg = svg('svg', {
      viewBox: '0 0 24 24',
      width: 16,
      height: 16,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });

    const normalized = normalizeIcon(iconName);
    const paths = ICON_PATHS[normalized];
    if (!paths) {
      iconSvg.appendChild(svg('path', { d: 'M5 12h14' }));
      return iconSvg;
    }

    for (const d of paths) {
      iconSvg.appendChild(svg('path', { d }));
    }
    return iconSvg;
  },

  setTopicEditorIconValue(value, options = {}) {
    const fields = this.topicEditorFields;
    if (!fields?.icon || !fields.iconPicker) return;

    const iconName = normalizeIcon(value);
    fields.icon.value = iconName;
    this.setTopicEditorCustomState(
      fields.iconPicker,
      Boolean(options.custom) && this.isTopicEditorExplicitValue('icon', iconName)
    );
    this.renderTopicEditorIconOption(fields.iconPicker._button, iconName);
    for (const option of fields.iconPicker._menu.querySelectorAll(
      '.yonxao-mindmap-topic-editor-icon-option'
    )) {
      option.setAttribute('aria-selected', String((option.dataset.icon || '') === iconName));
    }
    this.updateTopicEditorActionState();
  },

  createPanelButton(label, onClick) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'yonxao-mindmap-topic-editor-button';
    button.textContent = label;
    this.registerDomEvent(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      Promise.resolve(onClick()).catch((error) => {
        new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
      });
    });
    return button;
  },
};
