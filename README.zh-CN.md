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
layout: mindmap-right
connector:
  style: curve
font:
  size: 14
  weight: 560
  lineHeight: 18
  levels:
    1:
      size: 16
      weight: 700
topic:
  maxWidth: 240
source:
  enableTabIndent: true
  height: 520
---

# AI学习 [color=#3b82f6 layout=mindmap-right]

## 基础 [icon=book]

### 计算机网络

### 操作系统

## AI [color=#10b981]

### Transformer

### RAG
```
````

## 语法

- 使用主题级别标记表示层级：`#` 是中心主题，`##` 是二级主题，`###` 是三级主题，依此类推。
- `yxmm` 代码块中的非空行必须使用主题级别标记语法。
- 主题属性写在标题后面，格式为 `[key=value]`。
- 当前支持的属性：
  - `color=#3b82f6`：主题颜色。
  - `layout=mindmap-right`、`layout=mindmap-left`、`layout=mindmap-bidirectional`：局部布局类型。
  - `icon=book`：主题图标。
  - `fontSize=16`、`fontWeight=700`、`fontFamily="..."`、`lineHeight=20`：覆盖单个主题字体。

## 标准术语

为了让文档、配置、界面和代码注释保持一致，yonxao-mindmap 使用下面这些标准术语。

表格中的 `-` 表示该术语与标准术语含义几乎一致，不重复写。

==yxmm 借用 主题级别标记符号表达层级，但在 yonxao-mindmap 中统一称为“主题级别”。例如 `#` 是一级主题，`##` 是二级主题，而不是 Markdown 文档标题或 HTML 标题。==

### 基础结构

| 中文术语    | English Term    | yxmm 术语            | 作用 / 功能说明                                            |
| ----------- | --------------- | -------------------- | ---------------------------------------------------------- |
| 思维导图    | Mind Map        | yonxao-mindmap       | 用中心主题向外发散组织信息的图形化工具。                   |
| yxmm 代码块 | yxmm Code Block | <code>```yxmm</code> | 插件读取和保存的最小单位。                                 |
| 配置区      | Config Block    | `--- ... ---`        | 保存主题方案、布局、字体、工具栏位置、幕布高度等全局配置。 |
| 正文区      | Body            | -                    | 用主题级别描述主题树结构。                                 |
| 源码模式    | Source Mode     | -                    | 直接编辑 `yxmm` 文本的模式。                               |
| 导图模式    | Map Mode        | -                    | 把 `yxmm` 渲染成 SVG 图形后的可视化模式。                  |
| 主题        | Topic           | -                    | 图中的一个信息主题。                                       |

### 关系结构

| 中文术语                     | English Term               | yxmm 术语                     | 作用 / 功能说明                                                     |
| ---------------------------- | -------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| 主题级别                     | Topic Level                | `#` / `##` / `###`            | 表示主题层级；`#` 是一级主题，`##` 是二级主题，`###` 是三级主题。   |
| 中心主题 / 根主题            | Central Topic / Root Topic | 一级主题 / `#` / 中心主题     | 整张图的核心概念，通常位于导图中心或结构起点。                      |
| 主分支 / 一级分支 / 分支主题 | Main Branch / Branch Topic | 二级主题 / `##` / 分支主题    | 从中心主题直接延伸出的主题。                                        |
| 普通主题                     | Normal Topic               | 三级主题及更深 / `###` 及更深 | 除中心主题和分支主题之外的普通层级主题。                            |
| 子主题                       | Subtopic                   | -                             | 某个主题下面继续展开的内容。                                        |
| 父主题                       | Parent Topic               | -                             | 当前主题的上一级主题。                                              |
| 同级主题                     | Sibling Topic              | -                             | 与当前主题处于同一层级、拥有同一个父主题的主题。                    |
| 上一个同级主题 / 兄主题      | Previous Sibling Topic     | -                             | 当前主题在同级主题中的前一个主题。                                  |
| 下一个同级主题 / 弟主题      | Next Sibling Topic         | -                             | 当前主题在同级主题中的后一个主题。                                  |
| 分支                         | Branch                     | -                             | 从一个主题延伸出的结构线和下级内容。                                |
| 主题                         | Topic                      | 主题                          | 图中的一个信息点，通常等同于“主题”；代码实现中更常使用 Topic 表达。 |
| 叶子主题                     | Leaf Topic                 | 叶子主题                      | 没有子主题的最末端主题。                                            |
| 子树                         | Subtree                    | -                             | 某个主题以及它下面所有后代主题组成的结构。                          |
| 连线                         | Connector                  | -                             | 表示父主题和子主题之间关系的线。                                    |
| 连线线型                     | Connector Style            | -                             | 控制连线显示为曲线、直线或折线。                                    |
| 子线出口                     | Child Connector Outlet     | -                             | 连线从当前主题边框离开并指向子主题的位置。                          |
| 父线入口                     | Parent Connector Inlet     | -                             | 父主题连线进入当前主题边框的位置。                                  |

