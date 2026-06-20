## 现在插件我能想到的功能基本都做完了，你来分析一下项目，给我一个报告。

我做了一轮只读分析，没有改文件，也没有跑会改 `dist/` 的构建脚本。当前工作区只有 `.gitignore` 是已修改状态，应该是你的改动。

**总体结论**

`yonxao-mindmap` 现在已经不是“功能原型”，而是一个功能相当完整的 Obsidian 插件。它的主路径很清晰：`yxmm` 代码块 -> 解析配置和正文 -> 计算布局 -> SVG 渲染 -> 可视化编辑 -> 写回 Markdown。

我建议下一阶段不要继续堆功能，应该进入“封版 + 回归 + 稳定性整理”阶段。现在最值得投入的是：布局回归、配置回填一致性、文本测量边界、渲染器拆分。

**项目结构**

核心入口在 [YonxaoMindmapPlugin.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/plugin/YonxaoMindmapPlugin.js:24)，通过 Obsidian 的 `registerMarkdownCodeBlockProcessor` 注册 `yxmm` 代码块，阅读视图和 Live Preview 共用同一套渲染管线。

主要模块职责比较明确：

- 解析： [parseMind.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/parser/parseMind.js:39)
- 序列化： [serializeMind.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/parser/serializeMind.js:44)
- 配置规范化： [mindConfig.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/config/mindConfig.js:170)
- 布局计算： [layoutTree.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/layout/layoutTree.js:102)
- 主渲染器： [YonxaoMindmapRenderer.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/renderer/YonxaoMindmapRenderer.js:114)
- 配置弹框： [ConfigModal.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/ui/ConfigModal.js:101)

代码规模上，JS 总计约 `16646` 行，CSS 总计约 `1886` 行。其中 `YonxaoMindmapRenderer.js` 已经到 `7239` 行，是当前最大的维护风险点。

**已经做得不错的地方**

配置优先级设计清楚：主题属性 > 代码块配置区 > 插件全局默认配置 > 内置默认值。相关逻辑集中在 [mindConfig.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/config/mindConfig.js:63)，这点很好。

源码编辑和可视化编辑是双向的，且保存时只替换当前代码块，避免误改同文件其他 `yxmm` 代码块。定位逻辑在 [codeBlock.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/markdown/codeBlock.js:25)，这个设计是稳的。

布局类型很丰富，已经覆盖思维导图、树形图、组织结构图、时间轴、鱼骨图、放射图、树形表格等。布局列表在 [layoutTree.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/layout/layoutTree.js:35)。

文本换行逻辑已经考虑了中文、英文、空格、多行文本和字号字重，相关逻辑在 [text.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/utils/text.js:72)。这块虽然仍有边界，但方向是对的。

插件没有运行时第三方依赖，构建链很轻，发布产物也符合 Obsidian 插件习惯。

**主要风险**

第一，`YonxaoMindmapRenderer.js` 太大了。它现在同时负责 toolbar、源码模式、主题编辑、右键菜单、导出图片、复制、拖拽、缩放、保存、布局渲染等。功能越稳定，越应该拆，否则后面修一个 UI 小问题都可能碰到渲染或保存逻辑。

第二，布局算法已经有很多特殊分支。尤其是时间轴、鱼骨图、下挂展开、树形图空间利用率这些逻辑，视觉回归风险高。建议后续给布局做一组固定样例截图回归。

第三，配置面板和主题编辑面板现在承担了很多“默认值回填、继承、自定义、置灰、清理默认配置”的细节。这里用户感知很强，最近字体下拉框问题也说明这块需要专门回归。

第四，SVG 文本测量是估算。它无法完全等同浏览器真实字体渲染，所以大字号、粗体、中文字体、不同系统字体下，仍可能出现边距偏大或局部溢出。估算函数在 [text.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/utils/text.js:243)。

第五，目前没有真正的自动化测试。`validate` 能保证构建、格式和 lint，但不能证明“布局没有重叠”“配置回填正确”“复制的是当前代码块图片”。

**发布前建议清单**

建议先冻结功能，然后做一轮手动回归：

