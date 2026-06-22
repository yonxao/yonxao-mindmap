# yonxao-mindmap 项目分析与重构方案

> 基于 `f3b446e` (2026-06-22) 分支 `main` 的分析

---

## 一、项目整体分析报告

### 1.1 项目概况

`yonxao-mindmap` 是一个 Obsidian 插件，基于标题标记语法（`#`/`##`/`###`）将 ````yxmm` 代码块渲染为可交互的思维导图。

| 维度          | 数值                                                                                |
| ------------- | ----------------------------------------------------------------------------------- |
| JS 源文件数   | **28**                                                                              |
| 总 JS 代码量  | **~18,000 行**                                                                      |
| CSS 源文件数  | 10（分层导入）                                                                      |
| 总 CSS 代码量 | ~2,100 行                                                                           |
| 支持布局类型  | **19 种**（思维导图 6 + 树形 3 + 组织图 2 + 时间轴 3 + 放射 1 + 鱼骨 2 + 表格树 2） |
| 支持主题      | **8 种**（含默认/海洋/森林/日落/灰阶/彩虹/柔和彩虹/霓虹彩虹）                       |
| 支持语言      | **17 种**                                                                           |
| 构建工具      | esbuild + 自定义脚本                                                                |
| 内置图标      | **29 个** SVG path 图标                                                             |
| 代码规范      | ESLint + Prettier                                                                   |
| 测试          | **无**                                                                              |

### 1.2 文件大小分布（Top 10）

```
排名   行数    文件                              占比
 1    8,192   src/renderer/YonxaoMindmapRenderer.js   45.5%
 2    2,076   src/i18n/messages.js                    11.5%
 3    1,669   src/ui/ConfigModal.js                    9.3%
 4    1,027   src/config/mindConfig.js                 5.7%
 5    2,821   src/layout/layoutTree.js                  —
 6      269   src/utils/text.js                         —
 7      235   src/parser/parseMind.js                   —
 8      232   src/config/defaultMindConfig.js            —
 9      221   src/theme/mindThemes.js                    —
10      214   src/model/topicTreeActions.js              —
```

> `layoutTree.js` (2,821 行) 和 `text.js` (269 行) 因含大量布局算法不可直接比较，单列。

### 1.3 架构图（当前）

````
main.js
  └─> YonxaoMindmapPlugin (201 行)
        ├─> 注册 ```yxmm 代码块处理器
        ├─> YonxaoMindmapSettingTab (设置页)
        └─> YonxaoMindmapRenderer (8,192 行)  ★★★ 核心问题 ★★★
              ├─> parseMind              — 解析源码为树
              ├─> serializeMind          — 树序列化为源码
              ├─> layoutTree             — 计算坐标
              ├─> renderTopic/connector  — SVG 绘制
              ├─> ConfigModal            — 配置弹框
              ├─> topicTreeActions       — 树操作
              ├─> mindConfig             — 配置归一化
              ├─> mindThemes             — 主题配色
              └─> codeBlock              — Markdown 文件读写
````

### 1.4 核心问题

#### 🔴 严重：YonxaoMindmapRenderer 高达 8,192 行

这是整个项目最严重的问题。一个文件承载了**全部职责**：

- 构造函数：~70 个 `this.*` 属性声明
- DOM 创建：toolbar / SVG canvas / source view / topic editor / resize handle / topic editor panel
- 渲染绘制：`renderMap()` / `renderTopic()` / `renderConnector()` / `renderTopicButtons()`
- 布局重算：`scheduleFitView()` / `applyTreeToSvg()` / `computeBounds()`
- 用户交互：点击/拖拽/缩放/全屏/滚轮/上下文菜单
- 编辑功能：主题编辑面板 / 行内编辑 / 源码编辑 / Tab 缩进
- 文件读写：`saveSourceToMarkdownFile()` / `saveTreeToSourceAndFile()`
- 图片导出：`exportPng()` / `copyPngToClipboard()`
- 会话管理：`readSessionViewMode()` / `writeSessionViewMode()`
- 状态管理：折叠/展开 / 拖拽状态 / 高度拖拽 / 工具栏拖拽

**后果**：

- 任何修改都可能影响其他功能（高耦合）
- 新增功能时需要阅读 8,000 行才能定位修改点
- 无法单独测试某个功能
- 构造函数中 ~70 个属性的初始化缺乏语义分组
- 方法之间通过 `this.*` 紧密耦合，提取困难