### 内容组件

| 中文术语 | English Term      | yxmm 术语                             | 作用 / 功能说明                    |
| -------- | ----------------- | ------------------------------------- | ---------------------------------- |
| 文本     | Text              | 主题文本                              | 表达主题内容。                     |
| 主题属性 | Topic Attribute   | `[key=value]`                         | 写在主题文本末尾，只影响当前主题。 |
| 主题颜色 | Topic Color       | `[color=#...]`                        | 设置单个主题颜色。                 |
| 主题图标 | Topic Icon        | `[icon=book]`                         | 设置单个主题图标。                 |
| 主题字体 | Topic Font Family | `[fontFamily="..."]` / `font.family`  | 设置主题文字使用的字体族。         |
| 主题字号 | Topic Font Size   | `[fontSize=16]` / `font.size`         | 设置主题文字大小。                 |
| 主题字重 | Topic Font Weight | `[fontWeight=700]` / `font.weight`    | 设置主题文字粗细。                 |
| 主题行高 | Topic Line Height | `[lineHeight=20]` / `font.lineHeight` | 设置多行主题文本的行间距。         |
| 局部配置 | Local Config      | 主题属性                              | 只影响单个主题的配置。             |
| 全局配置 | Global Config     | 配置区                                | 影响整张图默认行为的配置。         |
| 配置项   | Config Key        | YAML key                              | 配置区中的某个具体字段。           |

### 布局结构

| 中文术语   | English Term       | yxmm 术语                             | 作用 / 功能说明                                                |
| ---------- | ------------------ | ------------------------------------- | -------------------------------------------------------------- |
| 布局类型   | layout type        | `layout`                              | 控制整张图的组织方式。                                         |
| 思维导图   | mind map           | `mindmap-right`(默认)：右向思维导图   | 中心主题在左侧，分支向右展开。适合列表式、流程式阅读。         |
|            |                    | `mindmap-left`：左向思维导图          | 中心主题在右侧，分支向左展开。适合与右向布局配合或特殊排版。   |
|            |                    | `mindmap-bidirectional`：双向思维导图 | 中心主题居中，一级分支向左右两侧展开。最符合传统思维导图形态。 |
|            |                    | `mindmap-up`：上向思维导图            | 中心主题在下方，分支向上展开。                                 |
|            |                    | `mindmap-down`：下向思维导图          | 中心主题在上方，分支向下展开。                                 |
|            |                    | `mindmap-vertical`：垂直双向思维导图  | 中心主题居中，一级分支向上、向下展开。                         |
| 树形图     | tree diagram       | `tree`：树形图                        | 中心主题在顶部，二级主题为一根垂直主根，子节点交替在主根两侧   |
|            |                    | `tree-right`：右向树形图              | 中心主题在顶部，二级主题为一根垂直主根，子节点交替在主根右侧   |
|            |                    | `tree-left` ：左向树形图              | 中心主题在顶部，二级主题为一根垂直主根，子节点交替在主根左侧   |
| 组织结构图 | organization chart | `org` ：组织结构图                    | 强调上下级关系和同层对齐。                                     |
|            |                    | `org-right`：右向组织结构图           | 组织结构图的三级节点及其子节点向右展开。                       |
| 时间轴     | timeline           | `timeline`：时间轴                    | 分支沿水平轴排列，后代在轴上下交替展开。                       |
|            |                    | `timeline-up`：上侧时间轴             | 分支沿水平轴排列，后代在轴上方展开。                           |
|            |                    | `timeline-down`：下侧时间轴           | 分支沿水平轴排列，后代在轴下方展开。                           |
| 放射图     | radial map         | `radial`：放射图                      | 围绕中心主题向四周径向分布。                                   |
| 鱼骨图     | fishbone diagram   | `fishbone-left`：左向鱼骨图           | 鱼头在左侧，主骨从右向左延伸。                                 |
|            |                    | `fishbone-right`：右向鱼骨图          | 鱼头在右侧，主骨从左向右延伸。                                 |
| 树形表格   | tree table         | `tree-table`：树形表格                | 把主题树渲染为表格，叶子主题会横向填满剩余列。                 |
|            |                    | `tree-table-stepped`：阶梯树形表格    | 把主题树渲染为表格，但叶子主题只占当前列，保留阶梯状轮廓。     |

