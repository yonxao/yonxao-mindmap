# yonxao-mindmap 项目分析与重构方案

> 生成时间：2026-06-22
> 基于本会话对完整源码的阅读和分析。

---

## 第一部分：项目分析报告

### 一、总体判断

yonxao-mindmap 已经是一个功能完整、架构相对清晰的 Obsidian 插件。从 `yxmm` 代码块到配置解析→布局计算→SVG 渲染→可视化编辑→保存回 Markdown 的主链路完整可用，覆盖了 19 种布局（含变体）、8 种主题、16 种语言、配置优先级系统、完整的主题交互编辑能力。

#### 数据规模

| 类型      | 行数        | 说明                         |
| --------- | ----------- | ---------------------------- |
| JS 源文件 | ~15,000 行  | 排除 i18n 文案后约 13,000 行 |
| CSS       | ~9 个分文件 | 按职责拆分，结构合理         |
| i18n 文案 | ~2,076 行   | 16 种语言                    |
| 构建脚本  | ~5 个       | 干净、无运行时依赖           |

#### 现有模块边界评估

| 模块           | 文件                                    | 行数      | 边界评估                          |
| -------------- | --------------------------------------- | --------- | --------------------------------- |
| 插件入口       | `src/main.js`                           | 16        | 清晰，只做 export                 |
| 插件类         | `src/plugin/YonxaoMindmapPlugin.js`     | 201       | 清晰，只做生命周期和注册          |
| **核心渲染器** | `src/renderer/YonxaoMindmapRenderer.js` | **8,192** | **严重过载**                      |
| 配置规范化     | `src/config/mindConfig.js`              | 1,027     | 较清晰，YAML 解析可与配置逻辑分离 |
| 默认配置       | `src/config/defaultMindConfig.js`       | 232       | 清晰                              |
| 配置草稿       | `src/config/configDraft.js`             | 115       | 清晰                              |
| 插件设置       | `src/config/pluginSettings.js`          | 51        | 清晰                              |
| **布局算法**   | `src/layout/layoutTree.js`              | **2,821** | 大但边界清晰，算法密度高          |
| 正文解析       | `src/parser/parseMind.js`               | 235       | 清晰                              |
| 正文序列化     | `src/parser/serializeMind.js`           | 104       | 清晰                              |
| 主题树操作     | `src/model/topicTreeActions.js`         | 214       | 清晰                              |
| 代码块定位     | `src/markdown/codeBlock.js`             | 166       | 清晰                              |
| 主题系统       | `src/theme/mindThemes.js`               | 221       | 清晰                              |
| 图标           | `src/icons/`                            | ~177      | 清晰                              |
| 工具函数       | `src/utils/`                            | ~430      | 清晰                              |
| **配置弹框**   | `src/ui/ConfigModal.js`                 | **1,669** | 较大，可拆分 Tab                  |
| 设置页         | `src/ui/YonxaoMindmapSettingTab.js`     | 195       | 清晰                              |
| 字体选项       | `src/ui/fontOptions.js`                 | 174       | 清晰                              |
| 源码按键       | `src/source/topicLevelKeys.js`          | 74        | 清晰                              |
| Obsidian 嵌入  | `src/obsidian/embed.js`                 | 55        | 清晰                              |
| i18n           | `src/i18n/messages.js`                  | 2,076     | 文案量大，结构清晰                |

### 二、做得好的地方

1. **配置优先级设计清晰**：主题属性 > 代码块配置区 > 全局默认配置 > 内置默认值，相关逻辑集中在 `mindConfig.js`。

2. **解析/序列化双向一致**：`parseMindDocument` 和 `serializeMindDocument` 是对称的，导图编辑后整棵序列化而非拼字符串，避免了大量边界问题。

3. **代码块精准替换**：`replaceCodeBlockSource` 优先使用 Obsidian sectionInfo 定位，兜底策略也做了严格匹配，避免误改同文件其他 yxmm 代码块。

4. **布局类型丰富且可扩展**：19 种布局变体，每种都在 `layoutTree.js` 中有独立策略函数，新增布局不破坏已有布局的结构。

5. **零运行时依赖**：esbuild 构建 + Prettier + ESLint 的工具链很轻，不依赖 Obsidian 以外的 npm 包。