#### 🟠 高：mindConfig.js 1,027 行，职责过杂

这个文件承载了**三件不同的事**：

1. **配置归一化**：`normalizeMindConfig()` / `normalizeTopicConfig()` / `normalizeFontConfig()` / `normalizeButtonConfig()`
2. **YAML 解析/序列化**：`parseSimpleYaml()` / `stringifySimpleYaml()` — 一个完整的 Mini YAML 引擎
3. **配置对象工具**：`deepMergePlainObjects()` / `clonePlainObject()` / `setMindConfigPath()` / `deleteMindConfigPath()`

另有大量私有函数（超过 20 个 `function` 声明）和 `isPlainObject()` / `normalizeText()` / `normalizeOptionalNumber()` 等通用工具混在其中。

#### 🟠 高：ConfigModal.js 1,669 行

横跨 **6 个配置标签页**（基础/主题/布局/字体/源码/高级），每个标签页的渲染逻辑全部内联在同一个类方法中。涉及大量 DOM 创建和表单交互。

#### 🟡 中：i18n/messages.js 2,076 行，全量加载

支持 17 种语言，每种语言包含约 130 个 key。运行时虽然只读取一种语言，但**所有语言数据都会包含在打包结果中**（`esbuild` 无法 tree-shake 对象分支）。

#### 🟡 中：fontOptions.js — 已知重复

`FONT_FAMILY_GROUPS`（中文标签）和 `getLocalizedFontFamilyGroups`（翻译标签）包含相同的字体数据，可以通过 `label → i18n key` 映射消除重复。

#### 🟡 中：no tests

整个项目没有任何测试文件（单元测试、集成测试或快照测试）。配置归一化、解析/序列化、布局算法这些纯函数模块非常适合测试。

### 1.5 架构亮点（正面）

尽管有上述问题，项目的设计质量整体很高：

- ✅ **源码目录结构清晰**：按职责分子目录（config / parser / layout / renderer / theme / ui / icons / utils 等）
- ✅ **类型注释完整**：每个文件头部有作用/设计思路/调用链说明
- ✅ **设计决策有记录**：关键 trade-off（如不注册 CodeMirror 扩展、不完整 YAML 解析）写有注释
- ✅ **常量集中管理**：`constants.js` + `defaultMindConfig.js` 双重常量定义
- ✅ **纯函数和副作用分离**：parseMind / layoutTree / serializeMind 是纯函数，renderer 负责副作用
- ✅ **API 边界清晰**：Obsidian 插件 API、Markdown 文件读写的衔接都有专门模块

---

## 二、重构方案

### 2.1 总体原则

1. **不引入新依赖**：保持零运行时依赖
2. **不改变外部 API**：重构后插件功能对所有用户透明
3. **纯函数优先提取**：先拆可独立测试的模块，再拆有状态的交互模块
4. **分阶段进行**：每个阶段产出可运行的版本，避免长期分支
5. **重构前先加测试**：对纯函数模块加测试锁定行为

### 2.2 阶段规划

| 阶段        | 目标                          | 预估变动文件           | 风险      |
| ----------- | ----------------------------- | ---------------------- | --------- |
| **Phase 1** | 基础设施（测试 + 纯函数提取） | ~10 个文件             | ⭐ 极低   |
| **Phase 2** | 拆 Renderer（4-6 个子模块）   | ~8 个新文件 + Renderer | ⭐⭐⭐ 中 |
| **Phase 3** | 拆 ConfigModal                | ~2-3 个新文件          | ⭐⭐ 低   |
| **Phase 4** | 拆分 mindConfig.js            | ~3 个新文件            | ⭐ 极低   |
| **Phase 5** | i18n 优化 + fontOptions 去重  | ~2 个文件              | ⭐ 极低   |
| **Phase 6** | 清理 & 收尾                   | ~5 个文件              | ⭐ 极低   |

---

### Phase 1 — 基础设施（1-2 天）

#### 1.1 搭建测试环境

**目标**：为纯函数模块建立测试基础设施，锁定行为后重构。

**操作**：

1. 安装 `mocha` + `chai`（零框架依赖，与 Obsidian 无冲突）：

```bash
npm install --save-dev mocha chai
```

2. 创建 `test/` 目录，加 `test/.mocharc.json`：

```json
{ "spec": "test/**/*.test.js" }
```

