## 新会话接手

先读 `docs/DEVELOPMENT_CONTEXT.zh-CN.md` 的"0. 快速接手摘要"。

## 技术边界

- 使用 npm 和 `package-lock.json`；不要改用 pnpm、yarn 或其他包管理器。
- 源码使用 ESM；不要在 `package.json` 中新增 `"type": "module"`。
- Obsidian 发布入口必须保持 CommonJS，由 `scripts/build-js.mjs` 打包到 `dist/main.js`。
- `obsidian` 是宿主运行时提供的 external 依赖，不要打进 bundle。

## 代码风格

- 图中元素统一称为"主题/topic"，不要新增"节点/node"作为核心术语。
- 核心算法和关键逻辑使用中文注释说明意图。
- 魔法值必须抽成语义常量，并说明作用。

## 文档导航

- 用户文档：`README.md`、`README.zh-CN.md`
- 开发上下文、术语表、代码地图：`docs/DEVELOPMENT_CONTEXT.zh-CN.md`
- 人工回归清单：`docs/REGRESSION_TEST_CHECKLIST.zh-CN.md`
- 人工回归样例：`docs/regression-layout-gallery.zh-CN.md`
- 发布流程：`.github/workflows/release.yml`
- 发布正文模板：`.github/release-body.md`
- 入口文件：`src/main.js`
- 样式入口：`styles/index.css`
- 构建与发布脚本：`scripts/`

## 命令说明

命令以 `package.json` 的 `scripts` 字段为准。

- npm 命令面向开发者任务，只暴露可独立使用的入口；内部辅助脚本不要求一一映射为 npm 命令。
- 命令使用常见任务名，并通过 `:<variant>` 表达同一任务的变体；不要按内部文件或临时实现细节命名。

## 测试与验证

- AI 默认只格式化、检查本次修改的文件，并运行直接相关的测试；JS 使用 `lint:file`，CSS 使用 `lint:css:file`，不要默认运行全量 `verify`。
- JS 改动影响插件入口时运行 `npm run build:js && npm run build:check:js`；只改 CSS 时运行 `npm run build:css && npm run build:check:css`。
- CSS 以 `stylelint-config-standard` 和 `minAppVersion` 对应的现代运行时为准，不为更旧 Electron/WebView 保留弃用回退。
- AI 需要本地调试产物时运行 `npm run dev`；`npm run dev:check` 供人工执行完整质量检查后再准备调试产物。
- 准备提交时运行 `npm run verify`；完整发布流程由 GitHub Actions 运行 `npm run release`。
- 修改布局、渲染、视口、导出、保存或交互后，只列出本次相关的人工回归项。
- 如果无法运行检查，交付时必须说明原因和替代验证方式。

## 脏工作区保护

- 开始修改前记录暂存和未暂存状态；验证范围以本次实际修改为准，不以仓库全部 diff 为准。
- 任务开始前干净的文件可自动格式化；已有暂存或未暂存改动的文件只做格式检查，不做整文件自动格式化。
- 不要擅自执行 `git add`、`git stash`、`git restore`、`git reset` 或其它改变用户改动状态的命令。
- 交付时说明与既有改动重叠的文件，以及本次未执行的检查。

## 禁止修改的内容

- 不要修改 `.github/workflows/`、发布脚本或许可证文件，除非任务明确要求。
- 不要改公共 `yxmm` 语法、配置结构、插件清单字段或发布产物结构，除非任务明确要求。
- 不要把 `.claude/`、`.trae/`、`.kilo/`、`.codex/` 等本地 AI Agent 状态加入版本控制。

## 依赖管理

- 新增生产依赖前必须说明原因、替代方案和影响。
- 依赖变更后必须运行 `npm run verify`；需要本地 Obsidian 调试产物时运行 `npm run dev`。

## 项目特有陷阱

- `npm run release` 会检查源码、清理并重建 `dist/`，可能移除 `dist/.hotreload`。
- `npm run dev` 会构建并检查 JS/CSS 产物，不清理 `dist/`、不生成发布正文，但需要根目录存在 `.hotreload`。
- 阅读视图应禁用编辑类功能，Live Preview / 编辑视图应保留编辑能力。
- Obsidian 内部链接和附件打开前要先解析目标，避免自动创建不存在的文档。
- 全屏逻辑依赖 body 级覆盖层承载 `hostEl`，不要直接对原代码块 DOM 请求全屏。
- 用户验证某个修复无效时，先检查并撤回本轮无价值改动，再重新定位问题。

## AI Agent 工作规则

- 大型架构调整、术语迁移、数据结构变化、布局算法重写必须先给方案。
- 需要创建 Obsidian 插件目录软链接时，使用 `create-obsidian-plugin-link.sh`。

## 维护规则

- 修改本文件后检查：保持短、准、硬，不包含过期或一次性内容。
- 项目架构、命令、依赖策略变化后及时更新本文件。
