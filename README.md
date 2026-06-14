# yonxao-mindmap

[中文文档](README.zh-CN.md)

yonxao-mindmap renders Markdown-heading-style `yxmm` code blocks as interactive SVG mind maps in Obsidian.

## Usage

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

## Syntax

- Markdown headings define hierarchy: `#` is the center topic, `##` is level 2, `###` is level 3, and so on.
- Non-empty lines inside `yxmm` blocks must use Markdown headings.
- Attributes are written at the end of a line with `[key=value]`.
- Supported attributes:
  - `color=#3b82f6`
  - `layout=mindmap-right`, `layout=mindmap-left`, `layout=mindmap-bidirectional`
  - `icon=book`
  - `fontSize=16`, `fontWeight=700`, `fontFamily="..."`, `lineHeight=20`

## Glossary

yonxao-mindmap uses these terms consistently across docs, config, UI text, and code comments.

### Basic Structure

| 中文术语    | English Term    | yxmm Term / Config Key | Purpose                                                                                  |
| ----------- | --------------- | ---------------------- | ---------------------------------------------------------------------------------------- |
| yxmm 代码块 | yxmm code block | <code>```yxmm</code>   | The smallest unit the plugin reads and saves.                                            |
| 配置区      | config block    | `--- ... ---`          | Stores global settings such as theme, layout, font, toolbar position, and canvas height. |
| 正文区      | body            | Markdown headings      | Describes the topic tree with Markdown headings.                                         |
| 源码模式    | source mode     | `source`               | Edits raw `yxmm` text.                                                                   |
| 导图模式    | map mode        | -                      | Shows the visual SVG rendering of the `yxmm` block.                                      |
| 主题级别    | heading level   | `#` / `##` / `###`     | Represents hierarchy; `#` is level 1.                                                    |

### Content Components

| 中文术语 | English Term      | yxmm Term / Config Key                | Purpose                                                 |
| -------- | ----------------- | ------------------------------------- | ------------------------------------------------------- |
| 主题     | topic             | heading line                          | A visual unit generated from one Markdown heading line. |
| 中心主题 | center topic      | `#`                                   | The root topic and core topic.                          |
| 分支主题 | branch topic      | `##`                                  | A first-level branch under the center topic.            |
| 子主题   | subtopic          | `###` and deeper headings             | A descendant topic under a branch topic.                |
| 文本     | Text              | topic text                            | The text displayed inside a topic.                      |
| 主题属性 | Topic Attribute   | `[key=value]`                         | A per-topic setting written at the end of a topic text. |
| 主题颜色 | Topic Color       | `[color=#...]`                        | Sets a single topic's color.                            |
| 主题图标 | Topic Icon        | `[icon=book]`                         | Sets a single topic's icon.                             |
| 主题字体 | Topic Font Family | `[fontFamily="..."]` / `font.family`  | Sets the topic text font family.                        |
| 主题字号 | Topic Font Size   | `[fontSize=16]` / `font.size`         | Sets the topic text font size.                          |
| 主题字重 | Topic Font Weight | `[fontWeight=700]` / `font.weight`    | Sets the topic text font weight.                        |
| 主题行高 | Topic Line Height | `[lineHeight=20]` / `font.lineHeight` | Sets line spacing for multi-line topic text.            |
| 局部配置 | Local Config      | topic attribute                       | A setting that only affects a single topic.             |
| 全局配置 | Global Config     | config block                          | A setting that affects the whole map by default.        |
| 配置项   | Config Key        | YAML key                              | A concrete field inside the config block.               |

### Relationship Structure

| 中文术语 | English Term  | yxmm Term / Config Key | Purpose                                                          |
| -------- | ------------- | ---------------------- | ---------------------------------------------------------------- |
| 父主题   | parent topic  | -                      | The direct ancestor of the current topic.                        |
| 子主题   | child topic   | -                      | The direct descendant of the current topic.                      |
| 兄弟主题 | sibling topic | -                      | A topic with the same parent.                                    |
| 叶子主题 | leaf topic    | -                      | A topic without children.                                        |
| 子树     | subtree       | -                      | A topic plus all of its descendants.                             |
| 连线     | connector     | `connector.style`      | Shows the relationship between a parent topic and a child topic. |
| 子线出口 | child outlet  | -                      | The point where a connector exits a topic toward its children.   |

### Layout Structures

