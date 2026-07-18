# Changelog

# 更新日志

All notable changes to this project will be documented in this file.

本文件记录本项目的所有重要变更。

<!-- The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), -->
<!-- and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). -->

## [1.5.4] - 2026-07-19

### Added

- Added mobile safe-area adaptation. A new `safeArea.js` utility reads system status bar and home indicator insets (supporting both CSS `env()` and WebView CSS variables), so floating elements stay tappable on notched devices.
- Updated config modal dimensions and drag boundaries to respect safe-area insets on mobile, preventing the modal header or bottom edge from being unreachable behind the status bar or home indicator.
- Updated floating toolbar positioning and fullscreen layout to avoid overlapping the system safe area, including toolbar drag boundary clamping and fullscreen viewport padding.
- Added auto-hide logic for floating toolbars when multiple mind maps exist on the same page, so leftover toolbars from previous renders no longer accumulate.
- Added view-operation entries to the canvas right-click menu, including **Toggle Source / Map**, **Open Config Panel**, **Fit View**, **Original Size**, **Zoom In**, **Zoom Out**, **Window Fullscreen**, **Fullscreen**, and **Reset Collapsed Topics** — all accessible without keyboard shortcuts.
- Added a shared `resetCollapsedTopics` method that uniformly restores the collapsed state, reused by the floating toolbar and the canvas context menu to avoid duplicate logic.

### Changed

- Optimized mobile touch-gesture handling: adjusted SVG `touch-action` to preserve normal page scrolling, and refined the pan-zoom controller to correctly distinguish touch-pan from tap interactions.
- Refactored floating toolbar collapse-reset calls to use the shared `resetCollapsedTopics` method, reducing code duplication.
- Added a dedicated mobile height-resize grip at the bottom center of the canvas; touch-based height resizing now starts only from this grip, while mouse resizing still uses the full bottom hot zone.
- Adjusted config modal responsive sizing and drag boundaries for better mobile usability, paired with safe-area inset handling.
- Refactored toolbar position calculation to use unified safe-area utilities, keeping boundary clamping consistent across toolbar drag, fullscreen, and normal view modes.
- Added Chinese comments for safe-area calculation and touch gesture logic to improve code readability.

### Fixed

- Fixed mobile canvas height resizing being accidentally triggered while scrolling the page. Touch events now require an explicit grip handle to start a resize, so swiping near the bottom no longer changes the canvas height.
- Fixed fit-view not being properly centered in fullscreen mode. The fullscreen fit-view logic now computes the centered viewBox based on the viewport aspect ratio, so long or wide maps stay centered instead of aligning to the top-left.

### 新增

- 移动端安全区域适配：新增 `safeArea.js` 工具类读取系统状态栏与手势栏间距（同时兼容 CSS `env()` 与 WebView CSS 变量），确保浮动控件在刘海屏设备上仍可正常点击。
- 调整配置面板的宽高与拖拽边界，在移动端避让系统安全区域，避免面板顶部被状态栏遮挡、底部被手势栏挡住无法操作。
- 调整悬浮工具栏定位与全屏布局，避开系统安全区域，包括工具栏拖拽边界夹紧和全屏视口内边距处理。
- 新增多导图页面悬浮工具栏自动隐藏逻辑，避免上一次渲染残留的工具栏在页面上不断累积。
- 画布右键菜单新增视图操作项，包括 **切换源码 / 导图视图**、**打开配置面板**、**适配视图**、**原始大小**、**放大**、**缩小**、**窗口全屏**、**全屏**、**重置折叠**，无需快捷键即可操作。
- 新增 `resetCollapsedTopics` 统一重置折叠状态方法，悬浮工具栏与画布右键菜单共同复用，减少重复代码。

### 调整

- 优化移动端触摸手势处理：调整 SVG `touch-action` 以保留正常页面滚动能力，优化平移缩放控制器以正确区分触摸平移与点击交互。
- 重构悬浮工具栏折叠重置调用，改用统一的 `resetCollapsedTopics` 方法，减少重复逻辑。
- 画布底部新增移动端专用高度调整抓手；触摸方式下仅从该抓手启动高度调整，鼠标方式下仍保留完整底部热区。
- 调整配置面板响应式尺寸与拖拽边界，配合安全区域避让，提升移动端可用性。
- 重构工具栏位置计算逻辑，统一使用安全区域工具，保持工具栏拖拽、全屏和普通视图模式下边界夹紧的一致性。
- 为安全区域计算和触摸手势逻辑补充中文注释，提升代码可读性。

