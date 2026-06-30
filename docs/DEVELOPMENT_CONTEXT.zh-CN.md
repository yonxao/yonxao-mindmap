# yonxao-mindmap 开发上下文

这份文档用于让新的大模型会话快速接手 `yonxao-mindmap` 项目。它不是用户手册，而是开发协作备忘录，记录长期开发中已经确认的架构、术语、流程和容易踩坑的地方。

如果开启新会话，可以先让大模型阅读本文件，再继续按当前代码实现具体需求：

```text
这是 yonxao-mindmap 项目。请先阅读 docs/DEVELOPMENT_CONTEXT.zh-CN.md，然后继续按其中约定协作。
```

---

# 一、项目基础

## 1. 项目概况

`yonxao-mindmap` 是一个 Obsidian 第三方插件，用于把 Markdown 文档中的 `yxmm` 代码块渲染为可交互的 SVG 思维导图及相关结构图。

核心目标：

- 在 Markdown 中用尽量自然的标题层级表达导图结构。
- 在 Obsidian 阅读视图和编辑视图中展示 `yxmm` 代码块。
- 支持导图模式（导图视图）、源码模式（源码视图）、可视化配置、主题、字体、布局、交互编辑。
- 发布产物符合 Obsidian 插件习惯：安装目录主要包含 `main.js`、`styles.css`、`manifest.json`、必要时包含 `data.json`。

### 1.1 项目路径

实际项目目录：

```text
/Users/yonxao/develop/code/plugin/yonxao-mindmap
```

如果新会话有权限直接操作实际项目目录，应优先在实际项目目录工作。若受沙箱限制，可在镜像目录修改并同步回实际项目目录。

## 2. 许可证

当前许可证策略是：

```text
AGPLv3 + 商业授权双许可证
```

相关文件：

- `LICENSE`
- `COMMERCIAL-LICENSE.md`

package license 字段：

```json
"license": "(AGPL-3.0-only OR LicenseRef-Commercial)"
```

## 3. 构建与发布

项目使用 ESM 风格，构建产物放在 `dist/`。

最重要的约定：

- 修改完成后，优先运行：`npm run ai:validate`。

- `ai:validate` 会执行完整校验，并额外把根目录 `.hotreload` 复制回 `dist/.hotreload`。
- 如果 `ai:validate` 因 Prettier 失败，可以先运行：

```bash
npm run format
npm run ai:validate
```

- 不要再手动重复"format -> validate -> copy hotreload"三步流程，除非脚本失效。
- 只改文档且非常轻量时，可以视情况只跑 `npm run format`，但涉及源码、配置、i18n、构建产物时应跑 `npm run ai:validate`。

`package.json` 的入口是：

```json
{
  "main": "dist/main.js"
}
```

发布目录是 `dist/`，不是项目根目录。

发布产物原则：

- `dist/main.js`：由源码构建生成。
- `dist/styles.css`：由 `styles/index.css` 和分文件 CSS 构建生成。
- `dist/manifest.json`：由根目录 `manifest.json` 准备到发布目录。
- `dist/.hotreload`：仅本地 Hot Reload 调试使用，由 `dev:obsidian` 或 `ai:validate` 复制。

发布目录结构（运行 `npm run release:prepare` 生成）：

```text
dist/
  .hotreload  # 仅 npm run dev:obsidian 生成，本地 Hot Reload 调试使用
  main.js
  manifest.json
  styles.css
```

其中 `main.js`、`manifest.json`、`styles.css` 是 Obsidian 插件安装目录需要的核心文件。`.hotreload` 只在本地开发调试时复制到 `dist/`，正式发布包不需要包含它。用户本地可能出现的 `data.json` 是 Obsidian 保存插件设置时自动生成的，不应该放进发布包。

---

# 二、协作规范

## 4. 协作约定

默认协作方式：

- 需求无论大小，都需要先给出解决思路或方案，等用户确认无误后在执行。只有明确声明某个需求不需要方案确认直接执行，那个需求才直接执行且仅限那个需求。
- 大型架构调整、术语大迁移、数据结构改动、布局算法重写，先给方案，用户确认后再执行。
- 如果一次布局或交互修复经用户验证"没有效果"或"效果不好"，应主动评估并丢弃无价值改动，避免继续在无效补丁上叠逻辑。
- 用户已经明确过：不要为了兼容旧实验配置而保留多套逻辑。本插件尚未正式发布，配置和命名以当前最新术语为准，旧配置兼容逻辑应尽量删除。
- 代码、注释、README、配置 UI、i18n 文案要尽量统一术语，避免同一概念出现多种命名。
- 关键变量、关键算法和不直观逻辑要加中文注释，注释粒度不要只停留在文件和方法级别。
- 文件级常量、算法常量、方法内部不直观常量都要给出作用说明。不要留下 `const offset = 22` 这类看不出原因的魔法数字，应抽成语义常量，并说明它的作用。
- 变量和方法命名要语义化，允许多几个单词，但不要为了长而长。

### 4.1 约定补充

为了避免新会话再次变慢：

- 小改动只读必要文件。
- 不要每次都全项目搜索，除非涉及命名、术语、配置迁移。
- 修改源码后跑 `npm run ai:validate`。
- 修改文档后至少跑 `npm run format`；若同步发布产物或涉及脚本，再跑 `npm run ai:validate`。
- 如果真实项目和镜像目录同时存在时，最后确认改动已同步到实际项目目录。
- 新会话开始后，建议先阅读：

```bash
sed -n '1,260p' docs/DEVELOPMENT_CONTEXT.zh-CN.md
sed -n '1,220p' package.json
```

处理具体需求时再按需阅读相关源码。

## 5. 测试

已开始建立人工回归样例和检查清单：

```text
docs/regression-layout-gallery.zh-CN.md
docs/REGRESSION_TEST_CHECKLIST.zh-CN.md
```

回归样例目标：

- 每种布局准备小图、中图、长文本图。
- 检查适配视图、原始大小、自动高度、手动高度、全屏。
- 检查曲线、直线、折线；下挂展开只在折线生效。
- 检查多代码块场景：配置保存、复制图片、导出图片、源码同步。
- 检查主题编辑：颜色、图标、字体、最大宽度、多行文本、取消恢复。
- 检查配置面板：全局默认值、代码块配置覆盖、默认值置灰、保存后配置区精简。
- 检查 Obsidian 阅读视图、Live Preview、深色主题、浅色主题。

---

# 三、语法与配置

## 6. 语法与数据结构

### 6.1 yxmm 代码块

代码块语言名：

````markdown
```yxmm

```
````

### 6.2 完整用法示例

````markdown
```yxmm
---
display:
  viewFit: fit
  fitViewNoUpscale: true
  saveFullConfig: true
structure:
  layout: mindmap-right
  connectorStyle: curve
  topicMaxWidth:
    global: 240
color:
  scheme: rainbow
  buttonColorMode: topic
font:
  family: "var(--font-text)"
  size: 16
  weight: 400
  lineHeight: 20
interaction:
  toolbar:
    corner: top-right
    placement: outside
  topicControlVisibility: toggle-always
  wheelZoom: false
  tabIndent: true
---

# 一级主题
中心主题
```
````

## 7. 术语规范

以下为标准术语表格，代码、注释、配置 UI、i18n 文案必须统一使用这些术语。

表格中的 `-` 表示该术语与标准术语含义几乎一致，不重复写。

yxmm 借用主题级别标记符号表达层级，但在 yonxao-mindmap 中统一称为"主题级别"。

例如 `#` 是一级主题，`##` 是二级主题，而不是 Markdown 文档标题或 HTML 标题。

此插件中，`节点`几乎不称之为`节点`，统一称为`主题（topic）`。

中心节点、中心主题、根节点、根主题，都统一称为`一级主题`。其他级别的同理，直接称呼为几级主题。

### 7.1 基础结构

| 中文术语    | English Term    | yxmm 术语            | 作用 / 功能说明                                            |
| ----------- | --------------- | -------------------- | ---------------------------------------------------------- |
| 思维导图    | Mind Map        | yonxao-mindmap       | 用中心主题向外发散组织信息的图形化工具。                   |
| yxmm 代码块 | yxmm Code Block | <code>```yxmm</code> | 插件读取和保存的最小单位。                                 |
| 配置区      | Config Block    | `--- ... ---`        | 保存主题方案、布局、字体、工具栏位置、幕布高度等全局配置。 |
| 正文区      | Body            | -                    | 用主题级别描述主题树结构。                                 |
| 源码模式    | Source Mode     | -                    | 直接编辑 `yxmm` 文本的模式。                               |
| 导图模式    | Map Mode        | -                    | 把 `yxmm` 渲染成 SVG 图形后的可视化模式。                  |
| 主题        | Topic           | -                    | 图中的一个信息主题。                                       |

### 7.2 关系结构

| 中文术语                     | English Term                  | yxmm 术语                     | 作用 / 功能说明                                                   |
| ---------------------------- | ----------------------------- | ----------------------------- | ----------------------------------------------------------------- |
| 主题级别                     | Topic Level                   | `#` / `##` / `###`            | 表示主题层级；`#` 是一级主题，`##` 是二级主题，`###` 是三级主题。 |
| 中心主题 / 根主题            | Central Topic / Root Topic    | 一级主题 / `#` / 中心主题     | 整张图的核心概念，通常位于导图中心或结构起点。                    |
| 主分支 / 一级分支 / 分支主题 | Main Branch / Branch Topic    | 二级主题 / `##` / 分支主题    | 从中心主题直接延伸出的主题。                                      |
| 普通主题                     | Normal Topic                  | 三级主题及更深 / `###` 及更深 | 除中心主题和分支主题之外的普通层级主题。                          |
| 子主题                       | Subtopic                      | -                             | 某个主题下面继续展开的内容。                                      |
| 父主题                       | Parent Topic                  | -                             | 当前主题的上一级主题。                                            |
| 同级主题                     | Sibling Topic                 | -                             | 与当前主题处于同一层级、拥有同一个父主题的主题。                  |
| 上一个同级主题 / 兄主题      | Previous Sibling Topic        | -                             | 当前主题在同级主题中的前一个主题。                                |
| 下一个同级主题 / 弟主题      | Next Sibling Topic            | -                             | 当前主题在同级主题中的后一个主题。                                |
| 分支                         | Branch                        | -                             | 从一个主题延伸出的结构线和下级内容。                              |
| 叶子主题                     | Leaf Topic                    | 叶子主题                      | 没有子主题的最末端主题。                                          |
| 子树                         | Subtree                       | -                             | 某个主题以及它下面所有后代主题组成的结构。                        |
| 虚拟主题                     | Virtual Topic                 | 内部 `_virtual`               | 解析多一级主题等场景时生成的内部承载主题，不是用户真实内容。      |
| 连线                         | Connector                     | -                             | 表示父主题和子主题之间关系的线。                                  |
| 连线线型                     | Connector Style               | -                             | 控制连线显示为曲线、直线或折线；目前仅思维导图组布局可配置。      |
| 子线出口                     | Child Connector Outlet        | -                             | 连线从当前主题边框离开并指向子主题的位置。                        |
| 父线入口                     | Parent Connector Inlet        | -                             | 父主题连线进入当前主题边框的位置。                                |
| 兄主题插入点                 | Previous Sibling Insert Point | -                             | 在当前主题前方插入兄弟主题的按钮语义点位。                        |
| 弟主题插入点                 | Next Sibling Insert Point     | -                             | 在当前主题后方插入兄弟主题的按钮语义点位。                        |