6. **CSS 架构**：按职责分 9 个源文件，构建时合成为 `styles.css`，结构清晰有序。

7. **全屏处理兼容**：阅读视图使用 body 级覆盖层绕过 ancestral transform 限制，编辑视图使用原生 Fullscreen API，方案成熟。

### 三、主要风险与问题

#### 1. `YonxaoMindmapRenderer.js` —— 最大的维护风险

8192 行，同时承担以下职责（按出现顺序）：

- 生命周期：mount / onunload / 配置刷新
- 工具栏：创建、按钮、拖拽吸附、滚动隐藏、全屏迁移、可见性判断
- 源码模式：tab 切换、textarea 编辑、语法高亮、源码同步、高度计算
- 主题编辑面板：颜色、图标、字体、行高、最大宽度的回填/继承/保存/取消
- 长文本编辑浮层：打开、定位、保存、拖拽
- 双击内联编辑：定位、保存、关闭
- SVG 绘制：主题卡片、文字、图标、连线、主干、按钮、折叠标记
- 右键菜单：空白处菜单、主题上下文菜单
- 图片导出/复制
- 视口管理：fitView、zoom、pan、高度拖拽
- 主题拖拽
- 事件边界控制
- 配置保存逻辑

**症状**：一个文件里查找光标停留在 toolbar 相关代码时，上下几百行后有可能是主题绘制或图片导出。新需求容易在不该改的地方加逻辑，因为"反正都在同一个文件里"。

#### 2. `layoutTree.js` 算法密度高、分支多

2821 行包含 8 组独立布局算法（水平思维导图、竖向思维导图、树形、组织图、时间轴、放射图、鱼骨图、树形表格），每组又有 side/hanging 子策略。共享了 `extent` 计算、`visibleSubtopics`、`collectVisible` 等工具函数但也引入了「树形图 HANGING 只看多子主题」「放射图碰撞 24 次迭代」等特殊逻辑。视觉回归成本很高。

#### 3. 配置保存与默认值裁剪逻辑分散

Renderer 里有多段关于"保存配置到文件前清理默认值"的逻辑（`documentConfigForSave`、`DOCUMENT_CONFIG_DEFAULT_PRUNE_PATHS`），但这部分和 `mindConfig.js` 里的 `pruneInactiveMindConfig` 有重复和边界不一致的风险。

#### 4. 无自动化测试

`ai:validate` 只保证构建、ESLint、Prettier。布局是否正确、配置回填是否正确、解析/序列化是否对称，都没有测试覆盖。手动回归可以验证主要布局，但无法覆盖编辑路径下所有组合。

#### 5. SVG 文本测量估算值

`estimateTopicTextWidth` 是近似测量，在大字号、粗体、中文字体、非系统字体下可能出现边距偏大或局部溢出。

#### 6. 重复的拖拽模式

Renderer 里有至少 5 套相似的 `pointerDown/Move/Up + dragState` 模式：工具栏拖拽、主题编辑面板拖拽、长文本编辑拖拽、高度拖拽、画布平移、主题拖拽。模式和代码重复，可以通过统一抽象减少。

#### 7. 上下文菜单纯字符串

右键菜单项直接使用 `this.t()` 生成字符串，没有结构化定义，菜单项的行为（删除确认子树数量计算、复制按钮文案）和 Renderer 状态绑定紧密、不易单元测试。

---

## 第二部分：重构方案

### 重构目标

1. **降低单文件复杂度**：`YonxaoMindmapRenderer.js` 从 8192 行降至 ~1500 行，只保留生命周期调度和模块组装。
2. **理清职责边界**：每个模块只负责一件事，模块间通过 Renderer 公共上下文通信。
3. **提高可测试性**：纯函数逻辑至少可以单独测试，UI 模块也更容易 mock。
4. **保持用户可见行为不变**：这是红线。重构不改功能、不改文案、不改交互体验。

### 目标目录结构