### 修复

- 修复移动端滚动页面时容易误触发画布高度调整的问题。触摸事件现在必须从明确的抓手启动高度调整，底部滑动不再意外改变画布高度。
- 修复全屏模式下适配视图没有正确居中的问题。全屏适配视图逻辑现在按视口宽高比计算居中的 viewBox，长图或宽图都会保持居中而不是贴靠左上角。

## [1.5.3] - 2026-07-18

### Added

- Added topic cut and paste support. Right-click a topic to use the new **Cut Topic** and **Paste Topic** actions, or press `Ctrl/Cmd+X` and `Ctrl/Cmd+V`. Cutting a topic preserves its full subtree on paste, while plain paste still inserts only the topic text as a subtopic of the focused topic.
- Added **Copy Topic with Attributes** and **Paste Topic with Attributes** actions to the topic context menu. Attribute-aware paste restores the copied topic's attributes and entire subtree.
- Added **Undo** and **Redo** entries to the canvas context menu for quick access to topic-tree history operations without using keyboard shortcuts.

### Changed

- Reorganized i18n locale files into a unified entry, with all locale modules bundled and minified through the JS build pipeline instead of being concatenated at runtime.
- Extracted source-mode shortcuts into a dedicated `sourceShortcuts.js` module and unified focus management across the topic editing flows.
- Introduced a shared `sessionMemory` utility that provides TTL, LRU, and capacity-budget controls for renderer state, topic history, and image caches, replacing the previous manual Map operations.
- Added a topic-history memory trimmer that caps the number of undo entries and total memory usage, preventing unbounded growth during long editing sessions.
- Unified cache-key generation through a new `codeBlockMemoryKey` helper that covers line number, editor offset, and source-prefix positioning strategies, reused by topic history and renderer state.
- Upgraded the `esbuild` build dependency from `0.27.7` to `0.28.1`.

### Fixed

- Fixed the relationship structure selection menu always showing a "Finish member selection" item for relation types, even though the second target topic already auto-creates the relationship.
- Fixed native `window.confirm()` dialogs triggered by deleting or cutting a topic inside fullscreen mode exiting the browser's physical fullscreen. Fullscreen now uses an in-canvas custom confirmation overlay that preserves the fullscreen state.

### 新增

- 主题新增剪切和粘贴功能：右键主题菜单新增 **剪切主题** 和 **粘贴主题**，也可使用 `Ctrl/Cmd+X` 与 `Ctrl/Cmd+V`。剪切后再粘贴会恢复完整子树；普通粘贴仍按原有行为，仅把主题文字作为当前焦点主题的子主题插入。
- 主题右键菜单新增 **复制主题及属性** 与 **粘贴主题及属性**。带属性粘贴会按剪贴板快照恢复当前可用的属性和完整子主题。
- 画布右键菜单新增 **撤销** 和 **重做** 菜单项，无需快捷键即可操作主题树历史。

### 调整

- 重构国际化语言包管理：将分散的多语言文件合并为统一入口，所有语言模块通过 JS 构建流程打包压缩，不再运行时拼接。
- 抽离源码模式快捷键逻辑到独立的 `sourceShortcuts.js` 模块，统一主题编辑流程中的焦点管理逻辑。
- 新增通用 `sessionMemory` 会话内存管理模块，提供 TTL、LRU 和容量预算控制，统一主题历史、视图状态和图片缓存的内存管理，替换原有的手动 Map 操作。
- 新增主题历史内存裁剪工具，限制撤销历史的条目数和总内存占用，避免长时间编辑导致内存无限增长。
- 统一缓存键生成逻辑，新增 `codeBlockMemoryKey` 通用函数，覆盖行号、编辑器偏移和源码前缀三种定位策略，主题历史和渲染状态共同复用。
- 升级 `esbuild` 构建依赖从 `0.27.7` 到 `0.28.1` 版本。

### 修复

- 修复关联结构选择菜单对所有结构类型都显示"完成成员选取"选项的问题。关联类型在第二个目标主题选中后会自动创建，不需要"完成成员选取"步骤，该菜单项此前会冗余出现。
- 修复全屏模式下删除或剪切主题时，原生 `window.confirm()` 弹窗会让浏览器退出物理全屏的问题。全屏模式下改用画布内的自定义确认浮层，确保全屏状态不被打断。

## [1.5.2] - 2026-07-14

