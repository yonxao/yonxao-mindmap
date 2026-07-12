// 序列化时需要合并配置源以获取 saveFullConfig 开关，同时引入结构块序列化能力。
import {
  mergeMindConfigSources,
  normalizeMindConfig,
  serializeMindSource,
} from '../config/mindConfig.js';
import { serializeMindStructures } from './mindStructures.js';

/*
 * 文件作用：
 * 这里负责把内存中的思维导图树重新序列化成 yxmm 主题级别标记源码。
 *
 * 为什么需要它：
 * 用户在导图视图中编辑的是 SVG 上的主题，但 Markdown 文件真正保存的是代码块文本。
 * 所以主题新增、删除、改名、改颜色后，都要通过 serializeMind 写回源码。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer.saveTreeToSourceAndFile() -> serializeMindDocument() -> saveSourceToMarkdownFile()
 */

/*
 * 作用：
 * 把完整主题树序列化为 yxmm 源码。
 *
 * 调用链：
 * Renderer.saveTreeToSourceAndFile() -> serializeMindDocument() -> serializeMind() -> serializeTopic()。
 */
export function serializeMind(root) {
  // serializeMind 的作用正好和 parseMind 相反：
  // parseMind:    yxmm 文本 -> 树结构
  // serializeMind: 树结构 -> yxmm 文本
  //
  // 为什么导图编辑后要做这一步？
  // 因为 Markdown 文件里真正保存的是文本代码块，不是 SVG，也不是 JS 对象。
  // 用户在导图里改了主题后，我们必须把内存中的树重新写成 主题级别标记文本，再保存回 Markdown。
  const roots = root._virtual ? root.subtopics : [root];
  return roots.map((topic) => serializeTopic(topic, 0)).join('\n');
}

/*
 * 作用：
 * 把“配置区 + 主题树”一起序列化成完整 yxmm 源码。
 *
 * 调用链：
 * Renderer.saveTreeToSourceAndFile()/saveRuntimeConfigToFile() -> serializeMindDocument()。
 *
 * 实现逻辑：
 * 主题树先用 serializeMind 转成标题正文，再交给 serializeMindSource 包上配置区。
 */
export function serializeMindDocument(root, rawConfig, forceConfig, baseConfig, structures = []) {
  // 需要合并全局默认配置和文档配置才能判断 saveFullConfig 开关，决定结构块是否写入。
  const effectiveConfig = normalizeMindConfig(mergeMindConfigSources(baseConfig, rawConfig));
  // 主题体 + 结构定义块拼接成完整 yxmm 正文。saveFullConfig 为 false 时结构块默认可省略。
  const body = [
    serializeMind(root),
    serializeMindStructures(structures, { saveFullConfig: effectiveConfig.view.saveFullConfig }),
  ]
    .filter(Boolean)
    .join('\n\n');
  return serializeMindSource(rawConfig, body, forceConfig, baseConfig);
}

/*
 * 作用：
 * 把单个主题及其子主题递归序列化为 主题级别标记行。
 */
export function serializeTopic(topic, depth) {
  const topicLevelMarker = '#'.repeat(depth + 1);
  const topicAttributes = serializeTopicAttributes(topic.attributes);
  const textLines = String(topic.text || '').split(/\r?\n/);
  const firstTextLine = textLines.shift() || '';
  const currentLine = `${topicLevelMarker} ${firstTextLine}${topicAttributes}`;
  const continuationLines = textLines.map((line) => line.trimEnd());
  const subtopicLines = topic.subtopics.map((subtopic) => serializeTopic(subtopic, depth + 1));
  return [currentLine, ...continuationLines, ...subtopicLines].join('\n');
}

/*
 * 作用：
 * 把主题 attributes 对象序列化成主题属性块。
 *
 * 实现逻辑：
 * 常用属性固定顺序输出，其它属性按字母排序，减少无意义 diff。
 */
export function serializeTopicAttributes(attributes) {
  const topicAttributes = attributes || {};
  // 为了输出稳定、易读，常用属性固定顺序：color -> icon -> maxWidth -> font*。
  // 如果后续扩展了其它属性，也会继续保留下来，避免导图编辑时误删用户写的自定义字段。
  const orderedKeys = [
    'color',
    'icon',
    'maxWidth',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'align',
    // 稳定主题 ID 由 assignIds 分配，序列化时保留，供结构定义通过 id=xxx 精确引用。
    'id',
  ];
  const keys = [
    ...orderedKeys.filter((key) => topicAttributes[key]),
    ...Object.keys(topicAttributes)
      .filter((key) => topicAttributes[key] && !orderedKeys.includes(key))
      .sort(),
  ];

  if (!keys.length) return '';

  const parts = keys.map((key) => `${key}=${serializeTopicAttributeValue(topicAttributes[key])}`);
  return ` [${parts.join(' ')}]`;
}

/*
 * 作用：
 * 序列化单个主题属性值，必要时自动加双引号并转义内部引号。
 */
export function serializeTopicAttributeValue(value) {
  const text = String(value || '');
  if (/^[^\s"'[\]]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}