| 中文术语 | English Term | yxmm Term / Config Key | Purpose                                                     |
| -------- | ------------ | ---------------------- | ----------------------------------------------------------- |
| 布局结构 | layout       | `layout`               | The config key that directly stores the layout type.        |
| 布局分组 | layout group | -                      | Groups layout types so they are easier to choose and learn. |
| 布局类型 | layout type  | `layout`               | Controls how topics and connectors are arranged.            |

| 布局分组   | English Term       | yxmm Layout Types                                                                                               | Purpose                                                                           |
| ---------- | ------------------ | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 思维导图   | mind map           | `mindmap-right` / `mindmap-left` / `mindmap-bidirectional` / `mindmap-up` / `mindmap-down` / `mindmap-vertical` | Branches from the center topic in one or more directions.                         |
| 树形图     | tree diagram       | `tree` / `tree-right` / `tree-left`                                                                             | Emphasizes trunk and hierarchy expansion.                                         |
| 组织结构图 | organization chart | `org` / `org-right`                                                                                             | Emphasizes parent-child hierarchy and level alignment.                            |
| 时间轴     | timeline           | `timeline` / `timeline-up` / `timeline-down`                                                                    | Places branch topics on a horizontal axis with descendants above, below, or both. |
| 放射图     | radial map         | `radial`                                                                                                        | Arranges first-level branches around the center topic.                            |
| 鱼骨图     | fishbone diagram   | `fishbone-left`                                                                                                 | Renders a left-head fishbone diagram.                                             |
| 树形表格   | tree table         | `tree-table` / `tree-table-stepped`                                                                             | Renders the topic tree as merged or stepped table cells.                          |

### Fishbone-Specific Structure

| 中文术语 | English Term  | yxmm Term / Config Key | Purpose                                                                                                                      |
| -------- | ------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 鱼头     | fish head     | `#`                    | The side where the center topic sits. The current implementation places the fish head on the left and the tail on the right. |
| 主骨     | main spine    | -                      | The horizontal main line from fish head to fish tail.                                                                        |
| 鱼尾     | fish tail     | -                      | The tail marker at the end of the main spine.                                                                                |
| 大分支   | primary bone  | `##`                   | A first-level branch topic connected to the main spine by a diagonal bone.                                                   |
| 斜骨线   | diagonal bone | -                      | The diagonal connector line between a primary bone and the main spine.                                                       |
| 鱼刺主题 | rib topic     | `###`                  | A topic attached to a diagonal bone line.                                                                                    |

### Functional Components

| 中文术语      | English Term           | yxmm Term / Config Key            | Purpose                                                            |
| ------------- | ---------------------- | --------------------------------- | ------------------------------------------------------------------ |
| 悬浮工具栏    | floating toolbar       | `toolbar.x` / `toolbar.y`         | Holds common action buttons and can be dragged.                    |
| 配置弹框      | config modal           | -                                 | Visually edits theme, layout, font, source, and advanced settings. |
| 主题编辑面板  | topic editor           | -                                 | Edits topic text, color, icon, layout, and related settings.       |
| 编辑按钮      | edit button            | -                                 | Opens the topic editor; some compact layouts hide it.              |
| 折叠/展开按钮 | collapse/expand button | -                                 | Hides or shows the current topic's subtree.                        |
| 新增按钮      | add button             | -                                 | Adds a child topic or sibling topic.                               |
| 右键菜单      | context menu           | -                                 | Provides topic actions such as add, delete, collapse, and expand.  |
| 源码编辑区    | source editor          | -                                 | The text editing area in source mode.                              |
| 工具栏抓手    | toolbar grip           | -                                 | Drags the floating toolbar.                                        |
| 高度拖拽条    | height resize handle   | `canvas.height` / `source.height` | Adjusts map canvas height or source-mode height.                   |

### Visual And Interaction Areas

