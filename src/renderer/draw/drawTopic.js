/*
 * 文件作用：
 * 主题绘制方法集合，负责主题背景、边框、图标和文本 SVG。
 *
 * 实现逻辑：
 * 读取主题布局盒、主题属性和主题色系，生成可交互的 topic group。
 *
 * 调用链：
 * mapRendererMethods -> topicDrawMethods -> renderIcon/theme helpers。
 */

import { MarkdownRenderer } from 'obsidian';

import {
  DEFAULT_TOPIC_BUTTON_COLOR,
  Notice,
  TOPIC_PADDING_X,
  renderIcon,
  themeTopicFillAlpha,
  topicColor,
  transparentColor,
  svg,
} from '../../shared/rendererShared.js';
import {
  TOPIC_CODE_BLOCK_PADDING_X,
  TOPIC_CODE_BLOCK_PADDING_Y,
  TOPIC_RICH_BLOCK_TYPES,
  topicRichTextLinkMarker,
} from '../../utils/richText.js';
import { fishboneHeadSideForLayout } from '../../layout/layoutTypes.js';

const BRAND_HIGHLIGHT_POSITIONS = new Set([0, 3, 7, 11]);
const UNORDERED_LIST_MARKER_SOLID_RADIUS = 2.4;
const UNORDERED_LIST_MARKER_HOLLOW_RADIUS = 2.6;
const UNORDERED_LIST_MARKER_SQUARE_SIZE = 4.4;
const UNORDERED_LIST_MARKER_CENTER_OFFSET_RATIO = 0.28;
const CODE_BLOCK_MIN_RENDER_WIDTH = 48;
const CODE_BLOCK_TEXT_ASCENT_RATIO = 0.75;
const EQUATION_RENDER_WAIT_MS = 600;
// 图片尺寸跨 renderer 缓存上限，防止长时间使用 Obsidian 时资源记录无限增长。
const TOPIC_IMAGE_NATURAL_SIZE_CACHE_LIMIT = 128;
// 任务复选框的可点击方框边长，和列表行高解耦，避免字号变化时方框过大。
const TASK_CHECKBOX_SIZE = 11;
// 任务复选框的圆角半径，只影响视觉，不参与布局测量。
const TASK_CHECKBOX_RADIUS = 2;
// 任务完成状态的对勾路径，坐标基于 TASK_CHECKBOX_SIZE 的局部 11x11 视图。
const TASK_CHECKMARK_PATH = 'M3 6l2 2 4-5';
// 文本基线到视觉中心的估算比例，用于让复选框和同一行文字垂直居中。
const TASK_TEXT_CENTER_FROM_BASELINE_RATIO = 0.36;
const IMAGE_BLOCK_CORNER_RADIUS = 6;
const IMAGE_BLOCK_CAPTION_GAP = 5;
const TOPIC_TAG_COLORS = Object.freeze([
  '#3b82f6',
  '#22c55e',
  '#ef4444',
  '#a855f7',
  '#06b6d4',
  '#f59e0b',
  '#ec4899',
  '#475569',
  '#14b8a6',
  '#818cf8',
  '#84cc16',
  '#fb923c',
  '#38bdf8',
  '#c084fc',
  '#f87171',
  '#34d399',
]);
const TOPIC_TAG_HASH_SEED = 2166136261;
const TOPIC_TAG_HASH_PRIME = 16777619;
const TOPIC_ADORNMENT_BUTTON_SIZE = 18;
const TOPIC_ADORNMENT_BUTTON_GAP = 4;
const TOPIC_ADORNMENT_LANE_GAP = 6;
const TOPIC_ADORNMENT_ICON_TRANSFORM = 'translate(-6 -6) scale(0.5)';
const TOPIC_ADORNMENT_NOTE_PATH = 'M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z';
const TOPIC_ADORNMENT_ATTACHMENT_PATH =
  'M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48';
const TOPIC_ADORNMENT_POPOVER_OFFSET = 8;
const TOPIC_ADORNMENT_POPOVER_VIEWPORT_GAP = 12;
const TOPIC_ADORNMENT_POPOVER_HIDE_DELAY_MS = 180;
const MISSING_IMAGE_PLACEHOLDER_WIDTH = 118;
const MISSING_IMAGE_PLACEHOLDER_HEIGHT = 54;

function splitObsidianLinkTarget(href) {
  const text = String(href || '').trim();
  const hashIndex = text.indexOf('#');
  if (hashIndex === -1) {
    return { linkpath: text, subpath: '' };
  }
  return {
    linkpath: text.slice(0, hashIndex).trim(),
    subpath: text.slice(hashIndex + 1).trim(),
  };
}

