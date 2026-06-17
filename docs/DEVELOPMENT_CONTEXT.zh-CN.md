# yonxao-mindmap 开发上下文

这份文档用于让新的 Codex 会话快速接手 `yonxao-mindmap` 项目。它不是用户手册，而是开发协作备忘录，记录本轮长期开发中已经确认的架构、术语、流程和容易踩坑的地方。

如果开启新会话，可以先让 Codex 阅读本文件，再继续按当前代码实现具体需求：

```text
这是 yonxao-mindmap 项目。请先阅读 docs/DEVELOPMENT_CONTEXT.zh-CN.md，然后继续按其中约定协作。
```

## 项目定位

`yonxao-mindmap` 是一个 Obsidian 第三方插件，用于把 Markdown 文档中的 `yxmm` 代码块渲染为可交互的 SVG 思维导图及相关结构图。

核心目标：

- 在 Markdown 中用尽量自然的标题层级表达导图结构。
- 在 Obsidian 阅读视图和编辑视图中展示 `yxmm` 代码块。
- 支持导图视图、源码视图、可视化配置、主题、字体、布局、交互编辑。
- 发布产物符合 Obsidian 插件习惯：安装目录主要包含 `main.js`、`styles.css`、`manifest.json`、必要时包含 `data.json`。

## 当前项目路径

实际项目目录：

```text
/Users/yonxao/develop/code/plugin/yonxao-mindmap
```

本轮 Codex 协作常用镜像目录：

```text
/Users/yonxao/Documents/Codex/2026-05-12/md-obsidian/yxmind
```

如果新会话有权限直接操作实际项目目录，应优先在实际项目目录工作。若受沙箱限制，可在镜像目录修改并同步回实际项目目录。

## 协作流程约定

默认协作方式：

- 小需求直接改，不需要反复写方案。
- 大型架构调整、术语大迁移、数据结构改动、布局算法重写，先给方案再执行。
- 用户已经明确过：不要为了兼容旧实验配置而保留多套逻辑。本插件尚未正式发布，配置和命名以当前最新术语为准，旧配置兼容逻辑应尽量删除。
- 代码、注释、README、配置 UI、i18n 文案要尽量统一术语，避免同一概念出现多种命名。
- 关键变量、关键算法和不直观逻辑要加中文注释，粒度不要只停留在文件和方法级别。
- 变量和方法命名要语义化，允许多几个单词，但不要为了长而长。

## 构建和校验

项目使用 ESM 风格，构建产物放在 `dist/`。

常用脚本：

```bash
npm run build
npm run release:prepare
npm run dev:obsidian
npm run validate
npm run ai:validate
```

最重要的约定：

- Codex 修改完成后，优先运行：

```bash
npm run ai:validate
```

- `ai:validate` 会执行完整校验，并额外把根目录 `.hotreload` 复制回 `dist/.hotreload`。
- 如果 `ai:validate` 因 Prettier 失败，可以先运行：

```bash
npm run format
npm run ai:validate
```

- 不要再手动重复“format -> validate -> copy hotreload”三步流程，除非脚本失效。
- 只改文档且非常轻量时，可以视情况只跑 `npm run format`，但涉及源码、配置、i18n、构建产物时应跑 `npm run ai:validate`。

## 发布产物规则

`package.json` 的入口是：

```json
{
  "main": "dist/main.js"
}
```

发布目录是 `dist/`，不是项目根目录。

发布产物原则：

- `dist/main.js`：由源码构建生成。
- `dist/styles.css`：由 `styles/index.css` 和分文件 CSS 构建生成。
- `dist/manifest.json`：由根目录 `manifest.json` 准备到发布目录。
- `dist/.hotreload`：仅本地 Hot Reload 调试使用，由 `dev:obsidian` 或 `ai:validate` 复制。
- 根目录 `main.js`、`styles.css` 不应作为主方案重新引入。

## 许可证

当前许可证策略是：

```text
AGPLv3 + 商业授权双许可证
```

相关文件：

- `LICENSE`
- `COMMERCIAL-LICENSE.md`

package license 字段：

```json
"license": "(AGPL-3.0-only OR LicenseRef-Commercial)"
```

## 语法和数据结构

代码块语言名：

````markdown
```yxmm
...
```
````

````

当前结构不再使用早期的缩进语法，只保留 Markdown 标题级别语法。

示例：

```markdown
---
theme:
  scheme: rainbow
layout:
  type: mindmap-right
---

# 中心主题
## 分支主题
### 普通主题
````

配置区使用代码块顶部的类 YAML 元数据：

```markdown
---
basic:
  canvasHeight: 420
