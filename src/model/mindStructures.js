/*
 * 文件作用
 * 定义导图中"高级结构"（关联/relation、概要/summary、外框/boundary）的数据模型与交互逻辑。
 * 涵盖：结构 ID 生成、主题稳定 ID 管理、结构创建编辑删除、选择栏 UI、贝塞尔控制点拖拽、
 * 以及主题变更后的结构清理。

 * 实现逻辑
 * - 结构/主题使用三位 ID（前缀 + 三位数字），通过随机起始 + 线性探测避免冲突。
 * - 创建结构走「选择主题 → 弹出编辑器 Modal → 存入 structures 数组 → 持久化」流程。
 * - 编辑/删除直接操作 structures 数组，通过 saveTreeToSourceAndFile() 持久化。
 * - 关联线端点吸附主题边框的 8 个固定锚点，并以 fromAnchor/toAnchor 持久化；
 *   曲线控制点（control1/control2）以起终点投影比值 + 法向偏移量存储。
 * - 主题删除或移动后，cleanupStructuresAfterTopicChange() 清除引用失效或校验不通过的结构。

 * 调用链
 * Renderer 在渲染阶段 (renderMap) 遍历 this.structures 绘制。
 * 用户交互入口来自编辑器视图的事件委托（结构 SVG 元素、控制点手柄、右键菜单）。
 * 主题变更（增/删/移）结束后由上层调用 cleanupStructuresAfterTopicChange() 清理。
 */
import { Modal } from 'obsidian';
import {
  RELATION_DEFAULT_DIRECTION,
  RELATION_DEFAULT_LINE_STYLE,
  STRUCTURE_ID_PREFIXES,
} from '../parser/mindStructures.js';
import { Notice, findTopicByStableId, validateMindStructures } from '../shared/rendererShared.js';
import { nearestRelationAnchor } from './relationAnchors.js';

// 结构 ID 池大小：每种结构最多生成 1000 个三位 ID（000-999），超限报错。
const STRUCTURE_ID_LIMIT = 1000;

// 主题稳定 ID 前缀：格式为 "t-xxx"，与解析器约定的 stableId 格式一致。
const TOPIC_ID_PREFIX = 't-';

// 主题 ID 池大小：整张导图最多生成 1000 个主题稳定 ID，超限报错。
const TOPIC_ID_LIMIT = 1000;

/*
 * 为指定类型生成一个未使用的三位结构 ID。
 * 策略：随机取起点，循环探测 000-999 范围内未被占用的 ID。
 * 池满时抛异常，展示用户友好的中文提示。
 */
function nextStructureId(structures, type) {
  // 使用 STRUCTURE_ID_PREFIXES（来自解析器）获取该类型的前缀，如 "r-"、"s-"、"b-"。
  const prefix = STRUCTURE_ID_PREFIXES[type];
  // 收集已用 ID 加速查找
  const used = new Set((structures || []).map((structure) => structure.id));
  const start = Math.floor(Math.random() * STRUCTURE_ID_LIMIT);
  for (let offset = 0; offset < STRUCTURE_ID_LIMIT; offset += 1) {
    const number = (start + offset) % STRUCTURE_ID_LIMIT;
    const id = `${prefix}${String(number).padStart(3, '0')}`;
    if (!used.has(id)) return id;
  }
  throw new Error(
    `当前导图的 ${{ relation: '关联', summary: '概要', boundary: '外框' }[type] || type} 三位 ID 已用完。`
  );
}

/*
 * 生成一个未使用的三位主题稳定 ID。
 * 策略同 nextStructureId，前缀固定为 TOPIC_ID_PREFIX ("t-")。
 * used 为已有 ID 的 Set，由调用方收集传入。
 */
function nextTopicStableId(used) {
  const start = Math.floor(Math.random() * TOPIC_ID_LIMIT);
  for (let offset = 0; offset < TOPIC_ID_LIMIT; offset += 1) {
    const number = (start + offset) % TOPIC_ID_LIMIT;
    const id = `${TOPIC_ID_PREFIX}${String(number).padStart(3, '0')}`;
    if (!used.has(id)) return id;
  }
  throw new Error('当前导图的三位主题 ID 已用完。');
}