### 7.3 内容组件

| 中文术语 | English Term      | yxmm 术语                             | 作用 / 功能说明                |
| -------- | ----------------- | ------------------------------------- | ------------------------------ |
| 内容     | Content           | 内容                                  | 表达主题内容。                 |
| 主题属性 | Topic Attribute   | `[key=value]`                         | 写在内容末尾，只影响当前主题。 |
| 主题颜色 | Topic Color       | `[color=#...]`                        | 设置单个主题颜色。             |
| 主题图标 | Topic Icon        | `[icon=book]`                         | 设置单个主题图标。             |
| 主题字体 | Topic Font Family | `[fontFamily="..."]` / `font.family`  | 设置主题文字使用的字体族。     |
| 主题字号 | Topic Font Size   | `[fontSize=16]` / `font.size`         | 设置主题文字大小。             |
| 主题字重 | Topic Font Weight | `[fontWeight=700]` / `font.weight`    | 设置主题文字粗细。             |
| 主题行高 | Topic Line Height | `[lineHeight=20]` / `font.lineHeight` | 设置多行内容的行间距。         |
| 局部配置 | Local Config      | 主题属性                              | 只影响单个主题的配置。         |
| 全局配置 | Global Config     | 配置区                                | 影响整张图默认行为的配置。     |
| 配置项   | Config Key        | YAML key                              | 配置区中的某个具体字段。       |

### 7.4 布局结构

| 中文术语   | English Term       | yxmm 术语                             | 作用 / 功能说明                                                |
| ---------- | ------------------ | ------------------------------------- | -------------------------------------------------------------- |
| 布局类型   | layout type        | `layout`                              | 控制整张图的组织方式。                                         |
| 思维导图   | mind map           | `mindmap-right`(默认)：右向思维导图   | 中心主题在左侧，分支向右展开。适合列表式、流程式阅读。         |
|            |                    | `mindmap-left`：左向思维导图          | 中心主题在右侧，分支向左展开。适合与右向布局配合或特殊排版。   |
|            |                    | `mindmap-bidirectional`：双向思维导图 | 中心主题居中，一级分支向左右两侧展开。最符合传统思维导图形态。 |
|            |                    | `mindmap-up`：上向思维导图            | 中心主题在下方，分支向上展开。                                 |
|            |                    | `mindmap-down`：下向思维导图          | 中心主题在上方，分支向下展开。                                 |
|            |                    | `mindmap-vertical`：垂直双向思维导图  | 中心主题居中，一级分支向上、向下展开。                         |
| 树形图     | tree diagram       | `tree`：树形图                        | 中心主题在顶部，二级主题为一根垂直主根，子主题交替在主根两侧   |
|            |                    | `tree-right`：右向树形图              | 中心主题在顶部，二级主题为一根垂直主根，子主题交替在主根右侧   |
|            |                    | `tree-left` ：左向树形图              | 中心主题在顶部，二级主题为一根垂直主根，子主题交替在主根左侧   |
| 组织结构图 | organization chart | `org` ：组织结构图                    | 强调上下级关系和同层对齐。                                     |
|            |                    | `org-right`：右向组织结构图           | 组织结构图的三级主题及其子主题向右展开。                       |
| 时间轴     | timeline           | `timeline`：时间轴                    | 分支沿水平轴排列，后代在轴上下交替展开。                       |
|            |                    | `timeline-up`：上侧时间轴             | 分支沿水平轴排列，后代在轴上方展开。                           |
|            |                    | `timeline-down`：下侧时间轴           | 分支沿水平轴排列，后代在轴下方展开。                           |
| 放射图     | radial map         | `radial`：放射图                      | 围绕中心主题向四周径向分布。                                   |
| 鱼骨图     | fishbone diagram   | `fishbone-left`：左向鱼骨图           | 鱼头在左侧，主骨从左向右延伸。                                 |
|            |                    | `fishbone-right`：右向鱼骨图          | 鱼头在右侧，主骨从右向左延伸。                                 |
| 树形表格   | tree table         | `tree-table`：树形表格                | 把主题树渲染为表格，叶子主题会横向填满剩余列。                 |
|            |                    | `tree-table-stepped`：阶梯树形表格    | 把主题树渲染为表格，但叶子主题只占当前列，保留阶梯状轮廓。     |

### 7.5 鱼骨图专用结构

| 中文术语 | English Term  | yxmm 术语 / 配置名 | 作用或功能说明                                           |
| -------- | ------------- | ------------------ | -------------------------------------------------------- |
| 鱼头     | fish head     | `#`                | 中心主题所在的一侧。目前插件实现的是鱼头在左、鱼尾在右。 |
| 主骨     | main spine    | -                  | 从鱼头延伸到鱼尾的水平主线。                             |
| 鱼尾     | fish tail     | -                  | 主骨末端的尾部标记。                                     |
| 大分支   | primary bone  | `##`               | 鱼骨图中的一级分支主题，通过斜骨线连接到主骨。           |
| 斜骨线   | diagonal bone | -                  | 大分支和主骨之间的斜向连接线。                           |
| 鱼刺主题 | rib topic     | `###`              | 挂在斜骨线上的主题。                                     |

### 7.6 功能组件

| 中文术语       | English Term           | yxmm 术语 / 配置名                              | 作用或功能说明                                |
| -------------- | ---------------------- | ----------------------------------------------- | --------------------------------------------- |
| 悬浮工具栏     | floating toolbar       | -                                               | 放置常用操作按钮，可以拖动并吸附到角落。      |
| 配置面板       | config panel           | -                                               | 可视化修改主题、结构、字体、源码和高级配置。  |
| 主题编辑面板   | topic edit panel       | -                                               | 编辑内容、颜色、图标、布局等。                |
| 编辑按钮       | edit button            | -                                               | 打开主题编辑面板；部分紧凑布局会隐藏。        |
| 折叠/展开按钮  | collapse/expand button | -                                               | 隐藏或显示当前主题的子树。                    |
| 新增按钮       | add button             | -                                               | 在主题旁新增子主题或兄弟主题。                |
| 右键菜单       | context menu           | -                                               | 主题操作入口，例如新增、删除、折叠和展开。    |
| 内联编辑框     | inline topic editor    | -                                               | 双击或 Space 后覆盖在主题上的轻量文本编辑框。 |
| 长文本编辑浮层 | topic content editor   | -                                               | 从主题编辑面板打开，用于编辑较长的多行内容。  |
| 源码编辑区     | source editor          | -                                               | 源码模式中的文本编辑区域。                    |
| 工具栏抓手     | toolbar grip           | -                                               | 拖动悬浮工具栏的位置。                        |
| 高度拖拽条     | height resize handle   | `display.canvasHeight` / `display.sourceHeight` | 调整导图幕布或源码模式高度。                  |

### 7.7 视觉与交互区域

| 中文术语     | English Term             | yxmm 术语 / 配置名                   | 作用或功能说明                                                 |
| ------------ | ------------------------ | ------------------------------------ | -------------------------------------------------------------- |
| 幕布         | canvas                   | `display.canvasHeight`               | 承载 SVG 导图的可视区域。                                      |
| 视口         | viewport                 | -                                    | 当前 SVG 中正在被查看的坐标范围；平移和缩放会改变视口。        |
| 主题卡片     | topic card               | -                                    | 主题的矩形外观，包括背景、边框和圆角。                         |
| 主题色系     | theme                    | -                                    | 控制整体颜色方案，避免和"主题 / Topic"混淆。                   |
| 默认主题颜色 | default topic color      | `color.defaultTopicColor`            | 覆盖主题自动配色；主题属性 `color` 仍然优先。                  |
| 按钮配色模式 | button color mode        | `color.buttonColorMode`              | 控制编辑、折叠/展开、新增等主题按钮的颜色来源。                |
| 按钮颜色     | button color             | `color.buttonColor`                  | 自定义按钮颜色，仅在按钮配色模式为 custom 时生效。             |
| 主题按钮显示 | topic control visibility | `interaction.topicControlVisibility` | 控制主题按钮的显示时机：全部常显、折叠常显其余悬浮、全部悬浮。 |
| 字体         | font                     | `font.*`                             | 控制主题文字样式。                                             |
| 连线线型     | connector style          | `structure.connectorStyle`           | 控制连线为曲线、直线或折线；目前仅思维导图组布局可配置。       |
| 平移         | pan                      | -                                    | 拖动幕布改变视口位置。                                         |
| 缩放         | zoom                     | -                                    | 放大或缩小当前视口。                                           |
| 适配视图     | fit view                 | -                                    | 自动调整视口，让导图尽量完整显示。                             |
| 主题焦点     | focused topic            | 内部 `focusedTopicId`                | 导图模式下由键盘快捷键操作的当前主题。                         |
| 焦点高亮     | focus highlight          | CSS `is-keyboard-focused`            | 主题焦点的视觉描边；颜色应跟随按钮配色变量。                   |
| 重置折叠状态 | reset collapse state     | -                                    | 清除当前折叠记录，展开所有主题。                               |
| 自动高度     | auto height              | -                                    | 根据导图内容自动计算幕布高度。                                 |
| 手动高度     | manual height            | `display.canvasHeight`               | 用户拖拽后保存的幕布高度。                                     |