3. 在 `package.json` 中添加 `"test": "mocha"`

4. 注：Obsidian 插件的 `import` 语法与 Node.js 不完全兼容，在 `package.json` 中添加 `"type": "module"`（需确认 esbuild 构建不受影响），或在 `mocha` 配置中使用 `--experimental-modules`。备选方案：使用 `esbuild` 打包测试文件后再运行。

**推荐方案**：定义纯函数模块暴露干净的接口，测试文件通过独立 `import` 测试；`import` 兼容性问题可通过 `mocha --loader=esmock` 或简单的外部打包脚本解决。

#### 1.2 优先测试的模块（按重要性排序）

```
1.  config/mindConfig.js  — normalizeMindConfig / canonicalizeMindConfig / mergeMindConfigObjects
2.  parser/parseMind.js   — parseMindDocument / parseTopicMind / assignIds
3.  parser/serializeMind.js  — serializeMind / serializeTopicAttributes
4.  layout/layoutTree.js     — (核心算法，测试最困难，可选)
5.  utils/color.js           — normalizeColor / transparentColor
6.  utils/text.js            — wrapTopicText / estimateTopicTextWidth
7.  utils/math.js            — clamp
```

---

### Phase 2 — 拆分 Renderer（3-5 天）

这是**最关键也最有挑战**的阶段。关键在于找到合理的切面。

#### 2.1 当前 Renderer 的内部职责分布

```
renderer.js 8,192 行
├─ 构造函数 (292 行)          — ~70 个属性初始化
├─ 生命周期 (34 行)            — onunload / cleanup
├─ mount (44 行)               — 首次挂载入口
├─ DOM 创建 (≈800 行)         — createToolbar / createSvg / createSourceView / createTopicEditor / createHeightResizeHandle / createInlineTextEditor
├─ 渲染 (≈1,200 行)           — renderMap / renderTopic / renderConnector / renderTopicButtons / renderArc
├─ 布局适配 (≈400 行)         — scheduleFitView / applyTreeToSvg / fitToBounds / computeZoom
├─ 源码编辑 (≈1,200 行)       — saveFromSourceView / saveSourceToMarkdownFile / sourceConfig编辑 等
├─ 主题编辑 (≈1,000 行)       — openTopicEditor / saveTopicEditor / renderColorSwatches / 等
├─ 拖拽 (≈1,000 行)           — topicDrag / tree / placement / indicator
├─ 交互 (≈800 行)             — 滚轮缩放 / 平移/ 全屏 / 点击 / 上下文菜单
├─ 高度拖拽 (≈200 行)
├─ 工具栏拖拽 (≈300 行)
├─ 图片导出 (≈200 行)
├─ 会话管理 (≈100 行)
├─ 折叠展开 (≈200 行)
└─ 其他工具 (≈200 行)
```

#### 2.2 推荐的拆分方案

方案：**按 DOM 区域 + 交互类型拆分**，而不是按方法相似性拆分。

```
src/renderer/
├── YonxaoMindmapRenderer.js     — 主类（缩小到 ≈1,500 行）
│   ├─ 构造函数（保留核心状态）
│   ├─ mount() / onunload()
│   ├─ 渲染入口: renderMap() / applyTreeToSvg()
│   ├─ 协调子模块
│   └─ 配置管理
│
├── createToolbar.js              — 工具栏创建 + 拖拽 + 位置更新
├── createCanvas.js               — SVG 幕布 + 容器 ResizeObserver
├── createSourceView.js           — 源码视图（tab + 编辑器 + 高度拖拽）
├── createTopicEditor.js          — 主题编辑面板（浮层 + 色板 + 字体选择）
├── createInlineEditor.js         — 行内文本编辑
│
├── dragTopic.js                  — 主题拖拽（检测、放置、指示器）
├── interactions.js               — 平移/缩放/全屏/折叠展开
├── contextMenus.js               — 右键菜单
├── imageExport.js                — 导出 PNG / 复制到剪贴板
│
├── viewModeManager.js            — 源码/导图模式切换 + 会话记忆
└── stateMemory.js                — 折叠状态、视图模式的会话级 Map
```

**关键迁移策略**：

以 `createToolbar.js` 为例：