theme:
  scheme: rainbow
layout:
  type: mindmap-right
font:
  size: 14
---
```

正文区只保存主题级别标记内容：

```markdown
# 中心主题

## 分支主题

### 普通主题

普通主题的第二行内容
```

正文区中只有 `#`、`##`、`###` 这类主题级别标记行会创建新主题；普通文本行会并入最近的上一个主题，作为多行主题内容。

主题属性仍然保留，用于覆盖配置区。主题属性只解析主题级别标记行末尾；多行主题的属性仍放在第一行末尾，例如：

```markdown
## 分支主题 [color=#10b981 icon=book layout=mindmap-left]
```

## 术语规则

术语以 `README.zh-CN.md` 中“标准术语”相关表格为准。

重要约定：

- 表格中的 `-` 表示该术语与标准术语含义几乎一致，不重复写。
- yxmm 使用 `#`、`##`、`###` 表达层级，但在插件内部和文档中统一称为“主题级别”，不要再称为 Markdown 标题或 heading。
- “节点”一词已经逐步替换为“主题”。代码中若仍有历史遗留，可以在相关修改时继续清理，但不要新增 node/节点 作为核心术语。
- “根主题”“中心主题”“分支主题”“普通主题”等含义应和 README 保持一致。

术语迁移原则：

- 新功能和新注释使用最新术语。
- 如果修改某块代码，顺手清理同一范围内的旧术语。
- 不为了兼容旧配置保留旧字段名或旧布局名。

## 配置优先级

当前配置优先级：

```text
主题属性 > 代码块配置区 > 插件全局默认配置 > 插件内置默认值
```

全局默认配置保存在 Obsidian 插件 `data.json` 中，由偏好设置界面编辑。

代码块配置区保存在当前 Markdown 文档内，只影响当前 `yxmm` 代码块。

主题属性写在主题文本后方，只影响单个主题。

## 主要配置项

运行时默认配置定义在：

```text
src/config/mindConfig.js
```

核心配置项：

- `basic.canvasHeight`：导图幕布高度。
- `basic.sourceHeight`：源码模式高度，和导图幕布高度分开保存。
- `basic.toolbar.corner` / `basic.toolbar.placement`：悬浮工具栏吸附位置，角落可选四角，位置可选内侧或外侧。
- `basic.viewFit`：打开导图时的视图适配方式，可选 `original`、`fit`，默认 `fit`。
- `basic.tabIndent`：源码模式中是否启用 Tab 调整主题级别，默认开启。
- `basic.wheelZoom`：是否启用鼠标滚轮缩放，默认关闭。
- `view.mode`：当前代码块视图模式，通常为 `map` 或 `source`。
- `theme.scheme`：主题色系。
- `theme.defaultTopicColor`：默认主题颜色。
- `layout.type`：布局类型。
- `layout.connectorStyle`：连线线型，仅思维导图组布局可配置。
- `layout.branchExpansion`：普通主题的子主题展开方式。
- `layout.topicMaxWidth`：主题最大宽度，包含 `global`、`level1`、`level2`、`level3`。
- `font.family` / `font.size` / `font.weight` / `font.lineHeight`：全局主题字体配置。
- `font.level1` / `font.level2` / `font.level3`：按主题级别覆盖字体。

## 布局类型

布局类型放在 `layout.type`：

```yaml
layout:
  type: mindmap-right
```

不要恢复成旧式：

```yaml
layout:
  defaultDirection: right
```

当前布局分组和布局值：

### 思维导图

- `mindmap-right`：右向思维导图，默认布局。
- `mindmap-left`：左向思维导图。
- `mindmap-bidirectional`：双向思维导图。
- `mindmap-up`：上向思维导图。
- `mindmap-down`：下向思维导图。
- `mindmap-vertical`：垂直双向思维导图。

### 树形图

- `tree`：树形图。
- `tree-right`：右向树形图。
- `tree-left`：左向树形图。

### 组织结构图

- `org`：组织结构图。
- `org-right`：右向组织结构图。

### 时间轴

- `timeline`：时间轴。
- `timeline-up`：上侧时间轴。
- `timeline-down`：下侧时间轴。

### 其他结构

- `radial`：放射图。
- `fishbone-left`：左向鱼骨图。
- `fishbone-right`：右向鱼骨图。
- `tree-table`：树形表格。
- `tree-table-stepped`：阶梯树形表格。

## 连线线型规则

