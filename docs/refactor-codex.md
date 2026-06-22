# yonxao-mindmap 项目分析与完整重构方案

本文是对当前 `yonxao-mindmap` 项目的阶段性分析报告和重构方案。目标不是继续增加功能，而是在现有功能基本完成的前提下，把项目整理到更容易维护、验证和发布的状态。

## 1. 总体结论

`yonxao-mindmap` 已经从功能原型进入了“准发布产品”阶段。

当前主链路完整清晰：

```text
yxmm 代码块
  -> 解析配置区和正文区
  -> 生成主题树
  -> 规范化全局/文档/主题配置
  -> 计算布局
  -> SVG 渲染
  -> 源码模式/导图模式交互编辑
  -> 序列化并写回当前 Markdown 代码块
```

项目已经具备：

- 完整的 `yxmm` 语法和配置区。
- 插件全局默认配置。
- 阅读视图和 Live Preview 接入。
- 导图模式和源码模式。
- 多布局类型。
- 主题、字体、配色、连线、下挂展开等配置。
- 主题编辑、右键菜单、拖拽排序、折叠展开。
- 工具栏、全屏、复制/导出、自动高度。
- CSS 分层、构建脚本、发布目录规则。
- 人工回归样例和开发上下文文档。

下一阶段最值得做的不是继续加功能，而是进入：

```text
功能冻结 -> 回归基线 -> 分层重构 -> 自动化测试补强 -> beta 发布准备
```

## 2. 当前代码体量

本次只读分析看到的核心文件体量如下：

| 文件                                    | 行数 | 判断                                   |
| --------------------------------------- | ---: | -------------------------------------- |
| `src/renderer/YonxaoMindmapRenderer.js` | 8193 | 最大风险点，承担过多职责               |
| `src/layout/layoutTree.js`              | 2822 | 布局能力集中，特殊布局分支多           |
| `src/i18n/messages.js`                  | 2077 | 文案集中，规模正常但后续可分组         |
| `src/ui/ConfigModal.js`                 | 1670 | 配置弹框职责偏重                       |
| `src/config/mindConfig.js`              | 1028 | 配置解析/规范化/序列化较完整           |
| `src/parser/parseMind.js`               |  236 | 边界清晰，适合补测试                   |
| `src/parser/serializeMind.js`           |  105 | 边界清晰，适合补测试                   |
| `src/model/topicTreeActions.js`         |  215 | 边界清晰，适合补测试                   |
| `src/markdown/codeBlock.js`             |  167 | 当前代码块定位和写回逻辑独立，设计较稳 |

从目录看，复杂度主要集中在：

```text
src/renderer  8193 行
src/layout    2822 行
src/ui        2041 行
src/i18n      2077 行
src/config    1429 行
```

这说明项目底层模块边界已经有基础，真正需要重构的是“渲染器应用层”与“部分大型 UI/布局模块”。

## 3. 当前做得好的地方

### 3.1 接入边界清楚

`src/plugin/YonxaoMindmapPlugin.js` 主要负责 Obsidian 生命周期、注册 `yxmm` 代码块处理器、设置页和全局默认配置刷新。这个边界是正确的，后续不应把业务逻辑塞回插件类。

### 3.2 代码块写回逻辑稳

`src/markdown/codeBlock.js` 独立处理当前 `yxmm` 代码块定位，优先使用 Obsidian `sectionInfo`，失败后再用旧源码兜底匹配。这个设计能降低多代码块场景误替换风险，应保留并补测试。

### 3.3 配置优先级已经成型

配置体系遵循：

```text
主题属性 > 代码块配置区 > 插件全局默认配置 > 插件内置默认值
```

`src/config/defaultMindConfig.js` 保存枚举、范围和默认值，`src/config/mindConfig.js` 负责解析、规范化、序列化和无效配置清理。这个方向正确。

### 3.4 解析、序列化和主题树操作比较纯

以下模块边界清楚、依赖少，适合优先建立自动化测试：

- `src/parser/parseMind.js`
- `src/parser/serializeMind.js`
- `src/model/topicTreeActions.js`
- `src/markdown/codeBlock.js`
- `src/utils/text.js`

这些模块一旦有测试，后续拆 Renderer 时会安心很多。

### 3.5 CSS 已经拆分

