/*
 * 文件作用：
 * 这里负责把 ```yxmm 代码块里的 Markdown 标题文本解析成树形数据。
 *
 * 输入与输出：
 * 输入是类似 "# 中心节点"、"## 子节点" 的纯文本；输出是 renderer/layout 都能理解的节点树。
 * 每个节点会包含 text、attrs、children、line、id 等字段。
 *
 * 执行逻辑：
 * 1. parseMind 按行切分源码。
 * 2. parseHeadingMind 使用标题层级维护一个 stack，把节点挂到正确父节点下面。
 * 3. parseNodeLine 解析节点文本和行尾属性块。
 * 4. assignIds 用结构路径生成稳定 id，供折叠状态和点击编辑使用。
 */

/*
 * 作用：
 * yxmm 源码解析入口，把原始字符串切成行并转交给 Markdown 标题解析器。
 */
export function parseMind(source) {
  const lines = source.split(/\r?\n/);
  return parseHeadingMind(lines);
}

/*
 * 作用：
 * 使用 Markdown 标题层级构建思维导图树。
 *
 * 调用链：
 * parseMind() -> parseHeadingMind() -> buildRootFromRoots()。
 *
 * 实现逻辑：
 * 用 stack 保存最近的祖先标题；新标题出现时弹出不再是父级的节点，再挂到当前父节点下。
 */
export function parseHeadingMind(lines) {
  const roots = [];
  const stack = [];

  // Markdown 标题语法解析：
  // # 是中心节点，## 是二级节点，### 是三级节点。
  // 这里不限制 # 的数量，因为内容在代码块里，属于 yxmm 自己的 DSL；
  // 这样深层级也不用回到大量空格缩进。旧版缩进语法已经移除，避免同一份源码存在两套层级规则。
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const rawLine = lines[lineIndex];
    if (!rawLine.trim()) continue;

    const heading = matchHeadingLine(rawLine.trim());
    if (!heading) {
      throw new Error(`第 ${lineIndex + 1} 行不是 Markdown 标题，请使用 #、##、### 表示节点层级。`);
    }

    const level = heading.level;
    const parsed = parseNodeLine(heading.text);
    if (!parsed.text) continue;

    const node = createMindNode(parsed.text, parsed.attrs, [], lineIndex + 1);

    // 当前标题只能挂到比自己层级小的最近祖先下面，所以需要弹出同级或更深层级节点。
    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length) {
      stack[stack.length - 1].node.children.push(node);
    } else {
      roots.push(node);
    }

    stack.push({ level, node });
  }

  return buildRootFromRoots(roots);
}

/*
 * 作用：
 * 把解析得到的顶层节点整理成渲染器需要的一棵树。
 *
 * 实现逻辑：
 * 单根时直接使用；多根时创建虚拟根，避免后续布局层处理森林结构。
 */
export function buildRootFromRoots(roots) {
  if (!roots.length) return null;

  // 如果用户写了多个顶层节点，就自动补一个虚拟根节点，保证渲染器始终处理一棵树。
  const root =
    roots.length === 1
      ? roots[0]
      : {
          id: '',
          text: 'Mind',
          attrs: { layout: 'balanced' },
          children: roots,
          line: 0,
          _layout: null,
          _virtual: true,
        };

  assignIds(root, '0');
  return root;
}

/*
 * 作用：
 * 判断一行文本是否符合 Markdown 标题语法，并返回标题层级和正文。
 */
export function matchHeadingLine(line) {
  const match = String(line).match(/^(#+)\s+(.+)$/);
  if (!match) return null;
  return {
    level: match[1].length,
    text: match[2].trim(),
  };
}

/*
 * 作用：
 * 创建统一的思维导图节点对象。
 *
 * 调用链：
 * parseHeadingMind()/Renderer.addChildFromNodeEditor() -> createMindNode()。
 */
export function createMindNode(text, attrs, children, line) {
  return {
    id: '',
    text,
    attrs: attrs || {},
    children: children || [],
    line: line || 0,
    _layout: null,
    _virtual: false,
  };
}

/*
 * 作用：
 * 解析单个标题行中的节点文本和行尾属性块。
 *
 * 实现逻辑：
 * 从行尾向前剥离 [key=value] 属性块，剩余部分就是节点文本。
 */
export function parseNodeLine(line) {
  let current = line;
  const attrs = {};

  // 属性必须写在行尾，例如：节点文本 [color=#3b82f6 icon=book]
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
 * 为树中每个节点分配稳定 id。
 *
 * 实现逻辑：
 * id 使用结构路径，例如 0.1.2；只要树结构不变，id 就稳定。
 */
export function assignIds(node, id) {
  // 使用结构路径作为 id，比如 0.1.2。源码不变时 id 稳定，折叠状态也就稳定。
  node.id = id;
  for (let index = 0; index < node.children.length; index += 1) {
    assignIds(node.children[index], `${id}.${index}`);
  }
}
