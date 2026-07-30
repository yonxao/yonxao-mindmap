# @yonxao/mindmap-core

Yonxao Mindmap 的宿主无关 `yxmm` 公共核心。

当前包含：

- YAML 配置前置区和完整 `yxmm` 文档解析、验证与序列化。
- 文档配置字段白名单、路径更新、来源级继承和无效字段裁剪。
- 产品默认值、数值边界、幂等运行时配置规范化和主题级字体/宽度解析。
- 8 种内置主题、分支/层级自动配色、主题与连线颜色优先级。
- 主题级别标记解析和主题树创建。
- 主题纯文本估宽、换行、保存归一化，以及局部样式、链接、列表、任务、公式、代码、图片、备注和附件语义解析。
- 富文本折行、列表编号、代码/公式预估、图片尺寸约束、装饰块统计和完整主题内容盒模型。
- 主题树与主题属性序列化。
- `@structures` 高级结构解析、验证和序列化。
- 主题树查询、复制、移动、遍历和层级刷新。
- 主题剪贴板快照和粘贴数据转换。
- 主题级别/任务源码编辑、折叠集合状态转换、纯文本与缩进大纲导出。
- Markdown `yxmm` 围栏格式化、定位、替换和恢复插入。
- 关联线锚点几何和历史快照容量预算。
- 布局尺寸常量、非对称子树占位、可见性、整体边界和放射碰撞几何。
- 横向、纵向、双向思维导图和放射布局算法。
- 树形图、左右树形图、树形表格和阶梯树形表格布局算法。
- 标准组织结构图和右向组织结构图布局算法。
- 平衡时间轴、上侧时间轴和下侧时间轴布局算法。
- 左向和右向鱼骨图布局算法。
- 19 种布局的统一调度、折叠过滤、连线收集和整体边界计算。
- 可供 TypeScript 使用的公共类型声明。

该包不得依赖 Obsidian、Electron、Node.js 文件系统、DOM、React 或其他宿主 API。宿主设置存储、配置面板选项文案、真实字体/富媒体测量、资源解析、SVG/Canvas 元素创建、样式注入、事件和宿主交互仍由上层应用负责。

## 完整文档

```ts
import { parseMindDocument, serializeMindDocument } from '@yonxao/mindmap-core';

const document = parseMindDocument(`---
structure:
  layout: mindmap-right
---

# Root
## Child`);

if (document.root) {
  const source = serializeMindDocument(document.root, {
    rawConfig: document.rawConfig,
    structures: document.structures,
  });
  console.log(source);
}
```

基础文档 API 的 `rawConfig` 会保留宿主扩展字段。需要遵循 Yonxao Mindmap 产品配置契约时，使用下面的规范化入口。

## 文档配置契约

```ts
import {
  mergeMindConfigSources,
  pruneInactiveMindConfig,
  serializeCanonicalMindSource,
  splitCanonicalMindSourceConfig,
} from '@yonxao/mindmap-core';

const document = splitCanonicalMindSourceConfig(source);
const effective = mergeMindConfigSources(globalConfig, document.rawConfig);
const compact = pruneInactiveMindConfig(document.rawConfig, globalConfig);
const nextSource = serializeCanonicalMindSource(compact, document.body);
```

这些入口统一字段白名单、代码块配置对全局配置的来源级遮蔽，以及布局、连线、适配视图和按钮颜色之间的条件裁剪。

## 运行时配置

```ts
import {
  mergeMindConfigSources,
  normalizeMindConfig,
  resolveTopicFont,
  resolveTopicMaxWidth,
} from '@yonxao/mindmap-core';

const effective = mergeMindConfigSources(globalConfig, document.rawConfig);
const runtime = normalizeMindConfig(effective);
const font = resolveTopicFont(topic, runtime);
const maxWidth = resolveTopicMaxWidth(topic, runtime);
```

核心统一产品默认值、枚举与数值边界，并保证 `normalizeMindConfig()` 对文档配置和已规范化配置均保持幂等。默认字体 `var(--font-text)` 是语义字体令牌：WebView 宿主提供同名 CSS 变量，非 CSS 原生宿主在绘制适配层映射为平台字体。

## 统一布局

布局核心不测量文字、图标和富媒体。宿主先为每个主题生成有限的 `width`、`height`，再调用统一入口：

```ts
import {
  layoutTree,
  parseTopicMind,
  type MeasuredMindTopic,
  type MindTopic,
} from '@yonxao/mindmap-core';

