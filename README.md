# yonxao-mindmap

[![GitHub Release](https://img.shields.io/github/v/release/yonxao/yonxao-mindmap?logo=github&logoColor=white)](https://github.com/yonxao/yonxao-mindmap/releases/latest) [![Obsidian](https://img.shields.io/badge/Obsidian-1.12.7%2B-7C3AED?logo=obsidian&logoColor=white)](https://community.obsidian.md/plugins/yonxao-mindmap) [![Platform](https://img.shields.io/badge/Platform-desktop%20%26%20mobile-5865F2)](https://github.com/yonxao/yonxao-mindmap/blob/main/manifest.json) [![License](https://img.shields.io/badge/License-AGPL--3.0-green)](https://github.com/yonxao/yonxao-mindmap/blob/main/LICENSE) [![中文文档](https://img.shields.io/badge/中文文档-查看-blue?logo=readthedocs&logoColor=white)](https://github.com/yonxao/yonxao-mindmap/blob/main/README.zh-CN.md)

A feature-rich Obsidian mind map plugin that renders `yxmm` code blocks in Markdown documents as interactive SVG mind maps and various structural diagrams.

这是一个功能丰富的 Obsidian 思维导图插件，将 Markdown 文档中的 `yxmm` 代码块渲染为可交互的 SVG 思维导图及多种结构图。

[中文文档](./README.zh-CN.md)

Demo screenshot:

![Demo Screenshot](./docs/assets/演示截图.png)

## ✨ Core Features

- 🎨 **Rich Layout Types**: 7 categories with 20 layouts, including mind maps (right/left/bidirectional/up/down/vertical), tree diagrams, organization charts, timelines, radial maps, fishbone diagrams, and tree tables
- 🎯 **Intuitive Syntax**: Use topic-level markers (`#`, `##`, `###`) to express hierarchy naturally and fluently
- 🖱️ **Full Interactive Editing**: Double-click editing, drag-and-drop sorting, right-click menus, collapse/expand — support complete topic tree editing
- 🎨 **8 Theme Color Schemes**: default, ocean, forest, sunset, mono, rainbow, pastel-rainbow, neon-rainbow
- 🔗 **Flexible Connector Styles**: Curve, straight, and elbow connectors — freely switchable in mind map layouts
- 📐 **Custom Fonts**: Support setting font family, size, weight, and line height per topic level
- 🖼️ **Export Functionality**: Export PNG images or copy to clipboard
- 🌐 **Multi-language Support**: 16 languages, automatically follows Obsidian language settings
- ⚙️ **Visual Configuration Panel**: Intuitive configuration interface supporting global defaults and per-code-block configuration
- 📱 **Responsive Design**: Adapts to different screen sizes and Obsidian themes

## 🚀 Quick Start

### Basic Usage

- Create a `yxmm` code block in your Markdown document:

  Moving the cursor out of the code block will display it as a mind map.

  ````markdown
  ```yxmm

  ```
  ````

- Right-click menu

  Right-click in an Obsidian note: click `Insert Mind Map`.

  ![Right-click Menu Create](./docs/assets/右键菜单创建.png)

### Complete Example

````markdown
```yxmm
---
structure:
  layout: mindmap-right
  connectorStyle: curve
color:
  scheme: ocean
---

# Central Topic
## Branch Topic A
### Subtopic A1
### Subtopic A2
## Branch Topic B
### Subtopic B1
```
````

## 📝 Syntax Reference

### Topic Hierarchy

- Use topic-level markers to represent hierarchy: `#` is a level-1 topic, `##` is a level-2 topic, `###` is a level-3 topic, and so on.
- Only topic-level marker lines like `#`, `##`, `###` create new topics; ordinary text lines merge into the nearest previous topic as multi-line content.

| Marker | Meaning                           |
| ------ | --------------------------------- |
| `#`    | Level-1 topic (central / root)    |
| `##`   | Level-2 topic (branch topic)      |
| `###`  | Normal topic (level-3 and deeper) |

### Multi-line Topics

Ordinary text lines merge into the nearest previous topic as multi-line content:

````markdown
```yxmm
# Central Topic
## Multi-line Topic Example
This is the second line
This is the third line
### Subtopic
```
````

### Inline Topic Content Styles

Topic content supports lightweight inline style markers:

````markdown
```yxmm
# Central Topic
## **Bold**, *italic*, ~~strikethrough~~, ++underline++
## {red|Semantic color text} and {#3b82f6|Hex color text}
```
````

Supported inline styles:

- `**Text**`: Bold
- `*Text*`: Italic
- `~~Text~~`: Strikethrough
- `++Text++`: Underline
- `{red|Text}`, `{#3b82f6|Text}`: Text color

Semantic colors: `red`, `green`, `blue`, `yellow`, `orange`, `purple`, `pink`, `gray`, `black`, `white`. The topic edit panel and large text editor include visual style buttons and can clear inline styles from the selection or the whole content field. These markers are part of topic content, not topic attributes.

### Topic Attributes

Add attributes in `[key=value]` format at the end of a topic-level marker line:

````markdown
```yxmm
# Central Topic [color=#3b82f6]
## Branch Topic [icon=book layout=mindmap-right]
### Subtopic [fontSize=14 fontWeight=700]
```
````

Supported attributes:

- `color=#3b82f6`: Topic color
- `icon=book`: Topic icon
- `layout=mindmap-right`: Local layout type
- `fontSize=16`, `fontWeight=700`, `fontFamily="..."`, `lineHeight=20`: Font overrides

### Config Block

Add a YAML config block wrapped in `---` at the top of the code block:

````markdown
```yxmm
---
display:
  viewFit: fit
  fitViewNoUpscale: true
  saveFullConfig: true
structure:
  layout: mindmap-right
  connectorStyle: curve
  topicMaxWidth:
    global: 240
color:
  scheme: rainbow
  buttonColorMode: topic
font:
  family: "var(--font-text)"
  size: 16
  weight: 400
  lineHeight: 20
interaction:
  toolbar:
    corner: top-right
    placement: outside
  topicControlVisibility: toggle-always
  wheelZoom: false
  tabIndent: true
---

# Central Topic
## Branch Topic
```
````

## 🎨 Layout Types

### Mind Maps

- `mindmap-right`: Rightward mind map (default)
- `mindmap-left`: Leftward mind map
- `mindmap-bidirectional`: Bidirectional mind map
- `mindmap-up`: Upward mind map
- `mindmap-down`: Downward mind map
- `mindmap-vertical`: Vertical bidirectional mind map

### Tree Diagrams

- `tree`: Tree diagram
- `tree-right`: Rightward tree diagram
- `tree-left`: Leftward tree diagram

### Organization Charts

- `org`: Organization chart
- `org-right`: Rightward organization chart

### Timelines

- `timeline`: Timeline
- `timeline-up`: Upper-side timeline
- `timeline-down`: Lower-side timeline

### Radial Maps

- `radial`: Radial map

### Fishbone Diagrams

- `fishbone-left`: Leftward fishbone diagram
- `fishbone-right`: Rightward fishbone diagram

### Tree Tables

- `tree-table`: Tree table
- `tree-table-stepped`: Stepped tree table

## 🖱️ Usage Guide

### Basic Operations

- **Double-click a topic**: Quickly edit topic content
- **Click collapse button**: Collapse/expand subtopics
- **Drag a topic**: Adjust sibling topic order or move to another position
- **Right-click a topic**: Open context menu (add, delete, copy, collapse, etc.)

### Toolbar Operations

- **Fit View**: Automatically adjust viewport to show the entire map
- **Zoom in/out**: Adjust view zoom level
- **Reset Collapse**: Expand all topics
- **Config Panel**: Open visual configuration interface
- **Source/Map Toggle**: Switch between source mode and map mode
- **Export Image**: Export PNG image or copy to clipboard

### View Modes

- **Reading View**: Browse only, editing functions disabled
- **Editing View**: Full editing capability, supporting topic drag, add, delete, etc.

### Height Adjustment

- **Drag the bottom edge of the canvas**: Manually adjust canvas height
- **Double-click the resize handle**: Restore auto height

## ⚙️ Configuration

### Configuration Priority

```
Topic attributes > Code block config > Plugin global defaults > Plugin built-in defaults
```

### Global Default Configuration

Set global defaults in Obsidian `Settings` → `Community plugins` → `yonxao-mindmap`. All `yxmm` code blocks will inherit these configurations.

### Language Support

Language option is also available in preferences. The initial default language follows Obsidian's current language; if the Obsidian language is not yet supported, it falls back to English. Currently supported:

- English: Fallback language.
- 中文（简体）.
- 中文（繁體）.
- 日本語.
- 한국어.
- Français.
- Deutsch.
- Español.
- Português (Brasil).
- Русский.
- Italiano.
- Bahasa Indonesia.
- Türkçe.
- Tiếng Việt.
- ไทย.
- हिन्दी.

### Config Trimming

When `display.saveFullConfig` is false (i.e., "Save full config" is turned off in the config panel), any config item whose value matches the global default will be trimmed to keep the config block concise.

## 📦 Installation

### Install from Obsidian Plugin Market

1. Open Obsidian Settings
2. Click `Community plugins`
3. Click `Browse`
4. Search for `yonxao-mindmap`
5. Click `Install`, then click `Enable`

### Manual Installation

1. Download the latest `yonxao-mindmap.zip`
2. Extract to your Obsidian plugins directory (`.obsidian/plugins/`)
3. Enable the plugin in Obsidian settings

## 📄 License

This project uses AGPLv3 + Commercial dual licensing:

- AGPLv3: See [LICENSE](LICENSE)
- Commercial license: See [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📚 Documentation

- [Development Context (Chinese)](docs/DEVELOPMENT_CONTEXT.zh-CN.md): Development collaboration memo including architecture, terminology, workflows, and FAQs
- [Regression Test Checklist (Chinese)](docs/REGRESSION_TEST_CHECKLIST.zh-CN.md): Regression test checklist
- [Example Gallery (Chinese)](examples/regression-layout-gallery.zh-CN.md): Collection of various layout examples

---

⭐ If this plugin helps you, please give it a star! [![Stars](https://img.shields.io/github/stars/yonxao/yonxao-mindmap)](https://github.com/yonxao/yonxao-mindmap)
