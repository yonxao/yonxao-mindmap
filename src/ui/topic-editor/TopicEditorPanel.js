/*
 * 文件作用：
 * 主题编辑面板方法集合，负责面板外壳、字段组合、保存/取消和拖拽。
 *
 * 实现逻辑：
 * 字段值写入主题属性后走统一保存链路，取消时恢复打开前快照。
 *
 * 调用链：
 * 主题点击/右键菜单 -> topicEditorPanelMethods -> topicEditorFields/topicEditorState。
 */

import {
  Notice,
  DEFAULT_MIND_CONFIG,
  FONT_LINE_HEIGHT_MAX,
  FONT_LINE_HEIGHT_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_WEIGHT_MAX,
  FONT_WEIGHT_MIN,
  TOPIC_MAX_WIDTH_MAX,
  TOPIC_MAX_WIDTH_MIN,
  createLabeledField,
  clamp,
} from '../../shared/rendererShared.js';

export const topicEditorPanelMethods = {
  createTopicEditor() {
    // 这个编辑面板属于“导图视图编辑器”。
    // 它不直接编辑 SVG 文本，而是编辑内存中的树主题；保存后再把整棵树序列化回 yxmm 源码。
    this.topicEditorEl = document.createElement('div');
    this.topicEditorEl.className = 'yonxao-mindmap-topic-editor';
    this.topicEditorEl.hidden = true;

    const titleEl = document.createElement('div');
    titleEl.className = 'yonxao-mindmap-topic-editor-title';
    titleEl.textContent = this.t('topicEditor.title');

    const contentInput = document.createElement('textarea');
    contentInput.className =
      'yonxao-mindmap-topic-editor-input yonxao-mindmap-topic-editor-textarea';
    contentInput.placeholder = this.t('topicEditor.content');
    const contentField = this.createTopicEditorContentField(contentInput);

    const colorField = this.createTopicEditorColorField();
    const colorInput = document.createElement('input');
    colorInput.type = 'hidden';
    colorField.appendChild(colorInput);

    const iconPicker = this.createTopicEditorIconPicker();
    const iconInput = document.createElement('input');
    iconInput.type = 'hidden';
    iconPicker.appendChild(iconInput);

    const fontFamilyField = this.createTopicEditorFontFamilyField();
    const fontSizeInput = this.createTopicEditorNumberInput({
      min: FONT_SIZE_MIN,
      max: FONT_SIZE_MAX,
      step: 1,
      placeholder: DEFAULT_MIND_CONFIG.font.size,
    });
    const fontWeightInput = this.createTopicEditorNumberInput({
      min: FONT_WEIGHT_MIN,
      max: FONT_WEIGHT_MAX,
      step: 100,
      placeholder: DEFAULT_MIND_CONFIG.font.weight,
    });
    const lineHeightInput = this.createTopicEditorNumberInput({
      min: FONT_LINE_HEIGHT_MIN,
      max: FONT_LINE_HEIGHT_MAX,
      step: 1,
      placeholder: DEFAULT_MIND_CONFIG.font.lineHeight,
    });
    const maxWidthInput = this.createTopicEditorNumberInput({
      min: TOPIC_MAX_WIDTH_MIN,
      max: TOPIC_MAX_WIDTH_MAX,
      step: 1,
      placeholder: DEFAULT_MIND_CONFIG.topic.maxWidth,
    });

    const actions = document.createElement('div');
    actions.className = 'yonxao-mindmap-topic-editor-actions';

    const saveButton = this.createPanelButton(this.t('topicEditor.save'), async () => {
      await this.saveTopicEditor();
    });
    const cancelButton = this.createPanelButton(this.t('topicEditor.cancel'), () => {
      this.closeTopicEditor();
    });

    actions.appendChild(saveButton);
    actions.appendChild(cancelButton);

    this.topicEditorEl.appendChild(titleEl);
    this.topicEditorEl.appendChild(contentField);
    this.topicEditorEl.appendChild(createLabeledField(this.t('topicEditor.icon'), iconPicker));
    this.topicEditorEl.appendChild(createLabeledField(this.t('topicEditor.color'), colorField));
    this.topicEditorEl.appendChild(
      createLabeledField(this.t('topicEditor.maxWidth'), maxWidthInput)
    );
    this.topicEditorEl.appendChild(
      createLabeledField(this.t('topicEditor.fontFamily'), fontFamilyField)
    );
    this.topicEditorEl.appendChild(
      createLabeledField(this.t('topicEditor.fontSize'), fontSizeInput)
    );
    this.topicEditorEl.appendChild(
      createLabeledField(this.t('topicEditor.fontWeight'), fontWeightInput)
    );
    this.topicEditorEl.appendChild(
      createLabeledField(this.t('topicEditor.lineHeight'), lineHeightInput)
    );
    this.topicEditorEl.appendChild(actions);
    document.body.appendChild(this.topicEditorEl);

    this.topicEditorFields = {
      content: contentInput,
      color: colorInput,
      colorField,
      icon: iconInput,
      iconPicker,
      fontFamily: fontFamilyField._valueInput,
      fontFamilyField,
      fontSize: fontSizeInput,
      fontWeight: fontWeightInput,
      lineHeight: lineHeightInput,
      maxWidth: maxWidthInput,
      saveButton,
    };
    this.installTopicEditorInheritanceEvents();

    for (const eventName of [
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'pointerdown',
      'pointerup',
      'keydown',
      'keyup',
      'input',
      'change',
      'wheel',
    ]) {
      this.registerDomEvent(this.topicEditorEl, eventName, (event) => {
        event.stopPropagation();
      });
    }

    this.registerDomEvent(titleEl, 'pointerdown', (event) => {
      this.startTopicEditorDrag(event);
    });
    this.registerDomEvent(titleEl, 'pointermove', (event) => {
      this.handleTopicEditorDragMove(event);
    });
    this.registerDomEvent(titleEl, 'pointerup', (event) => {
      this.finishTopicEditorDrag(event);
    });
    this.registerDomEvent(titleEl, 'pointercancel', (event) => {
      this.finishTopicEditorDrag(event);
    });

    this.registerDomEvent(contentInput, 'keydown', (event) => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        Promise.resolve(this.saveTopicEditor()).catch((error) => {
          new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
        });
      }
    });
    this.registerDomEvent(this.topicEditorEl, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      this.closeTopicEditor();
    });
    this.registerDomEvent(this.topicEditorEl, 'input', () => {
      this.updateTopicEditorActionState();
    });
    this.registerDomEvent(this.topicEditorEl, 'change', () => {
      this.updateTopicEditorActionState();
    });

    this.createTopicContentEditor();
  },

  installTopicEditorInheritanceEvents() {
    const fields = this.topicEditorFields;
    if (!fields) return;

    for (const [key, input] of [
      ['fontSize', fields.fontSize],
      ['fontWeight', fields.fontWeight],
      ['lineHeight', fields.lineHeight],
      ['maxWidth', fields.maxWidth],
    ]) {
      input._yonxaoMindmapTopicEditorKey = key;
      this.registerDomEvent(input, 'input', () => {
        this.setTopicEditorCustomState(input, this.isTopicEditorExplicitValue(key, input.value));
        this.updateTopicEditorActionState();
      });
      this.registerDomEvent(input, 'blur', () => {
        this.restoreTopicEditorInheritedValue(key);
        this.updateTopicEditorActionState();
      });
    }

    this.registerDomEvent(fields.colorField._textInput, 'blur', () => {
      this.restoreTopicEditorInheritedValue('color');
      this.updateTopicEditorActionState();
    });
  },

  openTopicEditor(topic) {
    if (!this.canEditMindMap()) return;
    if (!topic || topic._virtual || !this.topicEditorEl || !this.topicEditorFields) {
      return;
    }

    this.closeInlineTextEditor(false);
    this.editingTopicId = topic.id;
    this.topicEditorInheritedValues = this.resolveTopicEditorInheritedValues(topic);
    this.updateTopicEditorInheritedPlaceholders();
    const attributes = topic.attributes || {};
    this.topicEditorFields.content.value = topic.text || '';
    this.setTopicEditorColorValue(attributes.color || this.topicEditorInheritedValues.color, {
      custom: attributes.color !== undefined,
    });
    this.setTopicEditorIconValue(attributes.icon || this.topicEditorInheritedValues.icon, {
      custom: attributes.icon !== undefined && Boolean(attributes.icon),
    });
    this.setTopicEditorFontFamilyValue(
      attributes.fontFamily || this.topicEditorInheritedValues.fontFamily,
      {
        custom: attributes.fontFamily !== undefined,
      }
    );
    this.setTopicEditorNumberValue(
      this.topicEditorFields.fontSize,
      attributes.fontSize ?? this.topicEditorInheritedValues.fontSize,
      attributes.fontSize !== undefined
    );
    this.setTopicEditorNumberValue(
      this.topicEditorFields.fontWeight,
      attributes.fontWeight ?? this.topicEditorInheritedValues.fontWeight,
      attributes.fontWeight !== undefined
    );
    this.setTopicEditorNumberValue(
      this.topicEditorFields.lineHeight,
      attributes.lineHeight ?? this.topicEditorInheritedValues.lineHeight,
      attributes.lineHeight !== undefined
    );
    this.setTopicEditorNumberValue(
      this.topicEditorFields.maxWidth,
      attributes.maxWidth ?? this.topicEditorInheritedValues.maxWidth,
      attributes.maxWidth !== undefined
    );
    this.topicEditorEl.hidden = false;
    this.positionTopicEditor(topic);
    this.captureTopicEditorFormSnapshot();
    this.updateTopicEditorActionState();
    this.topicEditorFields.content.focus();
    this.topicEditorFields.content.select();
  },

  positionTopicEditor(topic) {
    if (!this.topicEditorEl || !this.mapEl || !topic) return;

    const topicEl = Array.from(this.mapEl.querySelectorAll('.yonxao-mindmap-topic')).find(
      (element) => element.getAttribute('data-topic-id') === topic.id
    );
    const cardEl = topicEl ? topicEl.querySelector('.yonxao-mindmap-topic-card') : null;
    if (!cardEl) return;

    const gap = 12;
    const cardRect = cardEl.getBoundingClientRect();
    const editorRect = this.topicEditorEl.getBoundingClientRect();
    const rightLeft = cardRect.right + gap;
    const rightFits = rightLeft + editorRect.width + gap <= window.innerWidth;
    let left = rightFits ? rightLeft : cardRect.left;
    let top = rightFits ? cardRect.top : cardRect.bottom + gap;

    ({ left, top } = this.clampTopicEditorPosition(left, top, editorRect));

    this.topicEditorEl.style.left = `${Math.round(left)}px`;
    this.topicEditorEl.style.top = `${Math.round(top)}px`;
  },

  clampTopicEditorPosition(left, top, rect = null) {
    const gap = 12;
    const editorRect = rect || this.topicEditorEl?.getBoundingClientRect();
    const width = editorRect?.width || 300;
    const height = editorRect?.height || 320;
    const maxLeft = Math.max(gap, window.innerWidth - width - gap);
    const maxTop = Math.max(gap, window.innerHeight - height - gap);
    return {
      left: clamp(left, gap, maxLeft),
      top: clamp(top, gap, maxTop),
    };
  },

  startTopicEditorDrag(event) {
    if (event.button !== 0 || !this.topicEditorEl || this.topicEditorEl.hidden) return;

    event.preventDefault();
    event.stopPropagation();

    const rect = this.topicEditorEl.getBoundingClientRect();
    this.topicEditorDragState = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startLeft: rect.left,
      startTop: rect.top,
    };
    this.topicEditorEl.classList.add('is-dragging');

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (_error) {
      // Pointer Capture 在少数环境可能不可用；拖拽仍可在标题栏范围内继续。
    }
  },

  handleTopicEditorDragMove(event) {
    const state = this.topicEditorDragState;
    if (!state || event.pointerId !== state.pointerId || !this.topicEditorEl) return;

    event.preventDefault();
    event.stopPropagation();

    const nextLeft = state.startLeft + event.clientX - state.startClientX;
    const nextTop = state.startTop + event.clientY - state.startClientY;
    const { left, top } = this.clampTopicEditorPosition(nextLeft, nextTop);
    this.topicEditorEl.style.left = `${Math.round(left)}px`;
    this.topicEditorEl.style.top = `${Math.round(top)}px`;
  },

  finishTopicEditorDrag(event) {
    const state = this.topicEditorDragState;
    if (!state || event.pointerId !== state.pointerId) return;

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch (_error) {
      // 没有捕获到指针时释放会失败，这里安全忽略。
    }

    this.topicEditorDragState = null;
    this.topicEditorEl?.classList.remove('is-dragging');
  },

  closeTopicEditor() {
    this.editingTopicId = null;
    this.topicEditorInheritedValues = null;
    this.topicEditorFormSnapshot = null;
    this.closeTopicContentEditor(false);
    if (this.topicEditorEl) {
      this.topicEditorEl.hidden = true;
      this.topicEditorEl.style.left = '';
      this.topicEditorEl.style.top = '';
      this.topicEditorEl.classList.remove('is-dragging');
    }
    this.topicEditorDragState = null;
    if (this.topicEditorFields?.content) {
      this.topicEditorFields.content.style.width = '';
      this.topicEditorFields.content.style.height = '';
    }
    if (this.topicEditorFields?.iconPicker?._menu) {
      this.topicEditorFields.iconPicker._menu.hidden = true;
      this.topicEditorFields.iconPicker._button.setAttribute('aria-expanded', 'false');
    }
  },
};
