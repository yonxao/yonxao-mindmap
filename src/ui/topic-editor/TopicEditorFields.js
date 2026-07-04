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
  setTooltip,
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
import { INLINE_TOPIC_COLOR_OPTIONS, topicRichTextToPlainText } from '../../utils/richText.js';

/*
 * 富文本编辑相关常量：
 * - RICH_TEXT_STYLE_CONTROLS：行内样式按钮配置（加粗/斜体/中划线/下划线）
 * - RICH_TEXT_BLOCK_CONTROLS：块级格式按钮配置（列表/公式/代码块）
 * - RICH_TEXT_CLEAR_CONTROL：清除样式按钮配置
 */
const RICH_TEXT_PLACEHOLDER_KEY = 'topicEditor.richText.placeholder';
const RICH_TEXT_FALLBACK_PLACEHOLDER = 'Text';
const RICH_TEXT_DEFAULT_COLOR = '#ef4444';
const RICH_TEXT_COLOR_MENU_VIEWPORT_GAP = 8;
const RICH_TEXT_COLOR_MENU_TRIGGER_GAP = 4;
// 菜单首次打开时可能还没有真实布局尺寸，定位逻辑用 CSS 设计尺寸作为兜底。
const RICH_TEXT_COLOR_MENU_FALLBACK_WIDTH = 132;
const RICH_TEXT_COLOR_MENU_FALLBACK_HEIGHT = 76;
const RICH_TEXT_STYLE_CONTROLS = Object.freeze([
  {
    label: 'B',
    className: 'is-bold',
    titleKey: 'topicEditor.richText.bold',
    marker: '**',
  },
  {
    label: 'I',
    className: 'is-italic',
    titleKey: 'topicEditor.richText.italic',
    marker: '*',
  },
  {
    label: 'S',
    className: 'is-strike',
    titleKey: 'topicEditor.richText.strike',
    marker: '~~',
  },
  {
    label: 'U',
    className: 'is-underline',
    titleKey: 'topicEditor.richText.underline',
    marker: '++',
  },
]);
const RICH_TEXT_BLOCK_CONTROLS = Object.freeze([
  {
    label: '•',
    icon: 'list',
    group: 'list',
    className: 'is-unordered-list',
    titleKey: 'topicEditor.richText.unorderedList',
    format: 'unordered-list',
  },
  {
    label: '1',
    icon: 'list-ordered',
    group: 'list',
    className: 'is-ordered-list',
    titleKey: 'topicEditor.richText.orderedList',
    format: 'ordered-list',
  },
  {
    label: 'Σ',
    className: 'is-equation',
    titleKey: 'topicEditor.richText.equation',
    format: 'equation',
  },
  {
    label: '</>',
    className: 'is-code-block',
    titleKey: 'topicEditor.richText.codeBlock',
    format: 'code-block',
  },
]);
const RICH_TEXT_CLEAR_CONTROL = Object.freeze({
  fallbackLabel: 'C',
  className: 'is-clear',
  titleKey: 'topicEditor.richText.clear',
  icon: 'eraser',
});

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
    inputColumn.appendChild(this.createTopicRichTextToolbar(contentInput));
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

  /*
   * 创建富文本编辑工具栏，包含两行按钮：
   * - 样式行：加粗/斜体/中划线/下划线 + 颜色选择器 + 清除样式
   * - 块级行：无序列表/有序列表/公式/代码块
   */
  createTopicRichTextToolbar(input) {
    const toolbar = document.createElement('div');
    toolbar.className = 'yonxao-mindmap-topic-rich-text-toolbar';

    const styleRow = document.createElement('div');
    styleRow.className = 'yonxao-mindmap-topic-rich-text-toolbar-row';
    const blockRow = document.createElement('div');
    blockRow.className = 'yonxao-mindmap-topic-rich-text-toolbar-row';

    for (const control of RICH_TEXT_STYLE_CONTROLS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `yonxao-mindmap-topic-rich-text-button ${control.className}`;
      button.textContent = control.label;
      this.setTopicRichTextControlTooltip(button, this.t(control.titleKey));
      this.registerDomEvent(button, 'click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.applyTopicRichTextFormat(input, control.marker, control.marker);
      });
      styleRow.appendChild(button);
    }

    styleRow.appendChild(this.createTopicRichTextColorDropdown(input));
    styleRow.appendChild(this.createTopicRichTextClearButton(input));

    const listGroup = document.createElement('div');
    listGroup.className = 'yonxao-mindmap-topic-rich-text-list-button-group';

    for (const control of RICH_TEXT_BLOCK_CONTROLS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `yonxao-mindmap-topic-rich-text-button ${control.className}`;
      if (control.icon) {
        try {
          setIcon(button, control.icon);
        } catch (_error) {
          button.textContent = control.label;
        }
      } else {
        button.textContent = control.label;
      }
      this.setTopicRichTextControlTooltip(button, this.t(control.titleKey));
      this.registerDomEvent(button, 'click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.applyTopicRichTextBlockFormat(input, control.format);
      });

      if (control.group === 'list') {
        listGroup.appendChild(button);
      } else {
        blockRow.appendChild(button);
      }
    }
    if (listGroup.childElementCount) {
      blockRow.prepend(listGroup);
    }

    toolbar.appendChild(styleRow);
    toolbar.appendChild(blockRow);

    return toolbar;
  },

  /*
   * 创建"清除样式"按钮：点击后将选中区域或全部内容中的样式标记剥离，只保留纯文本。
   */
  createTopicRichTextClearButton(input) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `yonxao-mindmap-topic-rich-text-button ${RICH_TEXT_CLEAR_CONTROL.className}`;
    try {
      setIcon(button, RICH_TEXT_CLEAR_CONTROL.icon);
    } catch (_error) {
      button.textContent = RICH_TEXT_CLEAR_CONTROL.fallbackLabel;
    }
    this.setTopicRichTextControlTooltip(button, this.t(RICH_TEXT_CLEAR_CONTROL.titleKey));
    this.registerDomEvent(button, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.clearTopicRichTextStyles(input);
    });
    return button;
  },

  /*
   * 创建文字颜色选择器下拉组件。包含预定义色块（语义色）和一个原生 <input type="color">
   * 供用户选取任意颜色。菜单使用 fixed 定位避免被滚动容器裁切。
   */
  createTopicRichTextColorDropdown(input) {
    const dropdown = document.createElement('div');
    dropdown.className = 'yonxao-mindmap-topic-rich-text-color-dropdown';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'yonxao-mindmap-topic-rich-text-color-trigger';
    trigger.setAttribute('aria-haspopup', 'true');
    trigger.setAttribute('aria-expanded', 'false');
    this.setTopicRichTextControlTooltip(trigger, this.t('topicEditor.richText.colorCustom'));

    const letter = document.createElement('span');
    letter.className = 'yonxao-mindmap-topic-rich-text-color-letter';
    letter.textContent = 'A';

    const arrow = document.createElement('span');
    arrow.className = 'yonxao-mindmap-topic-rich-text-color-arrow';
    arrow.textContent = 'v';

    trigger.appendChild(letter);
    trigger.appendChild(arrow);

    const menu = document.createElement('div');
    menu.className = 'yonxao-mindmap-topic-rich-text-color-menu';
    menu.hidden = true;

    const swatches = document.createElement('div');
    swatches.className = 'yonxao-mindmap-topic-rich-text-color-swatches';
    for (const [name, color] of INLINE_TOPIC_COLOR_OPTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'yonxao-mindmap-topic-rich-text-color';
      button.style.backgroundColor = color;
      button.dataset.color = name;
      this.setTopicRichTextControlTooltip(
        button,
        this.t('topicEditor.richText.colorNamed', { color: name })
      );
      this.registerDomEvent(button, 'click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        this.applyTopicRichTextColor(input, button.dataset.color || name);
        this.setTopicRichTextColorDropdownValue(dropdown, color);
        this.closeTopicRichTextColorDropdown(dropdown);
      });
      swatches.appendChild(button);
    }

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.className = 'yonxao-mindmap-topic-rich-text-color-picker';
    picker.value = RICH_TEXT_DEFAULT_COLOR;
    this.setTopicRichTextControlTooltip(picker, this.t('topicEditor.richText.colorCustom'));
    this.registerDomEvent(picker, 'change', (event) => {
      event.stopPropagation();
      this.applyTopicRichTextColor(input, picker.value);
      this.setTopicRichTextColorDropdownValue(dropdown, picker.value);
      this.closeTopicRichTextColorDropdown(dropdown);
    });

    const customButton = document.createElement('button');
    customButton.type = 'button';
    customButton.className = 'yonxao-mindmap-topic-rich-text-color-custom';
    this.setTopicRichTextControlTooltip(customButton, this.t('topicEditor.richText.colorCustom'));
    this.registerDomEvent(customButton, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      picker.click();
    });

    menu.appendChild(swatches);
    menu.appendChild(customButton);
    menu.appendChild(picker);
    dropdown.appendChild(trigger);
    dropdown.appendChild(menu);

    this.registerDomEvent(trigger, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.toggleTopicRichTextColorDropdown(dropdown);
    });
    this.registerDomEvent(dropdown, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      this.closeTopicRichTextColorDropdown(dropdown);
      trigger.focus();
    });
    this.registerDomEvent(dropdown, 'focusout', (event) => {
      this.scheduleTopicRichTextColorDropdownBlurClose(dropdown, input, event.relatedTarget);
    });
    this.registerDomEvent(document, 'click', (event) => {
      if (dropdown.contains(event.target)) return;
      this.closeTopicRichTextColorDropdown(dropdown);
    });

    return dropdown;
  },

  /*
   * 切换颜色选择器的打开/关闭状态。打开时重新计算菜单位置，
   * 使用 fixed 定位确保不被滚动容器裁切。
   */
  toggleTopicRichTextColorDropdown(dropdown) {
    const menu = dropdown?.querySelector?.('.yonxao-mindmap-topic-rich-text-color-menu');
    if (!menu) return;
    const shouldOpen = menu.hidden;
    menu.hidden = !shouldOpen;
    dropdown
      .querySelector?.('.yonxao-mindmap-topic-rich-text-color-trigger')
      ?.setAttribute('aria-expanded', String(shouldOpen));
    if (shouldOpen) {
      // 色板使用 fixed 定位，打开后按按钮视口坐标计算，避免被主题编辑面板滚动区域裁切。
      this.positionTopicRichTextColorDropdown(dropdown);
    }
  },

  /*
   * 关闭颜色选择器并重置菜单位置和 aria-expanded 状态。
   */
  closeTopicRichTextColorDropdown(dropdown) {
    const menu = dropdown?.querySelector?.('.yonxao-mindmap-topic-rich-text-color-menu');
    if (!menu) return;
    menu.hidden = true;
    menu.style.left = '';
    menu.style.top = '';
    dropdown
      .querySelector?.('.yonxao-mindmap-topic-rich-text-color-trigger')
      ?.setAttribute('aria-expanded', 'false');
  },

  /*
   * 计算颜色选择器菜单的 fixed 定位坐标。优先向下展开，
   * 下方空间不足时向上展开，避免菜单盖住工具栏按钮。
   */
  positionTopicRichTextColorDropdown(dropdown) {
    const trigger = dropdown?.querySelector?.('.yonxao-mindmap-topic-rich-text-color-trigger');
    const menu = dropdown?.querySelector?.('.yonxao-mindmap-topic-rich-text-color-menu');
    if (!trigger || !menu) return;

    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const menuWidth = menuRect.width || RICH_TEXT_COLOR_MENU_FALLBACK_WIDTH;
    const menuHeight = menuRect.height || RICH_TEXT_COLOR_MENU_FALLBACK_HEIGHT;
    const maxLeft = Math.max(
      RICH_TEXT_COLOR_MENU_VIEWPORT_GAP,
      window.innerWidth - menuWidth - RICH_TEXT_COLOR_MENU_VIEWPORT_GAP
    );
    const left = Math.min(Math.max(triggerRect.left, RICH_TEXT_COLOR_MENU_VIEWPORT_GAP), maxLeft);
    const belowTop = triggerRect.bottom + RICH_TEXT_COLOR_MENU_TRIGGER_GAP;
    const aboveTop = triggerRect.top - menuHeight - RICH_TEXT_COLOR_MENU_TRIGGER_GAP;
    const hasRoomBelow =
      belowTop + menuHeight + RICH_TEXT_COLOR_MENU_VIEWPORT_GAP <= window.innerHeight;
    // 优先向下展开；只有下方放不下时才向上，避免菜单默认盖住工具条。
    const top = hasRoomBelow ? belowTop : Math.max(RICH_TEXT_COLOR_MENU_VIEWPORT_GAP, aboveTop);

    menu.style.left = `${Math.round(left)}px`;
    menu.style.top = `${Math.round(top)}px`;
  },

  setTopicRichTextColorDropdownValue(dropdown, color) {
    dropdown?.style?.setProperty('--yonxao-mindmap-topic-rich-text-current-color', color);
  },

  /*
   * 清除选中文字或全部内容的富文本样式标记，仅保留纯文本。
   * 有选择时只清除选择区域，无选择时清除整个输入框。
   */
  clearTopicRichTextStyles(input) {
    if (!input) return;

    const start = Number(input.selectionStart) || 0;
    const end = Number(input.selectionEnd) || start;
    const hasSelection = end > start;
    const source = hasSelection ? input.value.slice(start, end) : input.value;
    const plainText = topicRichTextToPlainText(source);

    if (hasSelection) {
      input.value = `${input.value.slice(0, start)}${plainText}${input.value.slice(end)}`;
      input.focus();
      input.setSelectionRange(start, start + plainText.length);
    } else {
      input.value = plainText;
      input.focus();
      input.setSelectionRange(Math.min(start, plainText.length), Math.min(start, plainText.length));
    }

    input.dispatchEvent(new Event('input', { bubbles: true }));
  },

  /*
   * 对选中文字应用行内样式标记（如 **加粗**、*斜体*）。
   * 无选中时使用占位文本作为样式内容。
   */
  applyTopicRichTextFormat(input, open, close) {
    const fallback = this.topicRichTextPlaceholder();
    this.replaceTopicRichTextSelection(input, open, close, fallback);
  },

  /*
   * 对选中文字应用颜色标记（如 {red|文字}、{#e11d48|文字}）。
   */
  applyTopicRichTextColor(input, color) {
    const fallback = this.topicRichTextPlaceholder();
    this.replaceTopicRichTextSelection(input, `{${color}|`, '}', fallback);
  },

  applyTopicRichTextBlockFormat(input, format) {
    if (!input) return;

    const fallback = this.topicRichTextPlaceholder();
    const start = Number(input.selectionStart) || 0;
    const end = Number(input.selectionEnd) || start;
    const selected = input.value.slice(start, end);
    const replacement = this.createTopicRichTextBlockReplacement(format, selected, fallback);
    input.value = `${input.value.slice(0, start)}${replacement}${input.value.slice(end)}`;

    const selection = this.topicRichTextBlockSelectionRange(format, replacement, start);
    input.focus();
    input.setSelectionRange(selection.start, selection.end);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  },

  createTopicRichTextBlockReplacement(format, selected, fallback) {
    const text = selected || fallback;
    if (format === 'unordered-list') {
      return this.prefixTopicRichTextLines(text, '- ');
    }
    if (format === 'ordered-list') {
      return this.prefixTopicRichTextLines(text, '1. ');
    }
    if (format === 'equation') {
      return `$$\n${text}\n$$`;
    }
    if (format === 'code-block') {
      return `~~~\n${text}\n~~~`;
    }
    return text;
  },

  /*
   * 计算应用块级格式后光标的选中范围：
   * - 公式和代码块选中 fence 之间的内容
   * - 列表选中前缀之后的所有内容
   */
  topicRichTextBlockSelectionRange(format, replacement, start) {
    if (format === 'equation' || format === 'code-block') {
      const firstLineBreak = replacement.indexOf('\n');
      const lastLineBreak = replacement.lastIndexOf('\n');
      return {
        start: start + firstLineBreak + 1,
        end: start + Math.max(firstLineBreak + 1, lastLineBreak),
      };
    }

    const prefixLength = format === 'ordered-list' ? '1. '.length : '- '.length;
    return {
      start: start + prefixLength,
      end: start + replacement.length,
    };
  },

  prefixTopicRichTextLines(text, prefix) {
    return String(text || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => (line.trim() ? `${prefix}${line}` : line))
      .join('\n');
  },

  topicRichTextPlaceholder() {
    const translated = this.t(RICH_TEXT_PLACEHOLDER_KEY);
    return translated && translated !== RICH_TEXT_PLACEHOLDER_KEY
      ? translated
      : RICH_TEXT_FALLBACK_PLACEHOLDER;
  },

  scheduleTopicRichTextColorDropdownBlurClose(dropdown, input, nextFocusTarget) {
    const schedule = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
    // 点击色块会先触发焦点变化再触发 click；延后一帧判断，避免菜单提前关闭吞掉点击。
    schedule(() => {
      if (dropdown.contains(document.activeElement)) return;
      this.closeTopicRichTextColorDropdown(dropdown);
      if (nextFocusTarget && this.topicEditorEl && !this.topicEditorEl.contains(nextFocusTarget)) {
        return;
      }
      // 色板本身只是内容编辑器的辅助控件，收起后把焦点交回文本框，保持主题编辑面板活跃。
      if (!this.isTopicEditorShortcutTarget(document.activeElement)) {
        input?.focus?.({ preventScroll: true });
      }
    });
  },

  /*
   * 用样式标记包裹选中文字（如 **text** 或 {red|text}）。
   * 无选中时使用 fallbackText 作为样式内容，光标自动选中内容区供用户替换。
   */
  replaceTopicRichTextSelection(input, open, close, fallbackText) {
    if (!input) return;

    const start = Number(input.selectionStart) || 0;
    const end = Number(input.selectionEnd) || start;
    const selected = input.value.slice(start, end);
    const innerText = selected || fallbackText;
    const replacement = `${open}${innerText}${close}`;
    input.value = `${input.value.slice(0, start)}${replacement}${input.value.slice(end)}`;

    const selectionStart = start + open.length;
    const selectionEnd = selectionStart + innerText.length;
    input.focus();
    input.setSelectionRange(selectionStart, selectionEnd);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  },

  /*
   * 为富文本控件设置无障碍标签和 tooltip。优先使用 Obsidian 的 setTooltip，
   * 不可用时保留原生 title 作为兜底。
   */
  setTopicRichTextControlTooltip(element, text) {
    const label = String(text || '').trim();
    if (!label) return;
    element.setAttribute('aria-label', label);
    element.title = label;
    try {
      setTooltip(element, label);
    } catch (_error) {
      // Obsidian tooltip 在测试环境可能不可用，保留原生 title 作为兜底。
    }
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