`layout.connectorStyle` 可选值：

- `curve`：曲线，技术上是三次贝塞尔曲线。
- `straight`：直线。
- `elbow`：折线，正交折线。

重要约定：

- 只有思维导图组布局允许用户设置连线线型。
- 非思维导图布局为了保持结构语义，配置界面禁止设置线型，UI 上固定显示折线。
- 树形图、组织结构图、时间轴、鱼骨图等布局内部通常有专用的主干、支线或骨架绘制逻辑，不应简单套用 `layout.connectorStyle`。
- 如果以后要给某个非思维导图布局开放线型，需要单独设计该布局的语义和视觉规则。

## 主题和配色规则

主题定义在：

```text
src/theme/mindThemes.js
```

当前内置主题：

- `default`
- `ocean`
- `forest`
- `sunset`
- `mono`
- `rainbow`
- `pastel-rainbow`
- `neon-rainbow`

颜色优先级：

```text
主题属性 color > theme.defaultTopicColor > 主题自动配色
```

已确认规则：

- 中心主题颜色应和分支颜色区分开。
- 主题属性 `color` 只修改当前主题的颜色，不应改变它与父主题之间的连线颜色。
- 彩虹类主题按一级分支自动分配颜色。
- `theme.defaultTopicColor` 会覆盖主题自动配色，但主题属性 `color` 仍然优先。
- 配置区中的十六进制颜色建议加引号，例如 `defaultColor: '#66ed0c'`。

## 字体规则

字体配置支持全局设置和按主题级别覆盖。

结构约定：

```yaml
font:
  family: "'Sarasa Mono SC', monospace"
  size: 14
  weight: 560
  lineHeight: 22
  level1:
    size: 28
    weight: 700
    lineHeight: 38
```

优先级：

```text
主题属性 > font.levelN > 全局 font 配置 > 插件默认值
```

字号、字重、行高有范围限制，范围定义在 `src/config/mindConfig.js`。

配置弹框中字体需要提供预设和自定义输入，字体列表按类型分组。

## 国际化

i18n 文件：

```text
src/i18n/messages.js
```

当前语言：

- `en`
- `zh-CN`
- `zh-TW`
- `ja`
- `ko`
- `fr`
- `de`
- `es`
- `pt-BR`
- `ru`
- `it`
- `id`
- `tr`
- `vi`
- `th`
- `hi`

默认语言：

- 不写死英文。
- 初始默认跟随 Obsidian 当前语言。
- 无法匹配时回退到 `en`。

新增 UI 文案时：

- 至少补 `en`、`zh-CN`、`zh-TW`。
- 其他语言可通过 `createAdditionalLocale()` 的文本对象补主要入口。
- 缺失 key 会回退英文，避免显示 `undefined`。

## 偏好设置

Obsidian 偏好设置入口：

```text
src/ui/YonxaoMindmapSettingTab.js
```

当前职责：

- 在 Obsidian `设置` -> `第三方插件` 中提供插件设置页。
- 设置插件界面语言。
- 编辑全局默认配置。
- 展示全局默认配置摘要。

全局默认配置编辑复用：

```text
src/ui/ConfigModal.js
```

## 可视化配置弹框

配置弹框文件：

```text
src/ui/ConfigModal.js
```

当前 Tab：

- 基础。
- 主题。
- 结构。
- 字体。
- 源码。
- 高级。

设计原则：

- 熟悉配置的人可以直接输入。
- 不熟悉配置的人可以用下拉框或控件选择。
- 高级页允许直接编辑配置文本。
- 布局不是思维导图组时，连线线型控件禁用，固定折线。
- 不要让 UI 写入无意义配置噪音，例如只是切换查看时不应主动写入不生效的配置项。

## 阅读视图和编辑视图规则

Obsidian 阅读视图：

- 应展示导图。
- 应禁用编辑类交互，例如拖动主题、编辑按钮、增加按钮、右键菜单、双击编辑等。
- 可以保留查看类交互，例如折叠展开、缩放、适配视图等，具体以当前实现为准。

Obsidian 编辑视图：

- 可以编辑源码视图。
- 可以在导图中进行主题交互编辑。
- 工具栏应可见、可拖动，并在失焦时按当前规则隐藏或弱化。

源码模式：

- 源码模式和导图模式都应可编辑。
- 源码模式高度和导图幕布高度分开保存。
- 从源码模式切回导图模式时，应重新计算导图所需高度。
- 如果用户手动设置的导图高度大于计算高度，应保留用户高度；只有高度不够时才自动扩展。