### Added

- Added relationship line endpoint anchor support: both ends of a relationship line can now be fixed to one of 8 anchor points on the topic border. Dragging an endpoint automatically snaps to the nearest anchor, and the anchor positions are persisted as `fromAnchor`/`toAnchor` attributes. New visual feedback controls appear on the endpoints during drag, and a dedicated `relationAnchors.js` module handles anchor coordinate calculation and nearest-point snapping.
- Improved radial layout collision detection and connector handling:
  - Added segment-to-rectangle intersection detection using slab clipping to avoid missing diagonal line crossings.
  - Implemented connector obstacle repulsion that calculates the displacement needed for branches to clear the connector corridor.
  - Added root branch collision resolution to prevent center connectors from passing through other branch topics.
  - Improved collapsed topic child-line exit angle logic to record the actual expansion direction.
- Optimized image rendering performance to eliminate flicker:
  - Implemented image element pool reuse to avoid repeated creation and destruction.
  - Added cross-renderer caching of image natural dimensions to prevent redundant loading and measurement.
  - Established image resource address mapping to support reuse of the same image across multiple locations.
  - Set cache size limits to prevent unbounded memory growth.
  - Improved image size capture logic for better cache hit rates.
- Refactored structure control drag logic into a dedicated `beginStructureControlDrag` method, removing duplicate event listener bindings and improving code clarity.

### Fixed

- Fixed PNG export dark mode background fallback: solidified the `--background-primary` CSS variable value during SVG export, preventing export styles from overriding summary background and text stroke display properties. Ensures summary text box backgrounds remain consistent with the preview in dark mode, and prevents incorrect fallback to white backgrounds.
- Fixed boundary title avoidance breaking tree layout branch alignment: refactored boundary title vertical space reservation into `structureBounds.js` with a dedicated `reserveBoundaryLabelVerticalSpace` function that correctly offsets subsequent topics as a whole, preventing parent-child misalignment caused by boundary titles pushing only same-column topics.

### 新增

- 关联线端点锚点功能：关联线两端可固定到主题边框的 8 个锚点位置，拖拽端点时自动吸附最近锚点，锚点位置持久化为 `fromAnchor`/`toAnchor` 属性。新增端点拖拽视觉反馈控件，独立的 `relationAnchors.js` 模块负责锚点坐标计算与最近点吸附。
- 改进放射布局碰撞检测与连接线处理：
  - 新增线段与矩形边界相交检测算法，使用 slab 裁剪避免斜线漏判。
  - 实现连接线障碍物推离功能，计算分支移出连线走廊所需的最小位移。
  - 新增根节点分支碰撞解决机制，防止中心连线穿过其他分支主题。
  - 优化折叠主题子线出口角度逻辑，记录实际展开方向以保持折叠状态下的连线一致性。
- 优化图片渲染性能，消除闪动：
  - 实现图片元素池复用机制，避免重复创建和销毁。
  - 新增图片自然尺寸的跨渲染器缓存，防止重复加载和测量。
  - 建立图片资源地址映射，支持同一图片多处复用。
  - 设置缓存大小上限，防止内存无限增长。
  - 改进图片尺寸捕获逻辑，提升缓存命中率。
- 重构结构控制拖拽逻辑，提取为独立的 `beginStructureControlDrag` 方法，移除重复的事件监听器绑定，提升代码清晰度。

### 修复

- 修复 PNG 导出在深色模式下背景回退为白色的问题：在 SVG 导出时固化 `--background-primary` CSS 变量值，防止导出样式覆盖概要背景和文字描边的展示属性，确保深色模式下概要文字框背景与预览一致。
- 修复外框标题避让导致树形图分支对齐错乱的问题：将外框标题垂直空间预留逻辑重构到 `structureBounds.js` 中的 `reserveBoundaryLabelVerticalSpace` 函数，正确处理后续主题的整体偏移，避免仅移动同列主题导致父子节点对齐被破坏。

## [1.5.1] - 2026-07-13

### Added

- Added watermark support with two watermark modes to choose from in a new Watermark tab in the config modal:
  - **Signature watermark**: bound to the viewport; available in _corner_ style (text placed at one of nine positions with optional rounded background) and _bar_ style (a horizontal strip along the bottom of the viewport with tinted background and emphasized text). Configurable text, position, color, background color, font size, opacity, bar height, and padding.
  - **Normal watermark**: bound to the content area; supports _text_ and _image_ types, with _single_ or _tiled_ arrangement. Text watermarks allow full control over font size, color, opacity, rotation, and position (9 anchor points). Image watermarks support URL and vault-file sources, custom width/height, gap, and offset. Tiled mode auto-fills the content area with configurable spacing and an upper element count limit to keep large maps responsive.
