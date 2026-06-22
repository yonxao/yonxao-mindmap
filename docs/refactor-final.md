# yonxao-mindmap 最终重构方案

本文整合 `docs/refactor-codex.md`、`docs/refactor-claude.md`、`docs/refactor-hermes.md`、`docs/refactor-trae.md` 四份方案，并结合当前项目约定形成最终执行版。

目标不是重新设计产品，而是在现有功能基本完成的前提下，通过拆分和重新组织文件降低复杂度，让后续维护、回归和发布更稳。

## 1. 综合判断

四份方案的核心判断一致：

- 项目主链路已经完整：`yxmm` 源码 -> 配置解析 -> 主题树 -> 布局 -> SVG 渲染 -> 编辑交互 -> 写回 Markdown。
- 最大风险是 `src/renderer/YonxaoMindmapRenderer.js`，它已经承载过多 UI、渲染、交互、保存和导出职责。
- 第二梯队风险是 `src/ui/ConfigModal.js`、`src/config/mindConfig.js`、`src/layout/layoutTree.js`。
- 解析、序列化、主题树操作、代码块写回、文本换行等模块边界已经较清楚，适合作为测试安全网的第一批对象。
- CSS 已经有分层基础，但需要跟随 JS 模块拆分进一步细化，尤其是配置弹框、主题编辑面板、源码模式、导图 SVG 控件。

最终推荐路线：

```text
冻结功能和建立基线
  -> 补纯函数测试
  -> 抽配置保存逻辑
  -> 建立 Renderer 上下文
  -> 逐块拆 Renderer
  -> 拆 ConfigModal
  -> 拆 CSS
  -> 最后再考虑拆 layoutTree
```

## 2. 重构原则

### 2.1 用户行为不变

重构期间不改变：

- `yxmm` 代码块语言名。
- 正文区主题级别标记语法。
- 配置区结构。
- 主题属性名称。
- 布局类型名称。
- 阅读视图和编辑视图交互规则。
- 保存到 Markdown 的文本格式。
- 发布目录规则。

插件尚未正式发布，不为旧实验字段增加兼容层，不恢复旧逻辑。

### 2.2 文件大小目标

原则上每个源码文件控制在 500 行左右。

执行标准：

- 新增文件优先控制在 100 到 400 行。
- 复杂 UI 容器、布局算法文件可以短期超过 500 行，但应说明原因，并在后续阶段继续拆。
- 不为了追求行数机械拆分。拆分必须对应真实职责边界。
- `i18n` 文案和布局算法属于天然偏大的例外，但仍应逐步分组。

推荐行数上限：

| 文件类型           | 目标行数 | 说明                         |
| ------------------ | -------: | ---------------------------- |
| 纯函数工具         |   80-250 | 输入输出明确，便于测试       |
| UI 子组件          |  150-400 | 一个文件对应一个清晰 UI 区域 |
| Renderer 调度器    |  500-900 | 初期可略大，最终只做实例调度 |
| ConfigModal 主容器 |  300-500 | Tab 内容移到子文件           |
| 单个布局文件       |  300-700 | 允许因算法凝聚稍大           |
| CSS 文件           |   80-350 | 单文件聚焦一个视觉区域       |

### 2.3 职责单一但不过度碎片化

拆分时遵循：

- 一个文件回答一个问题：负责什么，不负责什么。
- 强相关的小函数可以留在同一文件，不必每个函数一个文件。
- UI 的 DOM 创建、事件绑定、状态保存应按区域拆，不按按钮拆。
- 布局算法按布局家族拆，不按每个小几何函数拆。
- CSS 按视觉区域和组件拆，不按单个 class 拆。

### 2.4 每一步可独立验证

每个阶段必须：

- 范围独立。
- 可单独回滚。
- 结束后运行 `npm run ai:validate`。
- 涉及视觉或 Obsidian 宿主能力时做人工回归。

## 3. 目标源码目录与文件职责

下面是重构后的目标结构。不是一次性全部创建，而是按阶段逐步迁移。

```text
src/
  main.js
  constants.js

  plugin/
    YonxaoMindmapPlugin.js

  markdown/
    codeBlock.js

  parser/
    parseMind.js
    serializeMind.js

  config/
    defaultMindConfig.js
    pluginSettings.js
    configDraft.js
    mindConfig.js
    runtimeConfigSave.js
    configAccessors.js
    yamlConfig.js
    configNormalize.js
    configSerialize.js

  model/
    topicTreeActions.js
    topicCommands.js
    collapseState.js

  layout/
    layoutTree.js
    layoutTypes.js
    layoutShared.js
    layoutBounds.js
    mindmapLayout.js
    treeLayout.js
    orgLayout.js
    timelineLayout.js
    radialLayout.js
    fishboneLayout.js
    treeTableLayout.js

  renderer/
    YonxaoMindmapRenderer.js
    rendererContext.js
    rendererState.js
    mapRenderer.js
    fullscreenController.js
    draw/
      drawTopic.js
      drawTopicText.js
      drawTopicControls.js
      topicControlPoints.js
      drawConnector.js
      connectorGeometry.js
      drawBranchTrunks.js
      drawTimeline.js
      drawFishbone.js
      drawTreeTable.js
    viewport/
      viewportState.js
      viewportMath.js
      viewFit.js
      panZoomController.js
      canvasHeight.js
    export/
      exportSvg.js
      copyImage.js
      copyText.js

  ui/
    toolbar/
      FloatingToolbar.js
      toolbarPosition.js
      toolbarButtons.js
    source/
      SourceView.js
      sourceDocument.js
      sourceHighlight.js
      sourceStatus.js
    topic-editor/
      TopicEditorPanel.js
      TopicEditorFields.js
      TopicTextEditor.js
      InlineTopicEditor.js
      topicEditorState.js
    context-menu/
      mapContextMenu.js
      topicContextMenu.js
    config-modal/
      ConfigModal.js
      BasicTab.js
      ThemeTab.js
      LayoutTab.js
      FontTab.js
      AdvancedTab.js
      configFields.js
      configModalRules.js
      configModalState.js
    YonxaoMindmapSettingTab.js
    fontOptions.js

  source/
    topicLevelKeys.js

  theme/
    mindThemes.js

  icons/
    iconPaths.js
    renderIcon.js

  i18n/
    messages.js
    localeMeta.js

  obsidian/
    embed.js

  utils/
    color.js
    dom.js
    math.js
    svg.js
    text.js
    drag.js
```