### 7.8 术语迁移原则

- "节点"一词已经替换为"主题"。代码中若仍有历史遗留，可以在相关修改时继续清理，但不要新增 node/节点 作为核心术语。
- "根主题""中心主题""分支主题""普通主题"等含义应和以上表格保持一致，优先使用一级主题、二级主题等等。
- 新功能和新注释使用最新术语。
- 如果修改某块代码，顺手清理同一范围内的旧术语。
- 不为了兼容旧配置保留旧字段名或旧布局名。

## 8. 配置系统

### 8.1 配置优先级

当前配置优先级：

```text
主题属性 > 代码块配置区 > 插件全局默认值配置 > 插件内置默认值
```

全局默认值配置保存在 Obsidian 插件 `data.json` 中，由偏好设置界面编辑。

代码块配置区保存在当前 Markdown 文档内，只影响当前 `yxmm` 代码块。

主题属性写在主题文本后方，只影响单个主题。

### 8.2 主要配置项

运行时默认值、配置范围和可选值集合定义在：

```text
src/config/defaultMindConfig.js
```

`src/config/mindConfig.js` 是配置系统对外聚合入口。具体实现已按职责拆到 `configAccessors.js`、`configCanonicalize.js`、`configNormalize.js`、`configSerialize.js`、`yamlConfig.js` 和 `runtimeConfigSave.js`。配置面板需要展示选项时，也应优先复用 `src/config/defaultMindConfig.js` 中的值集合，再在 UI 层映射为本地化文案。

核心配置项：

- `display.canvasHeight`：导图幕布高度，`null` 表示自动高度。
- `display.sourceHeight`：源码模式高度，和导图幕布高度分开保存，`null` 表示自动高度。
- `display.viewFit`：打开导图时的视图适配方式，可选 `original`、`fit`，默认 `fit`。
- `display.fitViewNoUpscale`：适配视图是否禁止放大小图，默认开启。
- `display.fitViewMaxScale`：关闭 `display.fitViewNoUpscale` 时的适配视图最大放大倍数，默认 `1.5`，范围 `1` 到 `6`。
- `display.saveFullConfig`：保存配置区时是否写入全部配置项，默认关闭（只保存非默认值）。
- `interaction.toolbar.corner` / `interaction.toolbar.placement`：悬浮工具栏吸附位置，角落可选四角，位置可选内侧或外侧。
- `interaction.topicControlVisibility`：主题按钮显示方式，可选 `always`（全部常显）、`toggle-always`（折叠按钮常显、其余悬浮）、`hover`（全部悬浮），默认 `toggle-always`。
- `interaction.tabIndent`：源码模式中是否启用 Tab 调整主题级别，默认开启。
- `interaction.wheelZoom`：是否启用鼠标滚轮缩放，默认关闭。
- `color.scheme`：主题色系。
- `color.defaultTopicColor`：默认主题颜色，空字符串表示不覆盖。
- `color.buttonColorMode`：按钮配色模式，可选 `inherit-accent`（继承 Obsidian 强调色）、`subtle`（低调色）、`topic`（主题自身颜色）、`custom`（自定义颜色），默认 `inherit-accent`。
- `color.buttonColor`：自定义按钮颜色，仅在 `buttonColorMode` 为 `custom` 时生效。
- `structure.layout`：布局类型。
- `structure.connectorStyle`：连线线型，仅思维导图组布局可配置。
- `structure.branchExpansion`：普通主题的子主题展开方式。
- `structure.topicMaxWidth`：主题最大宽度，包含 `global`、`level1`、`level2`、`level3`；全局最小 `120`，最大 `800`。
- `font.family` / `font.size` / `font.weight` / `font.lineHeight`：全局主题字体配置。
- `font.level1` / `font.level2` / `font.level3`：按主题级别覆盖字体。

插件偏好设置中还提供语言选项，首次默认语言会跟随 Obsidian 当前语言；如果 Obsidian 语言暂不支持，则回退到 English。当前支持：

- English（兜底语言）、中文（简体）、中文（繁體）、日本語、한국어、Français、Deutsch、Español、Português (Brasil)、Русский、Italiano、Bahasa Indonesia、Türkçe、Tiếng Việt、ไทย、हिन्दी。

全局默认值配置会作为所有 `yxmm` 代码块的基础配置；单个代码块顶部的配置区会覆盖全局默认值配置，主题属性会继续覆盖配置区。例如：

`主题属性` > `代码块配置区` > `插件全局默认值配置` > `插件内置默认值`

字体优先级：

`主题属性` > `font.levelN` > `font 全局配置` > `插件默认值`

主题最大宽度优先级：

`主题属性 maxWidth` > `structure.topicMaxWidth.levelN` > `structure.topicMaxWidth.global` > `插件默认值`

字体范围：

- `size`：字号，范围 `9` 到 `96`。
- `weight`：字重，范围 `100` 到 `900`，遵循 CSS 字重标准。
- `lineHeight`：行高，范围 `12` 到 `160`，表示 SVG 文本每行之间的像素距离。建议约为字号的 `1.3` 到 `1.5` 倍。

主题颜色优先级：

`主题属性 color` > `color.defaultTopicColor` > `配色方案自动配色`

其中 `rainbow`、`pastel-rainbow`、`neon-rainbow` 会按一级分支自动分配不同颜色。中心主题会使用主题独立中心色；主题属性 `color` 只改变主题本身，不改变它和父主题之间的连接线颜色。配置区中的 hex 颜色建议写成带引号的字符串，例如 `defaultColor: '#66ed0c'`；通过配置面板保存时会自动加引号。

### 8.3 布局类型

布局类型放在 `structure.layout`：

```yaml
structure:
  layout: mindmap-right
```

当前布局分组和布局值：

#### 8.3.1 思维导图

- `mindmap-right`：右向思维导图，默认布局。
- `mindmap-left`：左向思维导图。
- `mindmap-bidirectional`：双向思维导图。
- `mindmap-up`：上向思维导图。
- `mindmap-down`：下向思维导图。
- `mindmap-vertical`：垂直双向思维导图。

#### 8.3.2 树形图

- `tree`：树形图。
- `tree-right`：右向树形图。
- `tree-left`：左向树形图。

#### 8.3.3 组织结构图

- `org`：组织结构图。
- `org-right`：右向组织结构图。

#### 8.3.4 时间轴

- `timeline`：时间轴。
- `timeline-up`：上侧时间轴。
- `timeline-down`：下侧时间轴。

#### 8.3.5 放射图

- `radial`：放射图。

#### 8.3.6 鱼骨图

- `fishbone-left`：左向鱼骨图。
- `fishbone-right`：右向鱼骨图。

#### 8.3.7 树形表格

- `tree-table`：树形表格。
- `tree-table-stepped`：阶梯树形表格。

### 8.4 连线线型规则

`structure.connectorStyle` 可选值：

- `curve`：曲线，技术上是三次贝塞尔曲线。
- `straight`：直线。
- `elbow`：折线，正交折线。

重要约定：

- 只有布局类型属于思维导图组的布局才允许用户设置连线线型，其他布局都只有折线。
- 非思维导图组布局为了保持结构语义，配置界面禁止设置线型，UI 上固定显示折线。
- 树形图、组织结构图、时间轴、鱼骨图等布局内部通常有专用的主干、支线或骨架绘制逻辑，不应简单套用 `structure.connectorStyle`。
- 如果以后要给某个非思维导图布局开放线型，需要单独设计该布局的语义和视觉规则。

#### 8.4.1 子主题展开方式规则

`structure.branchExpansion` 当前可选：

- `side`：自然展开。
- `hanging`：下挂展开。

已确认规则：

- 下挂展开只在实际连线线型为折线时生效。
- 放射图、树形表格、阶梯树形表格不支持下挂展开。
- 下挂展开只控制三级主题及更深主题继续展开子主题；一级、二级主题不受它影响。
- 思维导图组只有 `structure.connectorStyle: elbow` 时，下挂展开才可配置且生效。
- 其他支持下挂的非思维导图布局因为实际线型固定为折线，默认可配置下挂展开。
- 修改下挂布局时要同时考虑主题坐标、连线锚点、折叠按钮、增加主题按钮等，不要只改其中一个点。

下挂展开的交互细节：

- 折叠/展开按钮优先于新增按钮响应；即使视觉上重叠，也不能出现"折叠的同时新增主题"。
- 如果折叠按钮和新增兄弟主题按钮占用同一个子线出口点，应把新增兄弟主题按钮沿主题边缘错开，而不是隐藏折叠按钮。
- 这类错位距离应由按钮半径和视觉间隙计算，不要写死魔法数字。

竖向思维导图下挂的几何细节：