- 所有布局各准备一个小图、一个中图、一个长文本图。
- 每个布局测试：适配视图、原始大小、自动高度、手动高度、全屏。
- 测试连接线：曲线、直线、折线；下挂展开只在折线生效。
- 测试多代码块场景：配置保存、复制图片、导出图片、源码同步。
- 测试主题编辑：颜色、图标、字体、最大宽度、多行文本、取消恢复。
- 测试配置面板：全局默认值、代码块配置覆盖、默认值置灰、保存后配置区精简。
- 测试 Obsidian 阅读视图、Live Preview、深色主题、浅色主题。
- 如果 `manifest.json` 保持 `"isDesktopOnly": false`，需要确认移动端至少能优雅降级，尤其是图片复制、拖拽、全屏等能力。

**我建议的下一步**

优先级最高的是做“稳定版整理”：

1. 把 `YonxaoMindmapRenderer.js` 拆出几个模块：导出/复制、右键菜单、主题编辑器、源码模式、toolbar。
2. 增加一批纯函数测试：配置 normalize、parse/serialize、字体值 normalize、文本换行、代码块替换。
3. 做一个 `examples/` 或文档里的回归样例集合，用来人工检查所有布局。
4. 更新 README 的配置区说明，确保现在的 `basic/theme/layout/font` 结构和界面完全一致。
5. 最后再跑 `npm run ai:validate`，准备一次 beta 版本。

我的判断：现在功能完成度已经很高，可以进入 beta 前整理；但还不建议直接正式发布。主要不是功能不够，而是核心渲染器和布局特殊逻辑太集中，发布前需要一次系统回归。

## 好，那我不止想 YonxaoMindmapRenderer.js 拆出几个模块，想完整的重构项目，提示词怎么写。

可以。完整重构不要直接一句“帮我重构项目”，很容易失控。建议拆成两个提示词：先让 Codex 做重构方案，确认后再分阶段执行。

**提示词 1：先出重构方案**

```text
这是 yonxao-mindmap 项目。请先阅读 docs/DEVELOPMENT_CONTEXT.zh-CN.md，并严格按其中约定协作。

我想对项目做一次完整重构，但先不要修改代码。请你先做代码审计和重构设计，目标是降低复杂度、拆分 YonxaoMindmapRenderer.js、理清模块边界，并保持现有功能和用户体验不变。

请重点分析：

1. 当前模块职责是否清晰。
2. YonxaoMindmapRenderer.js 应该拆成哪些模块。
3. 配置、解析、布局、渲染、交互、源码编辑、主题编辑、导出复制、右键菜单、工具栏等职责如何分层。
4. 哪些函数适合抽成纯函数，方便后续测试。
5. 哪些部分风险最高，应该先重构还是后重构。
6. 每个阶段的目标、涉及文件、验收标准和回滚风险。

约束：

- 先不要改代码。
- 不做旧配置兼容，插件尚未发布，以当前配置结构为准。
- 不改变 yxmm 语法。
- 不改变现有用户可见行为。
- 每个重构阶段都必须能独立完成并通过 npm run ai:validate。
- 如果发现需要调整架构、命名或目录结构，先给方案，我确认后再执行。

请输出一个分阶段重构方案，按“阶段 1、阶段 2、阶段 3...”组织，并给出你推荐的执行顺序。
```

**提示词 2：确认方案后执行某一阶段**

```text
按你刚才给出的重构方案，先执行阶段 1。

执行要求：

- 只做阶段 1 范围内的改动，不顺手重构其他阶段。
- 保持现有功能和 UI 行为不变。
- 不做旧配置兼容。
- 不改无关文件。
- 如果遇到用户已有改动，不要覆盖，先说明。
- 修改前先简短说明本阶段会动哪些文件。
- 修改后运行 npm run ai:validate。
- 最后总结：改了什么、验证结果、下一阶段建议。

现在开始执行阶段 1。
```

**我建议的重构方向可以这样写进方案里**

```text
优先目标：

1. Renderer 只保留生命周期、总调度和少量状态。
2. 把源码模式拆到 source/ 或 renderer/sourceEditor.js。
3. 把主题编辑面板拆到 ui/topicEditor.js。
4. 把工具栏拆到 ui/toolbar.js。
5. 把右键菜单拆到 ui/contextMenu.js。
6. 把导出/复制图片拆到 renderer/exportImage.js。
7. 把 SVG 绘制细节拆到 renderer/drawTopic.js、renderer/drawConnector.js。
8. 把视图适配、缩放、平移拆到 renderer/viewport.js。
9. 把保存 Markdown 代码块的流程继续保留在独立模块 markdown/codeBlock.js 附近。
10. 给 parse/serialize/config/text/layout 边界逐步补纯函数测试。
```