### 3.1 入口与 Obsidian 接入

| 文件                                | 职责                                                                    |
| ----------------------------------- | ----------------------------------------------------------------------- |
| `src/main.js`                       | 插件入口，只导出插件类。                                                |
| `src/plugin/YonxaoMindmapPlugin.js` | Obsidian 生命周期、注册 `yxmm` 代码块处理器、设置页、全局默认配置刷新。 |
| `src/obsidian/embed.js`             | Obsidian 嵌入相关 DOM 标记、错误渲染、宿主兼容辅助。                    |
| `src/markdown/codeBlock.js`         | 在完整 Markdown 文档中定位并替换当前 `yxmm` 代码块内容。                |

### 3.2 解析、序列化与模型

| 文件                            | 职责                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `src/parser/parseMind.js`       | 解析完整 `yxmm` 文档，生成配置对象和主题树。                                       |
| `src/parser/serializeMind.js`   | 将主题树和配置区重新序列化为 `yxmm` 文本。                                         |
| `src/model/topicTreeActions.js` | 主题树底层操作：增删改移、查找上下文、防循环、刷新主题级别。                       |
| `src/model/topicCommands.js`    | 面向 UI 的主题命令：新增子主题、兄弟主题、删除确认、复制子树、折叠展开后触发保存。 |
| `src/model/collapseState.js`    | 折叠状态集合的读写、后代折叠/展开、重置折叠。                                      |

### 3.3 配置系统

| 文件                              | 职责                                                                      |
| --------------------------------- | ------------------------------------------------------------------------- |
| `src/config/defaultMindConfig.js` | 用户配置层默认值、枚举值、数值范围。                                      |
| `src/config/pluginSettings.js`    | Obsidian `data.json` 中插件设置的规范化。                                 |
| `src/config/configDraft.js`       | 配置弹框草稿对象读写。                                                    |
| `src/config/mindConfig.js`        | 对外聚合配置 API，保持旧 import 入口稳定，逐步变薄。                      |
| `src/config/runtimeConfigSave.js` | 运行时配置保存前的合并、转换、默认值裁剪。                                |
| `src/config/configAccessors.js`   | `getPath`、`setPath`、`deletePath`、`clone`、`merge` 等配置对象访问工具。 |
| `src/config/yamlConfig.js`        | 简化 YAML 的解析、序列化、注释处理。                                      |
| `src/config/configNormalize.js`   | `normalizeMindConfig()` 及字体、布局、主题、按钮等子配置规范化。          |
| `src/config/configSerialize.js`   | 配置区保存结构、无意义配置清理、配置区文本生成。                          |

说明：

- 初期可以只新增 `runtimeConfigSave.js`，不急着拆 `mindConfig.js`。
- 当 `mindConfig.js` 仍超过 500 行并继续增长时，再拆 `yamlConfig.js`、`configAccessors.js`、`configNormalize.js`。

### 3.4 Renderer 与绘制

| 文件                                      | 职责                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------- |
| `src/renderer/YonxaoMindmapRenderer.js`   | 代码块实例调度器：生命周期、模块组装、渲染/保存入口。                |
| `src/renderer/rendererContext.js`         | 向子模块提供统一上下文：翻译、注册清理、保存、重渲染、当前状态引用。 |
| `src/renderer/rendererState.js`           | DOM、文档、视口、交互、编辑器状态的分组初始化。                      |
| `src/renderer/mapRenderer.js`             | 根据布局结果调度 SVG 层绘制，不直接处理 UI 面板。                    |
| `src/renderer/fullscreenController.js`    | 阅读视图覆盖层、编辑视图原生全屏、工具栏迁移。                       |
| `src/renderer/draw/drawTopic.js`          | 主题卡片、背景、边框、基础 topic group 绘制。                        |
| `src/renderer/draw/drawTopicText.js`      | 主题文本、行高、多行文本、图标旁文本定位。                           |
| `src/renderer/draw/drawTopicControls.js`  | 编辑、折叠/展开、新增子主题、新增兄弟主题按钮绘制。                  |
| `src/renderer/draw/topicControlPoints.js` | 父线入口、子线出口、兄/弟主题插入点等语义点位计算。                  |
| `src/renderer/draw/drawConnector.js`      | 普通父子连线绘制，调用几何路径计算。                                 |
| `src/renderer/draw/connectorGeometry.js`  | 连线锚点裁剪、曲线/直线/折线路径、round cap 修正。                   |
| `src/renderer/draw/drawBranchTrunks.js`   | 树形图、组织结构图、思维导图共享主干分段上色。                       |
| `src/renderer/draw/drawTimeline.js`       | 时间轴主轴、详情分支主干和时间轴专用结构线。                         |
| `src/renderer/draw/drawFishbone.js`       | 鱼骨图主骨、鱼尾、大骨/斜骨相关绘制。                                |
| `src/renderer/draw/drawTreeTable.js`      | 树形表格专用主题框和表格边界绘制。                                   |