`styles/` 目录按宿主、工具栏、幕布、源码、导图、面板、响应式、Live Preview、配置弹框拆分，比单个大 CSS 文件更适合维护。

## 4. 主要风险

### 4.1 Renderer 职责过多

`YonxaoMindmapRenderer.js` 当前同时负责：

- 生命周期和状态。
- 工具栏创建、显隐、拖拽、吸附。
- 全屏进入/退出和工具栏迁移。
- SVG 创建和渲染。
- 主题卡片绘制。
- 连线绘制。
- 树形图、组织结构图、时间轴、鱼骨图主干绘制。
- 主题按钮绘制和语义点位。
- 源码模式、源码高亮、Tab 调整主题级别。
- 主题编辑面板、长文本编辑、内联编辑。
- 右键菜单。
- 主题新增、删除、拖拽排序。
- 折叠状态。
- 配置保存和默认值裁剪。
- 图片复制、图片导出、纯文本复制。
- 缩放、平移、适配视图、自动高度。

它已经不是单纯渲染器，而是“代码块实例控制器 + UI 控制器 + SVG 绘制器 + 交互管理器”。这会带来三个问题：

- 小改动容易触碰无关状态。
- 很难给局部功能写测试。
- 后续新会话或新维护者接手成本高。

### 4.2 布局算法特殊分支多

`layoutTree.js` 支持多种布局，且包含下挂展开、放射碰撞、鱼骨几何、时间轴详情分支、树形表格等特殊规则。这里的主要风险不是“行数大”，而是视觉回归难以靠 lint 发现。

布局重构必须后置，先建立回归样例和测试入口。

### 4.3 配置 UI 与运行时行为需要持续对齐

配置弹框要同时处理：

- 全局默认配置。
- 当前代码块配置。
- 默认值回填。
- 继承值置灰。
- 无意义配置裁剪。
- 非思维导图布局禁用连线线型。
- 下挂展开配置可用性。
- 字体预设和自定义输入。

这里是用户强感知区域。重构时应该先抽纯逻辑，再拆 UI 组件。

### 4.4 缺少真正的自动化行为测试

当前 `npm run ai:validate` 能覆盖：

- 构建。
- `node --check dist/main.js`。
- ESLint。
- Prettier。
- Hot reload 文件准备。

但它不能证明：

- 解析/序列化往返正确。
- 配置裁剪正确。
- 多代码块写回没有误替换。
- 主题树拖拽不会形成循环。
- 文本换行没有明显越界。
- 布局无重叠。
- 各布局按钮点位语义正确。

重构前应先补一层轻量测试安全网。

## 5. 重构目标

### 5.1 用户可见行为不变

重构期间不改变：

- `yxmm` 语法。
- 配置结构。
- 布局名称。
- 主题属性名称。
- 阅读视图/编辑视图交互规则。
- 保存到 Markdown 的文本格式。
- 发布目录规则。

插件尚未正式发布，不为旧实验字段增加兼容层。

### 5.2 Renderer 退回“实例调度器”

最终期望：

`YonxaoMindmapRenderer.js` 只保留：

- 代码块实例生命周期。
- 核心状态持有。
- 模块组装。
- 渲染调度。
- 保存调度。
- 少量跨模块协调方法。

不再直接承载所有 UI、绘制和交互细节。

### 5.3 纯逻辑可测试

以下逻辑应尽量变成无 DOM、无 Obsidian API 的纯函数：

- 源码拆分和组合。
- 配置合并、规范化、裁剪。
- 主题树新增、删除、移动。
- 主题按钮语义点位计算。
- 连线锚点和路径片段计算。
- 视口适配计算。
- 文本换行和归一化。
- 导出文件名、尺寸、颜色替换策略中可纯化的部分。

### 5.4 每个阶段都能独立完成

每个阶段必须满足：

- 范围小。
- 可单独提交。
- 可单独回滚。
- 可通过 `npm run ai:validate`。
- 不依赖后续阶段才能恢复功能。

## 6. 推荐目标目录结构

建议最终演进到下面的结构。不是一次性创建全部目录，而是按阶段逐步迁移。

