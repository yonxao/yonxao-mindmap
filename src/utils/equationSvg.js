/*
 * 文件作用：
 * 为 PNG 导出提供一个不依赖 foreignObject 的轻量 TeX -> SVG 渲染器。
 *
 * 适用范围：
 * 只覆盖导图主题里常用的公式结构：上下标、分式、根号、积分、常见符号和希腊字母。
 * 正常预览仍优先使用 Obsidian/MathJax；这里用于导出环境拿不到 MathJax SVG API 时的兜底。
 */

import { SVG_NS } from '../constants.js';

/*
 * TeX \u547d\u4ee4\u540d\u76f4\u63a5\u6620\u5c04\u5230 Unicode \u5b57\u7b26\uff0c\u7701\u53bb\u8fc7\u5ea6\u7684 COMMAND_SYMBOLS \u4e8c\u6b21\u95f4\u63a5\u3002
 */
/*
 * TeX 命令名直接映射到 Unicode 字符，省去过度的二次间接查找。
 * 仅覆盖导图主题里常用的公式符号。
 */
const SYMBOL_MAP = Object.freeze({
  alpha: '\u03b1',
  beta: '\u03b2',
  gamma: '\u03b3',
  delta: '\u03b4',
  epsilon: '\u03b5',
  theta: '\u03b8',
  lambda: '\u03bb',
  mu: '\u03bc',
  pi: '\u03c0',
  sigma: '\u03c3',
  phi: '\u03c6',
  omega: '\u03c9',
  Gamma: '\u0393',
  Delta: '\u0394',
  Theta: '\u0398',
  Lambda: '\u039b',
  Pi: '\u03a0',
  Sigma: '\u03a3',
  Phi: '\u03a6',
  Omega: '\u03a9',
  pm: '\u00b1',
  times: '\u00d7',
  cdot: '\u00b7',
  infty: '\u221e',
  le: '\u2264',
  ge: '\u2265',
  neq: '\u2260',
  approx: '\u2248',
  to: '\u2192',
  rightarrow: '\u2192',
  leftarrow: '\u2190',
});

// 字符宽度估算比例（相对 fontSize），根据字符类型区分粗细
const TEXT_WIDTH_RATIO = 0.5;
const NUMBER_WIDTH_RATIO = 0.48;
const OPERATOR_WIDTH_RATIO = 0.5;
const SYMBOL_WIDTH_RATIO = 0.62;
// 行内元素之间的最小间距
const ROW_GAP = 0.2;
// 分式布局常量
const FRACTION_PADDING_X = 3;
const FRACTION_GAP = 2;
const FRACTION_LINE_WIDTH = 0.95;
// 上下标和分式内容的缩放比例
const SCRIPT_SCALE = 0.62;
const FRACTION_SCALE = 0.82;
// 根号符号额外宽度
const SQRT_EXTRA_WIDTH = 12;
// SVG 画布额外内边距
const SVG_PADDING = 2;

/*
 * 渲染 TeX 公式源码为轻量 SVG。
 * 解析公式 AST，逐节点计算尺寸和位置，生成纯 SVG 图形。
 * 正常预览优先使用 Obsidian/MathJax；此处用于导出环境拿不到 MathJax SVG API 时的兜底。
 */
export function renderEquationSvg(source, options = {}) {
  const fontSize = Math.max(10, Number(options.fontSize) || 16);
  const color = options.color || 'currentColor';
  const ast = parseEquation(String(source || ''));
  const box = renderEquationNode(ast, { fontSize, color });
  const width = Math.max(1, box.width + SVG_PADDING * 2);
  const height = Math.max(1, box.height + SVG_PADDING * 2);
  const root = svg('svg', {
    xmlns: SVG_NS,
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    overflow: 'visible',
  });
  root.style.color = color;
  root.style.fill = color;
  root.appendChild(placeBox(box, SVG_PADDING, SVG_PADDING));
  return root;
}

/*
 * 将 TeX 公式源码解析为 AST。
 * 顶层是一个 row 节点，包含子节点序列。
 */
function parseEquation(source) {
  const parser = new EquationParser(source);
  return { type: 'row', children: parser.parseRow() };
}

/*
 * 轻量 TeX 解析器，只覆盖导图主题常用的公式结构：
 * 上下标（^_）、分式（\frac）、根号（\sqrt）、常见符号和希腊字母。
 * 不支持 \newcommand、\begin 等复杂环境。
 */
class EquationParser {
  constructor(source) {
    this.source = source;
    this.index = 0;
  }

  parseRow(stopChar = '') {
    const children = [];
    while (this.index < this.source.length) {
      const char = this.peek();
      if (stopChar && char === stopChar) {
        this.index += 1;
        break;
      }
      if (char === '}') break;
      if (char === '^' || char === '_') {
        this.applyScript(children, char);
        continue;
      }
      const atom = this.parseAtom();
      if (atom) this.pushAtom(children, atom);
    }
    return children;
  }