### 鱼骨图专用结构

| 中文术语 | English Term  | yxmm 术语 / 配置名 | 作用或功能说明                                           |
| -------- | ------------- | ------------------ | -------------------------------------------------------- |
| 鱼头     | fish head     | `#`                | 中心主题所在的一侧。目前插件实现的是鱼头在左、鱼尾在右。 |
| 主骨     | main spine    | -                  | 从鱼头延伸到鱼尾的水平主线。                             |
| 鱼尾     | fish tail     | -                  | 主骨末端的尾部标记。                                     |
| 大分支   | primary bone  | `##`               | 鱼骨图中的一级分支主题，通过斜骨线连接到主骨。           |
| 斜骨线   | diagonal bone | -                  | 大分支和主骨之间的斜向连接线。                           |
| 鱼刺主题 | rib topic     | `###`              | 挂在斜骨线上的主题。                                     |

### 功能组件

| 中文术语      | English Term           | yxmm 术语 / 配置名                | 作用或功能说明                               |
| ------------- | ---------------------- | --------------------------------- | -------------------------------------------- |
| 悬浮工具栏    | floating toolbar       | `toolbar.x` / `toolbar.y`         | 放置常用操作按钮，可以拖动位置。             |
| 配置弹框      | config modal           | -                                 | 可视化修改主题、结构、字体、源码和高级配置。 |
| 主题编辑面板  | topic editor           | -                                 | 编辑主题文本、颜色、图标、布局等。           |
| 编辑按钮      | edit button            | -                                 | 打开主题编辑面板；部分紧凑布局会隐藏。       |
| 折叠/展开按钮 | collapse/expand button | -                                 | 隐藏或显示当前主题的子树。                   |
| 新增按钮      | add button             | -                                 | 在主题旁新增子主题或兄弟主题。               |
| 右键菜单      | context menu           | -                                 | 主题操作入口，例如新增、删除、折叠和展开。   |
| 源码编辑区    | source editor          | -                                 | 源码模式中的文本编辑区域。                   |
| 工具栏抓手    | toolbar grip           | -                                 | 拖动悬浮工具栏的位置。                       |
| 高度拖拽条    | height resize handle   | `canvas.height` / `source.height` | 调整导图幕布或源码模式高度。                 |

### 视觉与交互区域