```text
src/
  plugin/
    YonxaoMindmapPlugin.js

  markdown/
    codeBlock.js

  parser/
    parseMind.js
    serializeMind.js

  config/
    defaultMindConfig.js
    mindConfig.js
    pluginSettings.js
    configDraft.js
    runtimeConfigSave.js

  model/
    topicTreeActions.js
    collapseState.js

  layout/
    layoutTree.js
    layoutTypes.js
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
    mapRenderer.js
    draw/
      drawTopic.js
      drawTopicControls.js
      drawConnector.js
      drawTrunk.js
      drawTimeline.js
      drawFishbone.js
    viewport/
      viewportState.js
      viewportMath.js
      panZoomController.js
      canvasHeight.js
    export/
      exportSvg.js
      copyImage.js
      copyText.js

  ui/
    toolbar/
      ToolbarView.js
      toolbarPosition.js
    source/
      SourceView.js
      sourceDocument.js
      sourceHighlight.js
    topic-editor/
      TopicEditorPanel.js
      TopicTextEditor.js
      InlineTopicEditor.js
      topicEditorState.js
    context-menu/
      topicContextMenu.js
      mapContextMenu.js
    config-modal/
      ConfigModal.js
      BasicTab.js
      ThemeTab.js
      LayoutTab.js
      FontTab.js
      AdvancedTab.js
      configFields.js

  source/
    topicLevelKeys.js

  theme/
  icons/
  utils/
```

## 7. 分阶段重构方案

### 阶段 0：冻结功能与建立基线

目标：

在真正拆代码前，确认当前状态可构建、可回归、可对照。

建议动作：

- 运行 `npm run ai:validate`。
- 记录当前主要功能清单。
- 用 `examples/regression-layout-gallery.zh-CN.md` 做一次人工截图或人工检查。
- 明确重构期间不新增功能。

涉及文件：

- 原则上不改源码。
- 如需补文档，可更新 `docs/REGRESSION_TEST_CHECKLIST.zh-CN.md`。

验收标准：

- `npm run ai:validate` 通过。
- 有一份可复用的人工回归检查入口。

风险：

- 低。这个阶段主要建立基线。

### 阶段 1：补纯函数测试安全网

目标：

先保护最稳定、最容易测试的逻辑，避免后续重构时破坏基础行为。

建议动作：

- 引入 Node 内置 `node:test`，不新增重量级测试框架。
- 新增测试目录，例如 `test/` 或 `tests/`。
- 给以下模块补测试：
  - `parseMindDocument()`、多根虚拟根、多行主题、主题属性解析。
  - `serializeMindDocument()`、多行主题和属性顺序。
  - `replaceCodeBlockSource()` 的 sectionInfo 定位、多代码块兜底、CRLF。
  - `topicTreeActions` 的删除、插入兄弟主题、拖拽移动、防循环。
  - `normalizeMindConfig()` 的范围裁剪、布局枚举、字体配置。
  - `wrapTopicTextByWidth()` 和 `normalizeTopicTextForStorage()` 的关键边界。
- 在 `package.json` 增加测试脚本，并考虑让 `validate` 或 `ai:validate` 包含测试。

涉及文件：

- `package.json`
- `test/**/*.test.js`
- 可能少量调整被测模块导出。

验收标准：

- 测试可独立运行。
- `npm run ai:validate` 通过。
- 测试不依赖 Obsidian/Electron。

风险：

- 低到中。主要风险是测试暴露历史边界行为，需要确认是补测试还是修行为。

### 阶段 2：抽配置保存与默认值裁剪

目标：

把 Renderer 中配置保存相关逻辑抽成纯模块，先减少一块高价值复杂度。

当前适合外移的职责包括：

- 构造运行时保存文档。
- 合并运行时配置。
- 把运行时配置转回配置区结构。
- 裁剪和全局默认值相同的配置。
- 判断 `fitViewNoUpscale`、`fitViewMaxScale`、`branchExpansion` 是否有保存意义。

建议新增：

```text
src/config/runtimeConfigSave.js
```

Renderer 只调用类似：

```js
const { rawConfig, forceConfig } = buildRuntimeConfigForSave(...)
```

涉及文件：

- `src/renderer/YonxaoMindmapRenderer.js`
- `src/config/runtimeConfigSave.js`
- `src/config/mindConfig.js`
- 对应测试文件。

验收标准：

- 保存代码块配置后，配置区仍然保持精简。
- 全局默认配置与代码块配置一致时仍能裁剪。
- 非思维导图布局不保存无意义 `connectorStyle`。
- `npm run ai:validate` 通过。

风险：