- Added a watermark unlock mechanism using a user self-confirmation flow; watermark rendering is skipped until the user unlocks the feature through the plugin settings.
- Added watermark configuration normalization and canonicalization, including range validation for font size, opacity, rotation, size, gap, and offset, so out-of-range values are clamped to the allowed bounds before rendering.
- Added watermark rendering in exported PNG and SVG so watermarks remain visible after export.

### 新增

- 配置面板新增水印选项卡，提供两种水印模式可选：
  - **签名水印**：绑定视口，有角标样式（在 9 个位置之一显示文字，可带圆角背景）和底栏样式（在视口底部显示一条横向条幅，带低透明度强调底色和突出文字）两种风格，可配置文字、位置、颜色、背景色、字号、不透明度、条栏高度和内边距。
  - **普通水印**：绑定内容区域，支持文字和图片两种类型，单个或平铺两种排列方式。文字水印可完整控制字号、颜色、不透明度、旋转角度和位置（9 个锚点）；图片水印支持 URL 和仓库文件两种来源，可自定义宽高、间距和偏移。平铺模式自动填满内容区域，可配置间距，并设置单次元素数量上限以保证大型导图的渲染性能。
- 新增水印解锁机制，采用用户自行确认方式免费解锁；未解锁时水印渲染不会生效。
- 新增水印配置的归一化和标准化处理，对字号、不透明度、旋转角度、尺寸、间距和偏移进行范围校验，超出允许范围的值会在渲染前被自动修正到合法区间。
- 导出 PNG 和 SVG 时同步渲染水印图层，确保导出图片与画布显示一致。

## [1.5.0] - 2026-07-12

### Added

- Added three advanced mind map structures:
  - **Relationship**: connects topics across branches; supports three connector styles (curve, straight, elbow) with direction configuration, and draggable curve adjustment.
  - **Summary**: groups consecutive sibling topics and auto-generates a labeled bracket border around them.
  - **Boundary**: encloses a region of topics; the boundary title is automatically positioned to avoid overlapping the enclosed topics.
- Added source syntax parsing for relationships, summaries, and boundaries, with editor syntax highlighting.
- Added a Structures tab in the config modal for managing relationship, summary, and boundary settings.
- Added full interaction and export support for relationships, summaries, and boundaries, including drag-and-drop, undo/redo, and PNG/SVG export.
- Added a guide area at the bottom of the config modal with documentation links (English and Chinese) and a GitHub star prompt.

### Fixed

- Improved PDF export pagination for long mind maps:
  - Set `preserveAspectRatio` on the SVG element to prevent blank pages when content spans multiple print pages.
  - Recorded viewport aspect ratio as a CSS variable so print styles can dynamically recalculate canvas height.
  - Implemented natural truncation and continuation at the bottom of print pages so long maps flow across pages without cutting topics in half.
  - Added a dedicated print stylesheet to control page-break behavior during PDF export.

### 新增

- 新增三大高级导图结构能力：
  - **关联**：支持跨主题连接，三种线型（曲线、直线、折线）与方向配置，可拖拽调整曲线弧度。
  - **概要**：分组同级连续主题，自动生成带标签的括号边框。
  - **外框**：圈选主题区域，标题自动避让布局，避免与内部主题重叠。
- 新增关联、概要、外框的源码语法解析与编辑器语法高亮。
- 配置面板新增结构页，集中管理关联、概要、外框的各项配置。
- 关联、概要、外框支持完整的交互与导出，包括拖拽、撤销/重做、PNG/SVG 导出。
- 配置模态框底部新增引导区域，包含中英文文档链接和 GitHub 星标提示。

### 修复

- 优化长导图 PDF 导出的分页处理：
  - 为 SVG 元素添加 `preserveAspectRatio` 属性，避免跨页时产生空白页。
  - 记录视口宽高比到 CSS 变量，供打印样式动态重新计算画布高度。
  - 实现长导图在页面底部的自然截断和续接，避免主题被从中间截断。
  - 新增专用打印样式文件，控制 PDF 导出时的分页行为。

## [1.4.1] - 2026-07-09

### Added

