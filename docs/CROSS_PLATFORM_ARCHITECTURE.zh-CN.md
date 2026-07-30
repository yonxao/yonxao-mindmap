# Yonxao Mindmap 跨端架构与仓库方案

本文档是开源插件仓库与闭源产品仓库的长期边界约定。后续 Web、桌面和移动产品按此方案接入，不在各端复制核心算法。

## 1. 总体结论

- `yonxao-mindmap` 保持公开，继续交付 Obsidian 插件，并维护 `@yonxao/mindmap-core` 与 `@yonxao/mindmap-svg-renderer` 两个宿主无关的 TypeScript 包。
- 闭源产品使用独立私有仓库；它消费两个公共包，不复制 `packages/core` 或 `packages/svg-renderer` 源码。
- core 是文档、模型和布局的单一事实源；svg-renderer 是 SVG 与视口几何的单一事实源。
- 各端只实现宿主能力：窗口与生命周期、文件系统、数据库、账户与付费、真实文本/媒体测量、渲染、事件、系统集成和平台发布。
- 桌面端采用 Electron；Web 与 Electron 渲染层复用 TypeScript 前端。iOS/Android 优先使用 Capacitor 包装同一前端，平板使用同一响应式界面。鸿蒙通过独立宿主适配接入公共核心，不能假定 Capacitor 插件可直接复用。

依赖方向必须保持单向：

```text
@yonxao/mindmap-core ← @yonxao/mindmap-svg-renderer
        ↑                         ↑
Obsidian 插件适配层
        ↑
yonxao-mindmap

@yonxao/mindmap-core ← @yonxao/mindmap-svg-renderer
        ↑                         ↑
Web / Electron / Capacitor / HarmonyOS 适配层
        ↑
闭源产品仓库
```

公共仓库不得反向依赖闭源仓库。私有产品能力不得以条件分支、加密文件或未发布子模块的形式放进公共仓库。

## 2. 仓库与分支

### 2.1 开源仓库

仓库：`yonxao/yonxao-mindmap`

职责：

- Obsidian 插件源码、样式、清单、用户文档和发布流程。
- `packages/core` 文档、模型、语义与布局核心。
- `packages/svg-renderer` SVG、控件、结构、视口与水印几何。
- 两个公共包的类型声明、包内测试、边界测试和接入文档。
- 插件对两个公共包的兼容适配，用现有产品行为验证公共契约。

分支：

- `main`：稳定开源主线和插件发布来源。
- `codex/oss-core-prep`：核心抽取期间使用的历史准备分支；其内容已于
  2026-07-30 合入 `main`，不作为产品仓库的长期基线。
- 后续功能分支从 `main` 创建，完成后合回 `main`；不要建立永久的“开源分支”和“闭源分支”。

### 2.2 闭源产品仓库

职责：

- Web App、Electron 桌面端、移动端和鸿蒙宿主。
- 产品 UI、工作区、文件管理、同步、账户、授权、付费和遥测。
- 平台签名、安装包、应用商店配置、自动更新和私有服务协议。
- 仅在私有仓库存在的产品增强，可放入私有扩展包，但必须通过公共接口组合核心，不能修改一份私有 core 副本。

产品仓库通过明确版本依赖两个公共包：

```json
{
  "dependencies": {
    "@yonxao/mindmap-core": "0.1.0-alpha.0",
    "@yonxao/mindmap-svg-renderer": "0.1.0-alpha.0"
  }
}
```

开发期尚未发布 npm 包时，可以使用 Git 提交 SHA 或 npm workspace/link 做本地联调；正式构建必须锁定版本或提交，禁止依赖浮动分支。

## 3. 源码边界

### 3.1 公共核心

`packages/core/src` 当前负责：

- `yxmm` YAML 前置区、主题和高级结构的解析、验证与序列化。
- 文档配置白名单、默认值、继承、运行时规范化和保存裁剪。
- 主题内容语义、确定性估宽/换行和富内容盒模型。
- 主题树增删改移、剪贴板数据、折叠集合、源码级别编辑和任务切换。
- Markdown 围栏定位/替换、纯文本与缩进大纲导出。
- 主题与连线颜色规则。
- 19 种布局及布局所需的纯数据几何。

`packages/svg-renderer/src` 当前负责：

- 连接线锚点、裁剪、拐点和 SVG path。
- 主题边界点和编辑控件语义点。
- 外框、概要和关联结构的路径、边界与避障。
- 画布坐标、适配视图、原始大小和缩放 viewBox。
- 普通水印、平铺水印、角落签名和签名条几何。

两个公共包都不得静态依赖：

- `obsidian`、Electron 或平台 SDK。
- Node.js 文件系统和进程 API。
- DOM、SVG 元素、Canvas 上下文。
- React、React DOM 或其他 UI 框架。

### 3.2 宿主适配层

插件或产品仓库负责：