function normalizeObsidianHeadingText(text) {
  const source = String(text || '');
  let decoded;
  try {
    decoded = decodeURIComponent(source);
  } catch (_error) {
    decoded = source;
  }
  return decoded.replace(/^#+/, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export const topicDrawMethods = {
  applyTopicButtonColorVariable(element, topic, color = topicColor(topic, this.config)) {
    if (!element || this.config.button?.colorMode !== 'topic') return;
    // topic 模式下按钮颜色来自当前主题色；主题本体也写入该变量，供键盘焦点描边复用同一配色。
    element.style.setProperty('--yonxao-mindmap-button-color', color || DEFAULT_TOPIC_BUTTON_COLOR);
  },

  renderTopic(topic) {
    const box = topic._layout;
    const canEdit = this.canEditMindMap();
    const color = topicColor(topic, this.config);
    const classNames = ['yonxao-mindmap-topic'];
    if (topic.subtopics.length) classNames.push('yonxao-mindmap-topic-clickable');
    if (canEdit && !topic._virtual && topic !== this.root) {
      classNames.push('yonxao-mindmap-topic-draggable');
    }
    if (!color) {
      classNames.push('yonxao-mindmap-topic-default');
    }
    if (this.isTreeTableBox(box)) {
      classNames.push('yonxao-mindmap-topic-tree-table');
    }
    if (this.isTreeTableRootBox(box)) {
      classNames.push('yonxao-mindmap-topic-tree-table-root');
    }
    if (topic.id && topic.id === this.focusedTopicId) {
      classNames.push('is-keyboard-focused');
    }
    // 主题被高级结构选中时加上标记 class，CSS 据此绘制虚线边框以区分于键盘焦点。
    if (this.structureSelection?.topicIds?.has(topic.id)) {
      classNames.push('is-structure-selected');
    }

    // 每个主题都是一个 <g> 分组，组上保存 data-topic-id，点击时用它反查原始树主题。
    const group = svg('g', {
      class: classNames.join(' '),
      transform: `translate(${box.x - box.width / 2} ${box.y - box.height / 2})`,
      'data-topic-id': topic.id,
    });

    this.applyTopicButtonColorVariable(group, topic, color);

    const fill = color
      ? transparentColor(color, themeTopicFillAlpha(this.config))
      : 'var(--background-primary)';
    const stroke = color || 'var(--yonxao-mindmap-default-topic-border)';

    group.appendChild(
      svg('rect', {
        class: 'yonxao-mindmap-topic-card',
        width: box.width,
        height: box.height,
        rx: this.isTreeTableBox(box) ? 0 : 8,
        fill,
        stroke,
      })
    );

    if (box.icon) {
      group.appendChild(
        renderIcon(box.icon, TOPIC_PADDING_X, (box.height - box.iconSize) / 2, color, box.iconSize)
      );
    }

    if (Array.isArray(box.richBlocks) && box.richBlocks.length) {
      group.appendChild(this.renderTopicRichBlocks(topic, box));
    } else {
      group.appendChild(this.renderLegacyTopicText(box));
    }

    if (Array.isArray(box.adornments) && box.adornments.length) {
      group.appendChild(this.renderTopicAdornments(topic, box));
    }

    return group;
  },

  renderLegacyTopicText(box) {
    const textX = this.topicTextAnchorX(box);
    const textEl = this.createTopicTextElement(box, {
      x: textX,
      y: box.textY,
      font: box.font,
      textAnchor: this.topicTextAnchor(box),
    });

    for (let index = 0; index < box.lines.length; index += 1) {
      const line = box.lines[index];
      const richLine = box.richLines?.[index];

      if (this.isPlainYonxaoMindmapLine(line, richLine)) {
        this.appendYonxaoMindmapBrandLine(textEl, box, index, { x: textX });
      } else if (Array.isArray(richLine) && richLine.length) {
        this.appendRichTopicTextLine(textEl, richLine, box, index, { x: textX });
      } else {
        const tspan = svg('tspan', {
          x: textX,
          dy: index === 0 ? 0 : box.font.lineHeight,
        });
        tspan.textContent = line;
        textEl.appendChild(tspan);
      }
    }

    return textEl;
  },

  /*
   * 渲染主题的块级格式内容（列表、代码块、公式、段落），按布局阶段计算好的 block 数组
   * 依次绘制到 SVG <g> 分组中。
   */
  renderTopicRichBlocks(topic, box) {
    const contentGroup = svg('g', { class: 'yonxao-mindmap-topic-rich-content' });
    let cursorY = Number(box.textTop) || 0;

    for (const block of box.richBlocks) {
      if (
        block.type === TOPIC_RICH_BLOCK_TYPES.NOTE ||
        block.type === TOPIC_RICH_BLOCK_TYPES.ATTACHMENT
      ) {
        continue;
      }
      cursorY += Number(block.gapBefore) || 0;
      if (block.type === TOPIC_RICH_BLOCK_TYPES.LIST) {
        this.appendTopicListBlock(contentGroup, block, box, cursorY, topic);
      } else if (block.type === TOPIC_RICH_BLOCK_TYPES.IMAGE) {
        this.appendTopicImageBlock(contentGroup, block, box, cursorY);
      } else if (block.type === TOPIC_RICH_BLOCK_TYPES.CODE) {
        this.appendTopicCodeBlock(contentGroup, block, box, cursorY);
      } else if (block.type === TOPIC_RICH_BLOCK_TYPES.EQUATION) {
        this.appendTopicEquationBlock(contentGroup, block, box, cursorY, topic);
      } else {
        this.appendTopicParagraphBlock(contentGroup, block, box, cursorY);
      }
      cursorY += Number(block.height) || 0;
    }

    return contentGroup;
  },

  /*
   * 渲染主题右侧的备注/附件装饰按钮列。
   *
   * 每个备注或附件生成一个圆形图标按钮，hover/focus 时弹出浮层显示详情。
   * 按钮从右到左排列在主题卡片的 adornment lane 中。
   * 点击附件按钮直接尝试打开附件；点击备注按钮切换浮层固定态。
   */
  renderTopicAdornments(topic, box) {
    const adornments = Array.isArray(box.adornments) ? box.adornments : [];
    const group = svg('g', { class: 'yonxao-mindmap-topic-adornments' });
    const laneWidth =
      Number(box.adornmentLaneWidth) ||
      TOPIC_ADORNMENT_LANE_GAP +
        adornments.length * TOPIC_ADORNMENT_BUTTON_SIZE +
        Math.max(0, adornments.length - 1) * TOPIC_ADORNMENT_BUTTON_GAP;
    const startX =
      box.width -
      TOPIC_PADDING_X -
      laneWidth +
      TOPIC_ADORNMENT_LANE_GAP +
      TOPIC_ADORNMENT_BUTTON_SIZE / 2;
    const centerY = box.height / 2;

    adornments.forEach((block, index) => {
      const button = svg('g', {
        class: `yonxao-mindmap-topic-adornment is-${block.type}`,
        transform: `translate(${startX + index * (TOPIC_ADORNMENT_BUTTON_SIZE + TOPIC_ADORNMENT_BUTTON_GAP)} ${centerY})`,
        'data-topic-id': topic?.id || '',
        tabindex: '0',
      });
      button.appendChild(
        svg('rect', {
          class: 'yonxao-mindmap-topic-adornment-button',
          x: -TOPIC_ADORNMENT_BUTTON_SIZE / 2,
          y: -TOPIC_ADORNMENT_BUTTON_SIZE / 2,
          width: TOPIC_ADORNMENT_BUTTON_SIZE,
          height: TOPIC_ADORNMENT_BUTTON_SIZE,
          rx: 5,
        })
      );
      button.appendChild(
        svg('path', {
          class: 'yonxao-mindmap-topic-adornment-icon',
          d:
            block.type === TOPIC_RICH_BLOCK_TYPES.ATTACHMENT
              ? TOPIC_ADORNMENT_ATTACHMENT_PATH
              : TOPIC_ADORNMENT_NOTE_PATH,
          transform: TOPIC_ADORNMENT_ICON_TRANSFORM,
        })
      );

      this.registerDomEvent(button, 'mouseenter', () => {
        this.showTopicAdornmentPopover(button, block);
      });
      this.registerDomEvent(button, 'mouseleave', () => {
        this.scheduleHideTopicAdornmentPopover();
      });
      this.registerDomEvent(button, 'focus', () => {
        this.showTopicAdornmentPopover(button, block);
      });
      this.registerDomEvent(button, 'blur', () => {
        this.scheduleHideTopicAdornmentPopover();
      });
      this.registerDomEvent(button, 'click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (block.type === TOPIC_RICH_BLOCK_TYPES.ATTACHMENT) {
          if (this.openTopicAttachment(block)) return;
        }
        this.showTopicAdornmentPopover(button, block, { pinned: true });
      });

      group.appendChild(button);
    });

    return group;
  },

  /*
   * 显示主题装饰按钮（备注/附件）的浮层。
   * 浮层根据按钮所在列位置自动选择显示在列上方或下方，
   * 避免左右弹出时覆盖相邻按钮。
   * pinned 选项用于点击附件时的固定态浮层。
   */
  showTopicAdornmentPopover(anchorEl, block, options = {}) {
    if (!anchorEl || !block) return;
    if (this.topicAdornmentHideTimer) {
      window.clearTimeout(this.topicAdornmentHideTimer);
      this.topicAdornmentHideTimer = null;
    }
    this.hideTopicAdornmentPopover();

    const popover = document.createElement('div');
    popover.className = `yonxao-mindmap-topic-adornment-popover is-${block.type}`;
    if (options.pinned) popover.classList.add('is-pinned');

    if (block.type === TOPIC_RICH_BLOCK_TYPES.ATTACHMENT) {
      popover.appendChild(this.createTopicAttachmentPopoverContent(block));
    } else {
      const body = document.createElement('div');
      body.className = 'yonxao-mindmap-topic-adornment-popover-body';
      body.textContent = block.text || block.source || '';
      popover.appendChild(body);
    }
    (this._bodyFloatContainer?.() || document.body).appendChild(popover);
    this.topicAdornmentPopoverEl = popover;
    this.topicAdornmentAnchorEl = anchorEl;
    this.ensureTopicAdornmentDocumentClickHandler();
    this.positionTopicAdornmentPopover(anchorEl, popover);

    popover.addEventListener('mouseenter', () => {
      if (this.topicAdornmentHideTimer) {
        window.clearTimeout(this.topicAdornmentHideTimer);
        this.topicAdornmentHideTimer = null;
      }
    });
    popover.addEventListener('mouseleave', () => {
      this.scheduleHideTopicAdornmentPopover();
    });
  },

  createTopicAttachmentPopoverContent(block) {
    const content = document.createElement('div');
    content.className = 'yonxao-mindmap-topic-attachment-popover-content';

    const label = document.createElement('div');
    label.className = 'yonxao-mindmap-topic-attachment-label';
    label.textContent = block.title || block.label || block.source || 'Attachment';
    content.appendChild(label);

    const source = document.createElement('div');
    source.className = 'yonxao-mindmap-topic-attachment-source';
    source.textContent = block.source || '';
    content.appendChild(source);

    const actions = document.createElement('div');
    actions.className = 'yonxao-mindmap-topic-attachment-actions';
    const openButton = document.createElement('button');
    openButton.className = 'yonxao-mindmap-topic-attachment-action';
    openButton.type = 'button';
    openButton.textContent = this.t('attachment.open');
    openButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openTopicAttachment(block);
    });

    const copyButton = document.createElement('button');
    copyButton.className = 'yonxao-mindmap-topic-attachment-action';
    copyButton.type = 'button';
    copyButton.textContent = this.t('attachment.copy');
    copyButton.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await this.copyTopicAttachment(block);
    });

    actions.appendChild(openButton);
    actions.appendChild(copyButton);
    content.appendChild(actions);
    return content;
  },

  /*
   * 打开附件：外部 URL（http/mailto/obsidian/file 协议）直接用浏览器打开；
   * Obsidian 内部附件先通过 metadataCache 确认目标存在，
   * 避免 openLinkText 自动创建不存在的文档。
   * 目标不存在时只提示，不调用会自动创建文档的打开路径。
   */
  openTopicAttachment(block) {
    const source = String(block?.source || '').trim();
    if (!source) {
      new Notice(this.t('notice.attachmentMissing'));
      return false;
    }

    if (/^(?:https?:|mailto:|obsidian:|file:)/i.test(source)) {
      window.open(source, '_blank', 'noopener');
      return true;
    }

    const sourcePath = this.ctx?.sourcePath || '';
    const linkedFile = this.plugin?.app?.metadataCache?.getFirstLinkpathDest?.(source, sourcePath);
    if (!linkedFile) {
      new Notice(this.t('notice.attachmentMissing'));
      return false;
    }

    this.plugin?.app?.workspace?.openLinkText?.(source, sourcePath);
    return true;
  },

  /*
   * 复制附件地址到系统剪贴板。
   */
  async copyTopicAttachment(block) {
    const source = String(block?.source || '').trim();
    if (!source || !navigator.clipboard?.writeText) {
      new Notice(this.t('notice.attachmentCopyUnsupported'));
      return false;
    }
    await navigator.clipboard.writeText(source);
    new Notice(this.t('notice.attachmentCopied'));
    return true;
  },

  ensureTopicAdornmentDocumentClickHandler() {
    if (this.topicAdornmentDocumentClickInstalled) return;
    this.topicAdornmentDocumentClickInstalled = true;
    this.registerDomEvent(document, 'click', (event) => {
      if (!this.topicAdornmentPopoverEl) return;
      if (
        this.topicAdornmentPopoverEl.contains(event.target) ||
        this.topicAdornmentAnchorEl?.contains?.(event.target)
      ) {
        return;
      }
      this.hideTopicAdornmentPopover();
    });
  },

  positionTopicAdornmentPopover(anchorEl, popover) {
    const anchorRect = anchorEl.getBoundingClientRect();
    const laneRect =
      anchorEl.closest?.('.yonxao-mindmap-topic-adornments')?.getBoundingClientRect?.() ||
      anchorRect;
    const popoverRect = popover.getBoundingClientRect();
    const laneCenterX = laneRect.left + laneRect.width / 2;
    const left = Math.min(
      Math.max(TOPIC_ADORNMENT_POPOVER_VIEWPORT_GAP, laneCenterX - popoverRect.width / 2),
      window.innerWidth - popoverRect.width - TOPIC_ADORNMENT_POPOVER_VIEWPORT_GAP
    );
    const topSpace = laneRect.top - TOPIC_ADORNMENT_POPOVER_VIEWPORT_GAP;
    const bottomSpace = window.innerHeight - laneRect.bottom - TOPIC_ADORNMENT_POPOVER_VIEWPORT_GAP;
    const showAbove =
      topSpace >= popoverRect.height + TOPIC_ADORNMENT_POPOVER_OFFSET || topSpace >= bottomSpace;
    const rawTop = showAbove
      ? laneRect.top - popoverRect.height - TOPIC_ADORNMENT_POPOVER_OFFSET
      : laneRect.bottom + TOPIC_ADORNMENT_POPOVER_OFFSET;
    const top = Math.min(
      Math.max(TOPIC_ADORNMENT_POPOVER_VIEWPORT_GAP, rawTop),
      window.innerHeight - popoverRect.height - TOPIC_ADORNMENT_POPOVER_VIEWPORT_GAP
    );
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
  },

  scheduleHideTopicAdornmentPopover() {
    if (this.topicAdornmentHideTimer) {
      window.clearTimeout(this.topicAdornmentHideTimer);
    }
    this.topicAdornmentHideTimer = window.setTimeout(() => {
      this.topicAdornmentHideTimer = null;
      this.hideTopicAdornmentPopover();
    }, TOPIC_ADORNMENT_POPOVER_HIDE_DELAY_MS);
  },

  hideTopicAdornmentPopover() {
    if (this.topicAdornmentHideTimer) {
      window.clearTimeout(this.topicAdornmentHideTimer);
      this.topicAdornmentHideTimer = null;
    }
    if (!this.topicAdornmentPopoverEl) return;
    this.topicAdornmentPopoverEl.remove();
    this.topicAdornmentPopoverEl = null;
    this.topicAdornmentAnchorEl = null;
  },

  /*
   * 渲染段落块：将布局阶段换行后的多行文本逐行写入 SVG <text>。
   * 每行可以是纯文本或带局部样式（加粗/颜色等）的样式片段。
   */
  appendTopicParagraphBlock(contentGroup, block, box, top) {
    const textX = this.topicTextAnchorX(box);
    const textEl = this.createTopicTextElement(box, {
      x: textX,
      y: this.topicTextBlockFirstBaseline(box, top, box.font),
      font: box.font,
      textAnchor: this.topicTextAnchor(box),
    });

    for (let index = 0; index < block.lines.length; index += 1) {
      const line = block.lines[index];
      const plainLine = line.map((segment) => segment.text).join('');
      if (this.isPlainYonxaoMindmapLine(plainLine, line)) {
        this.appendYonxaoMindmapBrandLine(textEl, box, index, { x: textX });
      } else {
        this.appendRichTopicTextLine(textEl, line, box, index, { x: textX });
      }
    }

    contentGroup.appendChild(textEl);
  },

  /*
   * 渲染列表块：处理有序和无序列表项，每项包含编号/项目符号和文本内容。
   * 有序列表显示编号（如 1. 2. 3.），无序列表按层级显示不同形状的符号。
   */
  appendTopicListBlock(contentGroup, block, box, top, topic) {
    const listGroup = svg('g', { class: 'yonxao-mindmap-topic-list-block' });
    const listLineHeight = Number(block.lineHeight) || Number(box.font.lineHeight) || 20;
    const listFont = { ...box.font, lineHeight: listLineHeight };
    const textEl = this.createTopicTextElement(box, {
      x: box.textX,
      y: this.topicTextBlockFirstBaseline(box, top, listFont),
      font: listFont,
    });
    let lineIndex = 0;

    for (const item of block.items) {
      for (let index = 0; index < item.lines.length; index += 1) {
        const dy = lineIndex === 0 ? 0 : listLineHeight;
        if (index === 0) {
          if (item.task) {
            this.appendTopicTaskMarker(listGroup, item, box, top, lineIndex, listFont, topic);
          } else if (item.ordered) {
            // 有序列表：在指定偏移处绘制编号文本
            const marker = svg('tspan', {
              x: box.textX + item.markerXOffset,
              dy,
              class: 'yonxao-mindmap-topic-list-marker is-ordered',
            });
            marker.textContent = item.markerText;
            textEl.appendChild(marker);
          } else {
            // 无序列表：根据层级绘制不同形状的符号（实心圆、空心圆、方框）
            this.appendTopicUnorderedListMarker(listGroup, item, box, top, lineIndex, listFont);
          }
          this.appendRichTopicTextLineAt(textEl, item.lines[index], box, {
            x: box.textX + item.textXOffset,
            dy: item.ordered ? undefined : dy,
            font: listFont,
          });
        } else {
          // 列表项的多行文本：后续行继续沿用相同的文本偏移
          this.appendRichTopicTextLineAt(textEl, item.lines[index], box, {
            x: box.textX + item.textXOffset,
            dy,
            font: listFont,
          });
        }
        lineIndex += 1;
      }
    }

    listGroup.appendChild(textEl);
    contentGroup.appendChild(listGroup);
  },

  /*
   * 渲染单个任务项的复选框。
   *
   * 这个方法不仅画方框和对勾，还在可编辑导图中把复选框升级为轻量交互控件。
   * 点击时只局部更新当前 SVG，再通过 toggleTopicTaskItem() 写回 Markdown。
   */
  appendTopicTaskMarker(listGroup, item, box, top, lineIndex, listFont = box.font, topic = null) {
    // markerWidth 是布局阶段给列表 marker 预留的宽度，复选框需要在这个宽度内水平居中。
    const markerWidth = Number(item.markerWidth) || TASK_CHECKBOX_SIZE;
    // lineHeight 决定当前列表行的垂直步进，用于从列表块顶部推算当前任务所在行。
    const lineHeight = Number(listFont.lineHeight) || Number(box.font.lineHeight) || 20;
    // fontSize 用于估算文本视觉中心，避免复选框按基线对齐后看起来偏下。
    const fontSize = Number(listFont.size) || Number(box.font.size) || 16;
    // x 是复选框左上角横坐标：主题文本起点 + 列表缩进 + marker 区域内居中偏移。
    const x = box.textX + item.markerXOffset + (markerWidth - TASK_CHECKBOX_SIZE) / 2;
    // baseline 是当前列表行文字的基线坐标，复选框需要围绕文字视觉中心摆放。
    const baseline = this.topicTextBlockFirstBaseline(box, top, listFont) + lineIndex * lineHeight;
    // textCenterY 是当前行文字的近似视觉中心，不等同于 SVG 文本基线。
    const textCenterY = baseline - fontSize * TASK_TEXT_CENTER_FROM_BASELINE_RATIO;
    // y 是复选框左上角纵坐标，基于文字视觉中心向上偏移半个方框高度。
    const y = textCenterY - TASK_CHECKBOX_SIZE / 2;
    /*
     * 任务复选框只在导图可编辑时变成真正的交互控件。
     * 阅读视图仍渲染普通 SVG 图形，避免用户以为点击会改动 Markdown。
     */
    const canToggle = Boolean(
      topic &&
      !topic._virtual &&
      this.canEditMindMap() &&
      Number.isInteger(Number(item.sourceLineIndex)) &&
      Number(item.sourceLineIndex) >= 0
    );
    const markerGroup = svg('g', {
      class: `yonxao-mindmap-topic-task-marker${canToggle ? ' is-clickable' : ''}`,
      // 只有可编辑状态才声明 checkbox 语义；阅读视图中它只是普通图形。
      role: canToggle ? 'checkbox' : undefined,
      // aria-checked 和视觉状态保持一致，局部切换时也会同步更新。
      'aria-checked': canToggle ? String(Boolean(item.checked)) : undefined,
      // 只有可编辑状态才进入 Tab 顺序，避免阅读视图出现不能操作的焦点目标。
      tabindex: canToggle ? '0' : undefined,
      // 局部切换时需要复用对勾路径的位置，不重新计算或重绘整张导图。
      'data-check-transform': `translate(${x} ${y})`,
    });

    markerGroup.appendChild(
      svg('rect', {
        class: `yonxao-mindmap-topic-task-box${item.checked ? ' is-checked' : ''}`,
        x,
        y,
        width: TASK_CHECKBOX_SIZE,
        height: TASK_CHECKBOX_SIZE,
        rx: TASK_CHECKBOX_RADIUS,
      })
    );

    // 初始状态如果已经完成，就直接绘制对勾；未完成任务只保留空方框。
    if (item.checked) {
      markerGroup.appendChild(
        svg('path', {
          class: 'yonxao-mindmap-topic-task-check',
          d: TASK_CHECKMARK_PATH,
          transform: `translate(${x} ${y})`,
        })
      );
    }

    // 只有可编辑导图才绑定点击事件；阅读视图点击任务框不改 Markdown。
    if (canToggle) {
      this.registerDomEvent(markerGroup, 'click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        // 如果上一次点击还在保存，忽略连续点击，避免多个异步保存互相覆盖。
        if (markerGroup.classList.contains('is-saving')) return;

        // previousChecked 是失败回滚的来源，必须在乐观更新前读取。
        const previousChecked = markerGroup.getAttribute('aria-checked') === 'true';
        // nextChecked 是本次点击期望写入 Markdown 的目标状态。
        const nextChecked = !previousChecked;
        // is-saving 用于阻止并发点击，aria-busy 用于暴露当前控件正在保存。
        markerGroup.classList.add('is-saving');
        markerGroup.setAttribute('aria-busy', 'true');
        // 先做乐观视觉更新，让点击立即有反馈；保存失败时在 then/catch 中回滚。
        this.setTopicTaskMarkerVisualState(markerGroup, nextChecked);

        Promise.resolve(
          this.toggleTopicTaskItem(topic, Number(item.sourceLineIndex), {
            // 勾选状态不影响布局，避免主动 renderMap(true) 带来整图闪动。
            render: false,
            notice: false,
          })
        )
          .then((saved) => {
            // 保存入口返回 false 表示 Markdown 未写入成功，此时必须恢复点击前视觉状态。
            if (!saved) {
              this.setTopicTaskMarkerVisualState(markerGroup, previousChecked);
            }
          })
          .catch((error) => {
            this.setTopicTaskMarkerVisualState(markerGroup, previousChecked);
            new Notice(`yonxao-mindmap: ${error.message || String(error)}`);
          })
          .finally(() => {
            markerGroup.classList.remove('is-saving');
            markerGroup.removeAttribute('aria-busy');
          });
      });
    }

    listGroup.appendChild(markerGroup);
  },

  setTopicTaskMarkerVisualState(markerGroup, checked) {
    // markerGroup 不存在说明 SVG 已被 Obsidian 重建或当前控件已卸载，直接放弃局部更新。
    if (!markerGroup) return;

    // aria-checked 是当前复选框状态的语义来源，后续点击也从这里读取 previousChecked。
    markerGroup.setAttribute('aria-checked', String(Boolean(checked)));
    // 方框的 is-checked class 控制填充色和边框色。
    const boxEl = markerGroup.querySelector('.yonxao-mindmap-topic-task-box');
    boxEl?.classList.toggle('is-checked', Boolean(checked));

    // existingCheckEl 表示当前 SVG 里是否已经有对勾 path。
    const existingCheckEl = markerGroup.querySelector('.yonxao-mindmap-topic-task-check');
    // 切换为未完成时，移除对勾 path 即可，不需要重建整个列表文本。
    if (!checked) {
      existingCheckEl?.remove();
      return;
    }
    // 切换为完成且已有对勾时，不重复追加 path，避免 SVG 中出现多个重叠对勾。
    if (existingCheckEl) return;

    // 新增对勾只补当前复选框的 path，不触发布局、连线或主题文本重绘。
    markerGroup.appendChild(
      svg('path', {
        class: 'yonxao-mindmap-topic-task-check',
        d: TASK_CHECKMARK_PATH,
        transform: markerGroup.getAttribute('data-check-transform') || '',
      })
    );
  },

  /*
   * 渲染无序列表的项目符号。按层级循环使用三种形状：
   * level % 3 === 0 → 实心圆，level % 3 === 1 → 空心圆，level % 3 === 2 → 圆角方框。
   */
  appendTopicUnorderedListMarker(listGroup, item, box, top, lineIndex, listFont = box.font) {
    const level = Number(item.level) || 0;
    const markerWidth = Number(item.markerWidth) || 12;
    const lineHeight = Number(listFont.lineHeight) || Number(box.font.lineHeight) || 20;
    const fontSize = Number(listFont.size) || Number(box.font.size) || 16;
    const cx = box.textX + item.markerXOffset + markerWidth / 2;
    const cy =
      this.topicTextBlockFirstBaseline(box, top, listFont) +
      lineIndex * lineHeight -
      fontSize * UNORDERED_LIST_MARKER_CENTER_OFFSET_RATIO;

    if (level % 3 === 1) {
      listGroup.appendChild(
        svg('circle', {
          class: 'yonxao-mindmap-topic-list-marker-shape is-hollow',
          cx,
          cy,
          r: UNORDERED_LIST_MARKER_HOLLOW_RADIUS,
        })
      );
      return;
    }

    if (level % 3 === 2) {
      const size = UNORDERED_LIST_MARKER_SQUARE_SIZE;
      listGroup.appendChild(
        svg('rect', {
          class: 'yonxao-mindmap-topic-list-marker-shape is-square',
          x: cx - size / 2,
          y: cy - size / 2,
          width: size,
          height: size,
          rx: 0.8,
        })
      );
      return;
    }

    listGroup.appendChild(
      svg('circle', {
        class: 'yonxao-mindmap-topic-list-marker-shape is-solid',
        cx,
        cy,
        r: UNORDERED_LIST_MARKER_SOLID_RADIUS,
      })
    );
  },

  appendTopicImageBlock(contentGroup, block, box, top) {
    const imageGroup = svg('g', { class: 'yonxao-mindmap-topic-image-block' });
    const href = this.resolveTopicImageHref(block);
    const renderWidth = href
      ? block.imageWidth
      : Math.min(block.imageWidth, MISSING_IMAGE_PLACEHOLDER_WIDTH);
    const renderHeight = href
      ? block.imageHeight
      : Math.min(block.imageHeight, MISSING_IMAGE_PLACEHOLDER_HEIGHT);
    const imageX = box.textX + (block.imageWidth - renderWidth) / 2;
    const imageY = top + (block.imageHeight - renderHeight) / 2;
    this.registerDomEvent(imageGroup, 'dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openTopicImagePreview(block);
    });

    imageGroup.appendChild(
      svg('rect', {
        class: `yonxao-mindmap-topic-image-frame${href ? ' is-loaded' : ' is-missing'}`,
        x: imageX,
        y: imageY,
        width: renderWidth,
        height: renderHeight,
        rx: IMAGE_BLOCK_CORNER_RADIUS,
      })
    );

    if (href) {
      const imageEl = this.takeReusableTopicImageElement(href) || svg('image');
      const isReusedImage = imageEl.hasAttribute('data-image-loaded');
      const imageAttributes = {
        class: 'yonxao-mindmap-topic-image',
        'data-image-source': block.source || '',
        'data-image-href': href,
        x: imageX,
        y: imageY,
        width: renderWidth,
        height: renderHeight,
        preserveAspectRatio: 'xMidYMid meet',
      };
      for (const [attribute, value] of Object.entries(imageAttributes)) {
        imageEl.setAttribute(attribute, String(value));
      }
      // 复用元素的 href 保持不变，避免浏览器把同一资源重新加入加载队列。
      if (imageEl.getAttribute('href') !== href) imageEl.setAttribute('href', href);
      if (!isReusedImage) {
        this.registerDomEvent(imageEl, 'load', () => {
          imageEl.setAttribute('data-image-loaded', 'true');
          this.captureTopicImageNaturalSize(block, href);
        });
        this.registerDomEvent(imageEl, 'error', () => {
          imageEl.removeAttribute('data-image-loaded');
          imageEl.remove();
          imageGroup
            .querySelector('.yonxao-mindmap-topic-image-frame')
            ?.classList.remove('is-loaded');
          imageGroup
            .querySelector('.yonxao-mindmap-topic-image-frame')
            ?.classList.add('is-missing');
          this.appendTopicImagePlaceholder(
            imageGroup,
            block,
            box,
            imageX,
            imageY,
            renderWidth,
            renderHeight
          );
        });
      }
      imageGroup.appendChild(imageEl);
    } else {
      this.appendTopicImagePlaceholder(
        imageGroup,
        block,
        box,
        imageX,
        imageY,
        renderWidth,
        renderHeight
      );
    }

    if (block.captionLines?.length) {
      const captionFont = { ...box.font, size: Math.max(10, Math.round(box.font.size * 0.86)) };
      const captionText = this.createTopicTextElement(box, {
        x: imageX,
        y: top + block.imageHeight + IMAGE_BLOCK_CAPTION_GAP + captionFont.size,
        font: captionFont,
        className: 'yonxao-mindmap-topic-text yonxao-mindmap-topic-image-caption',
      });
      for (let index = 0; index < block.captionLines.length; index += 1) {
        this.appendRichTopicTextLineAt(captionText, block.captionLines[index], box, {
          x: imageX,
          dy: index === 0 ? 0 : captionFont.lineHeight,
          font: captionFont,
        });
      }
      imageGroup.appendChild(captionText);
    }

    contentGroup.appendChild(imageGroup);
  },

  /*
   * 收集当前画面中已经成功加载的图片元素，按实际资源地址建立一次性复用池。
   * 同一图片可能出现多次，因此每个地址保存数组并逐个消费。
   */
  collectReusableTopicImageElements() {
    const pool = new Map();
    for (const imageEl of this.mapEl?.querySelectorAll?.(
      '.yonxao-mindmap-topic-image[data-image-loaded="true"][data-image-href]'
    ) || []) {
      const href = imageEl.getAttribute('data-image-href') || '';
      if (!href) continue;
      if (!pool.has(href)) pool.set(href, []);
      pool.get(href).push(imageEl);
    }
    return pool.size ? pool : null;
  },

  /*
   * 取出一个与新图片资源完全一致的已加载元素。
   * 元素只在当前同步 renderMap() 中复用，避免旧 DOM 长期驻留。
   */
  takeReusableTopicImageElement(href) {
    const elements = this.topicImageElementPool?.get(href);
    if (!elements?.length) return null;
    const imageEl = elements.shift();
    if (!elements.length) this.topicImageElementPool.delete(href);
    return imageEl;
  },

  appendTopicImagePlaceholder(imageGroup, block, box, imageX, imageY, renderWidth, renderHeight) {
    const label = 'Missing image';
    const textEl = this.createTopicTextElement(box, {
      x: imageX + renderWidth / 2,
      y: imageY + renderHeight / 2 + box.font.size * 0.3,
      font: { ...box.font, size: Math.max(10, Math.round(box.font.size * 0.82)) },
      textAnchor: 'middle',
      className: 'yonxao-mindmap-topic-text yonxao-mindmap-topic-image-placeholder',
    });
    const tspan = svg('tspan', { x: imageX + renderWidth / 2 });
    tspan.textContent = label;
    textEl.appendChild(tspan);
    imageGroup.appendChild(textEl);
  },

  /*
   * 解析图片块中的资源地址为可渲染的 URL。
   * 外部 URL 直接返回；Obsidian 内部附件通过 metadataCache 解析为资源路径；
   * 目标不存在时返回空字符串，避免渲染破图。
   */
  resolveTopicImageHref(block) {
    const source = String(block?.source || '').trim();
    if (!source) return '';
    if (/^(?:https?:|data:|blob:|file:)/i.test(source)) return source;

    const app = this.plugin?.app;
    const sourcePath = this.ctx?.sourcePath || '';
    const linkedFile = app?.metadataCache?.getFirstLinkpathDest?.(source, sourcePath);
    if (linkedFile && typeof app?.vault?.getResourcePath === 'function') {
      return app.vault.getResourcePath(linkedFile);
    }

    return app?.metadataCache ? '' : source;
  },

  /*
   * 捕获图片的真实自然尺寸并缓存，触发一次重排使图片盒贴合真实比例。
   * 首次布局拿不到真实图片比例时先按语法或默认比例估算，
   * 图片加载出自然宽高后缓存比例并重排，减少上下/左右空边。
   */
  captureTopicImageNaturalSize(block, href) {
    const cacheKey = this.topicImageNaturalSizeKey(block, href);
    const sizeMemory = this.constructor.topicImageNaturalSizeMemory;
    if (!cacheKey || sizeMemory.has(cacheKey)) return;

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const width = Number(image.naturalWidth) || 0;
      const height = Number(image.naturalHeight) || 0;
      if (!width || !height || sizeMemory.has(cacheKey)) return;
      sizeMemory.set(cacheKey, { width, height });
      while (sizeMemory.size > TOPIC_IMAGE_NATURAL_SIZE_CACHE_LIMIT) {
        const oldestKey = sizeMemory.keys().next().value;
        if (oldestKey === undefined) break;
        sizeMemory.delete(oldestKey);
      }
      this.scheduleTopicImageNaturalSizeRelayout();
    };
    image.src = href;
  },

  topicImageNaturalSizeKey(block, href = '') {
    return String(href || block?.source || '').trim();
  },

  /*
   * 安排一次动画帧驱动的重排：图片自然尺寸加载后更新布局，
   * 如果当前处于 fit 模式还需要重新适配 viewBox，
   * 避免图片真实高度变大后沿用旧 viewBox 导致顶部或底部被截掉。
   */
  scheduleTopicImageNaturalSizeRelayout() {
    if (this.pendingTopicImageNaturalSizeFrame || this.isSourceMode) return;

    this.pendingTopicImageNaturalSizeFrame = window.requestAnimationFrame(() => {
      this.pendingTopicImageNaturalSizeFrame = null;
      if (!this.mapEl || this.isSourceMode) return;
      this.renderMap(false);
      // 初次打开时图片可能在 view fit 状态写入前完成加载；此时仍需按配置重新适配视口，
      // 否则图片真实尺寸扩大主题后会出现上/下边界被旧 viewBox 裁掉的情况。
      if (this.currentViewFitMode === 'fit' || this.config?.view?.fit === 'fit') {
        this.scheduleFitView();
      }
    });
  },

  /*
   * 打开图片预览浮层：双击图片块触发，覆盖在导图上方完整显示图片。
   * 浮层挂载到 _bodyFloatContainer 避免被全屏覆盖层遮挡。
   * 单击背景关闭；双击图片切换原始尺寸。
   */
  openTopicImagePreview(block) {
    const href = this.resolveTopicImageHref(block);
    if (!href) return;

    this.closeTopicImagePreview();

    const overlay = document.createElement('div');
    overlay.className = 'yonxao-mindmap-topic-image-preview-overlay';

    const image = document.createElement('img');
    image.className = 'yonxao-mindmap-topic-image-preview';
    image.src = href;
    image.alt = block?.alt || block?.source || 'Image';
    if (block?.sizeMode === 'original') {
      image.classList.add('is-original-size');
    }

    overlay.appendChild(image);
    (this._bodyFloatContainer?.() || document.body).appendChild(overlay);
    this.topicImagePreviewEl = overlay;

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) this.closeTopicImagePreview();
    });
    image.addEventListener('dblclick', (event) => {
      event.preventDefault();
      event.stopPropagation();
      image.classList.toggle('is-original-size');
    });
    if (!this.topicImagePreviewKeydownInstalled) {
      this.topicImagePreviewKeydownInstalled = true;
      this.registerDomEvent(window, 'keydown', (event) => {
        if (event.key === 'Escape') this.closeTopicImagePreview();
      });
    }
  },

  /*
   * 关闭图片预览浮层并清理 DOM 引用。
   */
  closeTopicImagePreview() {
    if (!this.topicImagePreviewEl) return;
    this.topicImagePreviewEl.remove();
    this.topicImagePreviewEl = null;
  },

  /*
   * 渲染代码块：绘制圆角背景矩形，然后在其内部用等宽字体逐行渲染代码文本。
   * 代码块宽度受主题最大宽度和 CODE_BLOCK_MAX_WIDTH 双重限制。
   */
  appendTopicCodeBlock(contentGroup, block, box, top) {
    const blockGroup = svg('g', { class: 'yonxao-mindmap-topic-code-block' });
    const rectWidth = Math.min(
      this.topicTextRightX(box) - box.textX,
      Math.max(block.width, CODE_BLOCK_MIN_RENDER_WIDTH)
    );
    blockGroup.appendChild(
      svg('rect', {
        class: 'yonxao-mindmap-topic-code-background',
        x: box.textX,
        y: top,
        width: rectWidth,
        height: block.height,
        rx: 5,
      })
    );

    const textEl = this.createTopicTextElement(box, {
      x: box.textX + TOPIC_CODE_BLOCK_PADDING_X,
      y: this.topicCodeBlockFirstBaseline(block, top),
      font: block.font,
      className: 'yonxao-mindmap-topic-text yonxao-mindmap-topic-code-text',
    });

    for (let index = 0; index < block.lines.length; index += 1) {
      this.appendRichTopicTextLineAt(textEl, block.lines[index], box, {
        x: box.textX + TOPIC_CODE_BLOCK_PADDING_X,
        dy: index === 0 ? 0 : block.font.lineHeight,
        font: block.font,
      });
    }

    blockGroup.appendChild(textEl);
    contentGroup.appendChild(blockGroup);
  },

  topicCodeBlockFirstBaseline(block, top) {
    const fontSize = Number(block?.font?.size) || 13;
    const lineHeight = Number(block?.font?.lineHeight) || Math.round(fontSize * 1.34);
    /*
     * 代码块测量使用 lineHeight + padding，SVG text 使用 baseline。
     * 这里用近似 ascent 把首行放回行盒中间，避免灰色背景底部看起来空一截。
     */
    return (
      top +
      TOPIC_CODE_BLOCK_PADDING_Y +
      Math.max(0, (lineHeight - fontSize) / 2) +
      fontSize * CODE_BLOCK_TEXT_ASCENT_RATIO
    );
  },

  /*
   * 渲染公式块：先用源码文本 fallback 绘制，再通过 foreignObject 委托
   * Obsidian 的 MarkdownRenderer 进行 MathJax 异步渲染。
   */
  appendTopicEquationBlock(contentGroup, block, box, top, topic) {
    const equationGroup = svg('g', { class: 'yonxao-mindmap-topic-equation-block' });
    const textEl = this.createTopicTextElement(box, {
      x: box.textX,
      y: this.topicTextBlockFirstBaseline(box, top, block.font || box.font),
      font: block.font || box.font,
      className: 'yonxao-mindmap-topic-text yonxao-mindmap-topic-equation-text',
    });

    for (let index = 0; index < block.lines.length; index += 1) {
      this.appendRichTopicTextLineAt(textEl, block.lines[index], box, {
        x: box.textX,
        dy: index === 0 ? 0 : block.font?.lineHeight || box.font.lineHeight,
        font: block.font || box.font,
      });
    }

    equationGroup.appendChild(textEl);
    this.appendRenderedEquationForeignObject(equationGroup, block, box, top, topic);
    contentGroup.appendChild(equationGroup);
  },

  /*
   * 通过 SVG foreignObject 嵌入 HTML，委托 Obsidian MarkdownRenderer 渲染公式。
   * 渲染结果由 MathJax 异步生成；渲染成功前保留源码文本 fallback，
   * 渲染完成后切换为 .is-equation-rendered 样式隐藏源码。
   */
  appendRenderedEquationForeignObject(equationGroup, block, box, top, topic) {
    if (!block.source || !this.plugin?.app || !MarkdownRenderer) return;

    const foreignObject = svg('foreignObject', {
      class: 'yonxao-mindmap-topic-equation-rendered',
      'data-equation-source': block.source,
      x: box.textX,
      y: top,
      width: Math.max(block.width, 40),
      height: Math.max(block.height, box.font.lineHeight),
    });
    const host = document.createElement('div');
    host.className = 'yonxao-mindmap-topic-equation-host markdown-rendered';
    const equationFontSize = Math.max(10, Number(block.font?.size) || Number(box.font.size) || 16);
    host.style.fontSize = `${equationFontSize}px`;
    host.style.setProperty('--font-text-size', `${equationFontSize}px`);
    foreignObject.appendChild(host);
    equationGroup.appendChild(foreignObject);

    const render = MarkdownRenderer.renderMarkdown || MarkdownRenderer.render;
    if (typeof render !== 'function') {
      foreignObject.remove();
      return;
    }

    // Obsidian/MathJax 可能异步插入内容；先绘制源码 fallback，再在渲染成功后切换显示。
    window.setTimeout(() => {
      if (!equationGroup.isConnected) return;
      const markdown = `$$\n${block.source}\n$$`;
      const sourcePath = this.ctx?.sourcePath || '';
      const renderPromise =
        render === MarkdownRenderer.render
          ? render.call(MarkdownRenderer, this.plugin.app, markdown, host, sourcePath, this)
          : render.call(MarkdownRenderer, markdown, host, sourcePath, this);
      Promise.resolve(renderPromise)
        .then(() => this.waitForRenderedEquationContent(host))
        .then((hasRenderedContent) => {
          if (!hasRenderedContent) {
            foreignObject.remove();
            return;
          }
          equationGroup.classList.add('is-equation-rendered');
          foreignObject.setAttribute('data-topic-id', topic?.id || '');
        })
        .catch(() => {
          foreignObject.remove();
        });
    }, 0);
  },

  /*
   * 等待 MathJax 异步渲染完成。最多等待 EQUATION_RENDER_WAIT_MS 毫秒，
   * 超时则放弃并显示源码 fallback。
   * 检测条件：MathJax container、.math 块或任何子元素/文本出现即视为渲染完成。
   */
  waitForRenderedEquationContent(host) {
    return new Promise((resolve) => {
      const hasContent = () =>
        Boolean(
          host.querySelector?.('mjx-container, .math, .math-block, .internal-embed') ||
          host.childElementCount ||
          host.textContent?.trim()
        );
      if (hasContent()) {
        resolve(true);
        return;
      }

      const startedAt = Date.now();
      const check = () => {
        if (hasContent()) {
          resolve(true);
          return;
        }
        if (Date.now() - startedAt > EQUATION_RENDER_WAIT_MS) {
          resolve(false);
          return;
        }
        window.requestAnimationFrame(check);
      };
      window.requestAnimationFrame(check);
    });
  },

  createTopicTextElement(box, options = {}) {
    const font = options.font || box.font;
    return svg('text', {
      class: options.className || 'yonxao-mindmap-topic-text',
      x: options.x,
      y: options.y,
      'text-anchor': options.textAnchor || 'start',
      'font-family': font.family,
      'font-size': font.size,
      'font-weight': font.weight,
    });
  },

  topicTextAnchor(box) {
    const align = String(box?.textAlign || 'auto');
    if (align === 'left') return 'start';
    if (align === 'center') return 'middle';
    if (align === 'right') return 'end';
    if (box?.side === 'root') return 'middle';
    if (this.isLeftwardTopicTextBox(box)) return 'end';
    return 'start';
  },

  /*
   * 普通段落文字默认按布局方向贴近连接侧；显式 align 会覆盖方向判断。
   * 列表和代码块不走这里，继续左对齐以保证可读性和缩进结构。
   */
  topicTextAnchorX(box) {
    const anchor = this.topicTextAnchor(box);
    if (anchor === 'middle') return (box.textX + this.topicTextRightX(box)) / 2;
    if (anchor === 'end') return this.topicTextRightX(box);
    return box.textX;
  },

  topicTextRightX(box) {
    return Number.isFinite(box?.textRight) ? box.textRight : box.width - TOPIC_PADDING_X;
  },

  isLeftwardTopicTextBox(box) {
    const side = String(box?.side || '');
    return side === 'left' || side === 'tree-left' || Number(box?.fishboneDirection) < 0;
  },

  topicTextBlockFirstBaseline(box, top, font = box.font) {
    const fontSize = Number(font?.size) || Number(box?.font?.size) || 16;
    const lineHeight = Number(font?.lineHeight) || Number(box?.font?.lineHeight) || fontSize * 1.3;
    /*
     * SVG text 的 y 是文字 baseline，不是行盒顶部。块级格式用 lineHeight 计算占位高度，
     * 因此首行 baseline 需要先走到行盒中线，再套用原有的主题文字视觉居中比例。
     */
    return top + lineHeight / 2 + fontSize * 0.36;
  },

  /*
   * 绘制品牌文字 "yonxao-mindmap" 的高亮效果。
   * 对位置 0(y)、3(x)、7(m)、11(m) 四个字母加高亮 class，形成品牌视觉标识。
   */
  appendYonxaoMindmapBrandLine(textEl, box, lineIndex, options = {}) {
    const segments = [];
    let buffer = '';
    let isHighlighted = false;
    const line = 'yonxao-mindmap';
    for (let i = 0; i < line.length; i++) {
      const shouldHighlight = BRAND_HIGHLIGHT_POSITIONS.has(i);
      if (shouldHighlight !== isHighlighted) {
        if (buffer) segments.push({ text: buffer, highlight: isHighlighted });
        buffer = '';
        isHighlighted = shouldHighlight;
      }
      buffer += line[i];
    }
    if (buffer) segments.push({ text: buffer, highlight: isHighlighted });

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const tspan = svg('tspan', {
        x: i === 0 ? (options.x ?? box.textX) : undefined,
        dy: i === 0 ? (lineIndex === 0 ? 0 : box.font.lineHeight) : undefined,
        class: seg.highlight ? 'yonxao-mindmap-text-highlight' : undefined,
      });
      tspan.textContent = seg.text;
      textEl.appendChild(tspan);
    }
  },

  /*
   * 在 SVG <text> 元素末尾追加一行富文本（带局部样式）。
   * 每段样式（加粗/斜体/颜色等）对应一个独立的 <tspan>。
   */
  appendRichTopicTextLine(textEl, richLine, box, lineIndex, options = {}) {
    this.appendRichTopicTextLineAt(textEl, richLine, box, {
      x: options.x ?? box.textX,
      dy: lineIndex === 0 ? 0 : box.font.lineHeight,
      font: box.font,
    });
  },

  /*
   * 在指定位置追加一行富文本，支持自定义 x/dy 偏移和字体（用于列表项缩进等场景）。
   * 将每个样式片段转换为独立的 <tspan>，设置对应的 font-weight、font-style、
   * text-decoration 和 fill 属性。
   */
  appendRichTopicTextLineAt(textEl, richLine, box, options = {}) {
    const lineFont = options.font || box.font;
    for (let index = 0; index < richLine.length; index += 1) {
      const segment = richLine[index];
      const attributes = {
        x: index === 0 ? options.x : undefined,
        dy: index === 0 ? options.dy : undefined,
      };
      if (segment.bold) {
        attributes['font-weight'] = Math.max(Number(lineFont.weight) || 400, 700);
      }
      if (segment.italic) {
        attributes['font-style'] = 'italic';
      }
      if (segment.underline || segment.strike) {
        attributes['text-decoration'] = [
          segment.underline ? 'underline' : '',
          segment.strike ? 'line-through' : '',
        ]
          .filter(Boolean)
          .join(' ');
      }
      if (segment.color) {
        attributes.fill = segment.color;
      }

      // SVG text 不能像 HTML 一样嵌套样式节点；每段样式独立生成 tspan。
      if (segment.tag) {
        attributes.class = 'yonxao-mindmap-topic-tag';
        attributes.fill = this.topicTagColor(segment.tagName || segment.text);
      } else if (segment.link) {
        attributes.class = 'yonxao-mindmap-topic-link';
      }
      if (segment.link) {
        this.appendTopicRichTextLinkSegment(textEl, segment, attributes);
      } else {
        const tspan = svg('tspan', attributes);
        tspan.textContent = segment.text;
        textEl.appendChild(tspan);
      }
    }
  },

  appendTopicRichTextLinkSegment(textEl, segment, attributes) {
    const linkKind = segment.linkKind === 'obsidian' ? 'obsidian' : 'external';
    const isMissing = this.isTopicRichTextLinkMissing(segment);
    const linkEl = svg('a', {
      class: `yonxao-mindmap-topic-link-anchor is-${linkKind}${isMissing ? ' is-missing' : ''}`,
      href: linkKind === 'external' && !isMissing ? segment.href : undefined,
    });
    const linkAttrs = {
      ...attributes,
      class: `yonxao-mindmap-topic-link is-${linkKind}${isMissing ? ' is-missing' : ''}`,
    };
    const label = svg('tspan', linkAttrs);
    label.textContent =
      segment.linkMarker === false
        ? segment.text
        : `${topicRichTextLinkMarker(linkKind)} ${segment.text}`;

    this.registerDomEvent(linkEl, 'click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.openTopicRichTextLink(segment);
    });
    linkEl.appendChild(label);
    textEl.appendChild(linkEl);
  },

  topicRichTextLayoutOptions() {
    return {
      richText: {
        isImageResolved: (block) => Boolean(this.resolveTopicImageHref(block)),
        resolveImageSize: (block) =>
          this.constructor.topicImageNaturalSizeMemory.get(
            this.topicImageNaturalSizeKey(block, this.resolveTopicImageHref(block))
          ) || null,
      },
    };
  },

  topicTagColor(tagName) {
    const text = String(tagName || '')
      .trim()
      .toLowerCase();
    let hash = TOPIC_TAG_HASH_SEED;
    for (const char of Array.from(text)) {
      hash ^= char.codePointAt(0) || 0;
      hash = Math.imul(hash, TOPIC_TAG_HASH_PRIME) >>> 0;
    }
    return TOPIC_TAG_COLORS[hash % TOPIC_TAG_COLORS.length];
  },

  isTopicRichTextLinkMissing(segment) {
    const href = String(segment?.href || '').trim();
    if (!href) return true;
    if (segment.linkKind === 'obsidian') {
      return !this.resolveTopicObsidianLinkFile(href);
    }
    if (/^(?:https?:|mailto:|obsidian:)/i.test(href)) return false;
    return !this.resolveTopicObsidianLinkFile(href);
  },

  openTopicRichTextLink(segment) {
    const href = String(segment?.href || '').trim();
    if (!href) return;

    if (segment.linkKind === 'obsidian') {
      const sourcePath = this.ctx?.sourcePath || '';
      if (!this.resolveTopicObsidianLinkFile(href)) return;
      this.plugin?.app?.workspace?.openLinkText?.(href, sourcePath);
      return;
    }

    if (/^(?:https?:|mailto:|obsidian:)/i.test(href)) {
      window.open(href, '_blank', 'noopener');
      return;
    }

    const sourcePath = this.ctx?.sourcePath || '';
    if (!this.resolveTopicObsidianLinkFile(href)) return;
    this.plugin?.app?.workspace?.openLinkText?.(href, sourcePath);
  },

  resolveTopicObsidianLinkFile(href) {
    const sourcePath = this.ctx?.sourcePath || '';
    const app = this.plugin?.app;
    const metadataCache = app?.metadataCache;
    const { linkpath, subpath } = splitObsidianLinkTarget(href);
    const file =
      linkpath && metadataCache?.getFirstLinkpathDest
        ? metadataCache.getFirstLinkpathDest(linkpath, sourcePath)
        : app?.vault?.getAbstractFileByPath?.(sourcePath) || null;
    if (!file) return null;

    const heading = normalizeObsidianHeadingText(subpath);
    if (!heading || heading.startsWith('^')) return file;

    const cache = metadataCache?.getFileCache?.(file);
    const headings = Array.isArray(cache?.headings) ? cache.headings : null;
    if (!headings) return file;

    return headings.some((item) => normalizeObsidianHeadingText(item?.heading) === heading)
      ? file
      : null;
  },

  isPlainYonxaoMindmapLine(line, richLine) {
    if (line !== 'yonxao-mindmap') return false;
    if (!Array.isArray(richLine) || richLine.length !== 1) return true;
    const segment = richLine[0];
    return !(
      segment.bold ||
      segment.italic ||
      segment.underline ||
      segment.strike ||
      segment.color ||
      segment.tag ||
      segment.link
    );
  },

  isTreeTableBox(box) {
    const side = String(box?.side || '');
    return side === 'tree-table-root' || side === 'tree-table-cell';
  },

  isTreeTableRootBox(box) {
    return String(box?.side || '') === 'tree-table-root';
  },

  topicDataElementFromTarget(target) {
    if (!target?.closest) return null;
    return target.closest('.yonxao-mindmap-topic, .yonxao-mindmap-topic-controls');
  },

  topicIdFromTarget(target) {
    return this.topicDataElementFromTarget(target)?.getAttribute('data-topic-id') || '';
  },

  renderedTopicElementById(topicId) {
    if (!topicId || !this.mapEl) return null;

    for (const element of this.mapEl.querySelectorAll('.yonxao-mindmap-topic')) {
      if (element.getAttribute('data-topic-id') === topicId) return element;
    }

    return null;
  },

  renderedTopicElementFromTarget(target) {
    if (!target?.closest) return null;
    const topicEl = target.closest('.yonxao-mindmap-topic');
    if (topicEl) return topicEl;

    const topicId = target.closest('.yonxao-mindmap-topic-controls')?.getAttribute('data-topic-id');
    return this.renderedTopicElementById(topicId);
  },

  isFishboneTopicBox(box) {
    const side = String(box?.side || '');
    return (
      side === 'fishbone-top' ||
      side === 'fishbone-bottom' ||
      side === 'fishbone-rib-topic' ||
      side === 'fishbone-rib-descendant'
    );
  },

  isFishbonePrimaryTopicBox(box) {
    const side = String(box?.side || '');
    return side === 'fishbone-top' || side === 'fishbone-bottom';
  },

  fishboneHeadSide() {
    return fishboneHeadSideForLayout(this.config.layout);
  },

  fishboneGrowthDirection() {
    return this.fishboneHeadSide() === 'left' ? 1 : -1;
  },

  fishboneSubtopicOutletSide() {
    return this.fishboneGrowthDirection() > 0 ? 'right' : 'left';
  },

  shouldPlaceSiblingButtonsHorizontally(box) {
    return [
      'top',
      'bottom',
      'vertical',
      'timeline-point',
      'timeline-top',
      'timeline-bottom',
      'org-bottom',
      'org-right-branch',
    ].includes(String(box.side || '').toLowerCase());
  },

  shouldShowSiblingTopicControls(topic) {
    if (Number(topic?.level || 1) <= 1) return false;
    const side = String(topic?._layout?.side || '');
    return (
      !this.isTreeTableBox(topic?._layout) &&
      side !== 'timeline-point' &&
      side !== 'fishbone-top' &&
      side !== 'fishbone-bottom'
    );
  },

  shouldShowSubtopicControl(topic) {
    return !this.isTreeTableBox(topic?._layout);
  },
};