说明：

- `rendererContext.js` 可以采用低风险方式：先让子模块接收 Renderer 或 Context，再逐步减少直接访问 `this.*`。
- 绘制层先拆纯几何，再拆 DOM 绘制，最后拆特殊布局主干。

### 3.5 视口、缩放、平移、高度

| 文件                                         | 职责                                             |
| -------------------------------------------- | ------------------------------------------------ |
| `src/renderer/viewport/viewportState.js`     | viewBox、缩放、平移、适配模式等状态结构。        |
| `src/renderer/viewport/viewportMath.js`      | 坐标转换、缩放中心、原始大小焦点比例等纯计算。   |
| `src/renderer/viewport/viewFit.js`           | 适配视图、原始大小、禁止放大、最大放大倍数计算。 |
| `src/renderer/viewport/panZoomController.js` | wheel、pointer pan、缩放事件绑定和状态更新。     |
| `src/renderer/viewport/canvasHeight.js`      | 自动高度、手动高度、高度拖拽、双击恢复自动高度。 |

### 3.6 UI 模块

| 文件                                       | 职责                                                     |
| ------------------------------------------ | -------------------------------------------------------- |
| `src/ui/toolbar/FloatingToolbar.js`        | 工具栏 DOM、按钮组合、显隐、事件边界、滚动隐藏。         |
| `src/ui/toolbar/toolbarPosition.js`        | 工具栏吸附点、四角 inside/outside 坐标、最近吸附点计算。 |
| `src/ui/toolbar/toolbarButtons.js`         | 工具栏按钮定义、状态刷新、tooltip 文案绑定。             |
| `src/ui/source/SourceView.js`              | 源码模式外壳、配置/正文 Tab、输入框和事件协调。          |
| `src/ui/source/sourceDocument.js`          | 源码模式配置区/正文区拆分和组合。                        |
| `src/ui/source/sourceHighlight.js`         | 源码模式高亮行和 token 生成。                            |
| `src/ui/source/sourceStatus.js`            | 源码模式状态消息、错误提示、行数变化辅助。               |
| `src/ui/topic-editor/TopicEditorPanel.js`  | 主题编辑面板外壳、保存/取消、继承值显示。                |
| `src/ui/topic-editor/TopicEditorFields.js` | 文本、颜色、图标、字体、数字输入等字段工厂。             |
| `src/ui/topic-editor/TopicTextEditor.js`   | 长文本编辑浮层、拖拽、保存/取消。                        |
| `src/ui/topic-editor/InlineTopicEditor.js` | 双击内联编辑文本框、定位、提交和取消。                   |
| `src/ui/topic-editor/topicEditorState.js`  | 打开前快照、自定义/继承状态、取消恢复。                  |
| `src/ui/context-menu/mapContextMenu.js`    | 空白处右键菜单。                                         |
| `src/ui/context-menu/topicContextMenu.js`  | 主题右键菜单。                                           |
| `src/ui/config-modal/ConfigModal.js`       | 配置弹框外壳、Tab 切换、保存/取消/重置、拖拽。           |
| `src/ui/config-modal/BasicTab.js`          | 基础配置页。                                             |
| `src/ui/config-modal/ThemeTab.js`          | 主题色系、默认主题颜色、按钮颜色配置页。                 |
| `src/ui/config-modal/LayoutTab.js`         | 布局类型、连线线型、下挂展开、主题最大宽度配置页。       |
| `src/ui/config-modal/FontTab.js`           | 全局字体和按主题级别字体配置页。                         |
| `src/ui/config-modal/AdvancedTab.js`       | 高级 YAML 文本编辑页。                                   |
| `src/ui/config-modal/configFields.js`      | 数字、下拉、字体、颜色、开关、帮助文案等字段工厂。       |
| `src/ui/config-modal/configModalRules.js`  | 连线线型可配置性、下挂展开可配置性、禁用态和警告规则。   |
| `src/ui/config-modal/configModalState.js`  | 草稿快照、是否已修改、继承样式同步。                     |
| `src/ui/YonxaoMindmapSettingTab.js`        | Obsidian 设置页。                                        |
| `src/ui/fontOptions.js`                    | 字体选项数据和本地化映射。                               |

### 3.7 导出与复制

| 文件                               | 职责                                                      |
| ---------------------------------- | --------------------------------------------------------- |
| `src/renderer/export/exportSvg.js` | 克隆 SVG、移除控件、内联 CSS 变量、生成导出 SVG。         |
| `src/renderer/export/copyImage.js` | 复制 PNG、Electron clipboard/browser Clipboard 兼容分支。 |
| `src/renderer/export/copyText.js`  | 当前主题、子树、整图纯文本序列化。                        |