核心原则就一句：**先方案，后执行；一次只重构一个边界；每一步都保持插件可运行。**

## 这是 yonxao-mindmap 项目。请先阅读 docs/DEVELOPMENT_CONTEXT.zh-CN.md，并严格按其中约定协作。

我想对项目做一次完整重构，但先不要修改代码。请你先做代码审计和重构设计，目标是降低复杂度、拆分 YonxaoMindmapRenderer.js、理清模块边界，并保持现有功能和用户体验不变。

请重点分析：

1. 当前模块职责是否清晰。
2. YonxaoMindmapRenderer.js 应该拆成哪些模块。
3. 配置、解析、布局、渲染、交互、源码编辑、主题编辑、导出复制、右键菜单、工具栏等职责如何分层。
4. 哪些函数适合抽成纯函数，方便后续测试。
5. 哪些部分风险最高，应该先重构还是后重构。
6. 每个阶段的目标、涉及文件、验收标准和回滚风险。

约束：

- 先不要改代码。
- 不做旧配置兼容，插件尚未发布，以当前配置结构为准。
- 不改变 yxmm 语法。
- 不改变现有用户可见行为。
- 每个重构阶段都必须能独立完成并通过 npm run ai:validate。
- 如果发现需要调整架构、命名或目录结构，先给方案，我确认后再执行。

请输出一个分阶段重构方案，按“阶段 1、阶段 2、阶段 3...”组织，并给出你推荐的执行顺序。

---

我已重新阅读 [DEVELOPMENT_CONTEXT.zh-CN.md](/Users/yonxao/develop/code/plugin/yonxao-mindmap/docs/DEVELOPMENT_CONTEXT.zh-CN.md:1)，这轮只做审计和方案，不改代码。

**总体判断**

当前项目的底层边界其实不错：解析、序列化、配置、布局、主题树操作都已经独立出来了。真正需要重构的是“应用层和渲染层”混在一起，尤其 [YonxaoMindmapRenderer.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/renderer/YonxaoMindmapRenderer.js:114) 已经 `7239` 行，同时负责生命周期、工具栏、源码模式、主题编辑、SVG 绘制、右键菜单、导出复制、缩放平移、拖拽、保存回 Markdown。这个文件现在像一个城市总管，什么都能办，但也最容易牵一发动全身。

推荐策略：**先抽纯逻辑，再拆 UI，再拆绘制，最后拆交互**。不要一上来动布局算法，也不要一上来拆保存链路。

**目标架构**

建议最终分层成这样：

```text
src/
  plugin/              Obsidian 插件入口、设置页注册
  parser/              yxmm 正文解析
  config/              配置解析、规范化、序列化、默认值裁剪
  model/               主题树增删改移、折叠状态相关纯逻辑
  layout/              坐标计算、布局算法
  renderer/
    YonxaoMindmapRenderer.js  只保留生命周期、状态调度、模块组装
    draw/              SVG 主题、连线、特殊主干绘制
    viewport/          适配视图、原始大小、缩放、平移、高度
    export/            导出图片、复制图片、复制正文
  ui/
    toolbar/           工具栏创建、吸附、拖动、显隐
    source/            源码模式、正文/配置选项卡、语法高亮
    topic-editor/      主题编辑面板、双击编辑、长文本编辑
    context-menu/      空白处右键、主题右键菜单
    config-modal/      配置弹框内部再拆分 tab
  markdown/            当前代码块定位与写回
```

**阶段 1：建立 Renderer 上下文，先不拆功能**

目标：给后续拆分铺路。把 Renderer 内部到处散落的依赖整理成一个明确的 `rendererContext` 或一组小型上下文对象。

涉及文件：

- [YonxaoMindmapRenderer.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/renderer/YonxaoMindmapRenderer.js:114)

建议动作：

- 梳理 Renderer 状态：DOM 引用、源码状态、配置状态、视口状态、拖拽状态、编辑器状态。
- 不移动大段逻辑，只把重复访问的状态收拢命名。
- 给后续模块预留统一能力：`t()`、`register()`、`saveTreeToSourceAndFile()`、`renderMap()`、`closePanels()`。

验收标准：

- 用户可见行为完全不变。
- `npm run ai:validate` 通过。
- Renderer 行数可以不明显下降，但状态边界更清楚。

回滚风险：低。主要是重命名和整理状态，不应该碰布局和 UI 行为。

