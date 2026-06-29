/*
 * 文件作用：
 * 主题控件绘制方法集合，负责折叠、编辑、新增子主题和新增兄弟主题按钮。
 *
 * 实现逻辑：
 * 控件位置来自 topicControlPoints，并根据冲突避让规则微调。
 *
 * 调用链：
 * mapRendererMethods -> topicControlDrawMethods -> topicControlPointMethods。
 */

import {
  svg,
  TOPIC_TOGGLE_BUTTON_RADIUS,
  TOPIC_SIBLING_BUTTON_RADIUS,
  TOPIC_SUBTOPIC_BUTTON_RADIUS,
  EDIT_BUTTON_SIZE,
  EDIT_BUTTON_BORDER_RADIUS,
} from '../../shared/rendererShared.js';

export const topicControlDrawMethods = {
  renderTopicControls(topic) {
    const positions = this.resolveTopicControlPositions(topic);
    if (!positions) return null;

    const box = topic._layout;
    const visibility = this.topicControlVisibilityMode();
    const group = svg('g', {
      class: `yonxao-mindmap-topic-controls is-visibility-${visibility}`,
      transform: `translate(${box.x - box.width / 2} ${box.y - box.height / 2})`,
      'data-topic-id': topic.id,
    });

    this.applyTopicButtonColorVariable(group, topic);

    if (positions.edit) {
      group.appendChild(this.renderEditButton(positions.edit));
    }
    if (positions.previousSibling || positions.nextSibling) {
      const siblingGroup = svg('g', { class: 'yonxao-mindmap-topic-sibling-actions' });
      if (positions.previousSibling) {
        siblingGroup.appendChild(this.renderSiblingButton(positions.previousSibling));
      }
      if (positions.nextSibling) {
        siblingGroup.appendChild(this.renderSiblingButton(positions.nextSibling));
      }
      group.appendChild(siblingGroup);
    }
    if (positions.subtopic) {
      group.appendChild(this.renderSubtopicButton(positions.subtopic));
    }
    if (positions.toggle) {
      group.appendChild(this.renderTopicToggle(topic, positions.toggle));
    }

    return group;
  },

  topicControlVisibilityMode() {
    const mode = String(this.config.button?.topicControlVisibility || 'toggle-always');
    return ['always', 'toggle-always', 'hover'].includes(mode) ? mode : 'toggle-always';
  },

  renderTopicToggle(topic, position) {
    const collapsed = this.collapsedIds.has(topic.id);
    const dir = position.side === 'left' ? -1 : 1;
    const toggle = svg('g', {
      class: 'yonxao-mindmap-toggle',
      transform: `translate(${position.x} ${position.y})`,
    });

    toggle.appendChild(
      svg('circle', {
        cx: 0,
        cy: 0,
        r: TOPIC_TOGGLE_BUTTON_RADIUS,
      })
    );
    toggle.appendChild(
      svg('path', {
        d: `M ${-3 * dir} 0 H ${3 * dir}`,
      })
    );

    if (collapsed) {
      toggle.appendChild(
        svg('path', {
          d: 'M 0 -3 V 3',
        })
      );
    }

    return toggle;
  },

  renderSiblingButton(position) {
    const button = svg('g', {
      class: 'yonxao-mindmap-topic-sibling-add',
      transform: `translate(${position.x} ${position.y})`,
      'data-sibling-position': position.placement,
    });

    const title = svg('title');
    title.textContent = position.label;
    button.appendChild(title);
    button.appendChild(svg('circle', { cx: 0, cy: 0, r: TOPIC_SIBLING_BUTTON_RADIUS }));
    button.appendChild(svg('path', { d: 'M -3 0 H 3 M 0 -3 V 3' }));
    button.appendChild(
      svg('path', {
        class: 'yonxao-mindmap-topic-sibling-direction',
        d: this.siblingButtonDirectionPath(position),
      })
    );

    return button;
  },

  siblingButtonDirectionPath(position) {
    const side = position.side;
    const placement = position.placement;
    if (side === 'left' || side === 'right') {
      const x = placement === 'before' ? -5 : 5;
      return `M ${x} -3 V 3`;
    }

    const y = placement === 'before' ? -5 : 5;
    return `M -3 ${y} H 3`;
  },

  renderSubtopicButton(position) {
    const button = svg('g', {
      class: 'yonxao-mindmap-topic-subtopic-add',
      transform: `translate(${position.x} ${position.y})`,
      'data-subtopic-side': position.side,
    });

    const title = svg('title');
    title.textContent = this.t('topicButton.addSubtopic');
    button.appendChild(title);
    button.appendChild(svg('circle', { cx: 0, cy: 0, r: TOPIC_SUBTOPIC_BUTTON_RADIUS }));
    button.appendChild(svg('path', { d: 'M -3.5 0 H 3.5 M 0 -3.5 V 3.5' }));

    return button;
  },

  siblingButtonLabel(side, placement) {
    if (side === 'left') return this.t('topicButton.addSiblingLeft');
    if (side === 'right') return this.t('topicButton.addSiblingRight');
    return placement === 'before'
      ? this.t('topicButton.addSiblingBefore')
      : this.t('topicButton.addSiblingAfter');
  },

  renderEditButton(position) {
    // SVG 里不能直接放 HTML button，所以这里用一个小 <g> 分组模拟“编辑按钮”。
    // 点击事件仍然通过 handleTopicClick 统一处理，避免给每个主题单独注册事件造成额外开销。
    const edit = svg('g', {
      class: 'yonxao-mindmap-topic-edit',
      transform: `translate(${position.x} ${position.y})`,
    });

    const title = svg('title');
    title.textContent = this.t('topicButton.editTopic');
    edit.appendChild(title);
    edit.appendChild(
      svg('rect', {
        width: EDIT_BUTTON_SIZE,
        height: EDIT_BUTTON_SIZE,
        rx: EDIT_BUTTON_BORDER_RADIUS,
      })
    );
    edit.appendChild(
      svg('path', {
        d: 'M6 14.5 6.7 11.4 13.2 4.9 16.1 7.8 9.6 14.3zM12.4 5.7 15.3 8.6',
      })
    );

    return edit;
  },
};