### 3.8 布局系统

| 文件                            | 职责                                           |
| ------------------------------- | ---------------------------------------------- |
| `src/layout/layoutTree.js`      | 统一布局入口，调用各布局组，导出对外 API。     |
| `src/layout/layoutTypes.js`     | 布局类型集合、布局组判断、连线/下挂能力判断。  |
| `src/layout/layoutShared.js`    | 主题准备、可见子主题、通用间距和树遍历辅助。   |
| `src/layout/layoutBounds.js`    | 包围盒、extent、visible bounds、布局平移辅助。 |
| `src/layout/mindmapLayout.js`   | 横向、竖向、双向思维导图布局。                 |
| `src/layout/treeLayout.js`      | 树形图、左右树形图布局。                       |
| `src/layout/orgLayout.js`       | 组织结构图、右向组织结构图布局。               |
| `src/layout/timelineLayout.js`  | 时间轴、上侧/下侧时间轴布局。                  |
| `src/layout/radialLayout.js`    | 放射图布局、角度分配、碰撞修正。               |
| `src/layout/fishboneLayout.js`  | 鱼骨图布局、大骨/鱼刺主题布局。                |
| `src/layout/treeTableLayout.js` | 树形表格、阶梯树形表格布局。                   |

说明：

- 布局拆分最后做。
- 第一步只移动代码，不重写算法。
- `layoutTree()` 对外入口保持不变，降低改动面。

## 4. CSS 目标目录与文件职责

CSS 也同步重构，但不追求碎片化。目标是让样式结构与 JS 模块边界对应，同时保持构建方式简单。

当前 `scripts/build-css.mjs` 支持递归 `@import`，因此可以使用子目录组织 CSS。

目标结构：

```text
styles/
  index.css

  00-foundation/
    tokens.css
    accessibility.css

  10-host/
    host.css
    fullscreen.css
    messages.css

  20-toolbar/
    toolbar.css

  30-canvas/
    canvas.css
    height-resize.css

  40-source/
    source-shell.css
    source-editor.css
    source-highlight.css

  50-map/
    svg.css
    connectors.css
    topics.css
    topic-controls.css
    drag-drop.css

  60-panels/
    topic-editor.css
    topic-text-editor.css
    inline-text-editor.css

  70-config-modal/
    modal-shell.css
    modal-tabs.css
    modal-fields.css
    modal-color-font.css
    modal-switches.css
    modal-advanced.css
    modal-responsive.css

  80-obsidian/
    live-preview.css
    responsive.css
```

### 4.1 CSS 文件职责

| 文件                                          | 职责                                               |
| --------------------------------------------- | -------------------------------------------------- |
| `styles/index.css`                            | 唯一入口，只声明导入顺序。                         |
| `styles/00-foundation/tokens.css`             | 共享 CSS 变量、z-index、通用尺寸、颜色兜底。       |
| `styles/00-foundation/accessibility.css`      | `sr-only`、通用 focus-visible、可访问性辅助类。    |
| `styles/10-host/host.css`                     | 插件宿主、容器、普通文档流布局。                   |
| `styles/10-host/fullscreen.css`               | 阅读视图覆盖层、编辑视图全屏、全屏容器。           |
| `styles/10-host/messages.css`                 | 普通提示、错误提示、插件错误块。                   |
| `styles/20-toolbar/toolbar.css`               | 悬浮工具栏、按钮、拖拽抓手、显隐态。               |
| `styles/30-canvas/canvas.css`                 | SVG 幕布、panning 状态、源码/导图模式显示切换。    |
| `styles/30-canvas/height-resize.css`          | 高度拖拽条、hover/focus/resizing 状态。            |
| `styles/40-source/source-shell.css`           | 源码模式外壳、Tab、状态栏。                        |
| `styles/40-source/source-editor.css`          | textarea、代码编辑区、滚动和选择态。               |
| `styles/40-source/source-highlight.css`       | 行号、高亮层、主题级别 token、活动行。             |
| `styles/50-map/svg.css`                       | SVG 基础类、图层、通用 map 状态。                  |
| `styles/50-map/connectors.css`                | 连线、主干、drop indicator 中结构线样式。          |
| `styles/50-map/topics.css`                    | 主题卡片、文本、图标、树形表格主题样式。           |
| `styles/50-map/topic-controls.css`            | 编辑、折叠/展开、新增子主题、新增兄弟主题按钮。    |
| `styles/50-map/drag-drop.css`                 | 主题拖拽、drop-subtopic、drop-before/after 高亮。  |
| `styles/60-panels/topic-editor.css`           | 主题编辑面板、字段、颜色、图标、字体控件。         |
| `styles/60-panels/topic-text-editor.css`      | 长文本编辑浮层。                                   |
| `styles/60-panels/inline-text-editor.css`     | 双击内联编辑框。                                   |
| `styles/70-config-modal/modal-shell.css`      | 配置弹框宿主、标题、拖拽、主体布局。               |
| `styles/70-config-modal/modal-tabs.css`       | 配置弹框 Tab 导航。                                |
| `styles/70-config-modal/modal-fields.css`     | 通用字段、label、control、help、warning、actions。 |
| `styles/70-config-modal/modal-color-font.css` | 颜色色板、字体 combo、层级字体块。                 |
| `styles/70-config-modal/modal-switches.css`   | 开关控件。                                         |
| `styles/70-config-modal/modal-advanced.css`   | 高级 YAML 编辑区和高级页特殊布局。                 |
| `styles/70-config-modal/modal-responsive.css` | 配置弹框移动端响应式。                             |
| `styles/80-obsidian/live-preview.css`         | Obsidian Live Preview 专用兼容样式。               |
| `styles/80-obsidian/responsive.css`           | 非配置弹框的通用移动端响应式。                     |