## 工具栏规则

工具栏是悬浮工具栏，不应挤压主体内容。

已确认规则：

- 工具栏位置可拖动，松手后吸附到最近的四角内侧或外侧位置。
- 工具栏位置保存到当前实例配置 `toolbar.corner` / `toolbar.placement`。
- 拖动工具栏不应触发视图从源码模式切回导图模式。
- 工具栏透明度有过调整，避免遮挡导图内容。
- 工具栏不要和 Obsidian 自带“编辑这个块”按钮冲突，必要时偏左上放置。

## 主题交互规则

已实现或已确认的方向：

- 左键单击主题不做普通编辑动作。
- 双击主题应直接编辑主题文案，而不是打开属性面板。
- 右键打开上下文菜单。
- 删除主题需要二次确认。
- 支持增加子主题、增加同级主题、删除主题、复制文本、展开折叠等右键操作。
- 阅读视图中禁用编辑类交互。
- 主题可拖动，并支持同级排序。
- 部分布局下主题新增按钮、编辑按钮、折叠按钮位置需要根据布局语义动态计算。

## 布局算法入口

布局计算主要在：

```text
src/layout/layoutTree.js
```

渲染主要在：

```text
src/renderer/YonxaoMindmapRenderer.js
```

解析和序列化：

```text
src/parser/parseMind.js
src/parser/serializeMind.js
```

结构修改：

```text
src/model/topicTreeActions.js
```

Markdown 代码块接入：

```text
src/markdown/codeBlock.js
src/obsidian/embed.js
```

## 主干上色规则

思维导图、树形图、组织结构图、时间轴、鱼骨图等布局都有“共享主干”或“结构主线”的概念。

已确认原则：

- 主干颜色应跟随对应分支颜色分段绘制。
- 不应被最后一个分支颜色覆盖整条主干。
- 共享主干不应简单使用中心主题颜色。
- 时间轴和鱼骨图的主干上色逻辑大致和思维导图、树形图、组织结构图一致，已抽取过公共的分段上色思路。

相关渲染辅助逻辑在 `YonxaoMindmapRenderer.js` 中，例如：

- `renderBranchColoredTrunkFromOrigin`
- `renderBranchColoredTrunkRun`
- `renderSequentialBranchColoredTrunk`
- `renderBranchColoredTrunkSegment`

## 时间轴布局规则

时间轴布局不是普通向右思维导图。

已确认语义：

- 一级主题是中心主题。
- 二级主题沿时间轴展开。
- `timeline-up`：二级主题在轴上，二级主题的子主题在轴上方向右展开。
- `timeline-down`：二级主题在轴下，二级主题的子主题在轴下方向右展开。
- `timeline`：上下平衡轴，二级主题在轴上下交替展开。
- 时间轴主轴不要压在主题文字上。
- 时间轴末尾不要无意义延伸过长。
- 轴颜色按分支分段。

## 鱼骨图规则

当前支持：

- `fishbone-left`：鱼头在左，主骨从左向右延伸。
- `fishbone-right`：鱼头在右，主骨从右向左延伸。

鱼骨图术语和逻辑：

- 一级主题是鱼头。
- 主骨从鱼头延伸到鱼尾。
- 二级主题是大骨或主分支，分布在主骨上下。
- 二级主题的普通子主题沿大骨展开。
- 鱼尾形状类似“小于号”或镜像方向，方向根据鱼头位置动态确定。
- 鱼尾颜色保持中心主题颜色。
- 主骨每一段颜色应对应分支颜色。
- 二级主题的新增按钮曾要求隐藏或取消，折叠按钮应放在子线出口交点。
- 主题按钮位置不能写死，应根据鱼头位置、分支方向、主题所在侧动态确定。
- 折叠按钮永远在子线出口交点。

鱼骨图优化方向：

- 提高空间利用率，避免上下空白过大。
- 优先避免重叠，其次再追求紧凑。
- 大骨和普通子主题交点要对齐到正确几何位置。

## 放射图规则

放射图和左右平衡思维导图不同：

- 放射图从中心主题向多个方向发散。
- 二级主题不必严格按文档顺序顺时针排列。
- 优先级是避免重叠，其次才是空间利用率。
- 可以先计算每个二级分支占用面积，再分配方向。

放射图当前做过动态分配和碰撞处理，但仍可能需要继续优化。

后续优化建议：

- 对每个二级分支估算包围盒。
- 大分支优先放在更开阔、互相距离更远的角度。
- 放置后做碰撞检测和位移。
- 保留用户阅读上的自然性，不要为了极致紧凑导致连线混乱。