- `mindmap-down` 下挂时，第一个子主题的中心点不能落在父主题右边缘内侧，否则父子连线会从父主题自身穿过。
- `mindmap-up` 和 `mindmap-vertical` 的上方分支下挂时也向右展开，第一个子主题的中心点同样不能落在父主题右边缘内侧。
- 这条规则只在父主题较宽时扩大起始偏移；父主题较窄时仍应保持原本紧凑间距。
- 为了让子线出口处横线不显得太短，父主题边缘外侧需要保留约一到两个字符宽度的视觉间隙，但不要大幅拉开布局。
- 不要为了消除某个重叠而引入全局"错层复用"或后处理压缩；如果布局计算本身已经无重叠，优先检查连线锚点和按钮位置。

### 8.5 主题和配色规则

主题定义在：

```text
src/theme/mindThemes.js
```

当前内置主题：

- `default`
- `ocean`
- `forest`
- `sunset`
- `mono`
- `rainbow`
- `pastel-rainbow`
- `neon-rainbow`

颜色优先级：

```text
主题属性 color > color.defaultTopicColor > 配色方案自动配色
```

已确认规则：

- 中心主题颜色应和分支颜色区分开。
- 主题属性 `color` 只修改当前主题的颜色，不应改变它与父主题之间的连线颜色。
- 彩虹类主题按分支主题自动分配颜色。
- `color.defaultTopicColor` 会覆盖主题自动配色，但主题属性 `color` 仍然优先。
- 配置区中的十六进制颜色建议加引号，例如 `defaultColor: '#66ed0c'`。

### 8.6 字体规则

字体配置支持全局设置和按主题级别覆盖。

默认字体为 Obsidian 正文字体变量 `var(--font-text)`，即跟随 Obsidian 当前主题的正文字体。

结构约定：

```yaml
font:
  family: var(--font-text)
  size: 16
  weight: 400
  lineHeight: 20
  level1:
    size: 28
    weight: 700
    lineHeight: 38
```

优先级：

```text
主题属性 > font.levelN > 全局 font 配置 > 插件默认值
```

字号、字重、行高有范围限制，范围定义在 `src/config/defaultMindConfig.js`：

- `size`：字号，范围 `9` 到 `96`。
- `weight`：字重，范围 `100` 到 `900`，遵循 CSS 字重标准。
- `lineHeight`：行高，范围 `12` 到 `160`，表示 SVG 文本每行之间的像素距离。建议约为字号的 `1.3` 到 `1.5` 倍。

配置面板的字体设置支持"按类型分组的预设下拉框 + 自定义输入框"。

#### 8.6.1 字体预设分组

预设下拉框按以下组别组织：

- **继承与自定义**：继承全局字体、自定义输入。
- **Obsidian**：界面字体、正文字体、等宽字体，使用 Obsidian CSS 变量。
- **系统字体**：系统无衬线、系统衬线、系统等宽。
- **中文常用**：黑体、宋体、楷体、仿宋、微软雅黑、苹方、思源黑体、思源宋体、霞鹜文楷。
- **等宽字体**：中文等宽字体栈、Sarasa Mono、霞鹜文楷等宽、JetBrains Mono、Cascadia Mono。

浏览器环境不能可靠读取完整系统字体列表，所以插件使用内置候选字体列表；如果本机没有安装某个字体，浏览器会自动使用后面的 fallback 字体。

选择"自定义"后，可以直接填写 CSS 字体族，例如 `'LXGW WenKai', 'Source Han Sans SC', sans-serif`。

### 8.7 内置图标

当前内置图标包括：

`book`、`brain`、`cpu`、`database`、`file`、`folder`、`calendar`、`clock`、`user`、`users`、`tag`、`star`、`check`、`checkbox`、`list`、`target`、`flag`、`link`、`globe`、`search`、`message`、`pencil`、`heart`、`alert`、`info`、`rocket`、`chart`、`lightbulb`

图标数据保存在：

```text
src/icons/iconPaths.js
```

如果填写了未知图标名，插件会把图标名渲染成一个小文本徽标。

### 8.8 插件偏好设置

Obsidian 偏好设置入口：

```text
src/ui/YonxaoMindmapSettingTab.js
```

当前职责：

- 在 Obsidian `设置` -> `第三方插件` 中提供插件设置页。
- 设置插件界面语言。
- 编辑全局默认值配置。
- 展示全局默认值配置摘要。

全局默认值配置编辑复用：

```text
src/ui/ConfigModal.js
src/ui/config-modal/
```

### 8.9 可视化配置面板

当前 Tab：

- 显示（DisplayTab）：幕布高度、视图适配、工具栏位置等显示相关配置。
- 颜色（ColorTab）：主题色系、默认主题颜色、按钮配色等颜色配置。
- 结构（StructureTab）：布局类型、连线线型、下挂展开、主题最大宽度等结构配置。
- 字体（FontTab）：全局字体和按主题级别覆盖的字体配置。
- 交互（InteractionTab）：滚轮缩放、Tab 缩进、主题按钮显示方式等交互配置。
- 快捷键（ShortcutsTab）：按“主题创建与删除、主题编辑、主题导航与折叠、视图控制、导图控制”只读展示当前快捷键。
- 高级（AdvancedTab）：直接编辑 YAML 配置文本。

设计原则：

- 熟悉配置的人可以直接输入。
- 不熟悉配置的人可以用下拉框或控件选择。
- 高级页允许直接编辑配置文本。
- 布局不是思维导图组时，连线线型控件禁用，固定折线。
- 不要让 UI 写入无意义配置噪音，例如只是切换查看时不应主动写入不生效的配置项。
- 工具栏打开的配置面板需要用当前全局默认值配置回填空值；回填值用"默认/继承"样式区分，自定义值保持普通样式。
- 保存代码块配置时，如果某项值和当前全局默认值配置一致，应从代码块配置区删除该项，让配置区保持精简。
- 全局默认值配置面板和单个代码块配置面板的默认值、下拉框回填、禁用态和说明文案应保持一致。

### 8.10 配置联动模式

配置面板中的字段并非彼此独立，存在三种联动关系：

#### 8.10.1 层级继承

一个全局值下挂多组级别值，级别字段未显式设置时自动继承全局值。继承值在 UI 上用灰色 placeholder 展示；全局变化时级别字段的继承来源同步更新，但不覆盖用户已显式设置的级别值（`preserveExplicit` 机制）。

涉及字段：

- `font.size` → `font.levelN.size`
- `font.weight` → `font.levelN.weight`
- `font.lineHeight` → `font.levelN.lineHeight`
- `font.family` → `font.levelN.family`
- `topicMaxWidth.global` → `topicMaxWidth.levelN`

代码定位：`syncTopicMaxWidthInheritanceSync()` 和 `installLevelFontInheritanceSync()` 分别是主题最大宽度和字体层级继承的联动入口。

#### 8.10.2 条件分支

父选项取特定值时，子选项显隐或出现。分两种实现力度：

- **轻量显隐**：子选项始终在 DOM 中，只切换 CSS `display: none/block`。用于 `viewFit='fit'` 时显示 `fitViewNoUpscale` 和 `fitViewMaxScale`，以及 `fitViewNoUpscale=true` 时隐藏 `fitViewMaxScale`。代码定位：`syncFitViewSubControls()`。
- **重度重绘**：父选项变化后整个 tab 重渲染，字段销毁重建。用于 `layout` 和 `connectorStyle` 切换时决定 `branchExpansion` 等字段是否出现。代码定位：`this.render()` 的 `StructureTab` 段落。

#### 8.10.3 布局绑定

字段是否可用由当前布局类型固有约束决定，用户不能主动改变。UI 上固定显示禁用态选择器，只有切到特定布局类型才能解除。

当前实例：`connectorStyle` 在非思维导图组布局下不可配置，固定显示折线。代码定位：`createDisabledConnectorStyleField()`。

#### 8.10.4 引用规范

新功能需要处理配置联动时，应在此基础上扩展而非自创新机制：

- 新增层级继承字段时，同步实现 `syncInheritedNumberInput` 或对应的继承同步方法。
- 新增条件分支字段时，优先评估能否用轻量显隐完成；只有字段结构差异较大时再走重度重绘。
- 判断布局类型固有约束优先通过 `isConnectorStyleConfigurableLayout()` 这类规则方法，不要在每个 Tab 里重复判断。
- 这三种模式的交互命名即术语：层级继承、条件分支（含轻量显隐/重度重绘）、布局绑定。

## 9. 国际化

i18n 文件：

```text
src/i18n/messages.js
src/i18n/languageOptions.js
src/i18n/locales/
```

当前语言：

- `en`
- `zh-CN`
- `zh-TW`
- `ja`
- `ko`
- `fr`
- `de`
- `es`
- `pt-BR`
- `ru`
- `it`
- `id`
- `tr`
- `vi`
- `th`
- `hi`

默认语言：

- 不写死英文。
- 初始默认跟随 Obsidian 当前语言。
- 无法匹配时回退到 `en`。

新增 UI 文案时：

- 至少补 `en`、`zh-CN`、`zh-TW`。
- 其他语言可通过 `createAdditionalLocale()` 的文本对象补主要入口。
- 缺失 key 会回退英文，避免显示 `undefined`。

---

# 四、布局系统

## 10. 布局入口

布局计算主要在：

```text
src/layout/layoutTree.js
src/layout/layoutTypes.js
src/layout/layoutShared.js
src/layout/layoutBounds.js
src/layout/mindmapLayout.js
src/layout/treeLayout.js
src/layout/orgLayout.js
src/layout/timelineLayout.js
src/layout/radialLayout.js
src/layout/radialGeometry.js
src/layout/fishboneLayout.js
src/layout/treeTableLayout.js
```

渲染主要在：