### 4.2 CSS 导入顺序

`styles/index.css` 建议变成：

```css
@import './00-foundation/tokens.css';
@import './00-foundation/accessibility.css';

@import './10-host/host.css';
@import './10-host/fullscreen.css';
@import './10-host/messages.css';

@import './20-toolbar/toolbar.css';

@import './30-canvas/canvas.css';
@import './30-canvas/height-resize.css';

@import './40-source/source-shell.css';
@import './40-source/source-editor.css';
@import './40-source/source-highlight.css';

@import './50-map/svg.css';
@import './50-map/connectors.css';
@import './50-map/topics.css';
@import './50-map/topic-controls.css';
@import './50-map/drag-drop.css';

@import './60-panels/topic-editor.css';
@import './60-panels/topic-text-editor.css';
@import './60-panels/inline-text-editor.css';

@import './70-config-modal/modal-shell.css';
@import './70-config-modal/modal-tabs.css';
@import './70-config-modal/modal-fields.css';
@import './70-config-modal/modal-color-font.css';
@import './70-config-modal/modal-switches.css';
@import './70-config-modal/modal-advanced.css';
@import './70-config-modal/modal-responsive.css';

@import './80-obsidian/live-preview.css';
@import './80-obsidian/responsive.css';
```

### 4.3 CSS 重构原则

- 只移动样式，不改视觉效果。
- class 名保持稳定，除非同步修改 JS 并有明确收益。
- 配置弹框 CSS 优先拆，因为 `90-config-modal.css` 已接近 500 行。
- `60-panels.css` 拆为主题编辑、长文本编辑、内联编辑三块。
- `50-map.css` 拆为主题、连线、控件、拖拽状态四块。
- `40-source.css` 拆为源码壳、编辑器、高亮三块。
- 保留编号目录和文件顺序，避免导入顺序不清。
- CSS 重构阶段必须跑 `npm run ai:validate`，并人工检查深色/浅色主题、移动端宽度、Live Preview。

## 5. 分阶段执行计划

### 阶段 0：冻结功能与建立回归基线

目标：

确认当前功能和视觉状态，避免重构过程中目标漂移。

动作：

- 运行 `npm run ai:validate`。
- 使用 `examples/regression-layout-gallery.zh-CN.md` 做一次人工回归。
- 确认重构期间不新增功能。
- 记录重点截图：普通思维导图、下挂展开、时间轴、鱼骨图、树形表格、配置弹框、主题编辑面板、源码模式、全屏。

验收：

- `npm run ai:validate` 通过。
- 有可复用回归样例和截图基线。

风险：低。

### 阶段 1：补纯函数测试安全网

目标：

先保护最稳定、最容易测试的逻辑。

建议使用 Node 内置 `node:test`，不新增 Mocha/Chai 等依赖，保持项目轻量。

新增：

```text
test/parser/parseMind.test.js
test/parser/serializeMind.test.js
test/config/mindConfig.test.js
test/markdown/codeBlock.test.js
test/model/topicTreeActions.test.js
test/source/topicLevelKeys.test.js
test/utils/text.test.js
```

测试重点：

- 配置区解析和正文区解析。
- 多根虚拟根。
- 多行主题。
- 主题属性解析和序列化顺序。
- 多代码块精准替换。
- CRLF/LF 换行处理。
- 主题树移动、防循环、刷新主题级别。
- Tab / Shift+Tab 调整主题级别。
- 中文、英文、中英混排换行。
- 配置 normalize、merge、prune。

验收：

- 新增 `npm test`。
- `npm run ai:validate` 包含测试或至少在阶段结束时同时运行 `npm test`。
- 测试不依赖 Obsidian/Electron。

风险：低。

### 阶段 2：抽配置保存与默认值裁剪

目标：

把 Renderer 中运行时配置保存逻辑移到配置层，为后续拆 Renderer 减负。

新增：

```text
src/config/runtimeConfigSave.js
```

职责：

- 构造保存用配置。
- 合并当前运行时配置和文档配置。
- 转换回代码块配置区结构。
- 裁剪与全局默认值一致的配置。
- 判断 `fitViewNoUpscale`、`fitViewMaxScale`、`branchExpansion`、`connectorStyle` 是否应保留。

验收：

- 配置弹框保存后配置区仍精简。
- 非思维导图布局不保存无意义连线线型。
- 下挂展开可用性规则不变。
- `npm test` 和 `npm run ai:validate` 通过。

风险：中低。

### 阶段 3：建立 Renderer Context 与状态分组

目标：

先整理 Renderer 内部状态，不急着移动大块功能。

新增：

```text
src/renderer/rendererContext.js
src/renderer/rendererState.js
```

状态分组：

