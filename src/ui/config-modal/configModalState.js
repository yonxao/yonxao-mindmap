/*
 * 文件作用：
 * 配置面板状态方法集合，负责草稿快照、应用保存、继承态判断和状态栏更新。
 *
 * 实现逻辑：
 * 保存时先 canonicalize/prune 草稿，再交给调用方 onApply；继承态通过 baseConfig 与 draftConfig 比较得出。
 *
 * 调用链：
 * ConfigModal actions/fields -> configModalStateMethods -> renderer runtime config save。
 */

import {
  setIcon,
  cloneConfig,
  deleteConfigValue,
  parseDraftConfigText,
  stringifyDraftConfig,
  canonicalizeMindConfig,
  mergeMindConfigObjects,
  normalizeMindConfig,
  pruneInactiveMindConfig,
  clamp,
} from './configModalShared.js';

function readConfigPath(config, path, fallback = '') {
  let current = config;
  for (const key of path) {
    if (!current || typeof current !== 'object') return fallback;
    current = current[key];
  }

  return current === undefined || current === null ? fallback : current;
}

function runtimePathForDraftPath(path) {
  const key = path.join('.');
  const directPaths = {
    'basic.canvasHeight': ['canvas', 'height'],
    'basic.sourceHeight': ['source', 'height'],
    'basic.topicControlVisibility': ['button', 'topicControlVisibility'],
    'basic.viewFit': ['view', 'fit'],
    'basic.fitViewNoUpscale': ['view', 'fitNoUpscale'],
    'basic.fitViewMaxScale': ['view', 'fitMaxScale'],
    'basic.toolbar.corner': ['toolbar', 'corner'],
    'basic.toolbar.placement': ['toolbar', 'placement'],
    'basic.tabIndent': ['source', 'enableTabIndent'],
    'basic.wheelZoom': ['interaction', 'wheelZoom'],
    'theme.scheme': ['theme'],
    'theme.defaultTopicColor': ['topic', 'defaultColor'],
    'theme.buttonColorMode': ['button', 'colorMode'],
    'theme.buttonColor': ['button', 'color'],
    'layout.type': ['layout'],
    'layout.connectorStyle': ['connector', 'style'],
    'layout.branchExpansion': ['branch', 'expansion'],
    'layout.topicMaxWidth.global': ['topic', 'maxWidth'],
    'font.family': ['font', 'family'],
    'font.size': ['font', 'size'],
    'font.weight': ['font', 'weight'],
    'font.lineHeight': ['font', 'lineHeight'],
  };
  if (directPaths[key]) return directPaths[key];

  const fontLevelMatch = key.match(/^font\.level([123])\.(family|size|weight|lineHeight)$/);
  if (fontLevelMatch) return ['font', 'levels', fontLevelMatch[1], fontLevelMatch[2]];

  const topicLevelMatch = key.match(/^layout\.topicMaxWidth\.level([123])$/);
  if (topicLevelMatch) return ['topic', 'levels', topicLevelMatch[1], 'maxWidth'];

  return null;
}

function inheritedRuntimeFallback(normalized, path, fallback) {
  const key = path.join('.');
  const fontLevelMatch = key.match(/^font\.level[123]\.(family|size|weight|lineHeight)$/);
  if (fontLevelMatch) return readConfigPath(normalized, ['font', fontLevelMatch[1]], fallback);
  if (/^layout\.topicMaxWidth\.level[123]$/.test(key)) {
    return readConfigPath(normalized, ['topic', 'maxWidth'], fallback);
  }
  return fallback;
}