```
src/
  main.js                              -- 入口
  constants.js                         -- 跨模块共享常量

  plugin/
    YonxaoMindmapPlugin.js             -- Obsidian 插件生命周期

  config/
    defaultMindConfig.js               -- 默认值和枚举
    mindConfig.js                      -- 配置规范化、YAML、合并、裁剪
    configDraft.js                     -- 配置草稿操作
    pluginSettings.js                  -- 插件设置持久化

  parser/
    parseMind.js                       -- yxmm → 主题树
    serializeMind.js                   -- 主题树 → yxmm

  model/
    topicTreeActions.js                -- 主题树 CRUD

  layout/
    layoutTree.js                      -- 布局算法（后期可拆）

  theme/
    mindThemes.js                      -- 主题色系

  icons/
    iconPaths.js                       -- 图标路径定义
    renderIcon.js                      -- 图标渲染

  utils/
    color.js / math.js / dom.js / svg.js / text.js

  markdown/
    codeBlock.js                       -- Markdown 代码块定位与替换

  obsidian/
    embed.js                           -- Obsidian 嵌入工具

  i18n/
    messages.js                        -- 国际化文案

  source/
    topicLevelKeys.js                  -- 源码 Tab 级别调整

  renderer/
    MindmapRenderer.js                 -- 原有 YonxaoMindmapRenderer 精简版
    context.js                         -- Renderer 公共上下文
    draw/
      drawTopic.js                     -- SVG 主题绘制
      drawConnector.js                 -- 连线绘制（含特殊主干）
    viewport/
      viewFit.js                       -- 适配视图
      panZoom.js                       -- 缩放/平移
      canvasHeight.js                  -- 自动/手动高度
    export/
      exportImage.js                   -- 图片导出/复制

  ui/
    toolbar/
      FloatingToolbar.js               -- 工具栏创建与按钮
      toolbarPosition.js               -- 吸附/拖拽计算
    source/
      SourceView.js                    -- 源码编辑模式
      sourceHighlight.js               -- 语法高亮
    topic-editor/
      TopicEditor.js                   -- 主题编辑面板
      InlineTopicEditor.js             -- 双击内联编辑
      topicEditorFields.js             -- 字段工厂
    context-menu/
      mapContextMenu.js                -- 空白处右键
      topicContextMenu.js              -- 主题右键
    config-modal/
      ConfigModal.js                   -- 配置弹框（Tab 分发）
      basicTab.js / themeTab.js / ...  -- 各 Tab
      configFields.js                  -- 字段工厂
    YonxaoMindmapSettingTab.js         -- 设置页
    fontOptions.js                     -- 字体预设
```

### 分阶段执行计划

---

#### 阶段 1：创建 Renderer 公共上下文

**目标**：把 Renderer 内部散落的依赖整理成明确的上下文对象，为后续模块拆分提供统一通信方式。

**思路**：在 `src/renderer/context.js` 中创建一个 MindmapContext 类或工厂函数，封装 Renderer 需要对外暴露的能力集合。后续每个拆出去的模块通过构造函数参数或 setter 获取上下文引用，不再直接依赖 Renderer 实例。

**涉及文件**：

- 新增 `src/renderer/context.js`
- `YonxaoMindmapRenderer.js` — 引入 context，逐步替换 `this.plugin` / `this.t()` / `this.register()` / `this.saveTreeToSourceAndFile()` / `this.renderMap()` 等直接调用

**动作清单**：

1. 定义 `MindmapContext` 接口：`{ plugin, t, register, saveTreeToSourceAndFile, renderMap, closePanels, config, rawConfig, root, collapsedIds, topicById, hostEl, containerEl, svgEl, mapEl, notify }`
2. Renderer 在 mount 中创建 context 实例。
3. 不移动任何逻辑，只把 Renderer 方法对 context 的访问标准化，后续模块通过 context 获取能力。

**验收**：

- 所有功能不变
- `npm run ai:validate` 通过

**风险**：低。不移动逻辑，只是引入一个中间层。

---

#### 阶段 2：提取配置保存逻辑

**目标**：把 Renderer 中关于「保存配置到 Markdown 文件前清理默认值」的逻辑提取到 `mindConfig.js`，消除与 `pruneInactiveMindConfig` 的重叠。

**涉及文件**：

- `src/config/mindConfig.js` — 合并 `documentConfigForSave` 的等价逻辑
- `YonxaoMindmapRenderer.js` — 移除内联配置保存逻辑，调用提取后的函数
- `src/config/runtimeConfigSave.js`（可选，如果逻辑复杂到需要新文件）

**动作清单**：

