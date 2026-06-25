/*
 * 文件作用：
 * 收集可见主题、父子连线和整体布局边界。
 */

import { visibleSubtopics } from './layoutShared.js';

/*
 * 作用：
 * 当没有可见主题时，返回一个合理的默认视口范围，避免空图显示空白页。
 */
const DEFAULT_BOUNDS_MIN_X = -120;
const DEFAULT_BOUNDS_MIN_Y = -80;
const DEFAULT_BOUNDS_WIDTH = 240; // 120 + 120
const DEFAULT_BOUNDS_HEIGHT = 160; // 80 + 80

/*
 * 作用：
 * 收集当前可见主题和父子连线关系，供 SVG 渲染层使用。
 */
export function collectVisible(topic, collapsedIds, topics, connectors) {
  topics.push(topic);
  for (const subtopic of visibleSubtopics(topic, collapsedIds)) {
    connectors.push({ parentTopic: topic, subtopic });
    collectVisible(subtopic, collapsedIds, topics, connectors);
  }
}

/*
 * 作用：
 * 根据所有可见主题的盒子范围计算整张图的边界。
 * 当 topics 为空时返回默认边界，防止渲染层出现 NaN 或 infinite。
 */
export function computeBounds(topics) {
  if (!topics.length) {
    return {
      minX: DEFAULT_BOUNDS_MIN_X,
      minY: DEFAULT_BOUNDS_MIN_Y,
      maxX: DEFAULT_BOUNDS_MIN_X + DEFAULT_BOUNDS_WIDTH,
      maxY: DEFAULT_BOUNDS_MIN_Y + DEFAULT_BOUNDS_HEIGHT,
    };
  }

  return topics.reduce(
    (bounds, topic) => {
      const box = topic._layout;
      bounds.minX = Math.min(bounds.minX, box.x - box.width / 2);
      bounds.maxX = Math.max(bounds.maxX, box.x + box.width / 2);
      bounds.minY = Math.min(bounds.minY, box.y - box.height / 2);
      bounds.maxY = Math.max(bounds.maxY, box.y + box.height / 2);
      return bounds;
    },
    {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    }
  );
}
