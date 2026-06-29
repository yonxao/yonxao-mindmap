# Changelog

# 更新日志

All notable changes to this project will be documented in this file.

本文件记录本项目的所有重要变更。

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