1. 确认 `DOCUMENT_CONFIG_DEFAULT_PRUNE_PATHS` 与 `pruneInactiveMindConfig` 的关系。
2. 将 `documentConfigForSave` 涉及的默认值比较+裁剪逻辑合并到 `mindConfig.js` 的导出函数中。
3. 替换 Renderer 中直接操作 `rawConfig` 的部分调用。

**验收**：

- 配置面板保存后配置区保持精简
- `npm run ai:validate` 通过

**风险**：中低。配置裁剪是强感知功能，需要手动验证保存和读取是否完整。

---

#### 阶段 3：补纯函数测试

**目标**：在拆 UI 之前，先给底层纯函数补上测试，让后续每一步都有测试网兜底。

**涉及文件**：

- 新增 `tests/` 目录
- 测试覆盖：
  - `parseMind.js` — 配置区、多行主题、主题属性、故障恢复
  - `serializeMind.js` — 多行主题、属性顺序、虚拟根
  - `mindConfig.js` — normalize、canonicalize、YAML parse/stringify、prune、merge
  - `text.js` — 中文、英文、混合、长文本估算宽度
  - `codeBlock.js` — 多代码块替换 accuracy
  - `topicTreeActions.js` — 拖拽移动、防循环
  - `topicLevelKeys.js` — Tab 调整级别
  - `configDraft.js` — get/set/delete 路径

**验收**：

- 新增 `npm test` 命令（用 Node built-in test runner 或轻量框架）
- 测试覆盖主要纯函数边界
- `npm run ai:validate` 通过（包含测试）

**风险**：低。测试不改变功能。

---

#### 阶段 4：拆分源码模式

**目标**：把源码模式从 Renderer 中完整拆分到 `src/ui/source/SourceView.js`。

**涉及文件**：

- 新增 `src/ui/source/SourceView.js`
- 新增 `src/ui/source/sourceHighlight.js`
- 调整 `YonxaoMindmapRenderer.js` — 移除 createSourceView、installSourceInputEvents、setSourceActiveTab、splitSourceForEditor、composeSourceFromSourceInputs、syncSourceInput、apply/scheduleSourceModeHeight、updateSourceStatus 等方法
- 保留 `src/source/topicLevelKeys.js`（已独立）

**动作清单**：

1. `SourceView` 接收 context，接管所有源码模式 DOM 创建和事件。
2. Renderer 只保留 `isSourceMode` 状态切换 + 委托调用 SourceView 方法。
3. 语法高亮逻辑放入 `sourceHighlight.js`，SourceView 引用它。

**验收**：

- 源码/导图切换不变
- 配置/正文 tab 不变
- Tab 键调整级别不变
- 源码保存回写不变
- `npm run ai:validate` 通过

**风险**：中。源码保存链路涉及多代码块定位。

---

#### 阶段 5：拆分工具栏

**目标**：把工具栏创建、按钮状态、拖拽吸附、滚动隐藏、全屏迁移从 Renderer 拆分到 `src/ui/toolbar/`。

**涉及文件**：

- 新增 `src/ui/toolbar/FloatingToolbar.js`
- 新增 `src/ui/toolbar/toolbarPosition.js`
- 调整 `YonxaoMindmapRenderer.js` — 移除 createToolbar、createToolbarButton、handleToolbarPointerDown/Move/Up、applyToolbarPosition、scheduleApplyToolbarPosition、setToolbarPosition、setToolbarSnap、toolbarSnapPoint、nearestToolbarSnap、showToolbar、hideToolbar、scheduleHideToolbar、installToolbarVisibilityEvents、installToolbarScrollListeners、installToolbarEventBoundary、moveToolbarIntoFullscreenHost、restoreToolbarToBody 等方法

**动作清单**：

1. `FloatingToolbar` 接收 context，负责 DOM 创建、按钮事件、拖拽吸附。
2. `toolbarPosition.js` 纯函数计算吸附点和最近吸附位置。
3. Renderer 只保留 toolbar 开关操作（show/hide/toggleFullscreen 中的工具栏迁移）。

**验收**：

- 工具栏默认右上外侧
- 四角/内外侧吸附不变
- 滚动隐藏不变
- 全屏工具栏迁移不变
- `npm run ai:validate` 通过

**风险**：中。DOM 层级复杂、全屏切换和事件冒泡边界容易出问题。

---

#### 阶段 6：拆分主题编辑面板与双击编辑