- 中。配置保存是用户强感知路径，但逻辑可测试，适合早拆。

### 阶段 3：建立 Renderer Context 与状态分组

目标：

在大拆 UI 前，先把 Renderer 的状态和跨模块能力整理清楚。

建议动作：

- 梳理状态分组：
  - `documentState`：source、root、rawConfig、config、hasConfigBlock。
  - `domState`：host、container、svg、groups、toolbar、panels。
  - `viewState`：viewBox、fit mode、fullscreen、canvas height。
  - `interactionState`：drag、pan、topicDrag、toolbarDrag。
  - `editorState`：source view、topic editor、inline editor、text editor。
- 新增轻量上下文对象或私有创建方法。
- 不移动大量功能，只统一命名和访问方式。

涉及文件：

- `src/renderer/YonxaoMindmapRenderer.js`
- 可新增 `src/renderer/rendererContext.js`

验收标准：

- 用户可见行为不变。
- Renderer 行数不一定明显下降，但状态边界变清楚。
- `npm run ai:validate` 通过。

风险：

- 中低。主要是重命名和状态收拢。

### 阶段 4：拆源码模式

目标：

把源码模式从 Renderer 中拆出，形成独立的 SourceView。

建议新增：

```text
src/ui/source/SourceView.js
src/ui/source/sourceDocument.js
src/ui/source/sourceHighlight.js
```

职责划分：

- `SourceView` 负责 DOM、选项卡、输入框、滚动同步、状态提示。
- `sourceDocument` 负责配置区/正文区拆分和组合。
- `sourceHighlight` 负责源码高亮 DOM 片段生成。
- `topicLevelKeys.js` 继续负责 Tab / Shift+Tab 调整主题级别。

Renderer 保留：

- 切换源码/导图模式。
- 接收源码变更并触发解析、保存、重渲染。

涉及文件：

- `src/renderer/YonxaoMindmapRenderer.js`
- `src/ui/source/*`
- `src/source/topicLevelKeys.js`
- 相关 CSS 可暂时不动。

验收标准：

- 导图模式/源码模式切换不变。
- 源码高度保存和自动高度不变。
- 配置区/正文区选项卡不变。
- Tab 调整主题级别不变。
- 从源码切回导图时重新计算高度。
- `npm run ai:validate` 通过。

风险：

- 中。源码模式涉及保存和高度，需重点回归。

### 阶段 5：拆工具栏、全屏和高度控制

目标：

把悬浮工具栏和幕布外层控制从 Renderer 中拆出，减少生命周期噪音。

建议新增：

```text
src/ui/toolbar/ToolbarView.js
src/ui/toolbar/toolbarPosition.js
src/renderer/viewport/canvasHeight.js
src/renderer/fullscreenController.js
```

职责划分：

- `ToolbarView`：创建按钮、显隐、事件边界、滚动隐藏。
- `toolbarPosition`：吸附点、最近角落、inside/outside 坐标计算。
- `fullscreenController`：阅读视图覆盖层、编辑视图原生全屏、工具栏迁移。
- `canvasHeight`：自动高度、手动高度、拖拽高度上下限。

涉及文件：

- `src/renderer/YonxaoMindmapRenderer.js`
- `src/ui/toolbar/*`
- `src/renderer/viewport/*`
- 可能少量调整 `styles/20-toolbar.css`、`styles/30-canvas.css`。

验收标准：

- 工具栏吸附位置和配置保存不变。
- 拖动工具栏不触发源码/导图模式切换。
- 页面滚动期间工具栏隐藏规则不变。
- 阅读视图和编辑视图全屏行为不变。
- 高度拖拽、双击恢复自动高度不变。
- `npm run ai:validate` 通过。

风险：

- 中到高。全屏和 Obsidian DOM 交互较敏感，建议拆完做人工回归。

### 阶段 6：拆主题编辑体系

目标：

把主题编辑面板、长文本编辑器、内联文本编辑从 Renderer 中拆出。

建议新增：

```text
src/ui/topic-editor/TopicEditorPanel.js
src/ui/topic-editor/TopicTextEditor.js
src/ui/topic-editor/InlineTopicEditor.js
src/ui/topic-editor/topicEditorState.js
```

职责划分：

