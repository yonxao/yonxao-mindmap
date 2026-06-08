import { serializeMindSource } from '../config/mindConfig.js';

/*
 * 文件作用：
 * 这里负责把内存中的思维导图树重新序列化成 yxmm Markdown 标题源码。
 *
 * 为什么需要它：
 * 用户在脑图视图中编辑的是 SVG 上的节点，但 Markdown 文件真正保存的是代码块文本。
 * 所以节点新增、删除、改名、改颜色后，都要通过 serializeMind 写回源码。
 *
 * 调用链位置：
 * YonxaoMindmapRenderer.saveTreeToSourceAndFile() -> serializeMindDocument() -> saveSourceToMarkdownFile()
 */

/*
 * 作用：
 * 把完整节点树序列化为 yxmm 源码。
 *
 * 调用链：
 * Renderer.saveTreeToSourceAndFile() -> serializeMindDocument() -> serializeMind() -> serializeNode()。
 */
export function serializeMind(root) {
  // serializeMind 的作用正好和 parseMind 相反：
  // parseMind:    yxmm 文本 -> 树结构
  // serializeMind: 树结构 -> yxmm 文本
  //
  // 为什么脑图编辑后要做这一步？
  // 因为 Markdown 文件里真正保存的是文本代码块，不是 SVG，也不是 JS 对象。
  // 用户在脑图里改了节点后，我们必须把内存中的树重新写成 Markdown 标题文本，再保存回 Markdown。
  const roots = root._virtual ? root.children : [root];
  return roots.map((node) => serializeNode(node, 0)).join('\n');
}

/*
 * 作用：
 * 把“配置区 + 节点树”一起序列化成完整 yxmm 源码。
 *
 * 调用链：
 * Renderer.saveTreeToSourceAndFile()/saveRuntimeConfigToFile() -> serializeMindDocument()。
 *
 * 实现逻辑：
 * 节点树先用 serializeMind 转成标题正文，再交给 serializeMindSource 包上配置区。
 */
export function serializeMindDocument(root, rawConfig, forceConfig) {
  return serializeMindSource(rawConfig, serializeMind(root), forceConfig);
}

/*
 * 作用：
 * 把单个节点及其子节点递归序列化为 Markdown 标题行。
 */
export function serializeNode(node, depth) {
  const heading = '#'.repeat(depth + 1);
  const attrs = serializeAttrs(node.attrs);
  const currentLine = `${heading} ${node.text}${attrs}`;
  const childLines = node.children.map((child) => serializeNode(child, depth + 1));
  return [currentLine, ...childLines].join('\n');
}

/*
 * 作用：
 * 把节点 attrs 对象序列化成行尾属性块。
 *
 * 实现逻辑：
 * 常用属性固定顺序输出，其它属性按字母排序，减少无意义 diff。
 */
export function serializeAttrs(attrs) {
  // 为了输出稳定、易读，常用属性固定顺序：color -> icon -> layout。
  // 如果后续扩展了其它属性，也会继续保留下来，避免脑图编辑时误删用户写的自定义字段。
  const orderedKeys = ['color', 'icon', 'layout'];
  const keys = [
    ...orderedKeys.filter((key) => attrs[key]),
    ...Object.keys(attrs)
      .filter((key) => attrs[key] && !orderedKeys.includes(key))
      .sort(),
  ];

  if (!keys.length) return '';

  const parts = keys.map((key) => `${key}=${serializeAttrValue(attrs[key])}`);
  return ` [${parts.join(' ')}]`;
}

/*
 * 作用：
 * 序列化单个属性值，必要时自动加双引号并转义内部引号。
 */
export function serializeAttrValue(value) {
  const text = String(value || '');
  if (/^[^\s"'[\]]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}
