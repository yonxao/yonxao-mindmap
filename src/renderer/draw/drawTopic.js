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

import {
  DEFAULT_TOPIC_BUTTON_COLOR,
  TOPIC_PADDING_X,
  renderIcon,
  themeTopicFillAlpha,
  topicColor,
  transparentColor,
  svg,
} from '../../shared/rendererShared.js';

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

    const textEl = svg('text', {
      class: 'yonxao-mindmap-topic-text',
      x: box.textX,
      y: box.textY,
      'text-anchor': 'start',
      'font-family': box.font.family,
      'font-size': box.font.size,
      'font-weight': box.font.weight,
    });

    for (let index = 0; index < box.lines.length; index += 1) {
      const line = box.lines[index];

      if (line === 'yonxao-mindmap') {
        // 对 "yonxao-mindmap" 中的 y、x、m、m 四个缩写字母（位置 0、3、7、11）逐个高亮
        const HIGHLIGHT_POSITIONS = new Set([0, 3, 7, 11]);
        const segments = [];
        let buffer = '';
        let isHighlighted = false;
        for (let i = 0; i < line.length; i++) {
          const shouldHighlight = HIGHLIGHT_POSITIONS.has(i);
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
            dy: i === 0 ? (index === 0 ? 0 : box.font.lineHeight) : undefined,
            class: seg.highlight ? 'yonxao-mindmap-text-highlight' : undefined,
          });
          tspan.textContent = seg.text;
          textEl.appendChild(tspan);
        }
      } else {
        const tspan = svg('tspan', {
          x: box.textX,
          dy: index === 0 ? 0 : box.font.lineHeight,
        });
        tspan.textContent = line;
        textEl.appendChild(tspan);
      }
    }

    group.appendChild(textEl);

    return group;
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