export const configModalStateMethods = {
  createConfigInfoPopover(headerEl) {
    const wrapperEl = headerEl.createDiv({ cls: 'yonxao-mindmap-config-info' });
    const buttonEl = wrapperEl.createEl('button', {
      cls: 'yonxao-mindmap-config-info-button',
      attr: {
        'aria-expanded': 'false',
      },
    });
    buttonEl.type = 'button';
    const popoverEl = wrapperEl.createDiv({
      cls: 'yonxao-mindmap-config-info-popover',
      text: this.t('configModal.info.tooltip'),
      attr: {
        role: 'tooltip',
      },
    });
    const popoverId = `yonxao-mindmap-config-info-${Date.now().toString(36)}`;
    const labelId = `${popoverId}-label`;
    popoverEl.id = popoverId;
    setIcon(buttonEl, 'info');
    const labelEl = buttonEl.createSpan({
      cls: 'yonxao-mindmap-config-info-label',
      text: this.t('configModal.info.label'),
    });
    labelEl.id = labelId;
    buttonEl.setAttribute('aria-labelledby', labelId);
    buttonEl.setAttribute('aria-describedby', popoverId);

    buttonEl.addEventListener('pointerdown', (event) => {
      event.stopPropagation();
    });
    buttonEl.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const isOpen = wrapperEl.classList.toggle('is-open');
      buttonEl.setAttribute('aria-expanded', String(isOpen));
    });
    buttonEl.addEventListener('blur', () => {
      wrapperEl.classList.remove('is-open');
      buttonEl.setAttribute('aria-expanded', 'false');
    });
  },

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
  },

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
  },

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
  },

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
  },

  clampModalPosition(left, top) {
    const gap = 12;
    const rect = this.modalEl.getBoundingClientRect();
    const maxLeft = Math.max(gap, window.innerWidth - rect.width - gap);
    const maxTop = Math.max(gap, window.innerHeight - rect.height - gap);
    return {
      left: clamp(left, gap, maxLeft),
      top: clamp(top, gap, maxTop),
    };
  },

  effectiveDraftConfig() {
    return mergeMindConfigObjects(this.baseConfig, this.draftConfig);
  },

  configDefaultValueForPath(path, fallback = '') {
    const draftWithoutPath = cloneConfig(this.draftConfig);
    deleteConfigValue(draftWithoutPath, path);
    const normalized = normalizeMindConfig(
      mergeMindConfigObjects(this.baseConfig, draftWithoutPath)
    );
    const runtimePath = runtimePathForDraftPath(path);
    const inheritedFallback = inheritedRuntimeFallback(normalized, path, fallback);
    if (!runtimePath) return inheritedFallback;
    return readConfigPath(normalized, runtimePath, inheritedFallback);
  },

  updateTabs() {
    for (const tab of this.contentEl.querySelectorAll('.yonxao-mindmap-config-tab')) {
      tab.classList.toggle('is-active', tab.textContent === this.tabLabel(this.activeTab));
    }
  },

  hasDraftConfigPath(path) {
    let current = this.draftConfig;
    for (const key of path) {
      if (!current || typeof current !== 'object') return false;
      if (!Object.prototype.hasOwnProperty.call(current, key)) return false;
      current = current[key];
    }
    return true;
  },

  applyInheritedValueStyle(controlEl, path) {
    this.syncInheritedValueStyle(controlEl, path);
  },

  syncInheritedValueStyle(controlEl, path) {
    const isInherited = !this.hasDraftConfigPath(path);
    controlEl.classList.toggle('is-inherited-value', isInherited);
    controlEl.parentElement?.classList.toggle('is-inherited-value', isInherited);
  },

  isDraftApplied() {
    if (this.activeTab === 'advanced' && this.advancedInputEl) {
      const normalizedDraftText = stringifyDraftConfig(this.draftConfig);
      if (this.advancedInputEl.value.trim() !== normalizedDraftText.trim()) return false;
    }

    return this.configSnapshot(this.draftConfig) === this.configSnapshot(this.initialConfig);
  },

  configSnapshot(config) {
    return stringifyDraftConfig(canonicalizeMindConfig(config));
  },

  updateActionButtons() {
    if (!this.cancelButton) return;
    const isApplied = this.isDraftApplied();
    if (this.applyButton) this.applyButton.disabled = isApplied;
    if (this.saveAndCloseButton) this.saveAndCloseButton.disabled = isApplied;
    this.cancelButton.setText(
      isApplied ? this.t('configModal.actions.close') : this.t('configModal.actions.cancel')
    );
  },

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

    this.draftConfig = pruneInactiveMindConfig(this.draftConfig);
    const saved = await this.onApply(cloneConfig(this.draftConfig));
    if (!saved) return;

    this.initialConfig = cloneConfig(this.draftConfig);
    if (this.activeTab === 'advanced' && this.advancedInputEl) {
      this.advancedInputEl.value = stringifyDraftConfig(this.draftConfig);
      this.updateAdvancedEditor();
    }
    this.updateActionButtons();
    this.updateStatus(this.t('configModal.status.saved'));
    if (closeAfterApply) this.close();
  },

  updateStatus(message, isError) {
    if (!this.statusEl) return;
    this.statusEl.textContent = message || '';
    this.statusEl.classList.toggle('is-error', Boolean(isError));
  },
};