**目标**：把主题编辑面板、双击内联编辑长文本编辑浮层从 Renderer 拆分。

**涉及文件**：

- 新增 `src/ui/topic-editor/TopicEditor.js`
- 新增 `src/ui/topic-editor/InlineTopicEditor.js`
- 新增 `src/ui/topic-editor/topicEditorFields.js`
- 调整 `YonxaoMindmapRenderer.js` — 移除 createTopicEditor、createTopicTextEditor、openTopicEditor、closeTopicEditor、saveTopicEditor、openInlineTextEditor、closeInlineTextEditor、saveInlineTextEditor、positionTopicEditor、positionInlineTextEditor 等所有编辑器方法

**动作清单**：

1. `TopicEditor` 接收 context，负责面板 DOM、字段工厂、继承值计算、保存/取消。
2. `InlineTopicEditor` 接收 context，负责双击编辑文本框的创建/定位/保存。
3. `topicEditorFields.js` 将颜色、字体、图标等字段工厂函数化。
4. Renderer 只保留 `editingTopicId` 状态和委托调用。

**验收**：

- 主题文本、颜色、图标、字体、字号、字重、行高、最大宽度保存不变
- 默认值回填、继承样式、取消恢复不变
- 双击编辑响应和保存不变
- `npm run ai:validate` 通过

**风险**：中高。编辑面板逻辑密集、刚打磨完毕，不能改交互细节。

---

#### 阶段 7：拆分右键菜单与导出/复制

**目标**：把右键菜单、图片导出/复制、文本复制从 Renderer 拆分。

**涉及文件**：

- 新增 `src/ui/context-menu/mapContextMenu.js`
- 新增 `src/ui/context-menu/topicContextMenu.js`
- 新增 `src/renderer/export/exportImage.js`
- 调整 `YonxaoMindmapRenderer.js` — 移除 handleTopicContextMenu、createMapContextMenu、createTopicContextMenu、exportPng、copyPng、copyTextFromTopic 等方法

**动作清单**：

1. 菜单模块接收 context + 事件数据，使用 Obsidian `Menu` API 构建菜单。
2. 导出模块接收 context + SVG 引用，完成 HTML2canvas 或 Blob 导出。
3. Renderer 只保留 `contextmenu` 事件分发。

**验收**：

- 空白处右键菜单不变
- 主题右键「编辑主题」「复制子树」「删除」等不变
- 多代码块复制图片仍复制当前块
- `npm run ai:validate` 通过

**风险**：中。复制图片涉及剪贴板 API 和焦点管理。

---

#### 阶段 8：拆分 SVG 绘制

**目标**：把主题绘制、连线绘制、特殊主干绘制从 Renderer 拆分到 `src/renderer/draw/`。

**涉及文件**：

- 新增 `src/renderer/draw/drawTopic.js`
- 新增 `src/renderer/draw/drawConnector.js`
- 调整 `YonxaoMindmapRenderer.js` — 移除 renderTopic、renderTopicCard、renderTopicText、renderTopicIcon、renderConnector、renderBranchColoredTrunkFromOrigin、renderFishboneMainSpine、renderTimelineAxis、renderTopicControlLayer 等所有绘制方法

**动作清单**：

1. `drawTopic.js` — 纯函数：输入 topic.\_layout + config，输出 SVG 元素片段。
2. `drawConnector.js` — 纯函数：输入 connector 信息 + config，输出 SVG 路径。
3. `drawControls.js`（可选）— 绘制折叠/编辑/新增按钮。
4. Renderer 的 `renderMap` 调用绘制函数并挂载到 `this.mapEl`。

**验收**：

- 所有布局视觉不变
- 曲线/直线/折线不变
- 时间轴、鱼骨图特殊主干不变
- 按钮位置和交互不变
- 建议先截图再改，改后对比
- `npm run ai:validate` 通过

**风险**：高。视觉细节多，建议在本阶段前固定一组人工截图样例。

---

#### 阶段 9：拆分视口、缩放、平移、高度

**目标**：把适配视图、自动/手动高度、缩放、平移整理到 `src/renderer/viewport/`。

**涉及文件**：

