# yonxao-mindmap

yonxao-mindmap 是一个 Obsidian 思维导图显示插件。它会把 Markdown 文档中的 `yxmm` 代码块渲染成可交互的 SVG 思维导图。

[English README](README.md)

## 用法

在 Markdown 文档中写入 `yxmm` 代码块：

````markdown
```yxmm
---
canvas:
  height: 420
toolbar:
  x: 8
  y: 8
layout:
  defaultDirection: right
edge:
  type: curve
font:
  size: 14
  weight: 560
  lineHeight: 18
  levels:
    1:
      size: 16
      weight: 700
node:
  maxWidth: 240
source:
  enableTabIndent: true
  height: 520
---

# AI学习 [color=#3b82f6 layout=right]

## 基础 [icon=book]

### 计算机网络

### 操作系统

## AI [color=#10b981]

### Transformer

### RAG
```
````

## 语法

- 使用 Markdown 标题表示层级：`#` 是中心节点，`##` 是二级节点，`###` 是三级节点，依此类推。
- `yxmm` 代码块中的非空行必须使用 Markdown 标题语法。
- 节点属性写在标题后面，格式为 `[key=value]`。
- 当前支持的属性：
  - `color=#3b82f6`：节点颜色。
  - `layout=right`、`layout=left`、`layout=balanced`：布局方向。
  - `icon=book`：节点图标。
  - `fontSize=16`、`fontWeight=700`、`fontFamily="..."`、`lineHeight=20`：覆盖单个节点字体。

## 配置区

`yxmm` 代码块顶部可以写一段 `---` 包裹的配置区，用来保存全局默认行为。配置区和正文节点是分离的：配置区控制默认值，正文标题继续只表达脑图结构。

当前支持的配置项：

- `canvas.height`：幕布高度。拖动画布底部边缘后会自动写入；双击拖拽条会移除该项并恢复自动高度。
- `toolbar.x` / `toolbar.y`：悬浮工具栏位置。拖动工具栏抓手后会自动写入。
- `interaction.wheelZoom`：是否启用鼠标滚轮缩放。默认关闭；开启后会写入 `true`，关闭时可删除该项。
- `theme`：主题名称，可选 `default`、`ocean`、`forest`、`sunset`、`mono`、`rainbow`、`pastel-rainbow`、`neon-rainbow`。
- `layout.defaultDirection`：布局结构，可选 `right`、`left`、`balanced`、`down`、`up`、`vertical`、`tree`、`tree-left`、`tree-balanced`、`org`、`org-right`、`timeline-up`、`timeline`、`timeline-balanced`、`radial`。
- `edge.type`：连线类型，可选 `curve`、`straight`、`elbow`。`curve` 是曲线，技术上是三次贝塞尔曲线；`straight` 是直线；`elbow` 是正交折线。
- `font.family`、`font.size`、`font.weight`、`font.lineHeight`：全局默认字体。
- `font.levels.1`、`font.levels.2`：按标题级别设置字体，数字对应 `#`、`##`、`###` 的层级。
- `node.defaultColor`：统一节点颜色，会覆盖主题自动配色；节点属性 `color` 仍然优先。
- `node.maxWidth`：节点最大宽度，长标题会按这个宽度换行。
- `source.enableTabIndent`：源码模式中是否启用 `Tab` / `Shift+Tab` 调整标题级别。
- `source.height`：源码模式高度，和脑图模式的 `canvas.height` 分开保存。

字体优先级从高到低是：

`节点属性` > `font.levels[当前级别]` > `font 全局配置` > `插件默认值`

字体范围：

- `size`：字号，范围 `9` 到 `96`。
- `weight`：字重，范围 `100` 到 `900`，遵循 CSS 字重标准。
- `lineHeight`：行高，范围 `12` 到 `160`，表示 SVG 文本每行之间的像素距离。建议约为字号的 `1.3` 到 `1.5` 倍。

主题颜色优先级从高到低是：

`节点属性 color` > `node.defaultColor` > `theme 自动配色`

其中 `rainbow`、`pastel-rainbow`、`neon-rainbow` 会按一级分支自动分配不同颜色。
中心节点会使用主题独立中心色；节点属性 `color` 只改变节点本身，不改变它和父节点之间的连接线颜色。
配置区中的 hex 颜色建议写成带引号的字符串，例如 `defaultColor: '#66ed0c'`；通过配置弹框保存时会自动加引号。

布局结构说明：

- 思维导图：`right` 右向展开、`left` 左向展开、`balanced` 左右平衡、`down` 向下展开、`up` 向上展开、`vertical` 上下平衡。
- 树状结构：`tree` 向右树、`tree-left` 向左树、`tree-balanced` 平衡树。
- 组织结构图：`org` 向下展开、`org-right` 下右展开。
- 时间轴：`timeline-up` 轴上展开、`timeline` 轴下展开、`timeline-balanced` 上下平衡轴。
- 其他：`radial` 放射图。

`down` 属于思维导图布局，强调从中心主题向下发散；`org` 属于组织结构图，强调同层级横向对齐和上下级关系；`org-right` 属于下右展开组织结构图，一级分支横向排列，二级及更深节点从各自分支向右下展开。

