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
- `theme`: parsed and preserved for future theme support.
- `layout.defaultDirection`: default first-level branch direction: `balanced`, `left`, or `right`.
- `font.family`, `font.size`, `font.weight`, `font.lineHeight`: global font defaults.
- `font.levels.1`, `font.levels.2`: per-heading-level font overrides.
- `node.defaultColor`: fallback node color when a node has no `color` attribute.
- `node.maxWidth`: maximum node width before label wrapping.
- `source.enableTabIndent`: whether Tab/Shift+Tab changes heading levels in source mode.
- `source.height`: source-mode height, stored separately from graph-mode `canvas.height`.

Font priority:

`node inline attributes` > `font.levels[current level]` > `global font config` > `plugin defaults`

## Controls

- The rendered mind map is available in both Reading view and editor/Live Preview.
- Click a node to collapse or expand its children.
- Use the source/map button to switch between raw `yxmm` source and the rendered mind map.
- In source view, edit the textarea; switching back to the mind map auto-saves, and Ctrl/Cmd+S also saves.
- In source view, Tab/Shift+Tab promotes or demotes selected heading lines.
- In mind map view, hover a node and click the small edit button to edit text, color, icon, or layout.
- The node editor can also add a child node or delete the selected node.
- Use the toolbar to fit, zoom in, zoom out, or reset collapsed nodes.
- Drag the toolbar grip to move the floating toolbar away from content.
- Drag the canvas to pan. Use the mouse wheel to zoom.
- Drag the bottom edge of the canvas to manually adjust its height. Double-click the handle to return to automatic height.

Edits are written back to the same `yxmm` code block in the current Markdown file.

The plugin uses an open-source/commercial-friendly monospace font stack when those fonts are installed locally, such as Noto Sans Mono CJK SC, Source Han Mono SC, Sarasa Mono SC, Cascadia Mono, JetBrains Mono, and Liberation Mono.

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