function measureTopic(topic: MindTopic): MeasuredMindTopic {
  return {
    ...topic,
    subtopics: topic.subtopics.map(measureTopic),
    _layout: { x: 0, y: 0, width: 120, height: 48 },
  };
}

const parsedRoot = parseTopicMind(['# Root', '## Child']);
if (parsedRoot) {
  const root = measureTopic(parsedRoot);
  const result = layoutTree(root, new Set(), {
    mode: 'mindmap-right',
    branchExpansion: 'side',
  });
  console.log(result.topics[0].text, result.bounds);
}
```

树形表格模式还需要宿主在 `_layout` 中提供 `lines`、`font` 和 `textY` 文本测量数据。

## 主题内容语义

```ts
import {
  parseTopicRichBlocks,
  parseTopicRichText,
  topicRichTextToPlainText,
  wrapTopicTextByWidth,
} from '@yonxao/mindmap-core';

const segments = parseTopicRichText('**重点** [文档](https://example.com)');
const blocks = parseTopicRichBlocks('- [ ] task\n![cover](cover.png|50%)');
const lines = wrapTopicTextByWidth(topicRichTextToPlainText('**long topic**'), 180, {
  size: 16,
  weight: 600,
});
```

核心统一内容标记的解释、源行索引、图片尺寸提示、确定性文本估宽和富内容盒模型。宿主根据平台能力解析内部链接和附件，并通过 `isImageResolved`、`resolveImageSize` 回调提供图片资源状态和自然尺寸；宿主仍负责真实字体测量、MathJax、SVG、Canvas 或原生文本绘制。

## 视觉主题

```ts
import {
  MIND_THEME_NAMES,
  resolveConnectorColor,
  resolveTopicColor,
  themeTopicFillAlpha,
} from '@yonxao/mindmap-core';

const topicColor = resolveTopicColor(topic, config);
const connectorColor = resolveConnectorColor(topic, config);
const fillAlpha = themeTopicFillAlpha(config);
```

核心统一主题名称与顺序、调色板、中心主题颜色、一级分支/层级选色和颜色覆盖优先级。宿主负责把主题名称映射成本地化文案，并把颜色与透明度写入 CSS、SVG、Canvas 或原生绘制 API。

## SVG 几何

连接线 path、主题控件、高级结构、viewBox 和水印几何由独立的 [`@yonxao/mindmap-svg-renderer`](https://github.com/yonxao/yonxao-mindmap/tree/main/packages/svg-renderer) 提供。该包单向依赖 core；core 不依赖任何渲染包或 UI 框架。

## 编辑与导出

```ts
import {
  adjustTopicLevelSelectionText,
  parseTopicsFromClipboardText,
  plainBodyToIndentedText,
  replaceCodeBlockSource,
  serializePlainBody,
  toggleTopicTaskItemText,
} from '@yonxao/mindmap-core';

const edit = adjustTopicLevelSelectionText(source, selectionStart, selectionEnd, false);
const taskSource = toggleTopicTaskItemText(source, sourceLineIndex);
const pastedTopics = parseTopicsFromClipboardText(clipboardText, {
  includeAttributes: true,
  includeSubtopics: true,
});
const outline = plainBodyToIndentedText(serializePlainBody(root));
const markdown = replaceCodeBlockSource(fileText, 'yxmm', oldSource, nextSource, section);
```

这些函数只处理字符串、主题数据和集合状态。读取系统剪贴板、写文件、维护选择区、显示确认框和派发保存命令仍由宿主负责。

## 构建与发布

```bash
npm run build --workspace @yonxao/mindmap-core
npm run typecheck --workspace @yonxao/mindmap-core
npm pack --dry-run ./packages/core
```

发布包只包含 `dist/`，入口为 ESM `dist/index.js`，类型入口为 `dist/index.d.ts`。`prepack` 会在打包或发布前重新构建，包没有运行时依赖。完整的开源/闭源仓库关系、平台技术栈和产物归属见 [跨端架构与仓库方案](https://github.com/yonxao/yonxao-mindmap/blob/main/docs/CROSS_PLATFORM_ARCHITECTURE.zh-CN.md)。

当前版本为公共 API 稳定前的预发布版本，导出仍可能在 `0.1.0` 正式发布前调整。