- Added clickable task checkbox interactions inside topic content for `- [ ]` and `- [x]` items.
- Added line number tracking for task items to maintain visual correspondence with source text.

### Changed

- Normalized source mode save shortcut from `Alt/Option+S` to `Ctrl/Cmd+S` to match other save buttons.
- Enabled JS build compression to reduce bundle size.

### Fixed

- Multiple details and performance optimizations

### 新增

- 主题内容中的 `- [ ]` 和 `- [x]` 任务项现在可点击交互，支持勾选和取消勾选。
- 任务项增加行号追踪，保持与源码文本的视觉对应关系。

### 调整

- 统一源码模式保存快捷键为 `Ctrl/Cmd+S`，与插件内其他保存快捷键一致。
- 启用 JS 构建压缩，减小打包体积。

### 修复

- 多项细节、性能优化

## [1.4.0] - 2026-07-06

### Added

- Added richer topic content syntax for inline tags, Markdown links, Obsidian links, task items, image blocks, note adornments, and attachment adornments.
- Added tag rendering with stable per-map colors so the same tag text keeps a consistent visual identity without relying on the Obsidian accent color.
- Added clickable link rendering with lightweight markers for external and Obsidian/internal links, while resolving internal targets through the current vault before opening.
- Added task list rendering for `- [ ]` and `- [x]` items inside topic content without changing the topic tree structure.
- Added Markdown and Obsidian image block support, including captions, explicit pixel sizes, width-height hints, percentage sizing, missing-image placeholders, and double-click image preview.
- Added note and attachment icons after topics. Notes show popovers, while attachments can be opened or copied from their popover and support external URLs, Obsidian URIs, and vault attachments.
- Expanded the topic editor content toolbar with quick insert actions for tags, links, tasks, images, notes, and attachments.
- Added `Alt+S` / `Option+S` source-mode saving so source edits can be saved without leaving source mode.

### Changed

- Improved PNG export and image-copy output by cloning the SVG with computed styles, embedded image data, and equation-safe SVG replacements, so rich content exports more closely match the preview.
- Copying the full source now writes a complete fenced `yxmm` code block that can be pasted directly into Markdown.
- Reworked physical fullscreen and window fullscreen to use body-level overlays consistently, improving behavior for long content, image-heavy maps, floating popovers, toolbar placement, focus recovery, and scroll restoration.
- Improved image layout measurement so explicit image widths can participate in topic width calculation while still respecting the topic width cap.
- Increased the documented and configured topic maximum width range to support wider rich-content topics up to `2000px`.
- Updated English and Chinese documentation for the expanded rich content syntax, editor toolbar actions, link behavior, image sizing, attachment behavior, and source-mode save shortcut.

### Fixed

- Fixed source-mode saving state so saving a modified `yxmm` source no longer unexpectedly returns the block to map mode after Obsidian rebuilds the code block.
- Fixed source-mode save feedback so the saved/dirty/error status can survive the short rebuild window and display consistently after saving.
- Fixed source-mode save shortcut handling when focus is inside the source view but not directly on the textarea, including macOS `Option+S` key handling.
- Fixed fullscreen exit recovery so topic focus and surrounding scroll positions are restored more reliably after physical fullscreen or window fullscreen.

### 新增

- 新增更完整的主题内容语法，支持内容标签、Markdown 链接、Obsidian 链接、任务项、图片块、备注装饰和附件装饰。
- 新增标签渲染，同一导图内相同标签文字会保持稳定颜色，不依赖 Obsidian 默认强调色。
- 新增可点击链接渲染，外部链接和 Obsidian/内部链接会显示轻量标识；内部目标打开前会先通过当前库解析，避免误创建不存在的文档。
- 新增 `- [ ]` 和 `- [x]` 任务项渲染，任务项只作为主题内容显示，不改变主题树结构。
- 新增 Markdown 图片和 Obsidian 附件图片渲染，支持标题、固定像素宽度、宽高提示、百分比尺寸、缺失图片占位，以及双击图片预览。
- 新增主题后方备注和附件图标。备注可显示浮层；附件浮层提供打开和复制地址操作，并支持外部 URL、Obsidian URI 和当前库附件。
- 主题编辑面板内容工具栏新增标签、链接、任务、图片、备注和附件快捷插入按钮。
- 源码模式新增 `Alt+S` / `Option+S` 保存快捷键，可在不离开源码模式的情况下保存修改。

### 调整

