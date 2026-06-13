import { normalizeMindConfig, splitMindSourceConfig } from '../config/mindConfig.js';

/*
 * 文件作用：
 * 这里负责把 ```yxmm 代码块里的 主题级别标记文本解析成树形数据。
 *
 * 输入与输出：
 * 输入是类似 "# 中心主题"、"## 子主题" 的纯文本；输出是 renderer/layout 都能理解的主题树。
 * 每个主题会包含 text、attrs、children、line、id 等字段。
 *
 * 执行逻辑：
 * 1. parseMind 按行切分源码。
 * 2. parseTopicMind 使用标题层级维护一个 stack，把主题挂到正确父主题下面。
 * 3. parseTopicLine 解析主题文本和主题属性。
 * 4. assignIds 用结构路径生成稳定 id，供折叠状态和点击编辑使用。
 */

/*
 * 作用：
 * yxmm 源码解析入口，把原始字符串切成行并转交给 主题级别标记解析器。
 */
export function parseMind(source) {
  return parseMindDocument(source).root;
}

/*
 * 作用：
 * 解析完整 yxmm 文档，包括顶部配置区和 主题级别标记正文。
 *
 * 调用链：
 * Renderer.mount()/saveFromSourceView() -> parseMindDocument()。
 *
 * 实现逻辑：
 * 配置区由 splitMindSourceConfig 剥离并解析；正文仍交给 parseTopicMind。
 * 这样后续扩展配置项时，不需要污染标题层级解析逻辑。
 */
export function parseMindDocument(source) {
  const document = splitMindSourceConfig(source);
  const lines = document.body.split(/\r?\n/);
  const root = parseTopicMind(lines);

  return {
    ...document,
    config: normalizeMindConfig(document.rawConfig),
    root,
  };
}

/*
 * 作用：
 * 使用 主题级别标记层级构建思维导图树。
 *
 * 调用链：
 * parseMind() -> parseTopicMind() -> buildRootFromRoots()。
 *
 * 实现逻辑：
 * 用 stack 保存最近的祖先标题；新标题出现时弹出不再是父级的主题，再挂到当前父主题下。
 */
export function parseTopicMind(lines) {
  const roots = [];
  const stack = [];

  // 主题级别标记语法解析：
  // # 是中心主题，## 是二级主题，### 是三级主题。
  // 这里不限制 # 的数量，因为内容在代码块里，属于 yxmm 自己的 DSL；
  // 这样深层级也不用回到大量空格缩进。旧版缩进语法已经移除，避免同一份源码存在两套层级规则。
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    if (!rawLine.trim()) continue;

    const topicLine = matchTopicLevelLine(rawLine.trim());
    if (!topicLine) {
      throw new Error(`第 ${lineIndex + 1} 行不是 主题级别标记，请使用 #、##、### 表示主题层级。`);
    }

    const level = topicLine.level;
    const parsed = parseTopicLine(topicLine.text);
    if (!parsed.text) continue;

    const topic = createMindTopic(parsed.text, parsed.attrs, [], lineIndex + 1, level);

    // 当前标题只能挂到比自己层级小的最近祖先下面，所以需要弹出同级或更深层级主题。
    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length) {
      stack[stack.length - 1].topic.children.push(topic);
    } else {
      roots.push(topic);
    }

    stack.push({ level, topic });
  }

  return buildRootFromRoots(roots);
}

/*
 * 作用：
 * 把解析得到的顶层主题整理成渲染器需要的一棵树。
 *
 * 实现逻辑：
 * 单根时直接使用；多根时创建虚拟根，避免后续布局层处理森林结构。
 */
export function buildRootFromRoots(roots) {
  if (!roots.length) return null;

  // 如果用户写了多个顶层主题，就自动补一个虚拟根主题，保证渲染器始终处理一棵树。
  const root =
    roots.length === 1
      ? roots[0]
      : {
          id: '',
          text: 'Mind',
          attrs: { layout: 'balanced' },
          children: roots,
          line: 0,
          level: 0,
          _layout: null,
          _virtual: true,
        };

  assignIds(root, '0');
  return root;
}

/*
 * 作用：
 * 判断一行文本是否符合 主题级别标记语法，并返回标题层级和正文。
 */
export function matchTopicLevelLine(line) {
  const match = String(line).match(/^(#+)\s+(.+)$/);
  if (!match) return null;
  return {
    level: match[1].length,
    text: match[2].trim(),
  };
}

/*
 * 作用：
 * 创建统一的思维导图主题对象。
 *
 * 调用链：
 * parseTopicMind()/Renderer.addChildFromTopicEditor() -> createMindTopic()。
 */
export function createMindTopic(text, attrs, children, line, level) {
  return {
    id: '',
    text,
    attrs: attrs || {},
    children: children || [],
    line: line || 0,
    level: level || 1,
    _layout: null,
    _virtual: false,
  };
}

/*
 * 作用：
 * 解析单个标题行中的主题文本和主题属性。
 *
 * 实现逻辑：
 * 从标题末尾向前剥离 [key=value] 主题属性块，剩余部分就是主题文本。
 */
export function parseTopicLine(line) {
  let current = line;
  const attrs = {};

  // 主题属性必须写在标题文本后面，例如：主题文本 [color=#3b82f6 icon=book]
  // 这里用循环是为了允许多个属性块连续出现，后面的属性会覆盖前面的同名属性。
  while (true) {
    const match = current.match(/\s*\[([^[\]]+)]\s*$/);
    if (!match) break;
    if (!/[a-zA-Z][\w-]*\s*=/.test(match[1])) break;

    Object.assign(attrs, parseAttrs(match[1]));
    current = current.slice(0, match.index).trimEnd();
  }

  return {
    text: current.trim(),
    attrs,
  };
}

/*
 * 作用：
 * 把属性块内容解析成对象，例如 color=#3b82f6 icon=book。
 */
export function parseAttrs(source) {
  const attrs = {};
  // 支持 key=value、key="value with space"、key='value with space' 三种写法。
  const attrPattern = /([a-zA-Z][\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s]+))/g;
  let match;

  while ((match = attrPattern.exec(source))) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = value.trim();
  }

  return attrs;
}

/*
 * 作用：
 * 为树中每个主题分配稳定 id。
 *
 * 实现逻辑：
 * id 使用结构路径，例如 0.1.2；只要树结构不变，id 就稳定。
 */
export function assignIds(topic, id) {
  // 使用结构路径作为 id，比如 0.1.2。源码不变时 id 稳定，折叠状态也就稳定。
  topic.id = id;
  for (let index = 0; index < topic.children.length; index += 1) {
    assignIds(topic.children[index], `${id}.${index}`);
  }
}
