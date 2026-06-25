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
  setConfigValue,
  stringifyDraftConfig,
  canonicalizeMindConfig,
  mergeMindConfigSources,
  normalizeMindConfig,
  pruneInactiveMindConfig,
  clamp,
} from './configModalShared.js';
import { CANONICAL_DEFAULT_CONFIG } from '../../config/defaultMindConfig.js';

// 配置模态框拖动时距离视口边缘的最小间隙，防止模态框被拖到屏幕外完全看不见。
const MODAL_POSITION_GAP = 12;

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
    'display.canvasHeight': ['canvas', 'height'],
    'display.sourceHeight': ['source', 'height'],
    'display.viewFit': ['view', 'fit'],
    'display.fitViewNoUpscale': ['view', 'fitNoUpscale'],
    'display.fitViewMaxScale': ['view', 'fitMaxScale'],
    'display.saveFullConfig': ['view', 'saveFullConfig'],
    'structure.layout': ['layout'],
    'structure.connectorStyle': ['connector', 'style'],
    'structure.branchExpansion': ['branch', 'expansion'],
    'structure.topicMaxWidth.global': ['topic', 'maxWidth'],
    'color.scheme': ['theme'],
    'color.defaultTopicColor': ['topic', 'defaultColor'],
    'color.buttonColorMode': ['button', 'colorMode'],
    'color.buttonColor': ['button', 'color'],
    'interaction.toolbar.corner': ['toolbar', 'corner'],
    'interaction.toolbar.placement': ['toolbar', 'placement'],
    'interaction.topicControlVisibility': ['button', 'topicControlVisibility'],
    'interaction.tabIndent': ['source', 'enableTabIndent'],
    'interaction.wheelZoom': ['interaction', 'wheelZoom'],
    'font.family': ['font', 'family'],
    'font.size': ['font', 'size'],
    'font.weight': ['font', 'weight'],
    'font.lineHeight': ['font', 'lineHeight'],
  };
  if (directPaths[key]) return directPaths[key];

  const fontLevelMatch = key.match(/^font\.level([123])\.(family|size|weight|lineHeight)$/);
  if (fontLevelMatch) return ['font', 'levels', fontLevelMatch[1], fontLevelMatch[2]];

  const topicLevelMatch = key.match(/^structure\.topicMaxWidth\.level([123])$/);
  if (topicLevelMatch) return ['topic', 'levels', topicLevelMatch[1], 'maxWidth'];

  return null;
}