**阶段 2：拆出配置保存与默认值裁剪逻辑**

目标：先抽最适合纯函数化的逻辑。Renderer 里这段现在很适合外移：`buildRuntimeDocumentForSave`、`mergeRuntimeConfig`、`documentConfigForSave`、`pruneDocumentConfigDefaults` 等。

涉及文件：

- 新增 `src/config/runtimeConfigSave.js`
- 调整 [YonxaoMindmapRenderer.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/renderer/YonxaoMindmapRenderer.js:3537)
- 可能调整 [mindConfig.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/config/mindConfig.js:326)

验收标准：

- 配置面板保存后，配置区仍然只保留自定义项。
- 全局默认配置回填、代码块覆盖、主题属性优先级不变。
- `npm run ai:validate` 通过。

回滚风险：中低。逻辑纯，但配置裁剪是用户强感知功能，需要重点测。

**阶段 3：拆源码模式**

目标：把源码模式从 Renderer 中拿出去。源码模式现在包括配置/正文选项卡、输入事件、语法高亮、源码同步、高度计算。

涉及文件：

- 新增 `src/ui/source/SourceView.js`
- 新增 `src/ui/source/sourceHighlight.js`
- 保留 [topicLevelKeys.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/source/topicLevelKeys.js:22)
- 调整 [YonxaoMindmapRenderer.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/renderer/YonxaoMindmapRenderer.js:1340)

验收标准：

- 显示源码/显示导图切换不变。
- 配置区和正文区选项卡不变。
- Tab 键调整主题级别不变。
- 源码实时同步当前 Markdown 代码块不变。
- `npm run ai:validate` 通过。

回滚风险：中。源码保存链路必须小心，不要误改其他代码块。

**阶段 4：拆工具栏**

目标：把工具栏创建、按钮状态、拖动吸附、滚动隐藏逻辑抽出。

涉及文件：

- 新增 `src/ui/toolbar/FloatingToolbar.js`
- 新增 `src/ui/toolbar/toolbarPosition.js`
- 调整 [YonxaoMindmapRenderer.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/renderer/YonxaoMindmapRenderer.js:486)

验收标准：

- 工具栏默认右上外侧。
- 四角和内外侧吸附不变。
- 滚动时隐藏工具栏逻辑不变。
- 全屏时工具栏迁移不变。
- `npm run ai:validate` 通过。

回滚风险：中。DOM 层级、全屏、滚动隐藏容易出细节问题。

**阶段 5：拆主题编辑面板和双击编辑**

目标：把主题编辑面板、字体/颜色/图标控件、长文本编辑、双击编辑统一移出 Renderer。

涉及文件：

- 新增 `src/ui/topic-editor/TopicEditor.js`
- 新增 `src/ui/topic-editor/InlineTopicEditor.js`
- 新增 `src/ui/topic-editor/topicEditorFields.js`
- 调整 [YonxaoMindmapRenderer.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/renderer/YonxaoMindmapRenderer.js:1999)
- 复用 [fontOptions.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/ui/fontOptions.js:25)

验收标准：

- 主题文本、颜色、图标、字体、字号、字重、行高、最大宽度保存不变。
- 默认值回填、继承样式、取消恢复不变。
- 双击编辑不缩放，体验不变。
- `npm run ai:validate` 通过。

回滚风险：中高。这里刚经历过多轮体验打磨，不能顺手改交互。

**阶段 6：拆右键菜单与复制导出**

目标：把空白处右键、主题右键、复制正文、复制子树、复制/导出图片移出 Renderer。

涉及文件：

- 新增 `src/ui/context-menu/mapContextMenu.js`
- 新增 `src/ui/context-menu/topicContextMenu.js`
- 新增 `src/renderer/export/exportImage.js`
- 新增 `src/renderer/export/copyText.js`
- 调整 [YonxaoMindmapRenderer.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/renderer/YonxaoMindmapRenderer.js:5920)

验收标准：

- 空白处右键菜单文案不变。
- 主题右键“编辑主题”“复制子树”等不变。
- 多代码块复制图片仍复制当前块。
- 图片导出和复制在 Obsidian 环境不回退。
- `npm run ai:validate` 通过。

回滚风险：中。复制图片涉及焦点、Electron clipboard、多代码块实例状态。

**阶段 7：拆 SVG 绘制**

目标：把纯绘制函数拆出。先拆“主题绘制”和“连线绘制”，最后再拆特殊布局主干。

涉及文件：