```text
src/renderer/YonxaoMindmapRenderer.js
src/renderer/draw/
src/renderer/export/
src/renderer/interaction/
src/renderer/viewport/
src/ui/toolbar/
src/ui/source/
src/ui/topic-editor/
src/ui/context-menu/
```

解析和序列化：

```text
src/parser/parseMind.js
src/parser/serializeMind.js
```

结构修改：

```text
src/model/topicTreeActions.js
```

Markdown 代码块接入：

```text
src/markdown/codeBlock.js
src/obsidian/embed.js
```

## 11. 主干上色规则

思维导图、树形图、组织结构图、时间轴、鱼骨图等布局都有"共享主干"或"结构主线"的概念。

已确认原则：

- 主干颜色应跟随对应分支颜色分段绘制。
- 不应被最后一个分支颜色覆盖整条主干。
- 共享主干不应简单使用中心主题颜色。
- 时间轴和鱼骨图的主干上色逻辑大致和思维导图、树形图、组织结构图一致，已抽取过公共的分段上色思路。

相关渲染辅助逻辑已拆到 `src/renderer/draw/` 中，例如：

- `renderBranchColoredTrunkFromOrigin`
- `renderBranchColoredTrunkRun`
- `renderSequentialBranchColoredTrunk`
- `renderBranchColoredTrunkSegment`

## 12. 时间轴布局规则

时间轴布局不是普通向右思维导图。

已确认语义：

- 一级主题是中心主题。
- 二级主题沿时间轴展开。
- `timeline-up`：二级主题在轴上，二级主题的子主题在轴上方向右展开。
- `timeline-down`：二级主题在轴下，二级主题的子主题在轴下方向右展开。
- `timeline`：上下平衡轴，二级主题在轴上下交替展开。
- 时间轴主轴不要压在主题文字上。
- 时间轴末尾不要无意义延伸过长。
- 轴颜色按分支分段。

## 13. 鱼骨图规则

当前支持：

- `fishbone-left`：鱼头在左，主骨从左向右延伸。
- `fishbone-right`：鱼头在右，主骨从右向左延伸。

鱼骨图术语和逻辑：

- 一级主题是鱼头。
- 主骨从鱼头延伸到鱼尾。
- 二级主题是大骨或主分支，分布在主骨上下。
- 二级主题的普通子主题沿大骨展开。
- 鱼尾形状类似"小于号"或镜像方向，方向根据鱼头位置动态确定。
- 鱼尾颜色保持中心主题颜色。
- 主骨每一段颜色应对应分支颜色。
- 二级主题的新增按钮曾要求隐藏或取消，折叠按钮应放在子线出口交点。
- 主题按钮位置不能写死，应根据鱼头位置、分支方向、主题所在侧动态确定。
- 折叠按钮永远在子线出口交点。

鱼骨图优化方向：

- 提高空间利用率，避免上下空白过大。
- 优先避免重叠，其次再追求紧凑。
- 大骨和普通子主题交点要对齐到正确几何位置。

## 14. 放射图规则

放射图和左右平衡思维导图不同：

- 放射图从中心主题向多个方向发散。
- 二级主题不必严格按文档顺序顺时针排列。
- 优先级是避免重叠，其次才是空间利用率。
- 可以先计算每个二级分支占用面积，再分配方向。

放射图当前做过动态分配和碰撞处理，但仍可能需要继续优化。

后续优化建议：

- 对每个二级分支估算包围盒。
- 大分支优先放在更开阔、互相距离更远的角度。
- 放置后做碰撞检测和位移。
- 保留用户阅读上的自然性，不要为了极致紧凑导致连线混乱。

## 15. 树形表格规则

当前存在两种表格类布局：

- `tree-table`：树形表格。
- `tree-table-stepped`：阶梯树形表格。

表格类布局中主题编辑按钮可隐藏，折叠按钮可以保留。

---

# 五、交互与渲染

## 16. 交互规则

### 16.1 阅读视图

- 应展示导图。
- 应禁用编辑类交互，例如拖动主题、编辑按钮、增加按钮、右键菜单、双击编辑等。
- 可以保留查看类交互，例如折叠展开、缩放、适配视图等，具体以当前实现为准。

### 16.2 编辑视图

- 可以编辑源码视图。
- 可以在导图中进行主题交互编辑。
- 工具栏应可见、可拖动，并在失焦时按当前规则隐藏或弱化。

### 16.3 源码模式

- 源码模式和导图模式都应可编辑。
- 源码模式高度和导图幕布高度分开保存。
- 从源码模式切回导图模式时，应重新计算导图所需高度。
- 如果用户手动设置的导图高度大于计算高度，应保留用户高度；只有高度不够时才自动扩展。

### 16.4 工具栏

工具栏是悬浮工具栏，不应挤压主体内容。

已确认规则：

- 工具栏位置可拖动，松手后吸附到最近的四角内侧或外侧位置。
- 工具栏位置保存到当前实例配置 `toolbar.corner` / `toolbar.placement`。
- 拖动工具栏不应触发视图从源码模式切回导图模式。
- 工具栏透明度有过调整，避免遮挡导图内容。
- 工具栏不要和 Obsidian 自带"编辑这个块"按钮冲突，必要时偏左上放置。
- 页面滚动期间不要显示工具栏，避免 body 级浮层停留在旧位置造成视觉错位。
- 全屏时工具栏会临时移入全屏元素内（编辑视图移入 hostEl，阅读视图移入 body 级覆盖层），退出后恢复到 body 级浮层。
- 全屏期间的导图编辑会先暂存在内存中，退出全屏后再异步写回文件并显示 Notice。窗口全屏会把 `hostEl` 移到 body 覆盖层，保存前必须在 `hostEl` 回到原代码块位置后重新写入主题焦点记忆；保存完成后还要再恢复一次主题选中状态和 SVG 焦点，避免 Notice 或 Obsidian 重建代码块覆盖退出全屏时的焦点恢复。

已实现或已确认的方向：

- 左键单击主题不做普通编辑动作。
- 双击主题应直接编辑内容，而不是打开属性面板。
- 右键打开上下文菜单。
- 删除主题需要二次确认。
- 支持增加子主题、增加同级主题、删除主题、复制文本、展开折叠等右键操作。
- 阅读视图中禁用编辑类交互。
- 主题可拖动，并支持同级排序。
- 主题按钮位置需要先根据布局语义计算点位，再把按钮绑定到点位，不要让每类按钮各自写一套布局判断。
- 主题编辑面板和配置面板都应支持默认值回填、继承值置灰、配置名称和值对齐、说明放在配置值下方。
- 主题编辑面板中的"内容"应使用可调整高度的多行文本框；长文本可通过放大编辑入口编辑，但普通双击编辑仍应轻量快速。
- 编辑面板点击取消必须恢复编辑前文本和字段状态。

### 16.5 导图主题焦点与键盘导航

导图模式下存在独立的“主题焦点”，由 `focusedTopicId` 记录，并通过 `is-keyboard-focused` 高亮当前主题。它和浏览器/Obsidian 的 DOM 焦点不是同一个概念，但快捷键分发需要 SVG 获得 DOM 焦点。

已确认规则：

- SVG 获得焦点时，应保证至少有一个可见主题成为主题焦点；默认优先一级主题。
- 导图失焦到源码、配置面板或 Obsidian 其他区域后，应清理焦点高亮，避免视觉上误以为仍在操作导图。
- 主题编辑面板、长文本编辑浮层、内联编辑框属于导图焦点的延伸区域。焦点进入这些浮层时，应保留当前主题高亮。
- 保存、取消、删除、新增主题可能触发 Obsidian 重建代码块。触发保存前要通过 `rememberTopicFocusState()` 写入焦点记忆，重建后再恢复到正确主题。
- 普通 Live Preview 场景下，Obsidian 可能在保存后延迟把 DOM 焦点抢回 CodeMirror；恢复导图焦点时需要立即补焦点，并保留延迟补焦点逻辑。
- 新增主题后，焦点移动到新主题，但不自动打开编辑框。
- 删除主题后，焦点移动到真实父主题。这里必须查完整主题树，不能只查当前可见主题，否则折叠或重渲染后可能退回一级主题。
- 当前焦点主题因折叠、删除或源码重渲染不可见时，才回退到一级主题或第一个可见主题。
- 焦点高亮颜色复用主题按钮颜色变量；按钮配色配置变化时，焦点高亮也应同步受影响。

思维导图组布局的方向键是结构导航，不是纯空间最近导航：

- 水平思维导图（`mindmap-right`、`mindmap-left`、`mindmap-bidirectional`）：左右只在父子关系之间移动，上下只在同级主题之间移动。
- 垂直思维导图（`mindmap-up`、`mindmap-down`、`mindmap-vertical`）：上下只在父子关系之间移动，左右只在同级主题之间移动。
- 双向布局仍需按实际坐标方向筛选候选主题，让一级主题能向对应方向进入某一侧分支。
- 非思维导图布局的结构语义差异较大，当前保留空间方向导航兜底。
- 方向键移动焦点时只平移当前 `viewBox` 保证主题可见，不重新执行 fit view，避免用户缩放比例被重置。

### 16.6 导图主题快捷键

主题快捷键只应在按键事件来自导图 SVG、且当前有选中主题时生效。`Tab`、`Enter`、`Space`、`Delete` 等按键在 Obsidian 或浏览器中有原生语义，确认命中主题快捷键后必须 `preventDefault()` 和 `stopPropagation()`。

当前已确认快捷键按配置面板快捷键页分为五组：

主题创建与删除：

| 操作       | Windows       | Mac                        | 行为说明                   |
| ---------- | ------------- | -------------------------- | -------------------------- |
| 插入子主题 | `Tab`         | `Tab`                      | 给当前主题创建子主题。     |
| 插入弟主题 | `Enter`       | `Return`                   | 在当前主题后创建同级主题。 |
| 插入兄主题 | `Shift+Enter` | `Shift+Return`             | 在当前主题前创建同级主题。 |
| 删除主题   | `Delete`      | `Delete` / `Cmd+Backspace` | 删除当前主题。             |