- `TopicEditorPanel`：颜色、图标、字体、最大宽度、继承值显示。
- `TopicTextEditor`：大文本编辑浮层。
- `InlineTopicEditor`：双击轻量编辑。
- `topicEditorState`：打开前快照、取消恢复、字段自定义状态。

Renderer 保留：

- 打开/关闭入口。
- 保存后刷新主题树和 Markdown。
- 阅读视图禁用编辑类入口。

涉及文件：

- `src/renderer/YonxaoMindmapRenderer.js`
- `src/ui/topic-editor/*`
- `src/ui/fontOptions.js`
- `src/model/topicTreeActions.js`
- `styles/60-panels.css`

验收标准：

- 双击主题仍直接编辑文案。
- 主题编辑面板取消必须恢复编辑前文本和字段状态。
- 字体、颜色、图标、最大宽度保存不变。
- 阅读视图禁用编辑功能。
- `npm run ai:validate` 通过。

风险：

- 高。主题编辑是复杂交互，必须有人工回归。

### 阶段 7：拆右键菜单和主题命令层

目标：

把菜单创建和主题操作命令从 Renderer 中拆开，让 Renderer 只负责派发。

建议新增：

```text
src/ui/context-menu/topicContextMenu.js
src/ui/context-menu/mapContextMenu.js
src/model/topicCommands.js
```

职责划分：

- `topicContextMenu`：主题右键菜单项。
- `mapContextMenu`：空白区域菜单项。
- `topicCommands`：新增子主题、兄弟主题、删除、复制文本、折叠展开等业务命令。

涉及文件：

- `src/renderer/YonxaoMindmapRenderer.js`
- `src/ui/context-menu/*`
- `src/model/topicCommands.js`
- `src/model/topicTreeActions.js`

验收标准：

- 右键菜单项不变。
- 删除主题仍二次确认。
- 阅读视图不出现编辑类菜单。
- 新增子主题/兄弟主题后源码写回不变。
- 折叠展开和重置折叠状态不变。
- `npm run ai:validate` 通过。

风险：

- 中。菜单本身简单，但命令会触发保存链路。

### 阶段 8：拆 SVG 绘制层

目标：

把“如何画”从 Renderer 中拆出，使 Renderer 只提供布局结果和事件回调。

建议新增：

```text
src/renderer/draw/drawTopic.js
src/renderer/draw/drawTopicControls.js
src/renderer/draw/drawConnector.js
src/renderer/draw/drawTrunk.js
src/renderer/draw/drawTimeline.js
src/renderer/draw/drawFishbone.js
src/renderer/draw/topicControlPoints.js
```

拆分顺序建议：

1. 先拆纯几何：连线锚点、路径生成、按钮语义点位。
2. 再拆 SVG DOM 绘制：主题卡片、连线、按钮。
3. 最后拆特殊结构：时间轴、鱼骨、树形/组织结构图主干。

重点保护：

- 主干按分支颜色分段。
- `theme.defaultTopicColor` 不覆盖主题属性颜色优先级。
- 下挂展开按钮避让。
- 双向/垂直双向根主题按钮语义。
- 时间轴和鱼骨图二级主题按钮规则。
- 树形表格按钮隐藏规则。

涉及文件：

- `src/renderer/YonxaoMindmapRenderer.js`
- `src/renderer/draw/*`
- `src/utils/svg.js`
- `src/utils/color.js`

验收标准：

- 所有布局视觉不变或仅有可解释的等价细微差异。
- 主题按钮命中和优先级不变。
- 导出图片中的颜色和样式不变。
- `npm run ai:validate` 通过。
- 人工回归通过重点布局：思维导图、下挂、时间轴、鱼骨、树形表格。

风险：

- 高。这是重构核心，但应在前面安全网完成后再做。

### 阶段 9：拆视口、平移、缩放和适配视图

目标：

把 viewBox 计算、适配视图、原始大小、缩放和平移从 Renderer 中拆出。

建议新增：

```text
src/renderer/viewport/viewportMath.js
src/renderer/viewport/ViewportController.js
src/renderer/viewport/panZoomController.js
```

可纯化逻辑：

- `getFitViewBox()`
- `getOriginalSizeViewBox()`
- `getOriginalSizeAxisStart()`
- `getOriginalSizeFocusRatio()`
- `zoomViewBox()`
- `clientPointToSvg()` 中和 DOM 无关的计算部分。

涉及文件：