| 中文术语     | English Term         | yxmm 术语 / 配置名   | 作用或功能说明                                          |
| ------------ | -------------------- | -------------------- | ------------------------------------------------------- |
| 幕布         | canvas               | `canvas.height`      | 承载 SVG 导图的可视区域。                               |
| 视口         | viewport             | -                    | 当前 SVG 中正在被查看的坐标范围；平移和缩放会改变视口。 |
| 主题卡片     | topic card           | -                    | 主题的矩形外观，包括背景、边框和圆角。                  |
| 主题色系     | theme                | -                    | 控制整体颜色方案，避免和“主题 / Topic”混淆。            |
| 默认主题颜色 | default topic color  | `topic.defaultColor` | 覆盖主题自动配色；主题属性 `color` 仍然优先。           |
| 字体         | font                 | `font.*`             | 控制主题文字样式。                                      |
| 连线线型     | connector style      | `connector.style`    | 控制连线为曲线、直线或折线。                            |
| 平移         | pan                  | -                    | 拖动幕布改变视口位置。                                  |
| 缩放         | zoom                 | -                    | 放大或缩小当前视口。                                    |
| 适配视图     | fit view             | -                    | 自动调整视口，让导图尽量完整显示。                      |
| 重置折叠状态 | reset collapse state | -                    | 清除当前折叠记录，展开所有主题。                        |
| 自动高度     | auto height          | -                    | 根据导图内容自动计算幕布高度。                          |
| 手动高度     | manual height        | `canvas.height`      | 用户拖拽后保存的幕布高度。                              |

## 配置区

`yxmm` 代码块顶部可以写一段 `---` 包裹的配置区，用来保存全局默认行为。配置区和正文主题是分离的：配置区控制默认值，正文区继续只表达导图结构。

### 插件偏好设置

Obsidian 的 `设置` -> `第三方插件` -> `yonxao-mindmap` 中提供了插件级别的“全局默认配置”。

偏好设置中还提供语言选项，首次默认语言会跟随 Obsidian 当前语言；如果 Obsidian 语言暂不支持，则回退到 English。当前支持：

- English：兜底语言。
- 中文（简体）。
- 中文（繁體）。
- 日本語。
- 한국어。
- Français。
- Deutsch。
- Español。
- Português (Brasil)。
- Русский。
- Italiano。
- Bahasa Indonesia。
- Türkçe。
- Tiếng Việt。
- ไทย。
- हिन्दी。

全局默认配置会作为所有 `yxmm` 代码块的基础配置；单个代码块顶部的配置区会覆盖全局默认配置，主题属性会继续覆盖配置区。例如：

`主题属性` > `代码块配置区` > `插件全局默认配置` > `插件内置默认值`

这个设置适合放统一偏好，例如默认主题色系、默认布局类型、默认字体、默认连线线型、是否启用滚轮缩放等。它由 Obsidian 保存到插件本地的 `data.json`，不会写入发布包，也不会自动写进每个 Markdown 文档。

当前支持的配置项：

- `canvas.height`：幕布高度。拖动幕布底部边缘后会自动写入；双击拖拽条会移除该项并恢复自动高度。
- `toolbar.x` / `toolbar.y`：悬浮工具栏位置。拖动工具栏抓手后会自动写入。
- `interaction.wheelZoom`：是否启用鼠标滚轮缩放。默认关闭；开启后会写入 `true`，关闭时可删除该项。
- `theme`：主题名称，可选 `default`、`ocean`、`forest`、`sunset`、`mono`、`rainbow`、`pastel-rainbow`、`neon-rainbow`。
- `layout`：布局类型，可选 `mindmap-right`、`mindmap-left`、`mindmap-bidirectional`、`mindmap-down`、`mindmap-up`、`mindmap-vertical`、`tree`、`tree-right`、`tree-left`、`org`、`org-right`、`timeline`、`timeline-up`、`timeline-down`、`radial`、`fishbone-left`、`tree-table`、`tree-table-stepped`。
- `connector.style`：连线线型，可选 `curve`、`straight`、`elbow`。`curve` 是曲线，技术上是三次贝塞尔曲线；`straight` 是直线；`elbow` 是正交折线。
- `font.family`、`font.size`、`font.weight`、`font.lineHeight`：全局默认字体。
- `font.levels.1`、`font.levels.2`：按主题级别设置字体，数字对应 `#`、`##`、`###` 的层级。
- `topic.defaultColor`：默认主题颜色，会覆盖主题自动配色；主题属性 `color` 仍然优先。
- `topic.maxWidth`：主题最大宽度，长标题会按这个宽度换行。
- `source.enableTabIndent`：源码模式中是否启用 `Tab` / `Shift+Tab` 调整主题级别。
- `source.height`：源码模式高度，和导图模式的 `canvas.height` 分开保存。