/*
 * 弹出结构编辑 Modal，让用户填写文本、方向、线条样式等信息。
 * 返回 Promise<{text, direction, lineStyle}>；用户取消则 resolve(null)。
 * 关联/概要支持多行文本；外框只支持单行。
 * 关联额外显示方向和线条样式下拉框。
 * 全屏模式下将 Modal 移入全屏容器，避免被覆盖层遮挡。
 */
function requestStructureDetails(renderer, structure) {
  const t = (key) => renderer.t(key);
  return new Promise((resolve) => {
    const modal = new Modal(renderer.plugin.app);
    let submitted = false;
    modal.setTitle(t('structureEditor.title.' + structure.type));

    // ---- 文本输入 ----
    const textLabel = document.createElement('label');
    textLabel.className = 'yonxao-mindmap-structure-editor-field';
    textLabel.append(t('structureEditor.label.text'));
    const supportsMultilineText = structure.type === 'relation' || structure.type === 'summary';
    const textInput = document.createElement(supportsMultilineText ? 'textarea' : 'input');
    if (supportsMultilineText) textInput.rows = 3;
    else textInput.type = 'text';
    textInput.value = structure.text || '';
    textInput.placeholder = supportsMultilineText
      ? t('structureEditor.placeholder.textMultiline')
      : t('structureEditor.placeholder.text');
    textLabel.appendChild(textInput);
    modal.contentEl.appendChild(textLabel);

    // ---- 关联专有设置：方向和线条样式 ----
    let directionSelect = null;
    let lineStyleSelect = null;
    if (structure.type === 'relation') {
      const directionLabel = document.createElement('label');
      directionLabel.className = 'yonxao-mindmap-structure-editor-field';
      directionLabel.append(t('structureEditor.label.direction'));
      directionSelect = document.createElement('select');
      for (const [value] of [['none'], ['forward'], ['backward'], ['both']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = t('structureEditor.direction.' + value);
        directionSelect.appendChild(option);
      }
      directionSelect.value = structure.attributes?.direction || RELATION_DEFAULT_DIRECTION;
      directionLabel.appendChild(directionSelect);
      modal.contentEl.appendChild(directionLabel);

      const lineStyleLabel = document.createElement('label');
      lineStyleLabel.className = 'yonxao-mindmap-structure-editor-field';
      lineStyleLabel.append(t('structureEditor.label.lineStyle'));
      lineStyleSelect = document.createElement('select');
      for (const [value] of [['curve'], ['straight'], ['elbow']]) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = t('structureEditor.lineStyle.' + value);
        lineStyleSelect.appendChild(option);
      }
      lineStyleSelect.value = structure.attributes?.lineStyle || RELATION_DEFAULT_LINE_STYLE;
      lineStyleLabel.appendChild(lineStyleSelect);
      modal.contentEl.appendChild(lineStyleLabel);
    }

    // ---- 底部操作按钮 ----
    const actions = document.createElement('div');
    actions.className = 'yonxao-mindmap-structure-editor-actions';
    const cancelButton = document.createElement('button');
    cancelButton.textContent = t('structureEditor.action.cancel');
    cancelButton.addEventListener('click', () => modal.close());
    const saveButton = document.createElement('button');
    saveButton.className = 'mod-cta';
    saveButton.textContent = t('structureEditor.action.save');
    saveButton.addEventListener('click', () => {
      submitted = true;
      resolve({
        text: textInput.value.trim(),
        direction: directionSelect?.value || RELATION_DEFAULT_DIRECTION,
        lineStyle: lineStyleSelect?.value || RELATION_DEFAULT_LINE_STYLE,
      });
      modal.close();
    });
    actions.append(cancelButton, saveButton);
    modal.contentEl.appendChild(actions);
    modal.onClose = () => {
      modal.contentEl.empty();
      if (!submitted) resolve(null);
    };
    modal.open();

    // 全屏支持下：Obsidian Modal 默认挂在 body；全屏时移入当前全屏容器，避免被覆盖层或 top layer 遮挡。
    const floatContainer = renderer._bodyFloatContainer?.() || document.body;
    const modalContainer = modal.containerEl || modal.modalEl?.parentElement;
    if (floatContainer !== document.body && modalContainer?.parentNode !== floatContainer) {
      modalContainer.classList.add('yonxao-mindmap-structure-modal-container');
      floatContainer.appendChild(modalContainer);
    }
    window.setTimeout(() => textInput.focus(), 0);
  });
}