  pushAtom(children, atom) {
    const previous = children[children.length - 1];
    if (previous?.type === 'text' && atom.type === 'text') {
      previous.text += atom.text;
      return;
    }
    children.push(atom);
  }

  parseAtom() {
    const char = this.peek();
    if (!char) return null;
    if (char === '{') {
      this.index += 1;
      return { type: 'row', children: this.parseRow('}') };
    }
    if (char === '\\') return this.parseCommand();
    this.index += 1;
    if (/\s/.test(char)) return { type: 'space' };
    return { type: 'text', text: char };
  }

  parseCommand() {
    this.index += 1;
    const command = this.readCommand();
    if (!command) return { type: 'text', text: '\\' };
    if (command === ',' || command === ';' || command === 'quad' || command === 'qquad') {
      return { type: 'space', width: command === 'qquad' ? 16 : command === 'quad' ? 10 : 4 };
    }
    if (command === 'frac') {
      return {
        type: 'frac',
        numerator: this.parseRequiredGroup(),
        denominator: this.parseRequiredGroup(),
      };
    }
    if (command === 'sqrt') {
      return { type: 'sqrt', body: this.parseRequiredGroup() };
    }
    if (command === 'int') return { type: 'symbol', text: '\u222b', large: true };
    if (SYMBOL_MAP[command]) {
      return { type: 'symbol', text: SYMBOL_MAP[command] };
    }
    return { type: 'text', text: command };
  }

  /*
   * 解析必需的组参数：花括号括起的内容组，或单个原子。
   * 用于 \frac{num}{den} 和 \sqrt{body} 等命令的参数提取。
   */
  parseRequiredGroup() {
    this.skipSpaces();
    if (this.peek() === '{') {
      this.index += 1;
      return { type: 'row', children: this.parseRow('}') };
    }
    return this.parseAtom() || { type: 'row', children: [] };
  }

  /*
   * 将 ^ 和 _ 应用到前一个节点作为上下标。
   * 连续上下标（如 x^2_3）合并到一个 scripts 节点。
   */
  applyScript(children, scriptChar) {
    this.index += 1;
    const script = this.parseRequiredGroup();
    const base = children.pop() || { type: 'row', children: [] };
    if (base.type === 'scripts') {
      children.push({
        ...base,
        sup: scriptChar === '^' ? script : base.sup,
        sub: scriptChar === '_' ? script : base.sub,
      });
      return;
    }
    children.push({
      type: 'scripts',
      base,
      sup: scriptChar === '^' ? script : null,
      sub: scriptChar === '_' ? script : null,
    });
  }

  readCommand() {
    const start = this.index;
    while (/[A-Za-z]/.test(this.peek())) this.index += 1;
    if (this.index > start) return this.source.slice(start, this.index);
    const char = this.peek();
    this.index += 1;
    return char || '';
  }

  skipSpaces() {
    while (/\s/.test(this.peek())) this.index += 1;
  }

  peek() {
    return this.source[this.index] || '';
  }
}

function renderEquationNode(node, context) {
  if (!node) return emptyBox();
  if (node.type === 'row') return renderRow(node.children || [], context);
  if (node.type === 'space') return renderSpace(node, context);
  if (node.type === 'frac') return renderFraction(node, context);
  if (node.type === 'sqrt') return renderSqrt(node, context);
  if (node.type === 'scripts') return renderScripts(node, context);
  if (node.type === 'symbol') return renderText(node.text, context, { large: node.large });
  return renderText(node.text || '', context);
}

function renderRow(children, context) {
  const boxes = children.map((child) => renderEquationNode(child, context));
  const width = boxes.reduce((sum, box) => sum + box.width + ROW_GAP, 0) - ROW_GAP;
  const baseline = Math.max(...boxes.map((box) => box.baseline), context.fontSize * 0.82);
  const descent = Math.max(
    ...boxes.map((box) => box.height - box.baseline),
    context.fontSize * 0.22
  );
  const group = svg('g');
  let cursorX = 0;
  for (const box of boxes) {
    group.appendChild(placeBox(box, cursorX, baseline - box.baseline));
    cursorX += box.width + ROW_GAP;
  }
  return {
    element: group,
    width: Math.max(0, width),
    height: baseline + descent,
    baseline,
  };
}

function renderText(text, context, options = {}) {
  const fontSize = options.large ? context.fontSize * 1.45 : context.fontSize;
  const width = estimateTextWidth(text, fontSize, options);
  const height = fontSize * 1.2;
  const baseline = fontSize * 0.86;
  const textEl = svg('text', {
    x: 0,
    y: baseline,
    fill: context.color,
    'font-size': fontSize,
    'font-family': 'STIX Two Math, Cambria Math, Times New Roman, serif',
    'font-weight': 400,
  });
  appendMathText(textEl, text);
  return { element: textEl, width, height, baseline };
}