- `src/renderer/YonxaoMindmapRenderer.js`
- `src/renderer/viewport/*`

验收标准：

- 打开导图时 `fit` / `original` 行为不变。
- `fitViewNoUpscale` 和 `fitViewMaxScale` 行为不变。
- 鼠标滚轮缩放配置不变。
- 拖拽平移不影响主题拖拽。
- 自动高度与手动高度规则不变。
- `npm run ai:validate` 通过。

风险：

- 中到高。视觉体验强相关，需要多尺寸回归。

### 阶段 10：拆导出和复制能力

目标：

把导出 SVG、复制图片、复制纯文本、颜色变量内联等能力拆出。

建议新增：

```text
src/renderer/export/exportSvg.js
src/renderer/export/copyImage.js
src/renderer/export/copyText.js
```

职责划分：

- `exportSvg`：克隆 SVG、清理交互元素、内联 CSS 变量、计算缩放。
- `copyImage`：浏览器 Clipboard / Electron clipboard 分支。
- `copyText`：主题树转纯文本。

涉及文件：

- `src/renderer/YonxaoMindmapRenderer.js`
- `src/renderer/export/*`

验收标准：

- 复制 PNG、导出图片、复制纯文本行为不变。
- 深色/浅色主题下导出颜色正确。
- 不把编辑按钮、折叠按钮等控件误导出。
- `npm run ai:validate` 通过。

风险：

- 中。剪贴板能力依赖宿主环境，需人工验证。

### 阶段 11：拆 ConfigModal

目标：

把配置弹框按 Tab 和字段组件拆开，降低后续新增配置项成本。

建议新增：

```text
src/ui/config-modal/ConfigModal.js
src/ui/config-modal/BasicTab.js
src/ui/config-modal/ThemeTab.js
src/ui/config-modal/LayoutTab.js
src/ui/config-modal/FontTab.js
src/ui/config-modal/AdvancedTab.js
src/ui/config-modal/configFields.js
src/ui/config-modal/configModalRules.js
```

职责划分：

- `ConfigModal`：弹框生命周期、Tab 切换、保存/取消/重置。
- 各 Tab：只渲染本页字段。
- `configFields`：数字、下拉、字体、颜色、开关等通用字段。
- `configModalRules`：连线线型可配置性、下挂展开可配置性、默认颜色提示等规则。

涉及文件：

- `src/ui/ConfigModal.js`
- `src/ui/config-modal/*`
- `src/i18n/messages.js`

验收标准：

- 所有 Tab 文案和字段不变。
- 默认值回填、继承置灰、自定义状态不变。
- 全局默认配置弹框和代码块配置弹框行为一致。
- 保存后配置区仍精简。
- `npm run ai:validate` 通过。

风险：

- 中。UI 字段多，但拆分收益明确。

### 阶段 12：拆布局算法

目标：

在渲染和测试安全网稳定后，再拆 `layoutTree.js`。

不建议提前拆布局。布局是当前最容易出现“看起来变了”的区域，应最后处理。

建议拆分：

```text
src/layout/layoutTypes.js
src/layout/layoutShared.js
src/layout/mindmapLayout.js
src/layout/treeLayout.js
src/layout/orgLayout.js
src/layout/timelineLayout.js
src/layout/radialLayout.js
src/layout/fishboneLayout.js
src/layout/treeTableLayout.js
src/layout/layoutBounds.js
```

拆分原则：

- 先移动，不改算法。
- 每次只拆一个布局组。
- 保留 `layoutTree()` 作为统一入口。
- 不把不同布局的语义硬抽成一个通用函数。
- 只抽真正一致的几何工具、边界计算、可见主题遍历。

涉及文件：

- `src/layout/layoutTree.js`
- `src/layout/*`
- 相关布局测试。

验收标准：

- `layoutTree()` 对外 API 不变。
- 所有布局在回归样例中位置基本一致。
- 下挂展开、放射碰撞、鱼骨主骨、时间轴轴线、树形表格不回退。
- `npm run ai:validate` 通过。

风险：

- 高。建议作为最后的大阶段执行。

### 阶段 13：整理 i18n 和文档

目标：

重构完成后，把文案和文档同步到新结构。

建议动作：

- 按功能区整理 `messages.js` 内部结构，但保持 key 稳定。
- 更新 `docs/DEVELOPMENT_CONTEXT.zh-CN.md` 中的架构入口。
- 更新 README 中涉及内部模块的说明。
- 更新回归清单，补充重构后的重点检查项。