- 优化 PNG 导出和复制图片流程：导出 SVG 会内联计算后的样式、图片数据，并把公式替换为更适合导出的 SVG 表达，使富内容导出结果更接近预览效果。
- 复制完整源码时改为输出完整 fenced `yxmm` 代码块，可直接粘贴到 Markdown 文档中。
- 重构物理全屏和窗口全屏流程，统一使用 body 级覆盖层承载导图，改善长内容、图片导图、浮层、工具栏、焦点恢复和滚动恢复的表现。
- 优化图片布局测量，显式图片宽度可参与主题宽度估算，同时仍受主题宽度上限约束。
- 扩展主题最大宽度的配置和文档范围，富内容主题最高可设置到 `2000px`。
- 更新中英文文档，补充富内容语法、主题编辑工具栏、链接行为、图片尺寸、附件行为和源码模式保存快捷键说明。

### 修复

- 修复源码模式保存状态问题，修改 `yxmm` 源码后保存不再因 Obsidian 重建代码块而意外回到导图模式。
- 修复源码模式保存提示在短暂重建窗口中丢失的问题，保存、已修改和错误状态会更稳定地显示。
- 修复源码模式保存快捷键在焦点位于源码视图但不在 textarea 上时可能不响应的问题，并兼容 macOS `Option+S` 的按键识别。
- 修复物理全屏和窗口全屏退出后的恢复问题，主题焦点和周围滚动位置会更可靠地回到进入全屏前的状态。

## [1.3.0] - 2026-07-04

### Added

- Added inline content styles for topic text, including bold, italic, strikethrough, underline, and inline text colors.
- Added lightweight block content support inside topics: unordered lists, ordered lists, display equations, and fenced code blocks using `~~~`.
- Added topic text alignment configuration with `auto`, `left`, `center`, and `right`, plus topic-level `align` attributes.
- Added topic editor controls for quickly inserting or clearing inline styles, lists, equations, code blocks, and text colors.

### Changed

- Refactored rich text parsing so inline styles can span hard line breaks and overlap with other style ranges.
- Improved code block and equation measurement so rich topic content keeps stable layout before SVG/MathJax rendering completes.
- Unified fishbone layout naming semantics so `fishbone-left` and `fishbone-right` describe the content expansion direction.
- Expanded README documentation and development context for rich content, font alignment, and current release behavior.

### Fixed

- Preserved list indentation and automatic ordered-list numbering during rich content rendering.
- Kept code blocks width-limited while allowing them to be wider than ordinary topic text when needed.
- Added regression coverage for rich text parsing, serialization, text wrapping, and timeline/fishbone overlap cases.

### 新增

- 新增主题内容局部样式：加粗、斜体、中划线、下划线和内容文字颜色。
- 新增主题内轻量块级内容：无序列表、有序列表、展示公式，以及使用 `~~~` 的代码块。
- 新增主题文本对齐配置，支持 `auto`、`left`、`center`、`right`，并支持主题属性 `align`。
- 主题编辑面板新增内容样式工具，可快速插入或清除行内样式、列表、公式、代码块和文字颜色。

### 调整

- 重构富文本解析逻辑，支持局部样式跨硬换行和不同样式区间交叉叠加。
- 优化代码块和公式的测量逻辑，让 SVG/MathJax 异步渲染完成前布局仍保持稳定。
- 统一鱼骨图布局命名语义，`fishbone-left` 与 `fishbone-right` 表示内容展开方向。
- 扩展 README 和开发上下文，补充富文本内容、字体对齐和当前发布行为说明。

### 修复

- 保留列表缩进，并在渲染有序列表时按层级自动递增编号。
- 代码块可按内容适度放宽宽度，同时仍受上限约束，避免撑开整张导图。
- 补充富文本解析、序列化、文本换行，以及时间轴/鱼骨图重叠场景的回归测试。

## [1.2.1] - 2026-07-02

### Fixed

- Fixed timeline detail branches where the upper and lower timeline layouts could let a later detail trunk pass through a previous detail subtree.
- Fixed fishbone layouts where same-side primary bones could place trailing topic cards too close and overlap in both left and right directions.

### 修复

- 修复上侧时间轴和下侧时间轴中，后续详情分支主干可能穿过前一棵详情子树的问题。
- 修复左向鱼骨图和右向鱼骨图中，同侧大分支末端主题卡片距离过近导致重叠的问题。

## [1.2.0] - 2026-07-01

### Added