- `documentState`：`source`、`root`、`rawConfig`、`config`、`hasConfigBlock`。
- `domState`：host、container、svg、图层、toolbar、panel。
- `viewState`：viewBox、fit mode、fullscreen、canvas height。
- `interactionState`：pan、toolbar drag、topic drag、height resize。
- `editorState`：source view、topic editor、inline editor、text editor。

迁移方式：

- 采用保守方式，允许子模块初期接收 Renderer 实例。
- 新模块优先通过 Context 调用 `t()`、`register()`、`renderMap()`、`saveTreeToSourceAndFile()`、`closePanels()`。
- 不在本阶段改变 UI 结构。

验收：

- 用户可见行为不变。
- `npm run ai:validate` 通过。

风险：中低。

### 阶段 4：拆源码模式

目标：

把源码模式完整移出 Renderer。

新增：

```text
src/ui/source/SourceView.js
src/ui/source/sourceDocument.js
src/ui/source/sourceHighlight.js
src/ui/source/sourceStatus.js
```

Renderer 保留：

- 切换源码/导图模式。
- 接收源码变更后触发解析、保存、重渲染。

验收：

- 源码/导图切换不变。
- 配置区和正文区 Tab 不变。
- 源码高亮和活动行不变。
- Tab 调整主题级别不变。
- 源码高度保存和自动高度不变。
- 多代码块保存不回退。
- `npm run ai:validate` 通过。

风险：中。

### 阶段 5：拆工具栏、全屏和高度控制

目标：

拆出工具栏、全屏和高度控制，减少 Renderer 的宿主 UI 噪音。

新增：

```text
src/ui/toolbar/FloatingToolbar.js
src/ui/toolbar/toolbarPosition.js
src/ui/toolbar/toolbarButtons.js
src/renderer/fullscreenController.js
src/renderer/viewport/canvasHeight.js
```

验收：

- 工具栏默认位置和吸附规则不变。
- 拖动工具栏不触发源码/导图切换。
- 页面滚动期间工具栏隐藏规则不变。
- 阅读视图和编辑视图全屏行为不变。
- 高度拖拽和双击恢复自动高度不变。
- `npm run ai:validate` 通过。

风险：中到高。

### 阶段 6：拆主题编辑体系

目标：

把主题编辑面板、长文本编辑、双击内联编辑从 Renderer 中拆出。

新增：

```text
src/ui/topic-editor/TopicEditorPanel.js
src/ui/topic-editor/TopicEditorFields.js
src/ui/topic-editor/TopicTextEditor.js
src/ui/topic-editor/InlineTopicEditor.js
src/ui/topic-editor/topicEditorState.js
```

验收：

- 双击主题仍直接编辑文本。
- 主题编辑面板取消必须恢复编辑前文本和字段状态。
- 文本、颜色、图标、字体、字号、字重、行高、最大宽度保存不变。
- 默认值回填、继承置灰、自定义状态不变。
- 阅读视图禁用编辑类交互。
- `npm run ai:validate` 通过。

风险：高。

### 阶段 7：拆右键菜单和主题命令层

目标：

将菜单展示和主题业务命令从 Renderer 中移出。

新增：

```text
src/ui/context-menu/mapContextMenu.js
src/ui/context-menu/topicContextMenu.js
src/model/topicCommands.js
src/model/collapseState.js
```

验收：

- 空白处右键菜单不变。
- 主题右键菜单不变。
- 删除主题仍二次确认。
- 新增子主题/兄弟主题后源码写回不变。
- 折叠展开和重置折叠状态不变。
- 阅读视图不出现编辑类菜单。
- `npm run ai:validate` 通过。

风险：中。

### 阶段 8：拆导出和复制

目标：

把导出 SVG/PNG、复制图片、复制文本从 Renderer 拆出。

新增：

```text
src/renderer/export/exportSvg.js
src/renderer/export/copyImage.js
src/renderer/export/copyText.js
```

验收：

- 复制图片、导出图片、复制纯文本行为不变。
- 不导出编辑按钮、折叠按钮、新增按钮等控件。
- 深色/浅色主题导出颜色正确。
- 多代码块场景复制当前块。
- `npm run ai:validate` 通过。

风险：中。

### 阶段 9：拆 SVG 绘制层

目标：

把主题、连线、按钮、特殊主干绘制从 Renderer 拆到 `renderer/draw/`。

新增：

```text
src/renderer/draw/drawTopic.js
src/renderer/draw/drawTopicText.js
src/renderer/draw/drawTopicControls.js
src/renderer/draw/topicControlPoints.js
src/renderer/draw/drawConnector.js
src/renderer/draw/connectorGeometry.js
src/renderer/draw/drawBranchTrunks.js
src/renderer/draw/drawTimeline.js
src/renderer/draw/drawFishbone.js
src/renderer/draw/drawTreeTable.js
```

拆分顺序：

1. 连线和按钮点位纯几何。
2. 普通主题绘制。
3. 主题控件绘制。
4. 普通连线绘制。
5. 共享主干、时间轴、鱼骨图、树形表格特殊绘制。

验收：

- 所有布局视觉不变或只有等价细微差异。
- 曲线、直线、折线不变。
- 主干按分支颜色分段不变。
- 下挂展开按钮避让不变。
- 时间轴和鱼骨图二级主题按钮规则不变。
- 树形表格按钮隐藏规则不变。
- `npm run ai:validate` 通过。

风险：高。执行前必须有截图或人工回归基线。