| 中文术语     | English Term         | yxmm Term / Config Key | Purpose                                                                            |
| ------------ | -------------------- | ---------------------- | ---------------------------------------------------------------------------------- |
| 幕布         | canvas               | `canvas.height`        | The visible area that hosts the SVG map.                                           |
| 视口         | viewport             | -                      | The current SVG coordinate range being viewed; panning and zooming change it.      |
| 主题卡片     | topic card           | -                      | The rectangular visual shape of a topic, including background, border, and radius. |
| 主题色系     | theme                | -                      | Controls the overall color scheme, distinct from topic.                            |
| 默认主题颜色 | default topic color  | `topic.defaultColor`   | Overrides theme auto topic colors; topic attribute `color` still wins.             |
| 字体         | font                 | `font.*`               | Controls topic text styling.                                                       |
| 连线线型     | connector style      | `connector.style`      | Controls whether connectors are curved, straight, or orthogonal.                   |
| 平移         | pan                  | -                      | Drags the canvas to change the viewport position.                                  |
| 缩放         | zoom                 | -                      | Zooms the current viewport in or out.                                              |
| 适配视图     | fit view             | -                      | Automatically adjusts the viewport so the map is shown as completely as possible.  |
| 重置折叠状态 | reset collapse state | -                      | Clears current collapse records and expands all topics.                            |
| 自动高度     | auto height          | -                      | Automatically calculates canvas height from map content.                           |
| 手动高度     | manual height        | `canvas.height`        | The persisted canvas height after user resizing.                                   |

## Config Block

A `yxmm` block can start with a `---` config block. The config block stores global defaults, while Markdown headings continue to describe the mind map structure.

### Plugin Settings

Obsidian `Settings` -> `Community plugins` -> `yonxao-mindmap` provides a plugin-level global default config.

Global defaults are used as the base config for every `yxmm` block. A block-level config overrides global defaults, and topic attributes still override both:

`topic attributes` > `block config` > `plugin global defaults` > `built-in defaults`

This is useful for shared preferences such as theme, layout type, font, connector style, and mouse-wheel zoom. Obsidian stores these settings in the plugin's local `data.json`; they are not part of the release package and are not automatically written into every Markdown document.

Supported config keys:

- `canvas.height`: persisted canvas height. Drag the bottom handle to write it; double-click the handle to remove it and return to automatic height.
- `toolbar.x` / `toolbar.y`: persisted floating toolbar position. Drag the toolbar grip to write it.
- `interaction.wheelZoom`: whether the mouse wheel zooms the mind map. It is off by default; enabling it writes `true`, and disabling it can remove the key.
- `theme`: built-in theme name: `default`, `ocean`, `forest`, `sunset`, `mono`, `rainbow`, `pastel-rainbow`, or `neon-rainbow`.
- `layout`: layout type: `mindmap-right`, `mindmap-left`, `mindmap-bidirectional`, `mindmap-up`, `mindmap-down`, `mindmap-vertical`, `tree`, `tree-right`, `tree-left`, `org`, `org-right`, `timeline`, `timeline-up`, `timeline-down`, `radial`, `fishbone-left`, `tree-table`, or `tree-table-stepped`.
- `connector.style`: connector style: `curve`, `straight`, or `elbow`. `curve` is a cubic Bezier curve, `straight` is a straight line, and `elbow` is an orthogonal connector.
- `font.family`, `font.size`, `font.weight`, `font.lineHeight`: global font defaults.
- `font.levels.1`, `font.levels.2`: per-heading-level font overrides.
- `topic.defaultColor`: unified topic color that overrides theme auto colors; topic attribute `color` still wins.
- `topic.maxWidth`: maximum topic width before label wrapping.
- `source.enableTabIndent`: whether Tab/Shift+Tab changes heading levels in source mode.
- `source.height`: source-mode height, stored separately from map-mode `canvas.height`.

Font priority:

`topic attributes` > `font.levels[current level]` > `global font config` > `plugin defaults`

Font ranges:

- `size`: font size, from `9` to `96`.
- `weight`: CSS font weight, from `100` to `900`.
- `lineHeight`: SVG text line spacing in pixels, from `12` to `160`. A practical value is usually `1.3` to `1.5` times the font size.

Theme color priority:

`topic attribute color` > `topic.defaultColor` > `theme auto color`

`rainbow`, `pastel-rainbow`, and `neon-rainbow` automatically assign colors by first-level branch.
The center topic uses an independent center color from the theme. Topic attribute `color` changes only the topic itself, not the connector from its parent.
Hex colors in the config block should be quoted, for example `defaultColor: '#66ed0c'`; the visual config modal writes quoted colors automatically.

Layout types:

- Mind map: `mindmap-right` right mind map, `mindmap-left` left mind map, `mindmap-bidirectional` bidirectional mind map, `mindmap-up` upward mind map, `mindmap-down` downward mind map, `mindmap-vertical` vertical bidirectional mind map.
- Tree diagram: `tree` tree diagram, `tree-right` right tree diagram, `tree-left` left tree diagram.
- Organization chart: `org` organization chart, `org-right` right organization chart.
- Timeline: `timeline` timeline, `timeline-up` upper timeline, `timeline-down` lower timeline.
- Radial map: `radial` radial map.
- Fishbone diagram: `fishbone-left` left fishbone diagram.
- Tree table: `tree-table` tree table, `tree-table-stepped` stepped tree table.

