/*
 * 文件作用：
 * 主题编辑状态方法集合，负责打开前快照、自定义值判断和继承样式同步。
 *
 * 实现逻辑：
 * 通过比较主题属性和有效配置判断字段是否继承，避免保存多余属性。
 *
 * 调用链：
 * TopicEditorPanel/Fields -> topicEditorStateMethods -> config helpers。
 */

import {
  Notice,
  DEFAULT_MIND_CONFIG,
  resolveTopicFont,
  resolveTopicMaxWidth,
  removeTopicById,
  setOptionalTopicAttribute,
  assignIds,
  topicColor,
  TOPIC_EDITOR_DEFAULT_COLOR,
  normalizeTopicTextForStorage,
} from '../../shared/rendererShared.js';

export const topicEditorStateMethods = {
  setTopicEditorCustomState(controlEl, isCustom) {
    if (!controlEl) return;

    // data-topic-editor-custom 是保存时的唯一判断来源；class 只负责视觉提示。
    controlEl.dataset.topicEditorCustom = isCustom ? 'true' : 'false';
    controlEl.classList.toggle('is-inherited-value', !isCustom);
    controlEl.classList.toggle('is-custom-value', isCustom);
    controlEl._fieldWrapper?.classList.toggle('is-inherited-value', !isCustom);
    controlEl._fieldWrapper?.classList.toggle('is-custom-value', isCustom);
  },

  isTopicEditorCustomValue(controlEl) {
    return controlEl?.dataset?.topicEditorCustom === 'true';
  },

  setTopicEditorNumberValue(input, value, isCustom) {
    input.value = value === null || value === undefined ? '' : String(value);
    const key = input._yonxaoMindmapTopicEditorKey;
    this.setTopicEditorCustomState(
      input,
      Boolean(isCustom) && (!key || this.isTopicEditorExplicitValue(key, input.value))
    );
  },

  isTopicEditorExplicitValue(key, value) {
    const text = String(value ?? '').trim();
    if (!text) return false;
    const inheritedValue = this.topicEditorInheritedValues?.[key];
    // 和继承值相同的输入不应保存成自定义属性，避免源码里出现冗余覆盖。
    return text !== String(inheritedValue ?? '').trim();
  },

  restoreTopicEditorInheritedValue(key) {
    if (!this.topicEditorInheritedValues || !this.topicEditorFields) return;

    const fields = this.topicEditorFields;
    const inheritedValue = this.topicEditorInheritedValues[key];
    if (key === 'color') {
      // 颜色字段由色板、文本框和隐藏值组成，只有文本框也为空时才恢复继承色。
      if (this.isTopicEditorCustomValue(fields.colorField) || fields.colorField._textInput.value) {
        return;
      }
      this.setTopicEditorColorValue(inheritedValue || '', { custom: false });
      this.updateTopicEditorActionState();
      return;
    }

    const input = fields[key];
    if (!input || this.isTopicEditorCustomValue(input) || input.value) return;
    this.setTopicEditorNumberValue(input, inheritedValue ?? '', false);
    this.updateTopicEditorActionState();
  },

  topicEditorSaveValue(controlEl) {
    return this.isTopicEditorCustomValue(controlEl) ? controlEl.value : '';
  },

  serializeTopicEditorFormState() {
    const fields = this.topicEditorFields;
    if (!fields) return null;

    // 快照只保存会写回 yxmm 的值；继承状态统一序列化为空字符串。
    return {
      content: normalizeTopicTextForStorage(fields.content.value),
      color: this.isTopicEditorCustomValue(fields.colorField) ? fields.color.value : '',
      icon: this.isTopicEditorCustomValue(fields.iconPicker) ? fields.icon.value : '',
      fontFamily: this.isTopicEditorCustomValue(fields.fontFamilyField)
        ? fields.fontFamily.value
        : '',
      fontSize: this.topicEditorSaveValue(fields.fontSize),
      fontWeight: this.topicEditorSaveValue(fields.fontWeight),
      lineHeight: this.topicEditorSaveValue(fields.lineHeight),
      align: this.topicEditorSaveValue(fields.align),
      maxWidth: this.topicEditorSaveValue(fields.maxWidth),
    };
  },

  captureTopicEditorFormSnapshot() {
    this.topicEditorFormSnapshot = this.serializeTopicEditorFormState();
  },

  hasTopicEditorChanges() {
    const snapshot = this.topicEditorFormSnapshot;
    const current = this.serializeTopicEditorFormState();
    if (!snapshot || !current) return false;

    for (const key of Object.keys(current)) {
      if (String(current[key] ?? '') !== String(snapshot[key] ?? '')) {
        return true;
      }
    }
    return false;
  },

  updateTopicEditorActionState() {
    const fields = this.topicEditorFields;
    if (!fields) return;

    const hasChanges = this.hasTopicEditorChanges();
    if (fields.saveButton) fields.saveButton.disabled = !hasChanges;
    this.topicEditorEl?.classList.toggle('is-dirty', hasChanges);
  },

  updateTopicEditorInheritedPlaceholders() {
    const fields = this.topicEditorFields;
    const inherited = this.topicEditorInheritedValues;
    if (!fields || !inherited) return;

    const setPlaceholder = (input, inheritedValue, fallbackValue = '') => {
      if (!input) return;

      const text = String(inheritedValue ?? '').trim();
      input.placeholder = text || fallbackValue;
    };

    // 继承值显示在 placeholder 中，输入框 value 保持空，保存时才能表达“继续继承”。
    setPlaceholder(
      fields.colorField?._textInput,
      inherited.color,
      DEFAULT_MIND_CONFIG.color.defaultTopicColor || TOPIC_EDITOR_DEFAULT_COLOR
    );
    setPlaceholder(
      fields.fontFamilyField?._customInput,
      inherited.fontFamily,
      this.t('topicEditor.fontCustomPlaceholder')
    );
    setPlaceholder(fields.fontSize, inherited.fontSize, DEFAULT_MIND_CONFIG.font.size);
    setPlaceholder(fields.fontWeight, inherited.fontWeight, DEFAULT_MIND_CONFIG.font.weight);
    setPlaceholder(fields.lineHeight, inherited.lineHeight, DEFAULT_MIND_CONFIG.font.lineHeight);
    setPlaceholder(
      fields.maxWidth,
      inherited.maxWidth,
      DEFAULT_MIND_CONFIG.structure.topicMaxWidth.global
    );
  },

  resolveTopicEditorInheritedValues(topic) {
    const attributes = { ...(topic.attributes || {}) };
    // 临时移除当前主题的可编辑属性，再走配置解析，即可得到父级/全局继承后的有效值。
    for (const key of [
      'color',
      'icon',
      'fontFamily',
      'fontSize',
      'fontWeight',
      'lineHeight',
      'align',
      'maxWidth',
    ]) {
      delete attributes[key];
    }

    const inheritedTopic = { ...topic, attributes };
    const font = resolveTopicFont(inheritedTopic, this.config);
    return {
      color: topicColor(inheritedTopic, this.config) || '',
      icon: '',
      fontFamily: font.family || '',
      fontSize: font.size || '',
      fontWeight: font.weight || '',
      lineHeight: font.lineHeight || '',
      align: font.align || DEFAULT_MIND_CONFIG.font.align,
      maxWidth: resolveTopicMaxWidth(inheritedTopic, this.config) || '',
    };
  },

  async saveTopicEditor() {
    if (!this.canEditMindMap()) return false;

    const topic = this.topicById.get(this.editingTopicId);
    if (!topic || !this.topicEditorFields) return false;

    const text = normalizeTopicTextForStorage(this.topicEditorFields.content.value);
    if (!text) {
      new Notice(this.t('notice.topicContentRequired'));
      return false;
    }

    for (const field of [
      this.topicEditorFields.fontSize,
      this.topicEditorFields.fontWeight,
      this.topicEditorFields.lineHeight,
      this.topicEditorFields.maxWidth,
    ]) {
      if (field.value && !field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }

    const customFontInput = this.topicEditorFields.fontFamilyField?._customInput;
    if (customFontInput && !customFontInput.hidden && !customFontInput.checkValidity()) {
      customFontInput.reportValidity();
      return false;
    }

    // 校验全部通过后才写入内存树；失败时保持原主题不变。
    topic.text = text;
    setOptionalTopicAttribute(
      topic.attributes,
      'color',
      this.isTopicEditorCustomValue(this.topicEditorFields.colorField)
        ? this.topicEditorFields.color.value
        : ''
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'icon',
      this.isTopicEditorCustomValue(this.topicEditorFields.iconPicker)
        ? this.topicEditorFields.icon.value
        : ''
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'fontFamily',
      this.isTopicEditorCustomValue(this.topicEditorFields.fontFamilyField)
        ? this.topicEditorFields.fontFamily.value
        : ''
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'fontSize',
      this.topicEditorSaveValue(this.topicEditorFields.fontSize)
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'fontWeight',
      this.topicEditorSaveValue(this.topicEditorFields.fontWeight)
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'lineHeight',
      this.topicEditorSaveValue(this.topicEditorFields.lineHeight)
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'align',
      this.topicEditorSaveValue(this.topicEditorFields.align)
    );
    setOptionalTopicAttribute(
      topic.attributes,
      'maxWidth',
      this.topicEditorSaveValue(this.topicEditorFields.maxWidth)
    );
    setOptionalTopicAttribute(topic.attributes, 'layout', '');

    const topicId = topic.id;
    // 保存可能触发 Obsidian 重建代码块；先记住当前主题，避免新实例丢失焦点。
    this.rememberTopicFocusState(topicId, { focusSvg: true });
    const saved = await this.saveTreeToSourceAndFile('主题已保存。');
    if (saved) this.closeTopicEditor({ restoreFocusTopicId: topicId });
    return saved;
  },

  async deleteTopicFromEditor() {
    if (!this.canEditMindMap()) return false;

    const topic = this.topicById.get(this.editingTopicId);
    if (!topic || topic === this.root || topic._virtual) {
      new Notice(this.t('notice.rootCannotDeleteInMap'));
      return false;
    }

    if (!this.confirmDeleteTopic(topic)) return false;

    const parentTopic = this.findTopicParentInTree(topic.id);
    if (parentTopic?.id) {
      // 删除保存可能触发代码块重建，先把父主题写入焦点记忆，避免恢复到根主题。
      this.rememberTopicFocusState(parentTopic.id, { focusSvg: true });
    }

    const removed = removeTopicById(this.root, topic.id);
    if (!removed) return false;

    assignIds(this.root, '0');
    const saved = await this.saveTreeToSourceAndFile(this.t('notice.topicDeleted'));
    if (saved) {
      this.closeTopicEditor({ restoreFocusTopicId: parentTopic?.id || '' });
      if (!parentTopic) this.ensureFocusedTopic();
    }
    return saved;
  },
};