字体优先级从高到低是：

`主题属性` > `font.levels[当前级别]` > `font 全局配置` > `插件默认值`

字体范围：

- `size`：字号，范围 `9` 到 `96`。
- `weight`：字重，范围 `100` 到 `900`，遵循 CSS 字重标准。
- `lineHeight`：行高，范围 `12` 到 `160`，表示 SVG 文本每行之间的像素距离。建议约为字号的 `1.3` 到 `1.5` 倍。

主题颜色优先级从高到低是：

`主题属性 color` > `topic.defaultColor` > `theme 自动配色`

其中 `rainbow`、`pastel-rainbow`、`neon-rainbow` 会按一级分支自动分配不同颜色。
中心主题会使用主题独立中心色；主题属性 `color` 只改变主题本身，不改变它和父主题之间的连接线颜色。
配置区中的 hex 颜色建议写成带引号的字符串，例如 `defaultColor: '#66ed0c'`；通过配置弹框保存时会自动加引号。

布局类型说明：

- 思维导图：`mindmap-right` 右向思维导图、`mindmap-left` 左向思维导图、`mindmap-bidirectional` 双向思维导图、`mindmap-up` 上向思维导图、`mindmap-down` 下向思维导图、`mindmap-vertical` 垂直双向思维导图。
- 树形图：`tree` 树形图、`tree-right` 右向树形图、`tree-left` 左向树形图。
- 组织结构图：`org` 组织结构图、`org-right` 右向组织结构图。
- 时间轴：`timeline` 时间轴、`timeline-up` 上侧时间轴、`timeline-down` 下侧时间轴。
- 放射图：`radial` 放射图。
- 鱼骨图：`fishbone-left` 左向鱼骨图。
- 树形表格：`tree-table` 树形表格、`tree-table-stepped` 阶梯树形表格。

`mindmap-down` 属于思维导图布局，强调从中心主题向下发散；`org` 属于组织结构图，强调同层级横向对齐和上下级关系；`org-right` 属于右向组织结构图，一级分支横向排列，二级及更深主题从各自分支向右下展开。

## 操作

- 阅读视图和编辑视图 Live Preview 都可以显示导图。
- 阅读视图默认只提供浏览能力；主题改名、新增、删除、拖拽排序和右键主题菜单只在编辑视图 Live Preview 中启用。
- 点击有子主题旁边的折叠/展开圆点，可以折叠或展开子主题。
- 使用插件工具栏中的源码/导图按钮，可以在源码模式和导图模式之间切换。
- 源码模式中可以直接编辑 `yxmm` 文本，切回导图时会自动保存，也可以按 `Ctrl/Cmd+S` 保存。
- 源码模式中，`Tab` / `Shift+Tab` 可以提升或降低选中标题行的层级。
- 编辑视图的导图模式中，悬停主题并点击主题上的小编辑按钮，可以编辑主题文本、颜色、图标和布局。
- 主题编辑面板支持新增子主题和删除当前主题。
- 工具栏支持适配视图、放大、缩小和重置折叠状态。
- 工具栏中的配置按钮可以打开可视化配置弹框；常用项可用下拉框选择，高级页也可以直接编辑 YAML 配置。
- 拖动工具栏左侧抓手可以移动工具栏位置，避免遮挡导图内容。
- 拖动幕布可以平移视图。默认情况下鼠标滚轮会继续滚动 Obsidian 页面；在配置弹框“基础”页开启“启用鼠标滚轮缩放”后，滚轮会缩放当前导图。
- 拖动幕布底部边缘可以手动调整幕布高度，双击拖拽条可以恢复自动高度。
- Obsidian 自带的“编辑这个块”按钮会继续保留；插件工具栏默认放在导图左上角，避免和它冲突。

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
