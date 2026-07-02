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
} from '../../utils/richText.js';

const BRAND_HIGHLIGHT_POSITIONS = new Set([0, 3, 7, 11]);
const UNORDERED_LIST_MARKER_SOLID_RADIUS = 2.4;
const UNORDERED_LIST_MARKER_HOLLOW_RADIUS = 2.6;
const UNORDERED_LIST_MARKER_SQUARE_SIZE = 4.4;
const UNORDERED_LIST_MARKER_CENTER_OFFSET_RATIO = 0.28;
const CODE_BLOCK_MIN_RENDER_WIDTH = 48;
const CODE_BLOCK_TEXT_ASCENT_RATIO = 0.75;
const EQUATION_RENDER_WAIT_MS = 600;

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

    return group;
  },

  renderLegacyTopicText(box) {
    const textEl = this.createTopicTextElement(box, {
      x: box.textX,
      y: box.textY,
      font: box.font,
    });

    for (let index = 0; index < box.lines.length; index += 1) {
      const line = box.lines[index];
      const richLine = box.richLines?.[index];

      if (this.isPlainYonxaoMindmapLine(line, richLine)) {
        this.appendYonxaoMindmapBrandLine(textEl, box, index);
      } else if (Array.isArray(richLine) && richLine.length) {
        this.appendRichTopicTextLine(textEl, richLine, box, index);
      } else {
        const tspan = svg('tspan', {
          x: box.textX,
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
      cursorY += Number(block.gapBefore) || 0;
      if (block.type === TOPIC_RICH_BLOCK_TYPES.LIST) {
        this.appendTopicListBlock(contentGroup, block, box, cursorY);
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
   * 渲染段落块：将布局阶段换行后的多行文本逐行写入 SVG <text>。
   * 每行可以是纯文本或带局部样式（加粗/颜色等）的样式片段。
   */
  appendTopicParagraphBlock(contentGroup, block, box, top) {
    const textEl = this.createTopicTextElement(box, {
      x: box.textX,
      y: this.topicTextBlockFirstBaseline(box, top, box.font),
      font: box.font,
    });

    for (let index = 0; index < block.lines.length; index += 1) {
      const line = block.lines[index];
      const plainLine = line.map((segment) => segment.text).join('');
      if (this.isPlainYonxaoMindmapLine(plainLine, line)) {
        this.appendYonxaoMindmapBrandLine(textEl, box, index);
      } else {
        this.appendRichTopicTextLine(textEl, line, box, index);
      }
    }

    contentGroup.appendChild(textEl);
  },

  /*
   * 渲染列表块：处理有序和无序列表项，每项包含编号/项目符号和文本内容。
   * 有序列表显示编号（如 1. 2. 3.），无序列表按层级显示不同形状的符号。
   */
  appendTopicListBlock(contentGroup, block, box, top) {
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
          if (item.ordered) {
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

  /*
   * 渲染代码块：绘制圆角背景矩形，然后在其内部用等宽字体逐行渲染代码文本。
   * 代码块宽度受主题最大宽度和 CODE_BLOCK_MAX_WIDTH 双重限制。
   */
  appendTopicCodeBlock(contentGroup, block, box, top) {
    const blockGroup = svg('g', { class: 'yonxao-mindmap-topic-code-block' });
    const rectWidth = Math.min(
      box.width - box.textX - TOPIC_PADDING_X,
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
      x: box.textX,
      y: top,
      width: Math.max(block.width, 40),
      height: Math.max(block.height, box.font.lineHeight),
    });
    const host = document.createElement('div');
    host.className = 'yonxao-mindmap-topic-equation-host';
    host.style.fontSize = `${Math.max(10, Number(block.font?.size) || Number(box.font.size) || 16)}px`;
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
      'text-anchor': 'start',
      'font-family': font.family,
      'font-size': font.size,
      'font-weight': font.weight,
    });
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
  appendYonxaoMindmapBrandLine(textEl, box, lineIndex) {
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
        x: i === 0 ? box.textX : undefined,
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
  appendRichTopicTextLine(textEl, richLine, box, lineIndex) {
    this.appendRichTopicTextLineAt(textEl, richLine, box, {
      x: box.textX,
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
      const tspan = svg('tspan', attributes);
      tspan.textContent = segment.text;
      textEl.appendChild(tspan);
    }
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
      segment.color
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
    return this.config.layout === 'fishbone-right' ? 'right' : 'left';
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