- 新增 `src/renderer/viewport/viewFit.js`
- 新增 `src/renderer/viewport/panZoom.js`
- 新增 `src/renderer/viewport/canvasHeight.js`
- 调整 `YonxaoMindmapRenderer.js` — 移除 scheduleFitView、fitView、toggleViewFitMode、zoomAtCenter、handleWheel、handlePanPointerDown/Move/Up、createHeightResizeHandle、handleHeightResizePointerDown/Move/Up、resetManualHeight、applyConfiguredCanvasHeight、applySourceModeHeight 等方法（来源码模式拆分后的残留）

**动作清单**：

1. `viewFit.js` — 纯函数计算 viewBox + scale + translate 变换。
2. `panZoom.js` — 管理缩放和平移状态，接收 wheel/pointer 事件。
3. `canvasHeight.js` — 管理自动/手动高度计算。
4. Renderer 委托调用。

**验收**：

- 默认适配视图
- 原始大小时中心主题位置合理
- 自动高度不裁切
- 滚轮缩放配置不变
- 拖拽平移不变
- 高度拖拽条和双击重置不变
- `npm run ai:validate` 通过

**风险**：高。视图体验非常敏感。

---

#### 阶段 10：拆分 ConfigModal

**目标**：配置弹框 1669 行，Renderer 拆分后整理它的 Tab 结构。

**涉及文件**：

- 拆分 `src/ui/ConfigModal.js`
- 新增 `src/ui/config-modal/` 下各 Tab 模块

**动作清单**：

1. 保持 `ConfigModal` 作为入口，按 Tab 分发到独立模块。
2. 字段工厂抽入 `configFields.js`。
3. 各 Tab 通过 context 或 props 获取默认值/当前值。

**验收**：

- 所有 Tab 的 UI 和联动行为不变
- 默认值置灰、回填、继承不变
- 保存后配置区精简不变
- `npm run ai:validate` 通过

**风险**：中。字段多但边界清楚。

---

#### 阶段 11（收尾）：整理 layoutTree.js 与极限优化

**目标**：布局算法 2821 行，在所有 UI 模块拆分后，视情况将布局算法按类型分文件（可选）。风险最高，建议只做收尾。

**涉及文件**：

- 新增 `src/layout/mindmap-layouts.js`、`src/layout/tree-layouts.js`、`src/layout/special-layouts.js`（可选）
- `src/layout/layoutTree.js` — 保留入口分发

**风险**：高。如果当前布局已经稳定，可以不拆，只在扩展新布局时分文件。

---

### 推荐执行顺序

```
阶段 1 (上下文)
  ↓
阶段 2 (配置保存逻辑)
  ↓
阶段 3 (补纯函数测试)
  ↓
阶段 4 (源码模式)     ← 从这里开始实际拆分
  ↓
阶段 5 (工具栏)
  ↓
阶段 6 (主题编辑)
  ↓
阶段 7 (右键菜单/导出)
  ↓
阶段 8 (SVG 绘制)
  ↓
阶段 9 (视口/高度)
  ↓
阶段 10 (配置弹框)
  ↓
阶段 11 (布局整理，可选)
```

### 核心原则

1. **先方案，后执行**：每个阶段执行前简要说明会动哪些文件。
2. **一次只重构一个边界**：阶段之间不交叉，避免同时动 Renderer 和 ConfigModal。
3. **每步保持可运行**：每个阶段结束后 `npm run ai:validate` 必须通过。
4. **不改功能**：出现「改这个更好看」的冲动时，先记下来，重构后再说。
5. **取消优先于硬撑**：如果某个阶段发现拆分后代码比原来更复杂或测试无法覆盖，应退回原状并调整方案。

### 重构收益预估

| 阶段 | 风险 | 收益                   | 依赖 |
| ---- | ---- | ---------------------- | ---- |
| 1    | 低   | 低（铺路）             | 无   |
| 2    | 中低 | 中                     | 1    |
| 3    | 低   | 高（测试网）           | 2    |
| 4    | 中   | 高（-1500 行）         | 3    |
| 5    | 中   | 高（-1000 行）         | 4    |
| 6    | 中高 | 高（-1500 行）         | 5    |
| 7    | 中   | 中（-500 行）          | 6    |
| 8    | 高   | 高（-2000 行）         | 7    |
| 9    | 高   | 中（-800 行）          | 8    |
| 10   | 中   | 中（拆分 ConfigModal） | 9    |
| 11   | 高   | 低（可选）             | 10   |