```javascript
// createToolbar.js
export function createToolbarElements(renderer) {
  // 创建 DOM 元素，保存在 renderer 上
  // 绑定事件到 renderer 的方法
}

export function updateToolbarPosition(renderer) {
  // 读取 renderer.config.toolbar.corner 和 placement
  // 更新 renderer.toolbarEl 的 CSS
}
```

Renderer 类调用的方式：

```javascript
import { createToolbarElements, updateToolbarPosition } from './createToolbar.js';

class YonxaoMindmapRenderer extends Component {
  createToolbar() {
    createToolbarElements(this);
  }
  scheduleApplyToolbarPosition() {
    updateToolbarPosition(this);
  }
}
```

这种 **mixin-by-importer** 模式不需要动 `extends Component`，改造风险最低。

#### 2.3 难点与应对

| 难点                                                 | 影响范围                 | 应对                                                                    |
| ---------------------------------------------------- | ------------------------ | ----------------------------------------------------------------------- |
| `this.*` 跨方法引用                                  | 全部方法                 | 先提取免 `this` 的纯函数逻辑，再提取读 `this` 的模块，最后拆分 DOM 创建 |
| `requestAnimationFrame`/`requestAnimationFrame` 回调 | scheduleFitView 等       | 回调函数可直接保留在主类，只提取渲染计算部分                            |
| 拖拽状态机（7 个拖拽状态）                           | mouseDown/move/up 三件套 | 可先提取纯计算（坐标、碰撞检测），事件绑定暂时留主类                    |

---

### Phase 3 — 拆分 ConfigModal（2-3 天）

#### 3.1 目标

把 6 个标签页的渲染逻辑从 `ConfigModal.js` 中分离出来。

#### 3.2 方案

```
src/ui/
├── ConfigModal.js           — 主容器（≈500 行）
│   ├─ 继承 Modal
│   ├─ 创建 tab 切换头
│   └─ 协调子渲染函数
│
├── renderBasicTab.js        — 基础设置标签页
├── renderThemeTab.js        — 主题设置标签页
├── renderLayoutTab.js       — 布局设置标签页
├── renderFontTab.js         — 字体设置标签页
├── renderSourceTab.js       — 源码设置标签页
├── renderAdvancedTab.js     — 高级 YAML 编辑标签页
│
└── modalHelpers.js          — 共用 UI 工具（创建 select / input / label）
```

#### 3.3 策略

每个标签页函数接收相同的参数签名：

```javascript
export function renderBasicTab(modal, containerEl, draft, updateDraft) {
  // modal — ConfigModal 实例（可调 modal.t()）
  // containerEl — 当前标签页的容器
  // draft — 草稿配置
  // updateDraft — 更新草稿的回调
}
```

这样每个标签页是独立的函数，新增/修改标签页不涉及其他文件。

---

### Phase 4 — 拆分 mindConfig.js（1 天）

#### 4.1 当前问题

`mindConfig.js` 包含三类完全不同的逻辑：

1. **配置归一化** — `normalizeMindConfig` / `normalizeTopicConfig` / `normalizeFontConfig` 等
2. **YAML 解析/序列化** — `parseSimpleYaml` / `stringifySimpleYaml` / `stripYamlComment` 等
3. **配置对象工具** — `deepMergePlainObjects` / `clonePlainObject` / `setMindConfigPath` 等

#### 4.2 拆分方案

```
src/config/
├── mindConfig.js            — 只保留 normalize / canonicalize / merge / prune
│                              (≈500 行，减半)
├── yamlUtils.js             — parseSimpleYaml / stringifySimpleYaml / stripYamlComment
│                              (≈250 行，新增)
└── configHelpers.js          — isPlainObject / clonePlainObject / deepMergePlainObjects
│                              (≈80 行，新增)
                              — setMindConfigPath / deleteMindConfigPath / setConfigValueIfPresent
│                              (≈120 行，新增)
```

注意：`configDraft.js` 中的 `cloneConfig / getConfigValue / setConfigValue / deleteConfigValue` 与 `mindConfig.js` 中的 `clonePlainObject / deepMergePlainObjects / setMindConfigPath / deleteMindConfigPath` 功能高度重叠。合并后统一为：

```
src/config/
├── configAccessors.js       — setPath / deletePath / getPath / clone / merge 等
```

---

### Phase 5 — i18n 优化 + fontOptions 去重（1 天）

#### 5.1 i18n 消息文件

**问题**：17 种语言全部打包，但运行时只使用 1 种。

