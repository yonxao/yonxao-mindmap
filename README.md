# yonxao-mindmap

[中文文档](README.zh-CN.md)

yonxao-mindmap renders Markdown-heading-style `yxmm` code blocks as interactive SVG mind maps in Obsidian.

## Usage

````markdown
```yxmm
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
- The parser still accepts the old indentation syntax for existing notes, but saved output uses headings.
- Attributes are written at the end of a line with `[key=value]`.
- Supported attributes:
  - `color=#3b82f6`
  - `layout=right`, `layout=left`, `layout=balanced`
  - `icon=book`

## Controls

- The rendered mind map is available in both Reading view and editor/Live Preview.
- Click a node to collapse or expand its children.
- Use the source/map button to switch between raw `yxmm` source and the rendered mind map.
- In source view, edit the textarea and click save, or press Ctrl/Cmd+S.
- In source view, Tab/Shift+Tab promotes or demotes selected heading lines.
- Source view shows hierarchy guide lines for heading levels and old indentation levels.
- In mind map view, hover a node and click the small edit button to edit text, color, icon, or layout.
- The node editor can also add a child node or delete the selected node.
- Use the toolbar to fit, zoom in, zoom out, or reset collapsed nodes.
- Drag the canvas to pan. Use the mouse wheel to zoom.
- Drag the bottom edge of the canvas to manually adjust its height. Double-click the handle to return to automatic height.

Edits are written back to the same `yxmm` code block in the current Markdown file.

The plugin uses an open-source/commercial-friendly monospace font stack when those fonts are installed locally, such as Noto Sans Mono CJK SC, Source Han Mono SC, Sarasa Mono SC, Cascadia Mono, JetBrains Mono, and Liberation Mono.

## Built-in icons

`book`, `brain`, `cpu`, `database`, `file`, `folder`, `tag`, `star`, `check`, `lightbulb`.

Unknown icon names are rendered as a small text badge.

## License

Dual-licensed under AGPLv3 or a separate commercial license:

- AGPLv3: see [LICENSE](LICENSE)
- Commercial license: see [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)