function renderSpace(node, context) {
  return {
    element: svg('g'),
    width: Number(node.width) || context.fontSize * 0.18,
    height: context.fontSize,
    baseline: context.fontSize * 0.8,
  };
}

function renderFraction(node, context) {
  const childContext = { ...context, fontSize: context.fontSize * FRACTION_SCALE };
  const numerator = renderEquationNode(node.numerator, childContext);
  const denominator = renderEquationNode(node.denominator, childContext);
  const width = Math.max(numerator.width, denominator.width) + FRACTION_PADDING_X * 2;
  const numeratorX = (width - numerator.width) / 2;
  const denominatorX = (width - denominator.width) / 2;
  const lineY = numerator.height + FRACTION_GAP;
  const denominatorY = lineY + FRACTION_GAP + FRACTION_LINE_WIDTH;
  const group = svg('g');
  group.appendChild(placeBox(numerator, numeratorX, 0));
  group.appendChild(
    svg('line', {
      x1: 0,
      x2: width,
      y1: lineY,
      y2: lineY,
      stroke: context.color,
      'stroke-width': FRACTION_LINE_WIDTH,
      'stroke-linecap': 'round',
    })
  );
  group.appendChild(placeBox(denominator, denominatorX, denominatorY));
  return {
    element: group,
    width,
    height: denominatorY + denominator.height,
    baseline: denominatorY + denominator.baseline,
  };
}

function renderSqrt(node, context) {
  const body = renderEquationNode(node.body, context);
  const width = body.width + SQRT_EXTRA_WIDTH;
  const height = body.height + 4;
  const baseline = body.baseline + 4;
  const group = svg('g');
  const rootY = 4;
  const bottomY = Math.max(height - 2, baseline + 3);
  group.appendChild(
    svg('path', {
      d: `M1 ${baseline - 2} L5 ${bottomY - 1} L10 ${rootY} L${width} ${rootY}`,
      fill: 'none',
      stroke: context.color,
      'stroke-width': 1.4,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    })
  );
  group.appendChild(placeBox(body, SQRT_EXTRA_WIDTH, 4));
  return { element: group, width, height, baseline };
}

function renderScripts(node, context) {
  const base = renderEquationNode(node.base, context);
  const scriptContext = { ...context, fontSize: context.fontSize * SCRIPT_SCALE };
  const sup = node.sup ? renderEquationNode(node.sup, scriptContext) : null;
  const sub = node.sub ? renderEquationNode(node.sub, scriptContext) : null;
  const scriptWidth = Math.max(sup?.width || 0, sub?.width || 0);
  const supLift = sup ? sup.height * 0.62 : 0;
  const subDrop = sub ? sub.height * 0.42 : 0;
  const baseline = base.baseline + supLift;
  const height = supLift + base.height + subDrop * 0.7;
  const group = svg('g');
  group.appendChild(placeBox(base, 0, baseline - base.baseline));
  if (sup) {
    group.appendChild(
      placeBox(sup, base.width + 1, Math.max(0, baseline - base.baseline - supLift))
    );
  }
  if (sub) {
    group.appendChild(placeBox(sub, base.width + 1, baseline + subDrop * 0.15));
  }
  return {
    element: group,
    width: base.width + scriptWidth + 1,
    height,
    baseline,
  };
}

function estimateTextWidth(text, fontSize, options = {}) {
  if (options.large) return text.length * fontSize * SYMBOL_WIDTH_RATIO;
  let width = 0;
  for (const char of Array.from(text)) {
    if (/[0-9]/.test(char)) {
      width += fontSize * NUMBER_WIDTH_RATIO;
    } else if (/[=+\-*/(),]/.test(char)) {
      width += fontSize * OPERATOR_WIDTH_RATIO;
    } else if (/[A-Za-z]/.test(char)) {
      width += fontSize * TEXT_WIDTH_RATIO;
    } else {
      width += fontSize * SYMBOL_WIDTH_RATIO;
    }
  }
  return width;
}

function appendMathText(textEl, text) {
  for (const char of Array.from(text)) {
    const tspan = svg('tspan', {
      'font-style': /[A-Za-z]/.test(char) ? 'italic' : 'normal',
    });
    tspan.textContent = char;
    textEl.appendChild(tspan);
  }
}

function emptyBox() {
  return { element: svg('g'), width: 0, height: 0, baseline: 0 };
}

function placeBox(box, x, y) {
  const group = svg('g', { transform: `translate(${x} ${y})` });
  group.appendChild(box.element);
  return group;
}

function svg(tagName, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    element.setAttribute(key, String(value));
  }
  return element;
}