涉及文件：

- `src/i18n/messages.js`
- `docs/DEVELOPMENT_CONTEXT.zh-CN.md`
- `docs/REGRESSION_TEST_CHECKLIST.zh-CN.md`
- `README.zh-CN.md`
- `README.md`

验收标准：

- 缺失 key 仍回退英文。
- 新增 UI 文案至少补 `en`、`zh-CN`、`zh-TW`。
- 文档入口和实际目录一致。
- `npm run ai:validate` 通过。

风险：

- 低到中。主要是避免误改 README 术语表。

## 8. 推荐执行顺序

推荐顺序：

```text
0. 冻结功能与建立基线
1. 补纯函数测试安全网
2. 抽配置保存与默认值裁剪
3. 建立 Renderer Context 与状态分组
4. 拆源码模式
5. 拆工具栏、全屏和高度控制
6. 拆主题编辑体系
7. 拆右键菜单和主题命令层
8. 拆 SVG 绘制层
9. 拆视口、平移、缩放和适配视图
10. 拆导出和复制能力
11. 拆 ConfigModal
12. 拆布局算法
13. 整理 i18n 和文档
```

如果想更保守，可以把阶段 5 的全屏拆分延后到阶段 9 之后，因为全屏涉及 Obsidian 宿主 DOM，风险相对高。

## 9. 不建议做的重构

暂时不建议：

- 不建议重写布局算法。
- 不建议更改 `yxmm` 语法。
- 不建议引入大型前端框架。
- 不建议把 Obsidian 接入层和业务逻辑重新混合。
- 不建议为旧实验字段增加兼容层。
- 不建议在同一阶段同时拆 Renderer、布局和 ConfigModal。
- 不建议在没有回归基线前追求“视觉更紧凑”。

## 10. 每阶段通用验收清单

每个阶段完成后至少检查：

- `npm run ai:validate` 通过。
- 当前阶段涉及功能人工点测通过。
- 没有改动无关文件。
- 没有引入旧术语，例如核心概念继续使用“主题”而不是“节点”。
- 没有恢复旧逻辑，例如 `yxmind`、`mind` 代码块、缩进式语法。
- 文档和注释中的术语与 README 保持一致。
- 如修改配置或 UI 文案，至少补齐 `en`、`zh-CN`、`zh-TW`。

重点人工回归：

- 多代码块保存。
- 源码模式和导图模式切换。
- 配置弹框保存和默认值裁剪。
- 主题编辑取消恢复。
- 下挂展开按钮避让。
- 时间轴、鱼骨图、树形表格。
- 阅读视图禁用编辑类交互。
- Live Preview。
- 深色/浅色主题。
- 全屏。
- 复制图片和导出图片。

## 11. 重构完成后的理想状态

重构完成后，项目应该达到：

- Renderer 行数显著下降，只负责实例调度。
- UI 能力按源码、工具栏、主题编辑、右键菜单、配置弹框分层。
- SVG 绘制和几何计算可以单独阅读。
- 布局各组文件边界清楚。
- 解析、配置、代码块写回、主题树操作有自动化测试。
- `npm run ai:validate` 成为可靠的重构守门。
- 新增布局或新增配置项时，不需要先理解整个 Renderer。

最重要的目标不是“文件越拆越多”，而是让每个模块都能回答一个简单问题：

```text
这个文件只负责什么？
它不负责什么？
它的输入输出是什么？
它怎么被验证？
```

## 12. 建议的第一步

我建议下一次真正开始执行时，从阶段 0 和阶段 1 开始。

也就是先不动 Renderer，先建立基线和测试安全网。这样后面拆 Renderer 时，每一步都有基本护栏，不会只靠人工肉眼判断是否破坏了保存、解析和配置行为。

推荐执行提示词：

```text
按 docs/refactor-codex.md 的方案，先执行阶段 0 和阶段 1。

要求：
- 先说明会新增或修改哪些文件，等我确认后再执行。
- 不重构 Renderer。
- 不改变 yxmm 语法和用户可见行为。
- 使用轻量测试方案，优先 Node 内置 node:test。
- 修改后运行 npm run ai:validate。
- 最后总结测试覆盖了哪些行为、还缺哪些人工回归。
```
