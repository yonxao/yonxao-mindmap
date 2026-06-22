/*
 * 文件作用：
 * 收集可见主题、父子连线和整体布局边界。
 */

import { visibleSubtopics } from './layoutShared.js';

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
 */
export function computeBounds(topics) {
  if (!topics.length) {
    return { minX: -120, minY: -80, maxX: 120, maxY: 80 };
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