### 阶段 10：拆视口、缩放、平移

目标：

把适配视图、原始大小、平移、缩放从 Renderer 中拆出。

新增：

```text
src/renderer/viewport/viewportState.js
src/renderer/viewport/viewportMath.js
src/renderer/viewport/viewFit.js
src/renderer/viewport/panZoomController.js
```

验收：

- 打开导图时 `fit` / `original` 行为不变。
- `fitViewNoUpscale` 和 `fitViewMaxScale` 行为不变。
- 鼠标滚轮缩放配置不变。
- 拖拽平移不影响主题拖拽。
- 自动高度和手动高度规则不变。
- `npm run ai:validate` 通过。

风险：高。

### 阶段 11：拆 ConfigModal

目标：

配置弹框按 Tab 和字段组件拆分。

新增：

```text
src/ui/config-modal/ConfigModal.js
src/ui/config-modal/BasicTab.js
src/ui/config-modal/ThemeTab.js
src/ui/config-modal/LayoutTab.js
src/ui/config-modal/FontTab.js
src/ui/config-modal/AdvancedTab.js
src/ui/config-modal/configFields.js
src/ui/config-modal/configModalRules.js
src/ui/config-modal/configModalState.js
```

迁移策略：

- 保持 `src/ui/ConfigModal.js` 作为兼容导出入口一段时间，避免一次性改全仓库 import。
- Tab 文件只负责渲染本页字段。
- 通用字段工厂集中到 `configFields.js`。
- 禁用态、下挂展开可用性、连线线型可配置性放到 `configModalRules.js`。

验收：

- 所有 Tab UI 和文案不变。
- 默认值回填、继承置灰、自定义状态不变。
- 全局默认配置弹框和单个代码块配置弹框行为一致。
- 保存后配置区仍精简。
- `npm run ai:validate` 通过。

风险：中。

### 阶段 12：CSS 同步重构

目标：

让样式文件结构与拆分后的 JS 模块对应，保持视觉不变。

动作：

- 创建 CSS 子目录。
- 按第 4 节目标结构移动样式。
- 更新 `styles/index.css` 导入顺序。
- 不改 class 名，不改视觉参数。
- 如果发现重复变量或重复 focus 样式，先抽到 `00-foundation`，不要顺手重做视觉。

优先拆分：

1. `styles/90-config-modal.css` -> `styles/70-config-modal/*`。
2. `styles/60-panels.css` -> `styles/60-panels/*`。
3. `styles/50-map.css` -> `styles/50-map/*`。
4. `styles/40-source.css` -> `styles/40-source/*`。
5. `styles/10-host.css`、`20-toolbar.css`、`30-canvas.css` 按需移动。

验收：

- `dist/styles.css` 构建结果包含全部样式。
- 配置弹框、主题编辑面板、源码模式、导图 SVG 控件视觉不变。
- 深色/浅色主题不回退。
- 移动端宽度检查通过。
- Live Preview 样式不回退。
- `npm run ai:validate` 通过。

风险：中。主要风险是导入顺序和选择器遗漏。

### 阶段 13：拆 mindConfig.js 内部职责

目标：

当 Renderer 与 ConfigModal 已经稳定后，再整理配置内部实现。

新增或完善：

```text
src/config/configAccessors.js
src/config/yamlConfig.js
src/config/configNormalize.js
src/config/configSerialize.js
```

验收：

- `mindConfig.js` 对外导出保持兼容。
- 配置区解析和序列化测试通过。
- 配置弹框保存、全局默认保存、代码块配置裁剪不变。
- `npm run ai:validate` 通过。

风险：中低。

### 阶段 14：拆 layoutTree.js

目标：

最后处理布局算法。只在回归基线稳定后执行。

新增：

```text
src/layout/layoutTypes.js
src/layout/layoutShared.js
src/layout/layoutBounds.js
src/layout/mindmapLayout.js
src/layout/treeLayout.js
src/layout/orgLayout.js
src/layout/timelineLayout.js
src/layout/radialLayout.js
src/layout/fishboneLayout.js
src/layout/treeTableLayout.js
```

原则：

- 只移动，不重写。
- 每次只拆一个布局家族。
- `layoutTree()` 统一入口不变。
- 不把不同布局的语义硬抽象到同一个函数里。
- 不在这个阶段追求更紧凑或更好看的布局。

验收：

- 所有布局在回归样例中位置基本一致。
- 下挂展开、放射碰撞、鱼骨主骨、时间轴轴线、树形表格不回退。
- `npm run ai:validate` 通过。

风险：高。可选阶段，不急。

### 阶段 15：整理 i18n、文档与收尾

目标：

更新文档，清理遗留 import，确认最终目录与开发上下文一致。

动作：

- 更新 `docs/DEVELOPMENT_CONTEXT.zh-CN.md`。
- 更新 `docs/REGRESSION_TEST_CHECKLIST.zh-CN.md`。
- 更新 README 中必要的开发说明。
- `messages.js` 可按功能区整理内部对象，但保持 key 稳定。
- `fontOptions.js` 检查是否仍有重复数据。
- 清理无用 export/import。

验收：

- 缺失 i18n key 仍回退英文。
- 新增 UI 文案至少补 `en`、`zh-CN`、`zh-TW`。
- 文档入口和实际目录一致。
- `npm run ai:validate` 通过。

风险：低到中。