**可选方案 A**（推荐）：在 `build-js.mjs` 构建脚本中按 `settings.language` 或 `navigator.language` 在构建时做代码替换。但由于插件是通用的，最佳方案是**接受这个开销**。17 × 130 key 的字符串数据约 100KB，gzip 后仅 ~20KB，对于 Obsidian 插件是可以接受的。

**可选方案 B**（低优先级）：将 `messages.js` 拆为每个语言独立文件，构建时只加载用户浏览器语言对应的文件。但会增加构建复杂度。

**推荐**：保持现状，`messages.js` 不是当前性能瓶颈。未来如需优化，可以添加构建时按需摘取语言的步骤。

#### 5.2 fontOptions 去重

**已知问题**：`FONT_FAMILY_GROUPS`（中文 label）和 `getLocalizedFontFamilyGroups`（翻译 key）包含相同数据。

**方案**：

```javascript
// 只保留 FONT_FAMILY_GROUPS，label 字段存 i18n key
export const FONT_FAMILY_GROUPS = Object.freeze([
  {
    group: 'font.group.inherit',
    options: Object.freeze([
      ['', 'font.inherit'], // [value, i18n_key]
      [CUSTOM_FONT_VALUE, 'font.custom'],
    ]),
  },
  // ... 其余组保持相同模式
]);

// getLocalizedFontFamilyGroups 改为纯翻译
export function getLocalizedFontFamilyGroups(t, options = {}) {
  return FONT_FAMILY_GROUPS.map((group) => ({
    group: t(group.group),
    options: group.options.map(([value, labelKey]) => [value, t(labelKey)]),
  }));
}
```

当前 `getLocalizedFontFamilyGroups` 其实已经这样做了（回顾代码第108-127行），它从 `FONT_FAMILY_GROUPS` 读取 labelKey 然后调用 `t()` 翻译。所以这个去重已经**部分完成**。但 `FONT_FAMILY_GROUPS` 的 `group` 和 `options[i][1]` 都是 i18n key——如果迁移老代码时遗留了中文字段，需要确保所有 label 都是 key 而非硬编码中文。

---

### Phase 6 — 清理 & 收尾（1 天）

1. **删除 dead code**：扫描未使用的 export/import，删除冗余注释（如已过时的 TODO 记录）
2. **统一命名风格**：文件命名统一 `camelCase.js`；检查 `snake_case` / 中英文混写
3. **改版后验证**：`npm run validate` 全绿
4. **更新 README 中的架构图**

---

## 三、总结

### 按优先级排序的操作清单

| 优先级 | 操作                                  | 预估工作量 | 收益                           |
| ------ | ------------------------------------- | ---------- | ------------------------------ |
| P0     | 加测试（Phase 1）                     | 1 天       | 测试覆盖保障后续所有重构       |
| P1     | 拆分 YonxaoMindmapRenderer（Phase 2） | 3-5 天     | 8,192→1,500 行，核心问题解决   |
| P2     | 拆分 ConfigModal（Phase 3）           | 2-3 天     | 1,669→500 行，新增标签页更简单 |
| P3     | 拆分 mindConfig.js（Phase 4）         | 1 天       | 1,027→500 行，职责清晰         |
| P4     | fontOptions 去重（Phase 5）           | 0.5 天     | 消除已知重复                   |
| P5     | 清理 & 收尾（Phase 6）                | 1 天       | 代码风格统一                   |

### 最终目标状态

```
src/                        ~18,000行 → ~20,000行（更多文件，单文件更小）
├── config/                 ~1,400行 → ~1,200行（拆分后更清晰）
├── renderer/               ~8,500行 → ~4,500行（主类 ~1,500 + 7个子模块）
├── ui/                     ~1,950行 → ~1,500行（主类 ~500 + 7个子模块）
├── parser/                 不变
├── layout/                 不变
├── theme/                  不变
├── icons/                  不变
├── utils/                  不变
├── model/                  不变
├── i18n/                   不变
├── markdown/               不变
├── source/                 不变
├── obsidian/               不变
└── test/                   新增 ~5-10 个文件
```

**核心指标变化**：

- 最大单文件：8,192 行 → ~1,500 行（-82%）
- 第二大单文件：2,076 行 → 不变（i18n 可接受）
- 第三大单文件：1,669 行 → ~500 行（-70%）
- 测试覆盖率：0% → 关键纯函数模块覆盖