主题编辑：

| 操作               | Windows        | Mac            | 行为说明                                       |
| ------------------ | -------------- | -------------- | ---------------------------------------------- |
| 打开主题编辑面板   | <code>`</code> | <code>`</code> | 打开当前主题的编辑面板；不要再绑定 F2。        |
| 快速内联编辑       | `Space`        | `Space`        | 快速编辑当前主题文本。                         |
| 内联编辑中换行     | `Shift+Enter`  | `Shift+Return` | 在主题文本内插入换行。                         |
| 内联编辑中提交     | `Enter`        | `Return`       | 保存文本并回到当前主题。                       |
| 内联编辑中取消     | `Esc`          | `Esc`          | 放弃修改并回到当前主题。                       |
| 主题编辑面板保存   | `Ctrl+S`       | `Cmd+S`        | 保存主题编辑面板中的全部改动。                 |
| 长文本编辑浮层保存 | `Ctrl+S`       | `Cmd+S`        | 只保存长文本编辑浮层，不保存整个主题编辑面板。 |

主题导航与折叠：

| 操作            | Windows         | Mac             | 行为说明                                                                |
| --------------- | --------------- | --------------- | ----------------------------------------------------------------------- |
| 移动选中状态    | `↑` `↓` `←` `→` | `↑` `↓` `←` `→` | 移动主题选中状态；思维导图按父子/同级关系导航，其他布局按空间方向导航。 |
| 展开/折叠子主题 | `Alt+/`         | `Option+/`      | 展开或折叠子主题。                                                      |

视图控制（View Control）快捷键只要求按键事件来自导图 SVG，不要求当前有选中主题：

| 操作     | Windows | Mac        | 行为说明                |
| -------- | ------- | ---------- | ----------------------- |
| 放大视图 | `Alt++` | `Option++` | 放大视图。              |
| 缩小视图 | `Alt+-` | `Option+-` | 缩小视图。              |
| 适配视图 | `Alt+0` | `Option+0` | 以当前视口进行缩放。    |
| 原始视图 | `Alt+1` | `Option+1` | 切换视图为原始大小。    |
| 窗口全屏 | `Alt+2` | `Option+2` | 进入/退出窗口全屏模式。 |
| 全屏     | `Alt+3` | `Option+3` | 进入/退出全屏模式。     |

导图控制（Map Control）快捷键只要求按键事件来自导图 SVG，不要求当前有选中主题：

| 操作         | Windows | Mac        | 行为说明       |
| ------------ | ------- | ---------- | -------------- |
| 打开配置面板 | `Alt+,` | `Option+,` | 打开配置面板。 |

快捷键架构约定：

- `src/renderer/interaction/topicKeyboardShortcuts.js` 只负责“按键 -> 命令”的匹配和分发。
- 真正的主题树增删改仍复用 `src/model/topicCommands.js` 和 `src/model/topicTreeActions.js`。
- `F2` 容易被 Obsidian 占用，插件内不要再绑定为打开主题编辑面板。
- 主题创建快捷键完成后只移动焦点，不打开编辑框。
- 创建、编辑、删除类主题快捷键不应在源码模式、阅读视图编辑禁用场景、输入法组合输入中触发。
- 主题导航与折叠属于查看/浏览行为，不要求导图可编辑，但仍只响应来自导图 SVG 的按键事件。

### 16.7 主题编辑与焦点恢复

主题编辑相关 UI 已拆成三层：

- `TopicEditorPanel.js`：主题编辑面板外壳、保存/取消、快捷保存和拖拽。
- `TopicContentEditor.js`：长文本编辑浮层，作为面板内的局部编辑层。
- `InlineTopicEditor.js`：双击或 Space 打开的轻量内联编辑框。
- `topicEditorState.js`：继承/自定义状态、表单快照、保存和删除。

已确认规则：

- 编辑框不需要 tooltip，避免鼠标悬浮时遮挡文本编辑。
- 主题编辑面板中的继承值显示在 placeholder 中，输入框 value 为空才表示“继续继承”。
- `data-topic-editor-custom` 是保存时判断自定义值的来源，class 只负责视觉提示。
- 用户输入与继承值相同时，不应保存成主题自定义属性，避免源码里出现冗余覆盖。
- 颜色和图标是组合控件，实际保存值统一落到隐藏 input，便于状态序列化复用。
- 打开主题编辑面板时，要先临时移除当前主题的可编辑属性，再解析有效配置，得到“继承后的有效值”。
- 保存主题编辑面板或内联编辑前，应先记录当前主题焦点；删除前应先记录父主题焦点。
- 内联编辑框中 `Shift+Enter` 需要手动插入换行并阻止事件继续冒泡，避免被 Obsidian 或导图快捷键链路抢走焦点。
- `Esc` 表示取消编辑，不应和 `Enter` 一样提交修改。
- 长文本编辑浮层打开时，`Cmd/Ctrl+S` 只应用该浮层文本；未打开长文本浮层时，`Cmd/Ctrl+S` 才保存整个主题编辑面板。

## 17. 主题按钮语义与绑定

### 17.1 按钮分层

导图 SVG 渲染分为三层：

- 连线层：只绘制父子连线、共享主干、时间轴、鱼骨主骨等结构线。
- 主题本体层：只绘制主题卡片、图标、文本和主题样式。
- 主题控件层：统一绘制编辑、折叠/展开、添加子主题、添加兄弟主题等主题按钮。

主题按钮不要再放回主题本体层。按钮层只读取主题布局结果和语义点位，负责按钮显示、定位、冲突避让和事件命中。

### 17.2 语义点位

每个主题框周围存在 4 个语义点位：

- 父线入口：父主题连接线进入当前主题的位置。没有父主题时，由布局语义推导，通常位于子线出口的对侧。
- 子线出口：当前主题连接到子主题的位置。有实际可见子线时取真实连线交点；没有可见子线时按当前布局默认子级展开方向推导。
- 兄主题插入点：用于在当前主题前方插入兄弟主题，位于兄主题方向一侧的主题边框中点。
- 弟主题插入点：用于在当前主题后方插入兄弟主题，位于弟主题方向一侧的主题边框中点。

普通右向思维导图中，父线入口是左侧中点，子线出口是右侧中点，兄主题插入点是上侧中点，弟主题插入点是下侧中点。

下挂展开时，子线出口必须跟随实际连接线交点。例如右向布局中子主题向下挂出时，子线出口应变为下侧中点，而不是继续使用右侧中点。

### 17.3 绑定与显示规则

主题按钮与语义点位的绑定关系：

- 折叠/展开按钮：绑定子线出口。当前主题有子主题时显示。
- 添加子主题按钮：绑定子线出口。当前主题没有子主题时显示，与折叠/展开按钮互斥。
- 编辑按钮：绑定父线入口。编辑视图中原则上始终显示；根主题或孤立主题根据布局语义推导父线入口。
- 在前方添加兄弟主题按钮：绑定兄主题插入点。一级主题不显示。
- 在后方添加兄弟主题按钮：绑定弟主题插入点。一级主题不显示。

冲突优先级：

- 第一优先级：子线出口按钮，包括折叠/展开按钮、添加子主题按钮。它们必须严格贴合子线出口。
- 第二优先级：编辑按钮，优先贴合父线入口。
- 第三优先级：兄弟主题插入按钮。发生冲突时只做局部避让，仍然保留前方/后方语义，不移动到相反方向。

补充规则：

- 所有按钮的中心点必须落在主题边框上。实际连线坐标只能用来判断语义侧边，不能让按钮漂到连接线上。
- 同级主题之间需要给新增兄弟主题按钮保留最小视觉间隙。按钮半径 8px 时，相邻按钮中心距离至少为 19px，也就是两个按钮之间约 3px 可见间隙。
- 多个不同侧边的子线出口同时存在时，不把折叠/展开按钮放到任一条实际连接线上，而是选择未被主连接线占用的中性边。多个子主题但共享同一侧出口时，折叠/展开按钮仍放在该侧边框中点。双向思维导图和垂直双向思维导图的根主题属于布局语义上的多出口根主题，即使当前内容只在一侧有可见子主题，也按出口轴选择另外两侧放按钮：双向思维导图的出口在左/右，编辑按钮放上侧，折叠/展开按钮放下侧；垂直双向思维导图的出口在上/下，编辑按钮放左侧，折叠/展开按钮放右侧。
- 结构线不能作为按钮出口。树形图主干、时间轴、鱼骨主骨只表达布局结构，不代表普通父子主题出口。树形图根主题折叠/展开按钮固定下侧，时间轴根主题固定右侧，鱼骨图根主题固定鱼尾方向。
- 根主题编辑按钮按布局语义固定：时间轴放左侧，鱼骨图放鱼头所在侧，树形图放上侧，双向思维导图放上侧，垂直双向思维导图放左侧。
- 时间轴二级主题是轴上的时间点主题。它的父线入口固定在左侧，也就是一级主题所在的一侧；它的子线出口按详情分支所在侧固定在上侧或下侧，不能读取详情连线的右侧锚点。
- 时间轴二级主题不显示在前方/后方添加兄弟主题按钮。
- 鱼骨图二级主题不显示在前方/后方添加兄弟主题按钮。它的父线入口固定在鱼头/一级主题那一侧；折叠/展开按钮和添加子主题按钮绑定子线出口，也就是二级主题和斜骨线的交点。
- 树形表格不显示添加子主题按钮和两个添加兄弟主题按钮。
- 折叠/展开按钮和添加主题按钮需要有明显视觉区分。当前折叠/展开按钮使用实心底色，添加主题按钮使用白底加号。
- 添加子主题、在前方添加兄弟主题、在后方添加兄弟主题也需要有轻量视觉区分。添加子主题按钮使用纯加号；兄弟主题按钮在加号旁增加短方向标记，before/after 根据兄弟方向显示在加号前侧或后侧。
- 下挂展开造成子线出口按钮和兄弟主题插入按钮冲突时，兄弟主题插入按钮的避让方向应与下挂子主题展开方向相反。非下挂冲突仍按局部边框方向轻微避让。

