# yonxao-mindmap

yonxao-mindmap 是一个 Obsidian 思维导图显示插件。它会把 Markdown 文档中的 `yxmm` 代码块渲染成可交互的 SVG 思维导图。

[English README](README.md)

## 用法

在 Markdown 文档中写入 `yxmm` 代码块：

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

## 语法

- 使用 Markdown 标题表示层级：`#` 是中心节点，`##` 是二级节点，`###` 是三级节点，依此类推。
- 仍然兼容旧版缩进语法，方便打开已有笔记；但插件保存后会统一输出为标题语法。
- 如果在标题语法中混入缩进普通行，插件会尽量把它解析为上一层节点的子节点，并在保存时规范化成标题。
- 属性写在行尾，格式为 `[key=value]`。
- 当前支持的属性：
  - `color=#3b82f6`：节点颜色。
  - `layout=right`、`layout=left`、`layout=balanced`：布局方向。
  - `icon=book`：节点图标。

## 操作

- 阅读视图和编辑视图 Live Preview 都可以显示思维导图。
- 点击有子节点的节点，可以折叠或展开子节点。
- 使用插件工具栏中的源码/导图按钮，可以在源码模式和思维导图模式之间切换。
- 源码模式中可以直接编辑 `yxmm` 文本，然后点击保存按钮，或按 `Ctrl/Cmd+S` 保存。
- 源码模式中，`Tab` / `Shift+Tab` 可以提升或降低选中标题行的层级。
- 源码模式会显示层级缩进辅助线，方便观察节点层级。
- 思维导图模式中，悬停节点并点击节点右上角的小编辑按钮，可以编辑节点文本、颜色、图标和布局。
- 节点编辑面板支持新增子节点和删除当前节点。
- 工具栏支持适配视图、放大、缩小和重置折叠状态。
- 拖动画布可以平移视图，滚动鼠标滚轮可以缩放视图。
- 拖动画布底部边缘可以手动调整幕布高度，双击拖拽条可以恢复自动高度。
- Obsidian 自带的“编辑这个块”按钮会继续保留；插件工具栏默认放在脑图左上角，避免和它冲突。

所有编辑都会写回当前 Markdown 文件中的同一个 `yxmm` 代码块。

## 字体

插件使用适合中文和代码显示的等宽字体栈。只要本机安装了这些字体，就会优先使用：

- Noto Sans Mono CJK SC
- Source Han Mono SC
- Sarasa Mono SC
- Cascadia Mono
- JetBrains Mono
- Liberation Mono

## 内置图标

当前内置图标包括：

`book`、`brain`、`cpu`、`database`、`file`、`folder`、`tag`、`star`、`check`、`lightbulb`

如果填写了未知图标名，插件会把图标名渲染成一个小文本徽标。

## 许可证

本项目采用 AGPLv3 + 商业授权双许可证：

- AGPLv3：见 [LICENSE](LICENSE)
- 商业授权：见 [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md)