export const mindStructureMethods = {
  /*
   * 为主题分配一个稳定 ID（持久化标识，不随主题位置变化）。
   * stableId 存储在 topic.attributes.id 中，用于结构引用（结构通过 topicIds 记录稳定 ID）。
   * 已有 ID 直接返回；否则遍历整棵主题树收集已用 ID，然后调用 nextTopicStableId 生成新 ID。
   */
  ensureStableTopicId(topic) {
    if (topic.attributes?.id) return topic.attributes.id;
    topic.attributes ||= {};
    const used = new Set();
    const visit = (current) => {
      if (current.attributes?.id) used.add(current.attributes.id);
      for (const child of current.subtopics || []) visit(child);
    };
    visit(this.root);
    const id = nextTopicStableId(used);
    topic.attributes.id = id;
    return id;
  },

  /*
   * 开始结构选择模式。
   * type: 结构类型（relation / summary / boundary）
   * topic: 第一个选中的主题
   * 初始化选择状态、重绘以高亮选中主题、显示底部选择栏；虚拟主题不可选。
   */
  beginStructureSelection(type, topic) {
    if (!this.canEditMindMap() || !topic || topic._virtual) return;
    this.structureSelection = { type, topicIds: new Set([topic.id]) };
    this.renderMap(false);
    this.updateStructureSelectionBar();
    new Notice(
      `yonxao-mindmap: ${type === 'relation' ? this.t('notice.structureSelectRelation') : this.t('notice.structureSelectMulti')}`
    );
  },

  /*
   * 切换主题选中状态。
   * - 关联：选中第二个主题后自动完成选择（关联只连接两个主题）。
   * - 概要/外框：多选/取消选中的切换逻辑，每次变化后重绘并更新选择栏。
   * 返回 true 表示事件被消费；false 表示未命中选择模式或主题无效。
   */
  toggleStructureSelectionTopic(topic) {
    const selection = this.structureSelection;
    if (!selection || !topic || topic._virtual) return false;
    if (selection.type === 'relation') {
      if (!selection.topicIds.has(topic.id)) {
        selection.topicIds.add(topic.id);
        this.finishStructureSelection();
      }
      return true;
    }
    if (selection.topicIds.has(topic.id)) selection.topicIds.delete(topic.id);
    else selection.topicIds.add(topic.id);
    this.renderMap(false);
    this.updateStructureSelectionBar();
    return true;
  },

  /*
   * 取消结构选择，重置状态并隐藏选择栏。
   * options.render 可控制是否重绘（默认 true）。
   */
  cancelStructureSelection(options = {}) {
    this.structureSelection = null;
    this.hideStructureSelectionBar();
    if (options.render !== false) this.renderMap(false);
  },

  /*
   * 完成结构选择并创建新结构。
   * 1. 校验选中主题是否满足结构要求
   * 2. 为主题分配稳定 ID
   * 3. 生成结构 ID、构建结构对象
   * 4. 弹出编辑器 Modal 让用户补充信息
   * 5. 提交前再次校验结构合法性
   * 6. 推入 structures 数组并持久化
   * 用户取消 Modal 或校验失败时回退到选择状态。
   */
  async finishStructureSelection() {
    const selection = this.structureSelection;
    if (!selection) return false;
    const validation = this.structureSelectionValidation(selection);
    if (!validation.valid) {
      new Notice(`yonxao-mindmap: ${validation.hint}`);
      this.updateStructureSelectionBar();
      return false;
    }
    const topics = validation.topics;
    this.hideStructureSelectionBar();
    const topicIds = topics.map((topic) => this.ensureStableTopicId(topic));
    const structure = {
      id: nextStructureId(this.structures, selection.type),
      type: selection.type,
      topicIds,
      text: '',
      attributes:
        selection.type === 'relation'
          ? {
              direction: RELATION_DEFAULT_DIRECTION,
              lineStyle: RELATION_DEFAULT_LINE_STYLE,
            }
          : {},
    };
    const details = await requestStructureDetails(this, structure);
    if (!details) {
      this.structureSelection = null;
      this.renderMap(false);
      return false;
    }
    structure.text = details.text;
    if (structure.type === 'relation') {
      structure.attributes.direction = details.direction;
      structure.attributes.lineStyle = details.lineStyle;
    }
    try {
      validateMindStructures(this.root, [...this.structures, structure]);
    } catch (error) {
      new Notice(`yonxao-mindmap: ${error.message}`);
      this.updateStructureSelectionBar();
      return false;
    }
    this.structures.push(structure);
    this.structureSelection = null;
    return this.saveTreeToSourceAndFile(
      this.t('notice.structureCreated', { type: this.t('structureEditor.title.' + structure.type) })
    );
  },

  /*
   * 校验当前选中的主题集合是否满足目标结构类型的要求。
   * - 外框：至少 1 个主题
   * - 关联/概要：至少 2 个主题
   * - 概要额外要求：所有主题同父级且连续排列
   * 返回 { valid, topics, hint }，hint 为国际化提示信息。
   */
  structureSelectionValidation(selection = this.structureSelection) {
    const type = selection?.type || '';
    const topics = [...(selection?.topicIds || [])]
      .map((id) => this.topicById.get(id))
      .filter(Boolean);
    const minimum = type === 'boundary' ? 1 : 2;
    if (topics.length < minimum) {
      return {
        valid: false,
        topics,
        hint: this.t('structureSelection.minimum', { minimum }),
      };
    }
    if (type !== 'summary') {
      return { valid: true, topics, hint: this.t('structureSelection.boundaryReady') };
    }

    // ---- 概要特殊校验：同父级 + 连续 ----
    const parentByTopicId = new Map();
    const visit = (topic) => {
      for (const child of topic.subtopics || []) {
        parentByTopicId.set(child.id, topic);
        visit(child);
      }
    };
    visit(this.root);
    const parents = new Set(topics.map((topic) => parentByTopicId.get(topic.id)));
    if (parents.size !== 1 || parents.has(undefined)) {
      return {
        valid: false,
        topics,
        hint: this.t('structureSelection.summarySameParent'),
      };
    }
    const parent = parents.values().next().value;
    // 检查选中主题在父级子主题列表中的位置是否连续
    const positions = topics
      .map((topic) => parent.subtopics.findIndex((candidate) => candidate.id === topic.id))
      .sort((left, right) => left - right);
    const contiguous = positions.every(
      (position, index) => index === 0 || position === positions[index - 1] + 1
    );
    return {
      valid: contiguous,
      topics,
      hint: contiguous
        ? this.t('structureSelection.summaryReady')
        : this.t('structureSelection.summaryContiguous'),
    };
  },

  /*
   * 更新底部选择栏的状态：显示选中数量、校验提示、控制完成按钮是否可点击。
   * 关联类型没有选择栏（两点选完即创建），直接隐藏。
   */
  updateStructureSelectionBar() {
    const selection = this.structureSelection;
    if (!selection || selection.type === 'relation' || !this.containerEl) {
      this.hideStructureSelectionBar();
      return;
    }
    if (!this.structureSelectionBarEl) this.createStructureSelectionBar();
    const validation = this.structureSelectionValidation(selection);
    this.structureSelectionBarEl.hidden = false;
    this.structureSelectionStatusEl.textContent = this.t('structureSelection.status', {
      type: this.t(`structureSelection.type.${selection.type}`),
      count: validation.topics.length,
    });
    this.structureSelectionHintEl.textContent = validation.hint;
    this.structureSelectionFinishButton.disabled = !validation.valid;
  },

  /*
   * 创建底部选择栏 DOM 并挂载到 containerEl。
   * 包含：状态提示（选中数量）、校验提示、取消按钮、创建按钮。
   * 支持拖拽移动（通过 copy 区域的 pointerdown 事件）、Escape 取消。
   */
  createStructureSelectionBar() {
    const bar = document.createElement('div');
    bar.className = 'yonxao-mindmap-structure-selection-bar';
    bar.setAttribute('role', 'toolbar');
    const copy = document.createElement('div');
    copy.className = 'yonxao-mindmap-structure-selection-copy';
    const status = document.createElement('strong');
    const hint = document.createElement('span');
    hint.className = 'yonxao-mindmap-structure-selection-hint';
    copy.append(status, hint);
    const actions = document.createElement('div');
    actions.className = 'yonxao-mindmap-structure-selection-actions';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = this.t('structureSelection.cancel');
    const finishButton = document.createElement('button');
    finishButton.type = 'button';
    finishButton.className = 'mod-cta';
    finishButton.textContent = this.t('structureSelection.create');
    actions.append(cancelButton, finishButton);
    bar.append(copy, actions);
    this.containerEl.appendChild(bar);
    this.registerDomEvent(cancelButton, 'click', () => this.cancelStructureSelection());
    this.registerDomEvent(finishButton, 'click', () => this.finishStructureSelection());
    this.registerDomEvent(copy, 'pointerdown', (event) =>
      this.startStructureSelectionBarDrag(event)
    );
    this.registerDomEvent(bar, 'pointermove', (event) => this.moveStructureSelectionBar(event));
    this.registerDomEvent(bar, 'pointerup', (event) => this.finishStructureSelectionBarDrag(event));
    this.registerDomEvent(bar, 'pointercancel', (event) =>
      this.finishStructureSelectionBarDrag(event)
    );
    this.registerDomEvent(bar, 'keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      this.cancelStructureSelection();
      this.svgEl?.focus?.({ preventScroll: true });
    });
    this.structureSelectionBarEl = bar;
    this.structureSelectionStatusEl = status;
    this.structureSelectionHintEl = hint;
    this.structureSelectionFinishButton = finishButton;
  },

  /*
   * 开始拖拽选择栏：记录拖拽起始偏移和 pointerId，添加 is-dragging 样式。
   */
  startStructureSelectionBarDrag(event) {
    if (event.button !== 0 || !this.structureSelectionBarEl || !this.containerEl) return;
    event.preventDefault();
    event.stopPropagation();
    const barRect = this.structureSelectionBarEl.getBoundingClientRect();
    this.structureSelectionBarDragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - barRect.left,
      offsetY: event.clientY - barRect.top,
    };
    this.structureSelectionBarEl.classList.add('is-dragging');
    this.structureSelectionBarEl.setPointerCapture?.(event.pointerId);
  },

  /*
   * 拖拽选择栏移动中：将选择栏约束在 containerEl 内，保留 6px 边距。
   * 比较 containerEl 和 bar 的尺寸，防止溢出。
   */
  moveStructureSelectionBar(event) {
    const state = this.structureSelectionBarDragState;
    const bar = this.structureSelectionBarEl;
    if (!state || !bar || event.pointerId !== state.pointerId) return;
    event.preventDefault();
    const containerRect = this.containerEl.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    const edgeGap = 6;
    const left = Math.min(
      Math.max(edgeGap, event.clientX - containerRect.left - state.offsetX),
      Math.max(edgeGap, containerRect.width - barRect.width - edgeGap)
    );
    const top = Math.min(
      Math.max(edgeGap, event.clientY - containerRect.top - state.offsetY),
      Math.max(edgeGap, containerRect.height - barRect.height - edgeGap)
    );
    bar.style.left = `${left}px`;
    bar.style.top = `${top}px`;
    bar.style.bottom = 'auto';
    bar.style.transform = 'none';
  },

  /*
   * 结束选择栏拖拽：释放 pointer capture，移除拖拽样式，清空状态。
   */
  finishStructureSelectionBarDrag(event) {
    const state = this.structureSelectionBarDragState;
    if (!state || event.pointerId !== state.pointerId) return;
    this.structureSelectionBarEl?.releasePointerCapture?.(event.pointerId);
    this.structureSelectionBarEl?.classList.remove('is-dragging');
    this.structureSelectionBarDragState = null;
  },

  /*
   * 隐藏（而非移除）选择栏，保留 DOM 以便后续复用。
   */
  hideStructureSelectionBar() {
    if (this.structureSelectionBarEl) this.structureSelectionBarEl.hidden = true;
  },

  /*
   * 彻底移除选择栏 DOM 并清空所有相关引用，避免内存泄漏。
   */
  removeStructureSelectionBar() {
    this.structureSelectionBarEl?.remove();
    this.structureSelectionBarEl = null;
    this.structureSelectionStatusEl = null;
    this.structureSelectionHintEl = null;
    this.structureSelectionFinishButton = null;
    this.structureSelectionBarDragState = null;
  },

  /*
   * 编辑已有结构：弹出编辑器 Modal，用户确认后更新 structure 字段并持久化。
   * 关联的线条样式从 curve 切换为非 curve 时，清理自定义控制点（control1/control2），
   * 因为直线/肘形线不需要贝塞尔控制点。
   */
  async editMindStructure(structure) {
    const details = await requestStructureDetails(this, structure);
    if (!details) return false;
    structure.text = details.text;
    if (structure.type === 'relation') {
      structure.attributes.direction = details.direction;
      structure.attributes.lineStyle = details.lineStyle;
      if (details.lineStyle !== RELATION_DEFAULT_LINE_STYLE) {
        delete structure.attributes.control1;
        delete structure.attributes.control2;
      }
    }
    return this.saveTreeToSourceAndFile(
      this.t('notice.structureSaved', { type: this.t('structureEditor.title.' + structure.type) })
    );
  },

  /*
   * 删除结构：从 structures 数组中移除并持久化。
   */
  async deleteMindStructure(structure) {
    this.structures = this.structures.filter((candidate) => candidate.id !== structure.id);
    this.selectedStructureId = '';
    this.svgEl?.classList.remove('has-selected-relation');
    return this.saveTreeToSourceAndFile(
      this.t('notice.structureDeleted', { type: this.t('structureEditor.title.' + structure.type) })
    );
  },

  /*
   * 从 DOM 事件目标向上查找 data-structure-id 属性，返回对应的结构对象。
   * 用于点击/焦点/双击等事件处理中确定用户交互的是哪个结构。
   */
  mindStructureFromTarget(target) {
    const id = target?.closest?.('[data-structure-id]')?.getAttribute('data-structure-id');
    return id ? this.structures.find((structure) => structure.id === id) : null;
  },

  /*
   * 清除当前选中的结构（清除 DOM 上的 is-selected 类）。
   */
  clearSelectedMindStructure() {
    this.svgEl?.classList.remove('has-selected-relation');
    if (!this.selectedStructureId) return;
    this.selectedStructureId = '';
    for (const element of this.mapEl?.querySelectorAll?.('.yonxao-mindmap-structure.is-selected') ||
      []) {
      element.classList.remove('is-selected');
    }
  },

  /*
   * 单击结构：切换焦点到该结构，清除主题焦点。
   * preventDefault 和 stopPropagation 阻止事件冒泡触发其他处理。
   */
  handleMindStructureClick(event) {
    const structure = this.mindStructureFromTarget(event.target);
    if (!structure) return false;
    event.preventDefault();
    event.stopPropagation();
    this.clearFocusedTopic();
    this.syncSelectedMindStructure(structure)?.focus?.({ preventScroll: true });
    return true;
  },

  /*
   * 焦点进入结构元素时，同步选中状态但不转移键盘焦点（与 click 区别）。
   */
  handleMindStructureFocus(event) {
    const structure = this.mindStructureFromTarget(event.target);
    if (!structure) return false;
    this.clearFocusedTopic();
    this.syncSelectedMindStructure(structure);
    return true;
  },

  /*
   * 将指定结构的选中态同步到所有结构 DOM 元素。
   * 关联类型（relation）需要在 DOM 中置顶以确保整条线和控制点手柄都可命中，
   * 键盘焦点也遵守同一层级规则。
   * 返回匹配的 DOM 元素。
   */
  syncSelectedMindStructure(structure) {
    this.selectedStructureId = structure.id;
    this.svgEl?.classList.toggle('has-selected-relation', structure.type === 'relation');
    let selectedElement = null;
    for (const element of this.mapEl?.querySelectorAll?.('.yonxao-mindmap-structure') || []) {
      const selected = element.getAttribute('data-structure-id') === structure.id;
      element.classList.toggle('is-selected', selected);
      if (selected) selectedElement = element;
    }
    // 关联必须高于概要才能保证整条线和控制点都可命中；键盘焦点也遵守同一层级规则。
    if (structure.type === 'relation' && selectedElement?.parentNode) {
      selectedElement.parentNode.appendChild(selectedElement);
    }
    return selectedElement;
  },

  /*
   * 双击结构：进入编辑模式。
   */
  handleMindStructureDoubleClick(event) {
    const structure = this.mindStructureFromTarget(event.target);
    if (!structure) return false;
    event.preventDefault();
    event.stopPropagation();
    this.editMindStructure(structure);
    return true;
  },

  /*
   * 开始拖拽关联端点或贝塞尔控制点手柄。
   * 端点拖动吸附同一主题的 8 个锚点；曲线手柄读取 control1/control2 和路径起终点，
   * 在 document 上注册全局 pointermove/pointerup 以支持跨元素拖拽。
   */
  handleStructureControlPointerDown(event) {
    const endpointHandle = event.target?.closest?.(
      '.yonxao-mindmap-relation-endpoint-hit-target, .yonxao-mindmap-relation-endpoint-handle'
    );
    if (endpointHandle && event.button === 0) {
      const structure = this.mindStructureFromTarget(endpointHandle);
      if (!structure || structure.type !== 'relation') return false;
      event.preventDefault();
      event.stopPropagation();
      const endpoint =
        endpointHandle.getAttribute('data-relation-endpoint') === 'to' ? 'to' : 'from';
      this.beginStructureControlDrag({
        kind: 'anchor',
        structure,
        endpoint,
        changed: false,
      });
      this.svgEl?.classList.add('is-dragging-relation-endpoint');
      return true;
    }
    const handle = event.target?.closest?.('.yonxao-mindmap-relation-control-handle');
    if (!handle || event.button !== 0) return false;
    const structure = this.mindStructureFromTarget(handle);
    if (!structure || structure.type !== 'relation') return false;

    event.preventDefault();
    event.stopPropagation();
    this.beginStructureControlDrag({
      kind: 'control',
      structure,
      controlKey: handle.getAttribute('data-structure-control') === '2' ? 'control2' : 'control1',
      start: {
        x: Number(handle.getAttribute('data-route-start-x')),
        y: Number(handle.getAttribute('data-route-start-y')),
      },
      end: {
        x: Number(handle.getAttribute('data-route-end-x')),
        y: Number(handle.getAttribute('data-route-end-y')),
      },
    });
    return true;
  },

  /*
   * 初始化拖拽状态并在 document 上注册全局 pointermove/pointerup 监听。
   * 端点拖拽和曲线控制柄拖拽共用此入口，避免重复的事件绑定代码。
   */
  beginStructureControlDrag(dragState) {
    const onMove = (moveEvent) => this.handleStructureControlPointerMove(moveEvent);
    const onUp = (upEvent) => this.finishStructureControlDrag(upEvent);
    dragState.onMove = onMove;
    dragState.onUp = onUp;
    this.structureControlDragState = dragState;
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
  },

  /*
   * 拖拽控制点过程中：将指针位置投影到起终点线段上，计算比例（ratio）和法向偏移（offset）。
   * ratio 表示控制点在起终点连线上的位置百分比，offset 表示偏离连线的垂直距离。
   * 存储格式如 "0.500,15.0"（ratio,offset）。
   * 每次变化后即时重绘以提供视觉反馈。
   */
  handleStructureControlPointerMove(event) {
    const state = this.structureControlDragState;
    if (!state) return;
    event.preventDefault();
    const point = this.clientPointToSvg(event.clientX, event.clientY);
    if (state.kind === 'anchor') {
      const topicIndex = state.endpoint === 'to' ? 1 : 0;
      const topic = this.topicForStableId(state.structure.topicIds[topicIndex]);
      const nearestAnchor = topic?._layout ? nearestRelationAnchor(topic._layout, point) : null;
      if (!nearestAnchor) return;
      const attributeName = `${state.endpoint}Anchor`;
      if (state.structure.attributes[attributeName] === nearestAnchor.name) return;
      state.structure.attributes[attributeName] = nearestAnchor.name;
      state.changed = true;
      this.renderMap(false);
      return;
    }
    const dx = state.end.x - state.start.x;
    const dy = state.end.y - state.start.y;
    const lengthSquared = dx * dx + dy * dy || 1;
    const length = Math.sqrt(lengthSquared);
    // 计算投影比例：点在起点方向向量上的投影长度 / 向量长度平方
    const pointDx = point.x - state.start.x;
    const pointDy = point.y - state.start.y;
    const ratio = (pointDx * dx + pointDy * dy) / lengthSquared;
    // 计算法向偏移：点到向量的垂直距离（带方向）
    const offset = (pointDx * -dy + pointDy * dx) / length;
    state.structure.attributes[state.controlKey] = `${ratio.toFixed(3)},${offset.toFixed(1)}`;
    this.renderMap(false);
  },

  /*
   * 完成控制点拖拽：保存最终结果到文件，选中当前结构。
   */
  async finishStructureControlDrag(event) {
    const state = this.structureControlDragState;
    if (!state) return;
    event.preventDefault();
    const structure = state.structure;
    this.cancelStructureControlDrag();
    if (state.kind === 'anchor' && !state.changed) {
      this.selectedStructureId = structure.id;
      return;
    }
    await this.saveTreeToSourceAndFile(this.t('notice.structureControlAdjusted'));
    this.selectedStructureId = structure.id;
  },

  /*
   * 取消控制点拖拽：清理 document 级别的事件监听和拖拽状态。
   * 注意：cancel 不会回滚 control1/control2 的中间值，已在 handleStructureControlPointerMove 中即时写入。
   */
  cancelStructureControlDrag() {
    const state = this.structureControlDragState;
    if (!state) return;
    document.removeEventListener('pointermove', state.onMove, true);
    document.removeEventListener('pointerup', state.onUp, true);
    document.removeEventListener('pointercancel', state.onUp, true);
    if (state.kind === 'anchor') {
      this.svgEl?.classList.remove('is-dragging-relation-endpoint');
    }
    this.structureControlDragState = null;
  },

  /*
   * 主题增删或移动后清理所有引用了失效主题的结构。
   * 清理策略：
   * 1. 收集当前所有主题的稳定 ID
   * 2. 过滤掉 topicIds 中已不存在的引用
   * 3. 过滤掉主题数不满足最低要求的结构（外框 >=1，关联/概要 >=2）
   * 4. 对每个结构单独执行 validateMindStructures 校验，未通过则移除
   * 注意：循环依赖的结构也可能被清理掉。
   */
  cleanupStructuresAfterTopicChange() {
    const validIds = new Set();
    const visit = (topic) => {
      if (topic.attributes?.id) validIds.add(topic.attributes.id);
      for (const child of topic.subtopics || []) visit(child);
    };
    visit(this.root);
    // 先移除失效引用，再过滤不满足最低数量或校验的结构
    this.structures = this.structures
      .map((structure) => ({
        ...structure,
        topicIds: structure.topicIds.filter((id) => validIds.has(id)),
      }))
      .filter((structure) => structure.topicIds.length >= (structure.type === 'boundary' ? 1 : 2))
      .filter((structure) => {
        try {
          validateMindStructures(this.root, [structure]);
          return true;
        } catch (_error) {
          return false;
        }
      });
  },

  /*
   * 通过稳定 ID 查找主题树中的对应主题。
   * 委托给 findTopicByStableId（来自 rendererShared），因为需要递归遍历。
   */
  topicForStableId(id) {
    return findTopicByStableId(this.root, id);
  },
};
