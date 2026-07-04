# yonxao-mindmap

[![GitHub Release](https://img.shields.io/github/v/release/yonxao/yonxao-mindmap?logo=github&logoColor=white)](https://github.com/yonxao/yonxao-mindmap/releases/latest) [![Obsidian](https://img.shields.io/badge/Obsidian-1.12.7%2B-7C3AED?logo=obsidian&logoColor=white)](https://community.obsidian.md/plugins/yonxao-mindmap) [![Platform](https://img.shields.io/badge/Platform-desktop%20%26%20mobile-5865F2)](https://github.com/yonxao/yonxao-mindmap/blob/main/manifest.json) [![License](https://img.shields.io/badge/License-AGPL--3.0-green)](https://github.com/yonxao/yonxao-mindmap/blob/main/LICENSE) [![中文文档](https://img.shields.io/badge/中文文档-查看-blue?logo=readthedocs&logoColor=white)](https://github.com/yonxao/yonxao-mindmap/blob/main/README.zh-CN.md)

A feature-rich Obsidian mind map plugin that renders `yxmm` code blocks in Markdown documents as interactive SVG mind maps and various structural diagrams.

[中文文档](./README.zh-CN.md)

Demo screenshot:

![Demo Screenshot](./docs/assets/演示截图.png)

## ✨ Core Features

- 🎨 **20 Layout Types**: 7 categories with 20 layouts, including mind maps (right/left/bidirectional/up/down/vertical), tree diagrams, organization charts, timelines, radial maps, fishbone diagrams, and tree tables
- 🎯 **Intuitive Topic-Level Syntax**: Use `#`, `##`, `###` markers for hierarchy; plain text lines automatically merge into multi-line topic content
- 🖱️ **Full Interactive Editing**: Double-click editing, drag-and-drop sorting, right-click menus, collapse/expand, keyboard navigation
- 🎨 **8 Theme Color Schemes**: default, ocean, forest, sunset, mono, rainbow, pastel-rainbow, neon-rainbow
- 🔗 **Flexible Connector Styles**: Curve, straight, and elbow connectors — freely switchable in mind map layouts
- 📝 **Inline Topic Content Styles**: Bold, italic, strikethrough, underline, text color, plus lists, code blocks, and equations
- ⌨️ **Full Keyboard Navigation & Shortcuts**: Arrow key navigation, quick create/delete/copy topics, zoom, fullscreen, and more
- 📋 **Internal Clipboard & Undo/Redo**: Copy/cut/paste topics with attributes, up to 80-step undo history
- 📐 **Visual Topic Editor Panel**: Floating panel for editing content, color, icon, font, and max width with rich text toolbar
- 🔧 **7-Tab Visual Configuration**: Display, Structure, Color, Font, Interaction, Shortcuts, Advanced (YAML editing)
- 🖼️ **Dual Fullscreen Modes**: Window fullscreen and physical fullscreen with automatic crash recovery
- 📄 **Source Code Editor**: Integrated syntax highlighting, YAML config editing, dirty state detection
- 🖼️ **Export & Copy**: Export PNG image or copy to clipboard; copy plain text, source code, or config
- 🌐 **Multi-language Support**: 16 languages, automatically follows Obsidian language settings
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

Topic content supports lightweight inline style markers and block-level formatting:

````markdown
```yxmm
# Central Topic
## **Bold**, *italic*, ~~strikethrough~~, ++underline++
## {red|Semantic color text} and {#3b82f6|Hex color text}
## Lists, equations, and code blocks
- Unordered list item
  - Nested list item
1. Ordered list item
2. Second item
$$
E = mc^2
$$
~~~js
const topic = 'yonxao-mindmap';
~~~
```
````

**Inline styles:**

| Syntax            | Effect              |
| ----------------- | ------------------- |
| `**Text**`        | **Bold**            |
| `*Text*`          | _Italic_            |
| `~~Text~~`        | ~~Strikethrough~~   |
| `++Text++`        | ++Underline++       |
| `{red\|Text}`     | Semantic color text |
| `{#3b82f6\|Text}` | Hex color text      |

**Block-level formats:**

| Syntax            | Effect                      |
| ----------------- | --------------------------- |
| `- List item`     | Unordered list              |
| `1. List item`    | Ordered list                |
| `$$ ... $$`       | Equation (MathJax rendered) |
| `~~~lang ... ~~~` | Code block (monospace font) |

- Semantic colors: `red`, `green`, `blue`, `yellow`, `orange`, `purple`, `pink`, `gray`, `black`, `white`
- List indentation uses 2 spaces per level
- Equations are rendered asynchronously via Obsidian/MathJax; source text is shown as fallback
- Code blocks use monospace font with independent background color and auto-width
- The topic edit panel and large text editor include visual toolbar buttons and can clear inline styles
- These markers are part of topic content, not topic attributes

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

| Attribute    | Example                  | Description                                    |
| ------------ | ------------------------ | ---------------------------------------------- |
| `color`      | `[color=#3b82f6]`        | Topic color                                    |
| `icon`       | `[icon=book]`            | Topic icon (Lucide icon name)                  |
| `layout`     | `[layout=mindmap-right]` | Local layout type, overrides code block config |
| `fontSize`   | `[fontSize=16]`          | Font size override (9-96px)                    |
| `fontWeight` | `[fontWeight=700]`       | Font weight override (100-900)                 |
| `fontFamily` | `[fontFamily="..."]`     | Font family override                           |
| `lineHeight` | `[lineHeight=20]`        | Line height override (12-160px)                |
| `maxWidth`   | `[maxWidth=300]`         | Max width override (120-800px)                 |

### Config Block

Add a YAML config block wrapped in `---` at the top of the code block to override plugin global defaults:

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

| Layout                  | Description                     |
| ----------------------- | ------------------------------- |
| `mindmap-right`         | Rightward mind map (default)    |
| `mindmap-left`          | Leftward mind map               |
| `mindmap-bidirectional` | Bidirectional mind map          |
| `mindmap-up`            | Upward mind map                 |
| `mindmap-down`          | Downward mind map               |
| `mindmap-vertical`      | Vertical bidirectional mind map |

> Mind map layouts support switching connector styles (curve/straight/elbow) and branch expansion modes (side/hanging).

### Tree Diagrams

| Layout       | Description            |
| ------------ | ---------------------- |
| `tree`       | Tree diagram           |
| `tree-right` | Rightward tree diagram |
| `tree-left`  | Leftward tree diagram  |

### Organization Charts

| Layout      | Description                  |
| ----------- | ---------------------------- |
| `org`       | Organization chart           |
| `org-right` | Rightward organization chart |

### Timelines

| Layout          | Description         |
| --------------- | ------------------- |
| `timeline`      | Timeline            |
| `timeline-up`   | Upper-side timeline |
| `timeline-down` | Lower-side timeline |

### Radial Maps

| Layout   | Description |
| -------- | ----------- |
| `radial` | Radial map  |

### Fishbone Diagrams

| Layout           | Description                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| `fishbone-right` | Rightward fishbone diagram: fish head on the left, spine and content expand right |
| `fishbone-left`  | Leftward fishbone diagram: fish head on the right, spine and content expand left  |

### Tree Tables

| Layout               | Description        |
| -------------------- | ------------------ |
| `tree-table`         | Tree table         |
| `tree-table-stepped` | Stepped tree table |

## 🖱️ Usage Guide

### Basic Operations

|       Operation       |                     Description                     |
| :-------------------: | :-------------------------------------------------: |
| Double-click a topic  |        Quick inline editing of topic content        |
| Click collapse button |              Collapse/expand subtopics              |
|     Drag a topic      | Rearrange sibling order or move to another position |
|  Right-click a topic  |                  Open context menu                  |

### Keyboard Shortcuts

|         Windows          |             macOS              |          Function           |     Context      |
| :----------------------: | :----------------------------: | :-------------------------: | :--------------: |
|     `↑` `↓` `←` `→`      |        `↑` `↓` `←` `→`         |       Navigate topics       |   All layouts    |
|          `Tab`           |             `Tab`              |       Add child topic       |    Edit mode     |
|         `Enter`          |            `Enter`             |   Add sibling topic below   |    Edit mode     |
|    `Shift` + `Enter`     |       `Shift` + `Enter`        |   Add sibling topic above   |    Edit mode     |
|         `Delete`         | `Delete` / `Cmd` + `Backspace` |        Delete topic         |    Edit mode     |
|         `Space`          |            `Space`             |     Open inline editor      |    Edit mode     |
|         `` ` ``          |            `` ` ``             |    Open topic edit panel    |    Edit mode     |
|       `Alt` + `/`        |         `Option` + `/`         |   Toggle collapse/expand    | Always available |
| `Ctrl` + `C` / `X` / `V` |    `Cmd` + `C` / `X` / `V`     |    Copy/cut/paste topic     |    Edit mode     |
|   `Ctrl` + `Alt` + `C`   |     `Cmd` + `Option` + `C`     | Copy topic with attributes  |    Edit mode     |
|   `Ctrl` + `Alt` + `V`   |     `Cmd` + `Option` + `V`     | Paste topic with attributes |    Edit mode     |
|    `Ctrl` + `Z` / `Y`    |  `Cmd` + `Z` / `Shift` + `Z`   |          Undo/redo          |    Edit mode     |
|    `Alt` + `+` / `-`     |      `Option` + `+` / `-`      |         Zoom in/out         | Always available |
|       `Alt` + `0`        |         `Option` + `0`         |          Fit view           | Always available |
|       `Alt` + `1`        |         `Option` + `1`         |    Original size (100%)     | Always available |
|       `Alt` + `2`        |         `Option` + `2`         |      Window fullscreen      | Always available |
|       `Alt` + `3`        |         `Option` + `3`         |     Physical fullscreen     | Always available |
|       `Alt` + `,`        |         `Option` + `,`         |      Open config panel      | Always available |

> **Arrow key navigation logic**: In horizontal layouts, left/right navigates parent-child relationships and up/down navigates siblings; vertical layouts are the opposite; other layouts navigate by spatial proximity.

### Context Menu

**Topic context menu:**

|          Action          |                   Description                    |
| :----------------------: | :----------------------------------------------: |
|        Edit Topic        |             Open inline text editor              |
|     Topic Edit Panel     |        Open full attribute editing panel         |
|    Copy Topic Content    |              Copy topic plain text               |
|    Copy Subtree Text     |            Copy subtree as plain text            |
|  Copy Indented Subtree   |          Copy subtree as indented text           |
|       Add Subtopic       |       Add child topic under selected topic       |
|    Add Sibling Above     |         Add sibling above selected topic         |
|    Add Sibling Below     |         Add sibling below selected topic         |
| Collapse/Expand Subtopic |              Toggle collapse state               |
|   Expand All Subtopics   |        Recursively expand all descendants        |
|  Collapse All Subtopics  |       Recursively collapse all descendants       |
|       Delete Topic       | Confirm and delete (shows count if has children) |

**Canvas context menu (on blank area):**

|       Action       |                Description                 |
| :----------------: | :----------------------------------------: |
|     Copy Text      |       Copy topic tree as plain text        |
| Copy Indented Text |     Copy topic tree as indented format     |
|    Copy Source     |        Copy full code block content        |
|    Copy Config     |        Copy YAML config block only         |
|     Export PNG     |           Download as PNG image            |
|      Copy PNG      |          Copy image to clipboard           |
|      Fit View      | Auto-adjust viewport to fit the entire map |
|   Original Size    |             Restore 100% zoom              |
|  Delete Mind Map   |    Delete the entire `yxmm` code block     |

### Topic Edit Panel

Press `` ` `` (backtick) while a topic is selected, or use the context menu to open the topic edit panel — a floating panel with:

|    Field    |                          Description                           |
| :---------: | :------------------------------------------------------------: |
|   Content   |          Multi-line text input with rich text toolbar          |
|    Color    |           Topic color (swatches + hex color picker)            |
|    Icon     |                   Icon picker (Lucide icons)                   |
|  Max Width  |              Override global/level configuration               |
| Font Family | Dropdown: inherit / Obsidian variables / system fonts / custom |
|  Font Size  |                             9-96px                             |
| Font Weight |                            100-900                             |
| Line Height |                            12-160px                            |

**Rich text toolbar:**

Style buttons: **B** (bold), _I_ (italic), ~~S~~ (strikethrough), U (underline), A▼ (text color), 🧹 (clear styles)

Block format buttons: • (unordered list), 1. (ordered list), Σ (equation), \</\> (code block)

- Select text and click a style button to wrap it with markers; inserts placeholder text when nothing is selected
- Click A▼ to open the color picker: 10 predefined semantic colors + native color picker
- The clear styles button strips inline style markers from the selection or entire content

**Large text editor:**

- Click the "expand" button next to the content field to open a standalone floating editor
- Supports drag-to-move, ideal for editing large amounts of content
- `Cmd/Ctrl + Enter` to save, `Escape` to cancel
- Includes the full rich text toolbar

### Source Code Editor

Click the "Source/Map Toggle" button in the toolbar or double-click the code block area to enter source editing mode:

- **Config tab** (YAML): Syntax highlighting (key/value/comment/string/number), line numbers
- **Content tab** (topic-level markers): Line numbers, `Tab` key inserts level markers
- **Real-time validation**: Parses before saving; rejects invalid content with error message
- **Dirty state detection**: Shows `dirty`/`synced` status indicator
- **Auto height**: Adapts to line count
- `Cmd/Ctrl + S` to save

### Fullscreen Modes

- **Window fullscreen**: Expands the map container to fill the browser viewport (does not use Fullscreen API)
- **Physical fullscreen**: Uses the browser Fullscreen API
- **Crash recovery**: Edited content is automatically saved to localStorage (7-day validity); on recovery, a new code block is appended or content is copied to clipboard
- Toolbar auto-repositions into the fullscreen container
- Reading view uses body-level overlay for fullscreen

### Toolbar Operations

|       Button        |                         Description                         |
| :-----------------: | :---------------------------------------------------------: |
|  Source/Map Toggle  |          Switch between source editor and map view          |
|    Config Panel     |             Open visual configuration interface             |
|      Fit View       |         Auto-adjust viewport to fit the entire map          |
|  Window Fullscreen  |                 Expand to browser viewport                  |
| Physical Fullscreen |                     Use Fullscreen API                      |
|       Zoom In       |                        Zoom in view                         |
|      Zoom Out       |                        Zoom out view                        |
|   Reset Collapse    |                      Expand all topics                      |
|     Drag Handle     | Drag toolbar to any position (auto-snaps to nearest corner) |

- Toolbar can be placed at 4 corners (top-left/right, bottom-left/right), inside or outside
- Toolbar auto-hides during scrolling or middle-click, reappears when idle
- Dragging the toolbar auto-snaps to the nearest corner and persists to config

### Canvas Control

- **Drag the bottom edge of the canvas**: Manually adjust canvas height
- **Double-click the resize handle**: Restore auto height
- Map mode and source mode save independent height values
- Mouse wheel zoom (can be disabled in config)

## ⚙️ Configuration

### Configuration Priority

```
Topic attributes > Code block config > Plugin global defaults > Plugin built-in defaults
```

### Global Default Configuration

Open the visual config panel in Obsidian `Settings` → `Community plugins` → `yonxao-mindmap`. There are 7 tabs:

**1. Display**

- Canvas height settings (map mode / source mode, saved independently)
- Initial zoom: original size / fit view
- `fitViewNoUpscale`: Don't upscale when fitting view
- `fitViewMaxScale`: Maximum zoom multiplier (1-6)
- `saveFullConfig`: Config trimming toggle

**2. Structure**

- Layout selector (7 categories, 20 layouts)
- Connector style (mind map layouts only: curve/straight/elbow)
- Branch expansion mode (elbow connector only: side/hanging)
- Topic max width: global + level1/level2/level3 overrides (120-800px)
- **Inheritance linkage**: Level fields auto-update when global value changes

**3. Color**

- Theme scheme selector (8 color schemes)
- Default topic color (hex / color picker)
- Rainbow theme override warning: shown when both default color and rainbow theme are set
- Button color mode: `inherit-accent` / `subtle` / `topic` / `custom`
- Custom button color (10 presets + color picker)

**4. Font**

- Global font: family / size / weight / lineHeight
- 3-level font overrides: level1 / level2 / level3
- Font family dropdown: inherit (empty) / Obsidian variables (interface/text/monospace) / system fonts (sans/serif/monospace) / custom input
- **Level font inheritance linkage**: Auto-syncs when global field changes
- One-click clear level overrides button

**5. Interaction**

- Toolbar position: 4 corners
- Toolbar placement: inside / outside
- Topic control visibility: `always` / `toggle-always` / `hover`
- Wheel zoom toggle
- Tab indent toggle

**6. Shortcuts**

- Read-only display listing all shortcut groups:
  - Topic create/delete
  - Topic editing
  - Topic navigation/collapse
  - Clipboard/history
  - View control
  - Map control

**7. Advanced**

- YAML raw text editing
- Real-time parse validation (shows valid/invalid status)
- Syntax highlighting
- Auto-trim inactive config

> **Config panel common features:**
>
> - Drag-to-move: Drag the title bar to reposition the panel
> - Inherited value display: Gray text shows inherited values, blue text shows explicit values
> - Status bar: Shows configuration state
> - Apply / Save & Close / Cancel buttons

### Language Support

A language option is also available in preferences. The initial default language follows Obsidian's current language; if the Obsidian language is not yet supported, it falls back to English. Currently supported:

- English (fallback)
- 中文（简体）
- 中文（繁體）
- 日本語
- 한국어
- Français
- Deutsch
- Español
- Português (Brasil)
- Русский
- Italiano
- Bahasa Indonesia
- Türkçe
- Tiếng Việt
- ไทย
- हिन्दी

### Config Trimming

When `display.saveFullConfig` is `false` (default: off), any config item whose value matches the global default will be trimmed to keep the config block concise.

Additional trimming rules:

- Non-elbow connector layouts: removes `branchExpansion` field
- Non-fit view: removes `fitViewNoUpscale` / `fitViewMaxScale`
- Non-custom button color mode: removes `buttonColor`
- Radial / tree-table layouts: removes `branchExpansion`

## 🖼️ Export

|      Feature       |                    Description                     |
| :----------------: | :------------------------------------------------: |
|     Export PNG     |             Download as PNG image file             |
|      Copy PNG      |         Copy PNG image to system clipboard         |
|     Copy Text      |           Copy topic tree as plain text            |
| Copy Indented Text |            Copy as indented format text            |
|    Copy Subtree    | Copy subtree plain text (with/without indentation) |
|    Copy Source     |            Copy full code block content            |
|    Copy Config     |            Copy YAML config block only             |

- Automatically inlines all CSS color values before export for color consistency
- Automatically removes interactive controls (collapse buttons, etc.) during export
- Export resolution is automatically optimized based on pixel ratio

## 📋 Clipboard & Undo/Redo

### Internal Clipboard

The plugin maintains an internal clipboard for topic-level copy/cut/paste:

- **Copy topic**: Copies the topic content and its entire subtree
- **Cut topic**: Cuts the topic and its entire subtree
- **Paste topic**: Pastes the clipboard topic as a child under the target topic
- **Copy topic with attributes**: Full copy including color, icon, font, etc.
- Operations are also written to the system clipboard

### Undo/Redo

- Full source snapshot-based undo/redo system (not incremental diff)
- Up to 80 history snapshots retained
- 30-minute in-memory expiry for auto-cleanup
- Snapshots are buffered during fullscreen editing and committed on exit
- Snapshots are indexed by `sourcePath + sectionInfo`

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
- [Example Gallery (Chinese)](docs/regression-layout-gallery.zh-CN.md): Collection of various layout examples

---

⭐ If this plugin helps you, please give it a star! [![Stars](https://img.shields.io/github/stars/yonxao/yonxao-mindmap)](https://github.com/yonxao/yonxao-mindmap)