---

# 六、代码参考

## 18. 代码地图

### 18.1 样式结构

构建入口 `styles/index.css`，通过 `@import` 按层级聚合，输出 `dist/styles.css`。

```
styles/
├── index.css                             # 唯一入口，按层级声明 @import 顺序
├── 00-foundation/
│   ├── tokens.css                        # CSS 变量、z-index、通用尺寸、颜色兜底
│   └── accessibility.css                 # sr-only、focus-visible、可访问性辅助类
├── 10-host/
│   ├── host.css                          # 插件宿主容器、文档流布局
│   ├── fullscreen.css                    # 阅读视图 body 级覆盖层、编辑视图原生全屏
│   └── messages.css                      # 普通提示、错误提示、插件错误块
├── 20-toolbar/
│   └── toolbar.css                       # 悬浮工具栏、按钮、拖拽抓手、显隐态
├── 30-canvas/
│   ├── canvas.css                        # SVG 幕布、panning 状态、源码/导图显示切换
│   └── height-resize.css                 # 高度拖拽条、hover/focus/resizing 状态
├── 40-source/
│   ├── source-shell.css                  # 源码模式外壳、Tab 栏、状态栏
│   ├── source-editor.css                 # textarea、代码编辑区、滚动和选择态
│   └── source-highlight.css              # 行号层、高亮层、主题级别 token、活动行
├── 50-map/
│   ├── svg.css                           # SVG 基础类、图层、通用 map 状态
│   ├── connectors.css                    # 连线、主干、drop indicator 结构线样式
│   ├── topics.css                        # 主题卡片、文本、图标、树形表格主题样式
│   ├── topic-controls.css                # 编辑/折叠/展开/新增子/兄弟主题按钮
│   └── drag-drop.css                     # 主题拖拽、drop-subtopic、drop-before/after 高亮
├── 60-panels/
│   ├── topic-editor.css                  # 主题编辑面板、字段、颜色、图标、字体控件
│   ├── topic-content-editor.css          # 长文本编辑浮层
│   └── inline-text-editor.css            # 双击内联编辑框
├── 70-config-modal/
│   ├── modal-shell.css                   # 配置面板宿主、标题、拖拽、主体布局
│   ├── modal-tabs.css                    # 配置面板 Tab 导航
│   ├── modal-fields.css                  # 通用字段、label、control、help、warning
│   ├── modal-color-font.css              # 颜色色板、字体 combo、层级字体块
│   ├── modal-switches.css                # 开关控件
│   └── modal-responsive.css              # 配置面板移动端响应式
└── 80-obsidian/
    ├── live-preview.css                  # Obsidian Live Preview 专用兼容样式
    └── responsive.css                    # 非配置面板的通用移动端响应式
```

CSS/浮层补充约定：

- 主题编辑面板、配置面板、工具栏等浮层不要受导图幕布 `overflow` 限制而被裁切。
- 需要跨出幕布显示的浮层优先使用 body 级定位。
- 阅读视图全屏使用 body 级覆盖层（`yonxao-mindmap-fs-overlay`），避免祖先容器
  transform 破坏 position: fixed 定位，以及避免 Obsidian 重渲染导致闪退。
  编辑视图全屏直接使用浏览器原生 Fullscreen API。

### 18.2 源码结构

```
src/
├── main.js                                  # 插件入口，只导出插件类
├── constants.js                             # 全局常量定义
│
├── plugin/
│   └── YonxaoMindmapPlugin.js               # Obsidian 生命周期、注册 yxmm 代码块处理器、设置页入口
│
├── markdown/
│   └── codeBlock.js                         # 在 Markdown 文档中定位并替换 yxmm 代码块内容
│
├── obsidian/
│   └── embed.js                             # Obsidian 嵌入相关 DOM 标记、错误渲染、宿主兼容辅助
│
├── parser/
│   ├── parseMind.js                         # 解析完整 yxmm 文档，生成配置对象和主题树
│   └── serializeMind.js                     # 将主题树和配置区重新序列化为 yxmm 文本
│
├── model/
│   ├── topicTreeActions.js                  # 主题树底层操作：增删改移、查找上下文、防循环
│   ├── topicCommands.js                     # 面向 UI 的主题命令：新增子/兄弟主题、删除确认、复制、折叠后保存
│   └── collapseState.js                     # 折叠状态集合读写、后代折叠/展开、重置折叠
│
├── config/
│   ├── defaultMindConfig.js                 # 用户配置层默认值、枚举值、数值范围定义
│   ├── pluginSettings.js                    # Obsidian data.json 插件设置的规范化
│   ├── configDraft.js                       # 配置面板草稿对象读写
│   ├── mindConfig.js                        # 对外聚合配置 API，保持旧 import 入口稳定
│   ├── runtimeConfigSave.js                 # 运行时配置保存前的合并、转换、默认值裁剪
│   ├── configAccessors.js                   # getPath/setPath/deletePath/clone/merge 配置对象访问工具
│   ├── configCanonicalize.js                # 配置规范化/标准化处理
│   ├── configNormalize.js                   # normalizeMindConfig() 及字体/布局/主题/按钮子配置规范化
│   ├── configSerialize.js                   # 配置区保存结构、无意义配置清理、配置区文本生成
│   └── yamlConfig.js                        # 简化 YAML 解析、序列化、注释处理
│
├── layout/
│   ├── layoutTree.js                        # 统一布局入口，调用各布局组，导出对外 API
│   ├── layoutTypes.js                       # 布局类型集合、布局组判断、连线/下挂能力判断
│   ├── layoutShared.js                      # 主题准备、可见子主题、通用间距和树遍历辅助
│   ├── layoutBounds.js                      # 包围盒、extent、visible bounds、布局平移辅助
│   ├── mindmapLayout.js                     # 横向/竖向/双向思维导图布局
│   ├── treeLayout.js                        # 树形图、左右树形图布局
│   ├── orgLayout.js                         # 组织结构图、右向组织结构图布局
│   ├── timelineLayout.js                    # 时间轴、上侧/下侧时间轴布局
│   ├── radialLayout.js                      # 放射图布局、角度分配、碰撞修正
│   ├── radialGeometry.js                    # 放射图几何计算辅助
│   ├── fishboneLayout.js                    # 鱼骨图布局、大骨/鱼刺主题布局
│   └── treeTableLayout.js                   # 树形表格、阶梯树形表格布局
│
├── renderer/
│   ├── YonxaoMindmapRenderer.js             # 代码块实例调度器：生命周期、模块组装、渲染/保存入口
│   ├── rendererContext.js                   # 向子模块提供统一上下文：翻译、注册清理、保存、重渲染
│   ├── rendererState.js                     # DOM、文档、视口、交互、编辑器状态的分组初始化
│   ├── mapRenderer.js                       # 根据布局结果调度 SVG 层绘制，不直接处理 UI 面板
│   ├── fullscreenController.js              # 阅读视图覆盖层、编辑视图原生全屏、工具栏迁移
│   ├── documentPersistence.js               # 文档持久化：配置/主题树写回 Markdown 文件
│   ├── draw/
│   │   ├── drawTopic.js                     # 主题卡片、背景、边框、基础 topic group 绘制
│   │   ├── drawTopicControls.js             # 编辑/折叠/展开/新增子/兄弟主题按钮绘制
│   │   ├── topicControlPoints.js            # 父线入口、子线出口、兄/弟主题插入点语义点位计算
│   │   ├── topicPointGeometry.js            # 点位几何计算辅助
│   │   ├── drawConnector.js                 # 普通父子连线绘制，调用几何路径计算
│   │   ├── connectorGeometry.js             # 连线锚点裁剪、曲线/直线/折线路径、round cap 修正
│   │   ├── connectorPaths.js                # 连线路径生成
│   │   ├── drawBranchTrunks.js              # 树形图/组织结构图/思维导图共享主干分段上色
│   │   ├── drawTrunkSegments.js             # 主干分段绘制辅助
│   │   ├── drawTimeline.js                  # 时间轴主轴、详情分支主干和专用结构线
│   │   ├── drawFishbone.js                  # 鱼骨图主骨、鱼尾、大骨/斜骨相关绘制
│   │   └── drawTreeTable.js                 # 树形表格专用主题框和表格边界绘制（预留）
│   ├── viewport/
│   │   ├── viewportMath.js                  # 坐标转换、缩放中心、原始大小焦点比例等纯计算
│   │   ├── viewFit.js                       # 适配视图、原始大小、禁止放大、最大放大倍数计算
│   │   ├── panZoomController.js             # wheel、pointer pan、缩放事件绑定和状态更新
│   │   └── canvasHeight.js                  # 自动高度、手动高度、高度拖拽、双击恢复自动高度
│   ├── export/
│   │   ├── exportSvg.js                     # 克隆 SVG、移除控件、内联 CSS 变量、生成导出 SVG
│   │   └── copyText.js                      # 当前主题、子树、整图纯文本序列化
│   └── interaction/
│       ├── topicInteraction.js              # 主题点击/双击/拖拽/右键、焦点和方向键导航
│       └── topicKeyboardShortcuts.js        # 导图 SVG 获得焦点后的主题快捷键分发
│
├── ui/
│   ├── ConfigModal.js                       # 配置面板入口（聚合层，委托给 config-modal/）
│   ├── YonxaoMindmapSettingTab.js           # Obsidian 插件设置页
│   ├── fontOptions.js                       # 字体选项数据和本地化映射
│   ├── toolbar/
│   │   ├── FloatingToolbar.js               # 工具栏 DOM、按钮组合、显隐、事件边界、滚动隐藏
│   │   ├── toolbarPosition.js               # 工具栏吸附点、四角 inside/outside 坐标计算
│   │   └── toolbarButtons.js                # 工具栏按钮定义、状态刷新、tooltip 文案绑定
│   ├── source/
│   │   ├── SourceView.js                    # 源码模式外壳、配置/正文 Tab、输入框和事件协调
│   │   ├── sourceDocument.js                # 源码模式配置区/正文区拆分和组合
│   │   ├── sourceCodeEditor.js              # 源码编辑区核心
│   │   ├── sourceHighlight.js               # 源码模式高亮行和 token 生成
│   │   └── sourceStatus.js                  # 源码模式状态消息、错误提示、行数变化辅助
│   ├── topic-editor/
│   │   ├── TopicEditorPanel.js              # 主题编辑面板外壳、保存/取消、继承值显示
│   │   ├── TopicEditorFields.js             # 文本、颜色、图标、字体、数字输入等字段工厂
│   │   ├── TopicContentEditor.js            # 长文本编辑浮层、拖拽、保存/取消
│   │   ├── InlineTopicEditor.js             # 双击内联编辑文本框、定位、提交和取消
│   │   └── topicEditorState.js              # 打开前快照、自定义/继承状态、取消恢复
│   ├── context-menu/
│   │   ├── mapContextMenu.js                # 导图空白处右键菜单
│   │   └── topicContextMenu.js              # 主题右键菜单
│   └── config-modal/
│       ├── ConfigModal.js                   # 配置面板外壳、Tab 切换、保存/取消/重置、拖拽
│       ├── DisplayTab.js                    # 显示配置页（幕布高度、视图适配、工具栏位置）
│       ├── ColorTab.js                      # 颜色配置页（主题色系、默认主题颜色）
│       ├── StructureTab.js                  # 结构配置页（布局类型、连线线型、下挂展开、最大宽度）
│       ├── FontTab.js                       # 字体配置页（全局字体和按主题级别覆盖）
│       ├── InteractionTab.js                # 交互配置页（滚轮缩放、Tab 缩进等）
│       ├── ShortcutsTab.js                  # 快捷键配置页（只读展示快捷键列表）
│       ├── AdvancedTab.js                   # 高级 YAML 文本编辑页
│       ├── configFields.js                  # 数字/下拉/字体/颜色/开关/帮助文案等字段工厂
│       ├── configModalRules.js              # 连线线型可配置性、下挂展开可配置性、禁用态规则
│       ├── configModalState.js              # 草稿快照、是否已修改、继承样式同步
│       └── configModalShared.js             # 配置面板共享工具
│
├── shared/
│   └── rendererShared.js                    # Renderer 共享常量/工具
│
├── theme/
│   └── mindThemes.js                        # 内置主题色系定义
│
├── icons/
│   ├── iconPaths.js                         # 内置图标 SVG path 数据
│   └── renderIcon.js                        # 图标渲染函数
│
├── source/
│   └── topicLevelKeys.js                    # 主题级别键名常量
│
├── i18n/
│   ├── messages.js                          # 国际化消息聚合入口
│   ├── languageOptions.js                   # 语言选项定义
│   ├── createAdditionalLocale.js            # 补充语言文案的辅助函数
│   └── locales/
│       ├── en.js                            # English（兜底语言）
│       ├── zhCN.js                          # 中文（简体）
│       ├── zhTW.js                          # 中文（繁體）
│       ├── eastAsian.js                     # 日/韩等东亚语言
│       ├── european.js                      # 法/德/西/葡/俄/意等欧洲语言
│       └── globalSouth.js                   # 印尼/土/越/泰/印地等语言
│
└── utils/
    ├── color.js                             # 颜色解析、转换、混合工具
    ├── dom.js                               # DOM 操作工具
    ├── math.js                              # 数学计算工具
    ├── svg.js                               # SVG 操作工具
    └── text.js                              # 文本换行、截断、测量工具
```