- 新增 `src/renderer/draw/drawTopic.js`
- 新增 `src/renderer/draw/drawConnector.js`
- 新增 `src/renderer/draw/drawSpecialTrunks.js`
- 新增 `src/renderer/draw/connectorGeometry.js`
- 调整 [YonxaoMindmapRenderer.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/renderer/YonxaoMindmapRenderer.js:3886)

验收标准：

- 所有布局视觉不变。
- 折叠按钮、新增按钮、编辑按钮位置不变。
- 曲线/直线/折线不变。
- 时间轴、鱼骨图、树形表格特殊线条不变。
- `npm run ai:validate` 通过。

回滚风险：高。视觉细节多，建议这阶段前先固定一组人工截图样例。

**阶段 8：拆视口、缩放、平移、高度**

目标：把适配视图、原始大小、自动高度、手动高度、缩放、平移整理成一个 viewport 控制器。

涉及文件：

- 新增 `src/renderer/viewport/viewportState.js`
- 新增 `src/renderer/viewport/viewFit.js`
- 新增 `src/renderer/viewport/panZoom.js`
- 调整 [YonxaoMindmapRenderer.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/renderer/YonxaoMindmapRenderer.js:6895)

验收标准：

- 默认适配视图。
- 原始大小时中心主题位置合理。
- 自动高度不裁切。
- 鼠标滚轮缩放配置不变。
- 拖拽平移不变。
- `npm run ai:validate` 通过。

回滚风险：高。视图体验非常敏感，而且会影响所有布局。

**阶段 9：整理 ConfigModal**

目标：配置面板也已经 `1475` 行，可以在 Renderer 拆完后整理。不要太早做，避免两条大线并行。

涉及文件：

- 拆分 [ConfigModal.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/ui/ConfigModal.js:101)
- 新增：
  - `src/ui/config-modal/ConfigModal.js`
  - `src/ui/config-modal/basicTab.js`
  - `src/ui/config-modal/themeTab.js`
  - `src/ui/config-modal/layoutTab.js`
  - `src/ui/config-modal/fontTab.js`
  - `src/ui/config-modal/advancedTab.js`
  - `src/ui/config-modal/fields.js`

验收标准：

- 配置面板 UI 不变。
- 默认值置灰、回填、继承联动不变。
- 高级配置 YAML 不变。
- 全局默认配置和代码块配置都能保存。
- `npm run ai:validate` 通过。

回滚风险：中。ConfigModal 边界清楚，但字段多。

**阶段 10：补测试与回归样例**

目标：重构后不要只靠眼睛。项目现在没有真正的自动化测试，建议先补轻量 Node 测试，不引入重框架也可以。

适合测试的纯函数：

- [parseMind.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/parser/parseMind.js:39)：配置区、多行主题、主题属性。
- [serializeMind.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/parser/serializeMind.js:44)：多行主题、属性顺序。
- [mindConfig.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/config/mindConfig.js:170)：normalize、canonicalize、YAML parse/stringify。
- [text.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/utils/text.js:72)：中文、英文、空格、多行换行。
- [codeBlock.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/markdown/codeBlock.js:25)：多代码块替换。
- [topicTreeActions.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/model/topicTreeActions.js:146)：拖拽移动、防循环、刷新主题级别。
- [topicLevelKeys.js](/Users/yonxao/develop/code/plugin/yonxao-mindmap/src/source/topicLevelKeys.js:22)：Tab/Shift+Tab 调整主题级别。

验收标准：

- 新增 `npm run test` 或并入 `npm run validate`。
- 测试只覆盖纯函数，不依赖 Obsidian。
- `npm run ai:validate` 通过。

回滚风险：低。测试不改变功能，但会暴露现有边界。

**推荐执行顺序**

我建议顺序是：

```text
阶段 1 -> 阶段 2 -> 阶段 3 -> 阶段 4 -> 阶段 5 -> 阶段 6 -> 阶段 7 -> 阶段 8 -> 阶段 9 -> 阶段 10
```

如果你想更稳，可以把阶段 10 提前到阶段 2 后面，先给 parser/config/text/codeBlock 补测试，再继续拆 UI。我的偏好是：**先抽配置保存，再补测试，再拆源码和工具栏**。这会让后续每一步都更踏实一点。

最不建议先动的是：布局算法、视口适配、SVG 连线绘制。这三块视觉回归成本最高，应该等外围模块拆干净后再处理。