- **Keyboard focus and navigation in map mode**: SVG maps can now keep an independent focused topic with visible focus highlighting.
- **Topic navigation shortcuts**: use arrow keys to move topic focus. Mind map layouts use structural navigation between parent/child and sibling topics; other layouts keep spatial direction navigation.
- **Topic creation and editing shortcuts**: add subtopics with `Tab`, add sibling topics with `Enter` / `Shift+Enter`, delete topics with `Delete` / `Cmd+Backspace`, open the topic editor with `Backtick` and start inline editing with `Space`.
- **Topic collapse and view shortcuts**: toggle subtopics with `Alt+/` / `Option+/`, zoom and switch views with `Alt/Option` view shortcuts, and open the config panel with `Alt+,` / `Option+,`.
- **Topic copy, cut, and paste shortcuts**: copy or cut the current topic content and paste it as a subtopic of the focused topic.
- **Copy and paste with attributes**: copy the current topic together with attributes and subtopics, then paste the copied topic structure into another branch.
- **Cross-map topic clipboard** within the same Obsidian session, with system clipboard text fallback when available.
- **Undo and redo for topic-tree edits**: undo and redo map-mode topic operations with `Ctrl/Cmd+Z`, `Ctrl+Y`, and `Cmd+Shift+Z`.
- **Shortcuts tab** in the config panel, listing the current read-only shortcut groups.
- **Fullscreen draft recovery**: if fullscreen editing exits unexpectedly before pending edits are written back, the plugin offers recovery actions for the leftover source.

### Changed

- Undo/redo history is kept briefly per `yxmm` code block so it can survive Obsidian rebuilding the code block after a save.
- Undo/redo in fullscreen and window fullscreen follows the existing fullscreen pending-save flow and writes back to Markdown after exiting fullscreen.
- Keyboard shortcut documentation and labels now use the same topic terminology as the rest of the plugin.

### Documentation

- Updated the development context with the current shortcut groups, keyboard focus behavior, clipboard behavior, undo/redo boundaries, fullscreen save rules, and relevant code map entries.

### 新增

- 新增 **导图模式主题焦点与键盘导航**：SVG 导图可维护独立的当前主题焦点，并显示焦点高亮。
- 新增 **主题导航快捷键**：方向键可移动主题焦点；思维导图布局按父子/同级关系导航，其他布局按空间方向导航。
- 新增 **主题创建与编辑快捷键**：`Tab` 新增子主题，`Enter` / `Shift+Enter` 新增同级主题，`Delete` / `Cmd+Backspace` 删除主题，`Backtick` 打开主题编辑面板，`Space` 开始内联编辑。
- 新增 **主题折叠与视图控制快捷键**：`Alt+/` / `Option+/` 展开或折叠子主题，`Alt/Option` 组合键控制缩放、适配视图、原始视图、窗口全屏、全屏和配置面板。
- 新增 **主题复制、剪切与粘贴快捷键**：可复制或剪切当前主题内容，并粘贴为当前焦点主题的子主题。
- 新增 **复制主题及属性 / 粘贴主题及属性**：可复制当前主题的属性和子主题结构，并粘贴到其他分支。
- 支持同一 Obsidian 会话内 **跨导图主题剪贴板**，并在系统剪贴板文本可用时作为兜底来源。
- 新增 **主题树撤销与重做**：导图模式主题操作可通过 `Ctrl/Cmd+Z`、`Ctrl+Y` 和 `Cmd+Shift+Z` 撤销或重做。
- 配置面板新增 **快捷键页**，只读展示当前快捷键分组。
- 新增 **全屏草稿恢复**：全屏编辑异常退出且存在未写回内容时，提供残留源码恢复入口。

### 调整

- 撤销/重做历史按 `yxmm` 代码块短期保存，避免 Obsidian 保存后重建代码块导致历史立即丢失。
- 全屏和窗口全屏中的撤销/重做复用全屏待保存流程，退出全屏后再写回 Markdown。
- 快捷键说明和界面文案统一使用当前项目的主题术语。

### 文档

- 更新开发上下文，记录当前快捷键分组、主题焦点行为、剪贴板行为、撤销/重做边界、全屏保存规则和相关代码地图。

## [1.1.0] - 2026-06-29

### Added

- **Window fullscreen mode**: full-screen the mind map within the app window instead of the entire display.
- **Tooltips** for all toolbar and view buttons.
- README badges and localization notes for both English and Chinese documentation.

### Fixed