### 18.3 按功能快速定位

```
要改主题卡片外观 → src/renderer/draw/drawTopic.js
                   styles/50-map/topics.css

要改连线样式     → src/renderer/draw/drawConnector.js
                   src/renderer/draw/connectorGeometry.js
                   styles/50-map/connectors.css

要改布局算法     → src/layout/{layoutType}Layout.js
                   入口: src/layout/layoutTree.js

要改主题交互     → src/renderer/interaction/topicInteraction.js
                   src/renderer/interaction/topicKeyboardShortcuts.js
                   src/ui/topic-editor/*.js

要改主题快捷键   → src/renderer/interaction/topicKeyboardShortcuts.js
                   src/model/topicCommands.js

要改配置面板     → src/ui/config-modal/{TabName}Tab.js
                   入口: src/ui/config-modal/ConfigModal.js

要改工具栏       → src/ui/toolbar/FloatingToolbar.js
                   styles/20-toolbar/toolbar.css

要改配置系统     → src/config/defaultMindConfig.js  (默认值/枚举)
                   src/config/mindConfig.js          (聚合入口)

要改国际化文案   → src/i18n/locales/{language}.js
                   入口: src/i18n/messages.js

要改主题色系     → src/theme/mindThemes.js

要改源码模式     → src/ui/source/SourceView.js
                   src/ui/source/sourceCodeEditor.js

要改解析/序列化  → src/parser/parseMind.js
                   src/parser/serializeMind.js

要改 Markdown 集成 → src/markdown/codeBlock.js
                      src/plugin/YonxaoMindmapPlugin.js
```

### 18.4 数据流

```
Markdown 文档
  │
  └─→ src/markdown/codeBlock.js          # 提取 yxmm 代码块
        │
        └─→ src/parser/parseMind.js       # 解析为配置对象 + 主题树
              │
              ├─→ src/config/mindConfig.js # 配置规范化/合并
              │
              └─→ src/layout/layoutTree.js # 布局计算
                    │
                    └─→ src/renderer/mapRenderer.js  # SVG 绘制
                          │
                          ├─→ src/renderer/draw/     # 连线、主题、控件
                          ├─→ src/renderer/viewport/ # 视口、缩放、高度
                          └─→ src/ui/                # 工具栏、面板、编辑
                                │
                                └─→ src/parser/serializeMind.js  # 写回 Markdown
                                      │
                                      └─→ src/markdown/codeBlock.js
```

### 18.5 架构层级

```
src/
├── main.js + plugin/           # 层0: Obsidian 宿主接入
├── markdown/ + obsidian/       # 层1: Markdown ↔ 插件桥接
├── parser/ + model/            # 层2: 解析/序列化 + 数据模型
├── config/                     # 层3: 配置系统
├── layout/                     # 层4: 布局计算（纯数据，不涉及 DOM）
├── renderer/                   # 层5: 渲染调度 + 绘制 + 视口 + 导出
│   ├── draw/                   #   5a: SVG 绘制
│   ├── viewport/               #   5b: 视口/缩放/平移
│   ├── export/                 #   5c: 导出/Copy
│   └── interaction/            #   5d: 交互事件
├── ui/                         # 层6: UI 面板（工具栏/源码/编辑/配置）
├── theme/ + icons/ + i18n/     # 层7: 横向资源
└── utils/ + shared/            # 层8: 通用工具
```

## 19. 常见问题汇总

### 19.1 构建问题

#### 19.1.1 dist 目录被清理后 `.hotreload` 丢失

运行 `release:prepare` 会清理并重建 `dist/`，可能移除 `.hotreload`。开发时使用：

```bash
npm run ai:validate
```

或：

```bash
npm run dev:obsidian
```

### 19.2 配置问题

#### 19.2.1 配置 UI 和实际渲染逻辑不一致

比如 `structure.connectorStyle` 只有思维导图布局可配置。改 UI 时要确认渲染器实际是否使用该配置。

#### 19.2.2 术语表被误改

术语表统一维护在本文档第 7 章「术语规范」。除非明确要求，不要擅自大范围改术语表。需要改代码术语时，以本文档第 7 章当前表格为准。

### 19.3 交互问题

#### 19.3.1 阅读视图和编辑视图交互混淆

阅读视图应禁用编辑类功能，编辑视图应保留编辑能力。判断 Obsidian 当前视图时要谨慎。

#### 19.3.2 自动高度和手动高度冲突

从源码模式切回导图模式时应重新计算高度，但如果用户手动拖出的高度更大，应保留手动高度。

### 19.4 布局问题

#### 19.4.1 布局共享逻辑过度复用

不同布局虽然都叫"连线"或"主干"，但语义不同。抽公共函数时只抽几何或颜色分段等真正一致的部分，不要把布局语义硬合并。

#### 19.4.2 下挂展开按钮重叠

下挂展开会改变子线出口，折叠按钮、新增兄弟主题按钮、新增子主题按钮可能落到同一点。处理时至少要保证：

- 事件顺序上折叠按钮优先，不能一键同时折叠和新增。
- 视觉上把新增兄弟主题按钮错开，不要让两个按钮长期叠在一起。
- 错开距离来自按钮半径和视觉间隙常量，不要写死无法解释的数字。

#### 19.4.3 竖向下挂连线穿过父主题

上向/下向/垂直双向思维导图的下挂展开中，子主题统一向右展开；如果第一个子主题中心点落在父主题右边缘内侧，折线会从父主题自身穿过。修复应从布局起始偏移入手，让第一个子主题中心点位于父主题右边缘之外，而不是单纯改连线锚点。

### 19.5 开发流程

#### 19.5.1 无效改动要及时撤回

如果用户验证某个修复"没有变化"或"太难看"，应先检查当前 diff，撤掉本轮无效改动，再重新定位问题。不要为了证明思路继续叠加补丁。