`mindmap-down` is still a mind-map layout focused on downward branching. `org` is an organization-chart layout focused on aligned hierarchy rows. `org-right` is a right organization-chart layout where first-level branches are arranged horizontally and deeper levels expand down-right from each branch.

## Controls

- The rendered mind map is available in both Reading view and editor/Live Preview.
- Reading view is browse-focused; topic rename, add, delete, drag-sort, and topic context menus are enabled only in editor/Live Preview.
- Click the collapse/expand dot next to a topic to collapse or expand its children.
- Use the source/map button to switch between raw `yxmm` source and the rendered mind map.
- In source view, edit the textarea; switching back to the mind map auto-saves, and Ctrl/Cmd+S also saves.
- In source view, Tab/Shift+Tab promotes or demotes selected heading lines.
- In editor/Live Preview mind map view, hover a topic and click the small edit button to edit text, color, icon, or layout.
- The topic editor can also add a child topic or delete the selected topic.
- Use the toolbar to fit view, zoom in, zoom out, or reset collapse state.
- Use the toolbar settings button to open the visual config modal; common fields have select presets, and the advanced tab supports direct YAML editing.
- Drag the toolbar grip to move the floating toolbar away from content.
- Drag the canvas to pan. By default, the mouse wheel keeps scrolling the Obsidian page; enable mouse-wheel zoom in the Basic tab of the config modal to zoom the current mind map with the wheel.
- Drag the canvas height resize handle to set manual height. Double-click the handle to return to auto height.

Edits are written back to the same `yxmm` code block in the current Markdown file.

The plugin uses an open-source/commercial-friendly monospace font stack by default when those fonts are installed locally, such as Noto Sans Mono CJK SC, Source Han Mono SC, Sarasa Mono SC, Cascadia Mono, JetBrains Mono, and Liberation Mono.

The visual config modal provides grouped font presets plus a custom font-family input:

- Presets are grouped by inheritance/custom values, Obsidian fonts, common Chinese fonts, system fonts, and monospace fonts.
- Common Chinese presets include Hei, Song, Kai, FangSong, Microsoft YaHei, PingFang SC, Source Han Sans, Source Han Serif, and LXGW WenKai.
- Select `自定义` to type a CSS font-family value, for example `"LXGW WenKai", "Source Han Sans SC", sans-serif`.
- Browser environments cannot reliably list every installed system font, so the plugin uses curated candidates and normal CSS fallback behavior.

## Built-in icons

`book`, `brain`, `cpu`, `database`, `file`, `folder`, `tag`, `star`, `check`, `lightbulb`.

Unknown icon names are rendered as a small text badge.

## Development

The maintainable source lives in `src/` and `styles/`.

- Business source files under `src/` use ESM `import/export`.
- Build scripts under `scripts/` use `.mjs`.
- `src/main.js` is bundled by `scripts/build-js.mjs` to `dist/main.js`.
- `styles/index.css` is merged by `scripts/build-css.mjs` to `dist/styles.css`.
- `npm run release:prepare` creates a clean `dist/` directory with only the core files needed by Obsidian.
- For local development with Obsidian Hot Reload, run `npm run dev:obsidian`; it runs `release:prepare` and then copies the root `.hotreload` marker to `dist/.hotreload`.
- Edit source files first, then run `npm run release:prepare`.
- Run `npm run validate` before committing changes.

Use `dist/` for releases, manual installs, zip packaging, and local Hot Reload development.
`package.json`, `manifest.json`, and `versions.json` are standard JSON files, so they cannot contain comments; documentation lives here and in nearby `.mjs` config files instead.

### Release Directory

Run:

```bash
npm run release:prepare
```

It creates:

```text
dist/
  .hotreload  # generated only by npm run dev:obsidian for local Hot Reload development
  main.js
  manifest.json
  styles.css
```

`main.js`, `manifest.json`, and `styles.css` are the core files needed in an Obsidian plugin installation directory.
`.hotreload` is copied into `dist/` only for local development and should not be shipped in a formal release.
A user-local `data.json` may be created by Obsidian for plugin settings and should not be shipped.

## License

Dual-licensed under AGPLv3 or a separate commercial license:

- AGPLv3: see [LICENSE](LICENSE)
- Commercial license: see [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)