## 6. 推荐执行顺序

最终推荐顺序：

```text
0. 冻结功能与建立回归基线
1. 补纯函数测试安全网
2. 抽配置保存与默认值裁剪
3. 建立 Renderer Context 与状态分组
4. 拆源码模式
5. 拆工具栏、全屏和高度控制
6. 拆主题编辑体系
7. 拆右键菜单和主题命令层
8. 拆导出和复制
9. 拆 SVG 绘制层
10. 拆视口、缩放、平移
11. 拆 ConfigModal
12. CSS 同步重构
13. 拆 mindConfig.js 内部职责
14. 拆 layoutTree.js
15. 整理 i18n、文档与收尾
```

如果想更保守：

- 可以把阶段 5 里的全屏拆分延后到阶段 10。
- 可以把阶段 14 视为可选，等发布后有实际布局维护需求再做。
- CSS 可以跟随对应 JS 阶段分批拆，不一定等到阶段 12 一次性处理。

## 7. 阶段风险表

| 阶段               | 风险   | 原因                         |
| ------------------ | ------ | ---------------------------- |
| 0 回归基线         | 低     | 不改业务逻辑                 |
| 1 测试             | 低     | 只新增测试                   |
| 2 配置保存         | 中低   | 用户强感知，但可测试         |
| 3 Renderer Context | 中低   | 状态整理，少量行为风险       |
| 4 源码模式         | 中     | 涉及保存和高度               |
| 5 工具栏/全屏/高度 | 中到高 | DOM 层级和全屏敏感           |
| 6 主题编辑         | 高     | 交互细节多，取消恢复必须正确 |
| 7 右键菜单/命令    | 中     | 命令会触发保存               |
| 8 导出复制         | 中     | 剪贴板和导出依赖宿主         |
| 9 SVG 绘制         | 高     | 视觉细节最多                 |
| 10 视口            | 高     | 影响所有布局体验             |
| 11 ConfigModal     | 中     | 字段多，但边界清楚           |
| 12 CSS             | 中     | 导入顺序和遗漏选择器风险     |
| 13 mindConfig      | 中低   | 有测试后风险可控             |
| 14 layoutTree      | 高     | 视觉回归成本最高             |
| 15 收尾            | 低到中 | 文档和 i18n 易误改           |

## 8. 通用验收清单

每个阶段完成后检查：

- `npm run ai:validate` 通过。
- 如新增测试，`npm test` 通过。
- 没有修改无关文件。
- 没有恢复旧逻辑：`yxmind`、`mind` 代码块、缩进式语法、旧配置兼容层。
- 术语仍使用“主题”“主题级别”，不新增“节点”作为核心术语。
- 阅读视图仍禁用编辑类交互。
- 编辑视图仍保留主题编辑能力。
- 多代码块保存不误替换。
- 配置区保存后仍精简。

重点人工回归：

- 所有布局的小图、中图、长文本图。
- 适配视图、原始大小、自动高度、手动高度、全屏。
- 曲线、直线、折线；下挂展开只在折线生效。
- 源码模式/导图模式切换。
- 主题编辑：颜色、图标、字体、最大宽度、多行文本、取消恢复。
- 配置弹框：全局默认、代码块覆盖、默认值置灰、保存裁剪。
- 下挂展开按钮避让。
- 时间轴、鱼骨图、树形表格。
- 阅读视图、Live Preview、深色主题、浅色主题。
- 复制图片、导出图片、复制文本。
- 移动端宽度下弹框和工具栏不溢出。

## 9. 不建议做的事

- 不建议在第一轮重构中引入 TypeScript。
- 不建议引入 React/Vue/Svelte 等 UI 框架。
- 不建议新增运行时依赖。
- 不建议先重写布局算法。
- 不建议为了文件少于 500 行把强相关逻辑拆得过散。
- 不建议在同一阶段同时拆 Renderer、ConfigModal、layoutTree。
- 不建议一边重构一边优化视觉。
- 不建议一边重构一边新增布局或新增配置项。

## 10. 最终目标状态

重构完成后，理想状态是：

- `YonxaoMindmapRenderer.js` 从 8000 多行降到 500 到 900 行左右。
- `ConfigModal.js` 主容器控制在 300 到 500 行。
- CSS 单文件基本都低于 350 行。
- 大多数普通 JS 文件低于 500 行。
- 布局算法按布局家族分文件，入口稳定。
- 解析、序列化、配置、代码块写回、主题树操作有测试。
- 新增功能时可以定位到一个明确模块，而不是先阅读整个 Renderer。

最关键的衡量标准：

```text
每个文件都有清晰职责。
每个阶段都可运行、可验证、可回滚。
重构后的用户体验和保存结果与重构前一致。
```

## 11. 建议的下一步提示词

如果要正式开始执行，建议从阶段 0 和阶段 1 开始：

```text
按 docs/refactor-final.md 的方案，先执行阶段 0 和阶段 1。

要求：
- 修改前先说明会新增或修改哪些文件，等我确认后再执行。
- 不重构 Renderer。
- 不改变 yxmm 语法和用户可见行为。
- 使用 Node 内置 node:test。
- 测试只覆盖纯函数，不依赖 Obsidian/Electron。
- 修改后运行 npm test 和 npm run ai:validate。
- 最后总结测试覆盖了哪些行为、还缺哪些人工回归。
```