function inheritedRuntimeFallback(normalized, path, fallback) {
  const key = path.join('.');
  const fontLevelMatch = key.match(/^font\.level[123]\.(family|size|weight|lineHeight)$/);
  if (fontLevelMatch) return readConfigPath(normalized, ['font', fontLevelMatch[1]], fallback);
  if (/^structure\.topicMaxWidth\.level[123]$/.test(key)) {
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
    const gap = MODAL_POSITION_GAP;
    const rect = this.modalEl.getBoundingClientRect();
    const maxLeft = Math.max(gap, window.innerWidth - rect.width - gap);
    const maxTop = Math.max(gap, window.innerHeight - rect.height - gap);
    return {
      left: clamp(left, gap, maxLeft),
      top: clamp(top, gap, maxTop),
    };
  },

  effectiveDraftConfig() {
    return mergeMindConfigSources(this.baseConfig, this.draftConfig);
  },

  configDefaultValueForPath(path, fallback = '') {
    const draftWithoutPath = cloneConfig(this.draftConfig);
    deleteConfigValue(draftWithoutPath, path);
    const normalized = normalizeMindConfig(
      mergeMindConfigSources(this.baseConfig, draftWithoutPath)
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

  syncInheritedValueStyle(controlEl, path) {
    const isInherited = !this.hasDraftConfigPath(path);
    controlEl.classList.toggle('is-inherited-value', isInherited);
    controlEl.parentElement?.classList.toggle('is-inherited-value', isInherited);
  },

  isDraftApplied() {
    if (this.activeTab === 'advanced' && this.advancedInputEl) {
      /*
       * 渲染高级页时 YAML 编辑器中显示的是裁剪后的 draftConfig，
       * 所以比较时应使用裁剪后的版本，避免因 textarea 显示值与
       * 原始 draftConfig 不一致导致按钮状态错误。
       */
      const prunedConfig = pruneInactiveMindConfig(this.draftConfig, this.baseConfig);
      const trimmedDraftText = stringifyDraftConfig(prunedConfig).trim();
      if (this.advancedInputEl.value.trim() !== trimmedDraftText) return false;
    }

    return this.configSnapshot(this.draftConfig) === this.configSnapshot(this.initialConfig);
  },

  configSnapshot(config) {
    return stringifyDraftConfig(canonicalizeMindConfig(config));
  },

  /*
   * 作用：
   * 判断草稿配置中的某条路径是否为"冗余"配置，
   * 即删除该路径后归一化结果与删除前完全相同。
   *
   * 判断逻辑：
   * 比较"包含当前路径的有效配置"和"删除当前路径后的有效配置"的归一化结果，
   * 如果完全一致，说明该路径的值不影响最终渲染结果，可以安全删除。
   *
   * 使用场景：
   * prepareConfigFieldDefault 中用于避免把"恰好等于默认值的显式配置"误删，
   * 因为某些字段（如导图高度）虽然值等于默认值，但删除后行为会变化。
   *
   * 性能注意：
   * 每次调用会做两次 normalizeMindConfig 和两次 JSON.stringify，
   * 当前仅在字段初始化时调用一次，性能可接受。
   * 不要在高频循环或 input 事件中直接调用。
   */
  isDraftConfigPathRedundant(path) {
    const currentSnapshot = JSON.stringify(normalizeMindConfig(this.effectiveDraftConfig()));
    const draftWithoutPath = cloneConfig(this.draftConfig);
    deleteConfigValue(draftWithoutPath, path);
    const withoutPathSnapshot = JSON.stringify(
      normalizeMindConfig(mergeMindConfigSources(this.baseConfig, draftWithoutPath))
    );
    return currentSnapshot === withoutPathSnapshot;
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

    let configToSave = this.draftConfig;
    const effectiveConfig = this.effectiveDraftConfig();
    const shouldSaveFull = Boolean(effectiveConfig.display?.saveFullConfig);

    if (shouldSaveFull) {
      // 完整保存：用配置区规范默认配置兜底，再叠加全局默认值，最后叠加代码块配置，
      // 保证所有字段都被写入，方便分享给他人时样式一致。
      configToSave = mergeMindConfigSources(
        CANONICAL_DEFAULT_CONFIG,
        mergeMindConfigSources(this.baseConfig, this.draftConfig)
      );
    }

    configToSave = pruneInactiveMindConfig(configToSave, this.baseConfig);

    if (shouldSaveFull) {
      setConfigValue(configToSave, ['display', 'saveFullConfig'], true);
    }

    const result = await this.onApply(cloneConfig(configToSave));
    if (!result || !result.saved) return;

    /*
     * 使用 renderer 保存后的裁剪配置更新草稿，保证后续显示与写入文件的配置一致。
     *
     * 为什么优先用 result.rawConfig 而不是本地 configToSave：
     * configToSave 只经过了 pruneInactiveMindConfig（移除当前布局/线型不生效的字段），
     * 而 renderer 的 documentConfigForSave 在此基础上还会调用
     * serializeMindSource -> pruneInactiveMindConfig（合并 baseConfig 后再次裁剪），
     * 移除更多与全局默认值重复的字段，使配置区更精简。
     * 用其返回值更新 draftConfig 可以让高级选项卡 YAML 立即反映最终写入的配置。
     */
    if (result.rawConfig) {
      this.draftConfig = canonicalizeMindConfig(result.rawConfig);
    } else {
      // applyConfigFromModal 返回 { saved: true, rawConfig } 或 false。
      // 走 else 分支意味着 onApply 未实现 rawConfig 返回（如全局默认值面板），
      // 此时直接使用本地裁剪后的 configToSave。
      this.draftConfig = configToSave;
    }
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