## 操作

- 阅读视图和编辑视图 Live Preview 都可以显示思维导图。
- 阅读视图默认只提供浏览能力；节点改名、新增、删除、拖拽排序和右键节点菜单只在编辑视图 Live Preview 中启用。
- 点击有子节点旁边的折叠/展开圆点，可以折叠或展开子节点。
- 使用插件工具栏中的源码/导图按钮，可以在源码模式和思维导图模式之间切换。
- 源码模式中可以直接编辑 `yxmm` 文本，切回思维导图时会自动保存，也可以按 `Ctrl/Cmd+S` 保存。
- 源码模式中，`Tab` / `Shift+Tab` 可以提升或降低选中标题行的层级。
- 编辑视图的思维导图模式中，悬停节点并点击节点上的小编辑按钮，可以编辑节点文本、颜色、图标和布局。
- 节点编辑面板支持新增子节点和删除当前节点。
- 工具栏支持适配视图、放大、缩小和重置折叠状态。
- 工具栏中的配置按钮可以打开可视化配置弹框；常用项可用下拉框选择，高级页也可以直接编辑 YAML 配置。
- 拖动工具栏左侧抓手可以移动工具栏位置，避免遮挡脑图内容。
- 拖动画布可以平移视图。默认情况下鼠标滚轮会继续滚动 Obsidian 页面；在配置弹框“基础”页开启“启用鼠标滚轮缩放”后，滚轮会缩放当前脑图。
- 拖动画布底部边缘可以手动调整幕布高度，双击拖拽条可以恢复自动高度。
- Obsidian 自带的“编辑这个块”按钮会继续保留；插件工具栏默认放在脑图左上角，避免和它冲突。

所有编辑都会写回当前 Markdown 文件中的同一个 `yxmm` 代码块。

## 字体

插件使用适合中文和代码显示的等宽字体栈作为默认字体。只要本机安装了这些字体，就会优先使用：

- Noto Sans Mono CJK SC
- Source Han Mono SC
- Sarasa Mono SC
- Cascadia Mono
- JetBrains Mono
- Liberation Mono

配置弹框的字体设置支持“按类型分组的预设下拉框 + 自定义输入框”：

- 预设下拉框按继承与自定义、Obsidian、中文常用、系统字体、等宽字体分组。
- 中文常用预设包括黑体、宋体、楷体、仿宋、微软雅黑、苹方、思源黑体、思源宋体、霞鹜文楷。
- 选择“自定义”后，可以直接填写 CSS 字体族，例如 `"LXGW WenKai", "Source Han Sans SC", sans-serif`。
- 浏览器环境不能可靠读取完整系统字体列表，所以插件使用内置候选字体列表；如果本机没有安装某个字体，浏览器会自动使用后面的 fallback 字体。

## 内置图标

当前内置图标包括：

`book`、`brain`、`cpu`、`database`、`file`、`folder`、`tag`、`star`、`check`、`lightbulb`

如果填写了未知图标名，插件会把图标名渲染成一个小文本徽标。

## 开发

可维护源码放在 `src/` 和 `styles/` 目录中。

- `src/` 下的业务源码统一使用 ESM `import/export`。
- `scripts/` 下的构建脚本统一使用 `.mjs`。
- `src/main.js` 会通过 `scripts/build-js.mjs` 打包成 `dist/main.js`。
- `styles/index.css` 会通过 `scripts/build-css.mjs` 合并成 `dist/styles.css`。
- `npm run release:prepare` 会生成干净的发布目录 `dist/`，其中只包含 Obsidian 安装需要的核心文件。
- 如果使用 Obsidian Hot Reload 做本地调试，可以运行 `npm run dev:obsidian`，它会先执行 `release:prepare`，再把根目录 `.hotreload` 复制到 `dist/.hotreload`。
- 日常开发优先修改源码目录，然后运行 `npm run release:prepare`。
- 提交前建议运行 `npm run validate`。

发布、手动安装、打包 zip 或本地 Hot Reload 调试时，请使用 `dist/` 目录。
`package.json`、`manifest.json`、`versions.json` 属于标准 JSON 文件，格式本身不支持注释；相关说明放在 README 和相邻的 `.mjs` 配置文件中。

### 发布目录

运行：

```bash
npm run release:prepare
```

会生成：

```text
dist/
  .hotreload  # 仅 npm run dev:obsidian 生成，本地 Hot Reload 调试使用
  main.js
  manifest.json
  styles.css
```

其中 `main.js`、`manifest.json`、`styles.css` 是 Obsidian 插件安装目录需要的核心文件。
`.hotreload` 只在本地开发调试时复制到 `dist/`，正式发布包不需要包含它。
用户本地可能出现的 `data.json` 是 Obsidian 保存插件设置时自动生成的，不应该放进发布包。

## 许可证

本项目采用 AGPLv3 + 商业授权双许可证：

- AGPLv3：见 [LICENSE](LICENSE)
- 商业授权：见 [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)