- UI element occlusion issues in fullscreen mode.
- Mind map editing being disabled when in window fullscreen state.

### Refactored

- Optimized initial rendering performance and view adaptation logic for better responsiveness.

### 新增

- **窗口全屏功能**：在应用窗口内全屏显示导图，而非整个显示器。
- 为工具栏和视图按钮添加 **tooltip 支持**。
- 更新两个语言的 README 文档，添加项目徽章和本地化说明。

### 修复

- 修复全屏模式下各类 UI 元素遮挡问题。
- 修复窗口全屏状态下导图无法编辑的问题。

### 重构

- 优化初始渲染性能与视图适配逻辑，提升响应速度。

## [1.0.0] - 2026-06-15

### Added

- Initial public release of yonxao-mindmap.
- Render Markdown-heading-style mind maps from `yxmm` code blocks.
- **20 layout types across 7 categories**: mind maps, tree diagrams, organization charts, timelines, radial maps, fishbone diagrams, and tree tables.
- **Two expansion modes**: natural expansion and hanging expansion.
- **Three connector styles**: curve, straight, and elbow (configurable for mind map layouts).
- **8 built-in color schemes**: default, ocean, forest, sunset, mono, rainbow, pastel-rainbow, neon-rainbow.
- **28 built-in icons**: book, brain, cpu, database, file, folder, calendar, clock, user, users, tag, star, check, checkbox, list, target, flag, link, globe, search, message, pencil, heart, alert, info, rocket, chart, lightbulb.
- Topic-level attributes: color, icon, fontSize, fontWeight, fontFamily, lineHeight, maxWidth.
- **Interactive editing**: double-click inline edit, drag-and-drop reordering, right-click context menu, collapse/expand.
- **Source mode**: toggle between map view and source editor with syntax highlighting.
- **Visual configuration panel**: 6 tabs (Display, Color, Structure, Font, Interaction, Advanced) with intuitive controls.
- **Config priority**: topic attributes > code block config > plugin global defaults > plugin built-in defaults.
- **Global defaults editor** in Obsidian settings tab.
- **Level-based overrides** for font and topic max-width with inheritance display.
- **Fit view** and original size view modes, with configurable max upscale limit.
- **Fullscreen mode** for immersive editing and viewing.
- **PNG export** and text copy (current topic, subtree, or entire map).
- **Obsidian right-click menu** for quick mind map insertion.
- **Reading view support**: view-only mode with editing interactions disabled.
- **Floating toolbar** with draggable position and corner snapping.
- **16 supported languages**: auto-follows Obsidian language on first run.

### 新增

- yonxao-mindmap 首次公开发布。
- 从 `yxmm` 代码块渲染 Markdown 标题风格思维导图。
- **7 大类共 20 种布局类型**：思维导图、树形图、组织结构图、时间轴、放射图、鱼骨图、树形表格。
- **两种展开方式**：自然展开和下挂展开。
- **三种连线线型**：曲线、直线、折线（思维导图布局可配置）。
- **8 种内置色系**：default、ocean、forest、sunset、mono、rainbow、pastel-rainbow、neon-rainbow。
- **28 个内置图标**：book、brain、cpu、database、file、folder、calendar、clock、user、users、tag、star、check、checkbox、list、target、flag、link、globe、search、message、pencil、heart、alert、info、rocket、chart、lightbulb。
- 主题级属性：颜色、图标、字号、字重、字体、行高、最大宽度。
- **交互式编辑**：双击内联编辑、拖拽排序、右键菜单、折叠/展开。
- **源码模式**：导图视图与源码编辑器切换，支持语法高亮。
- **可视化配置面板**：6 个 Tab（显示、颜色、结构、字体、交互、高级），操作直观。
- **配置优先级**：主题属性 > 代码块配置区 > 插件全局默认值 > 插件内置默认值。
- **全局默认值编辑器**，集成在 Obsidian 设置页中。
- **按级别覆盖**字体和主题最大宽度，UI 显示继承关系。
- **适配视图**和原始大小两种视图模式，可配置最大放大倍数。
- **全屏模式**，沉浸式编辑与查看。
- **PNG 导出**和文本复制（当前主题、子树或整图）。
- **Obsidian 右键菜单**，快速插入思维导图。
- **阅读视图支持**：仅查看模式，禁用编辑交互。
- **悬浮工具栏**，可拖动位置并吸附到角落。
- **支持 16 种语言**，首次运行自动跟随 Obsidian 语言。