## 树形表格规则

当前存在两种表格类布局：

- `tree-table`：树形表格。
- `tree-table-stepped`：阶梯树形表格。

已确认：

- 阶梯树形表格样式可以保留。
- 树形表格是更接近参考图的合并表格样式，没有子主题的父主题应填充空白区域。
- 表格类布局中主题编辑按钮可隐藏，折叠按钮可以保留。

## CSS 架构

CSS 已拆分到 `styles/` 目录，入口为：

```text
styles/index.css
```

构建输出：

```text
dist/styles.css
```

分文件大致含义：

- `10-host.css`：宿主容器。
- `20-toolbar.css`：悬浮工具栏。
- `30-canvas.css`：画布区域。
- `40-source.css`：源码模式。
- `50-map.css`：导图 SVG 和主题样式。
- `60-panels.css`：面板类样式。
- `70-responsive.css`：响应式。
- `80-live-preview.css`：Obsidian Live Preview 相关。
- `90-config-modal.css`：配置弹框。

早期缩进辅助线已经移除，因为当前只保留标题级别结构。

## 源码架构

入口：

```text
src/main.js
```

插件类：

```text
src/plugin/YonxaoMindmapPlugin.js
```

核心渲染器：

```text
src/renderer/YonxaoMindmapRenderer.js
```

注意：

- `YonxaoMindmapRenderer.js` 仍然较长，后续可以继续拆分。
- 但拆分前应先确认职责边界，例如连接线渲染、主题渲染、交互事件、工具栏、源码视图、上下文菜单等。
- 不要为了拆分而引入过度抽象。

## 不要恢复的旧逻辑

以下旧逻辑不要恢复：

- `yxmind` 插件名。
- `mind` 代码块语言名。
- 缩进式导图语法。
- `layout.defaultDirection` 这类旧配置。
- 根目录 `main.js` / `styles.css` 作为主发布方案。
- 为未发布前的实验字段增加兼容层。

## 常见坑

### 1. dist 目录被清理后 `.hotreload` 丢失

运行 `release:prepare` 会清理并重建 `dist/`，可能移除 `.hotreload`。开发时使用：

```bash
npm run ai:validate
```

或：

```bash
npm run dev:obsidian
```

### 2. 配置 UI 和实际渲染逻辑不一致

比如 `layout.connectorStyle` 只有思维导图布局可配置。改 UI 时要确认渲染器实际是否使用该配置。

### 3. README 术语被误改

用户多次手动修订 README 里的术语表。除非明确要求，不要擅自大范围改术语表。需要改代码术语时，以 README 当前表格为准。

### 4. 阅读视图和编辑视图交互混淆

阅读视图应禁用编辑类功能，编辑视图应保留编辑能力。判断 Obsidian 当前视图时要谨慎。

### 5. 布局共享逻辑过度复用

不同布局虽然都叫“连线”或“主干”，但语义不同。抽公共函数时只抽几何或颜色分段等真正一致的部分，不要把布局语义硬合并。

### 6. 自动高度和手动高度冲突

从源码模式切回导图模式时应重新计算高度，但如果用户手动拖出的高度更大，应保留手动高度。

## 新会话接手建议

新会话开始后，建议先阅读：

```bash
sed -n '1,260p' docs/DEVELOPMENT_CONTEXT.zh-CN.md
sed -n '1,260p' README.zh-CN.md
sed -n '1,220p' package.json
```

处理具体需求时再按需阅读相关源码：

- 配置问题：`src/config/mindConfig.js`、`src/ui/ConfigModal.js`、`src/ui/YonxaoMindmapSettingTab.js`。
- 布局问题：`src/layout/layoutTree.js`。
- 渲染问题：`src/renderer/YonxaoMindmapRenderer.js`。
- 解析/保存问题：`src/parser/parseMind.js`、`src/parser/serializeMind.js`、`src/model/topicTreeActions.js`。
- 文案问题：`src/i18n/messages.js`。
- 样式问题：`styles/`。

## 当前开发节奏建议

为了避免新会话再次变慢：

- 小改动只读必要文件。
- 不要每次都全项目搜索，除非涉及命名、术语、配置迁移。
- 修改源码后跑 `npm run ai:validate`。
- 修改文档后至少跑 `npm run format`；若同步发布产物或涉及脚本，再跑 `npm run ai:validate`。
- 真实项目和镜像目录同时存在时，最后确认改动已同步到实际项目目录。