- 文件打开、保存、监听、冲突处理和持久化。
- 浏览器剪贴板、系统菜单、快捷键、窗口、全屏和拖拽。
- 真实字体、MathJax、图片、附件和图标测量。
- SVG/Canvas/原生控件创建、样式、动画、可访问性和输入事件。
- 本地化文案、权限、功能开关、账户和商业能力。

判断规则：文档、模型和布局规则进入 core；SVG/path/viewBox 等绘制描述进入 svg-renderer；依赖当前窗口、设备、文件、DOM 或平台服务的行为留在宿主。

## 4. 技术栈与复用

建议的闭源产品工作区：

```text
apps/
├── web/                 # React + TypeScript + Vite，浏览器和 PWA
├── desktop/             # Electron 主进程、preload、安全 IPC、安装与更新
├── mobile/              # Capacitor iOS/Android 宿主及平台插件
└── harmony/             # HarmonyOS 宿主和桥接
packages/
├── app-ui/              # Web/Electron/Capacitor 共用界面
├── app-model/           # 产品状态、命令、用例编排
├── renderer-svg/        # core 描述数据到 SVG/DOM 的渲染适配
├── platform-contracts/  # 文件、剪贴板、窗口、分享等能力接口
└── platform-*/          # 各宿主接口实现
```

Electron 主进程只暴露白名单 IPC；文件系统、系统剪贴板和自动更新不直接开放给渲染进程。Web、Electron 和 Capacitor 共用 `app-ui`、`app-model` 与 `renderer-svg`，只替换 `platform-*`。鸿蒙优先复用业务模型和 core，根据实际 WebView/ArkUI 能力选择复用 Web UI 或实现原生界面。

## 5. 编译产物

开源仓库：

```text
packages/core/dist/
├── index.js             # ESM 公共入口
├── index.d.ts           # TypeScript 类型入口
├── *.js                 # 按模块编译的 ESM
├── *.d.ts               # 按模块类型声明
└── *.map                # JS 和声明映射

packages/svg-renderer/dist/
├── index.js             # ESM 公共入口，运行时依赖 core
├── index.d.ts           # TypeScript 类型入口
└── *.js / *.d.ts / *.map

dist/
├── main.js              # Obsidian CommonJS 插件入口，已包含两个公共包
├── styles.css
└── manifest.json
```

两个 `packages/*/dist` 分别是 npm 包内容，不直接复制到 Obsidian 安装目录。根 `dist` 是插件产物，不作为公共包发布。

闭源产品仓库的目标产物：

```text
apps/web/dist/           # 静态 Web/PWA 资源
apps/desktop/release/    # macOS、Windows、Linux 安装包与更新元数据
apps/mobile/ios/         # Xcode 工程和 iOS archive
apps/mobile/android/     # Gradle 工程、AAB/APK
apps/harmony/            # HarmonyOS 工程与 HAP/App Pack
```

这些目录名称可随产品仓库构建工具调整，但产物归属不能混入公共插件仓库。

## 6. 发布顺序

1. 在开源仓库修改对应公共包，并通过包内测试、类型检查、宿主边界测试和插件构建。
2. core 有变更时先发布或锁定 core，再构建并发布相同版本的 svg-renderer。
3. 在私有产品仓库同步升级两个版本，运行 Web、桌面和移动端契约测试。
4. 分别构建、签名和发布各平台产品。
5. 发现跨端规则缺陷时先修公共核心，再升级产品依赖；不要只在某个平台复制修复。

两个公共包当前均为 `0.1.0-alpha.0`，正式稳定公共 API 前允许调整导出，但每次产品仓库升级都必须锁定版本并阅读变更。

## 7. 当前完成状态

- core 与 svg-renderer 两个 TypeScript workspace、分层源码、包内测试、构建入口和类型声明已建立。
- 插件构建会按 core、svg-renderer 的顺序编译，再将二者打进 Obsidian CommonJS 产物。
- 文档、配置、主题树、内容语义、布局、编辑和导出规则已迁入 core；SVG 与视口几何已迁入 svg-renderer。
- 插件对应模块已收缩为宿主适配或兼容出口。
- 自动测试会检查两个包的发布入口、声明文件、依赖方向和宿主导入边界。
- `main` 已包含两个公共包及插件适配，`.github/workflows/check.yml` 会在 PR 和
  `main` 推送时运行完整 `npm run verify`。
- 闭源产品仓库 `yonxao/yonxao-mindmap-product` 已建立，并在
  `codex/platform-foundation` 收口 Web、Electron、Capacitor、HarmonyOS、
  平台能力契约、公共包本地联调入口和产品契约测试。
- 两个公共 alpha 包尚未发布，因此产品仓库的普通独立安装仍受阻；基础 CI
  从本仓库 `main` 检出源码并安装本地打包产物。

下一项公共仓库工作是发布可锁定的 `0.1.0-alpha.0` 公共包。产品仓库完成
`codex/platform-foundation` 验证并合入后，后续跨端功能统一从产品 `main`
创建短期功能分支。
