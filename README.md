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
layout:
  defaultDirection: balanced
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

## Syntax

- Markdown headings define hierarchy: `#` is the center node, `##` is level 2, `###` is level 3, and so on.
- Non-empty lines inside `yxmm` blocks must use Markdown headings.
- Attributes are written at the end of a line with `[key=value]`.
- Supported attributes:
  - `color=#3b82f6`
  - `layout=right`, `layout=left`, `layout=balanced`
  - `icon=book`
  - `fontSize=16`, `fontWeight=700`, `fontFamily="..."`, `lineHeight=20`

## Config Block

A `yxmm` block can start with a `---` config block. The config block stores global defaults, while Markdown headings continue to describe the mind map structure.

Supported config keys:

- `canvas.height`: persisted canvas height. Drag the bottom handle to write it; double-click the handle to remove it and return to automatic height.
- `toolbar.x` / `toolbar.y`: persisted floating toolbar position. Drag the toolbar grip to write it.
- `interaction.wheelZoom`: whether the mouse wheel zooms the mind map. It is off by default; enabling it writes `true`, and disabling it can remove the key.
- `theme`: built-in theme name: `default`, `ocean`, `forest`, `sunset`, `mono`, `rainbow`, `pastel-rainbow`, or `neon-rainbow`.
- `layout.defaultDirection`: default first-level branch direction: `balanced`, `left`, or `right`.
- `edge.type`: connector type: `curve`, `straight`, or `elbow`. `curve` is a cubic Bezier curve, `straight` is a straight line, and `elbow` is an orthogonal connector.
- `font.family`, `font.size`, `font.weight`, `font.lineHeight`: global font defaults.
- `font.levels.1`, `font.levels.2`: per-heading-level font overrides.
- `node.defaultColor`: unified node color that overrides theme auto colors; node attribute `color` still wins.
- `node.maxWidth`: maximum node width before label wrapping.
- `source.enableTabIndent`: whether Tab/Shift+Tab changes heading levels in source mode.
- `source.height`: source-mode height, stored separately from graph-mode `canvas.height`.

Font priority:

`node attributes` > `font.levels[current level]` > `global font config` > `plugin defaults`

Font ranges:

- `size`: font size, from `9` to `96`.
- `weight`: CSS font weight, from `100` to `900`.
- `lineHeight`: SVG text line spacing in pixels, from `12` to `160`. A practical value is usually `1.3` to `1.5` times the font size.

Theme color priority:

`node attribute color` > `node.defaultColor` > `theme auto color`

`rainbow`, `pastel-rainbow`, and `neon-rainbow` automatically assign colors by first-level branch.
The center node uses an independent center color from the theme. Node attribute `color` changes only the node itself, not the edge from its parent.
Hex colors in the config block should be quoted, for example `defaultColor: '#66ed0c'`; the visual config modal writes quoted colors automatically.

## Controls

- The rendered mind map is available in both Reading view and editor/Live Preview.
- Reading view is browse-focused; node rename, add, delete, drag-sort, and node context menus are enabled only in editor/Live Preview.
- Click the collapse/expand dot next to a node to collapse or expand its children.
- Use the source/map button to switch between raw `yxmm` source and the rendered mind map.
- In source view, edit the textarea; switching back to the mind map auto-saves, and Ctrl/Cmd+S also saves.
- In source view, Tab/Shift+Tab promotes or demotes selected heading lines.
- In editor/Live Preview mind map view, hover a node and click the small edit button to edit text, color, icon, or layout.
- The node editor can also add a child node or delete the selected node.
- Use the toolbar to fit, zoom in, zoom out, or reset collapsed nodes.
- Use the toolbar settings button to open the visual config modal; common fields have select presets, and the advanced tab supports direct YAML editing.
- Drag the toolbar grip to move the floating toolbar away from content.
- Drag the canvas to pan. By default, the mouse wheel keeps scrolling the Obsidian page; enable mouse-wheel zoom in the Basic tab of the config modal to zoom the current mind map with the wheel.
- Drag the bottom edge of the canvas to manually adjust its height. Double-click the handle to return to automatic height.

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
