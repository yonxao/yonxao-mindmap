/*
 * 文件作用：
 * 运行时配置保存方法集合，负责把界面操作转换为 yxmm 配置区写入。
 *
 * 实现逻辑：
 * 保存前会合并全局默认、文档配置和当前草稿，并裁剪与默认值相同或当前布局不生效的字段。
 *
 * 调用链：
 * YonxaoMindmapRenderer -> runtimeConfigSaveMethods -> mindConfig/configSerialize -> Markdown 文件。
 */

import {
  Notice,
  canonicalizeMindConfig,
  CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS,
  deleteMindConfigPath,
  FONT_LEVEL_FIELD_KEYS,
  FONT_LEVEL_KEYS,
  hasMeaningfulConfig,
  isPlainObject,
  mergeMindConfigObjects,
  mergeMindConfigSources,
  normalizeMindConfig,
  pruneInactiveMindConfig,
  serializeMindSource,
  TOPIC_MAX_WIDTH_LEVEL_KEYS,
  assignIds,
  parseMindDocument,
  serializeMindDocument,
  DOCUMENT_CONFIG_DEFAULT_PRUNE_PATHS,
} from '../shared/rendererShared.js';

export const runtimeConfigSaveMethods = {
  /*
   * 保存当前内存中的主题树到 yxmm 源码和 Markdown 文件。
   *
   * options.render 控制保存成功后是否主动重绘整张导图；
   * options.notice 控制是否显示保存成功提示。
   */
  async saveTreeToSourceAndFile(successMessage, options = {}) {
    // 主题树变更后清理结构中已删除或不再存在的主题引用，避免保存时携带无效结构数据。
    this.cleanupStructuresAfterTopicChange?.();
    /*
     * 部分导图编辑只改变源码语义，不改变布局几何。
     * 例如任务复选框从 [ ] 切换到 [x] 时，主题尺寸和连线都不变；
     * 调用方可以关闭 render/notice，只写回 Markdown 并同步源码缓存，避免可见的整图闪动。
     */
    // shouldRender 为 true 时保持旧行为：保存成功后重新布局并重绘整张导图。
    const shouldRender = options.render !== false;
    // shouldNotify 为 true 时保持旧行为：保存成功后弹出 Obsidian Notice。
    const shouldNotify = options.notice !== false;

    // 导图编辑的保存流程：
    // 1. 当前内存里的 root 已经被修改。
    // 2. serializeMindDocument(root, rawConfig) 把配置区和树重新变成 yxmm 文本。
    // 3. saveSourceToMarkdownFile(nextSource) 只替换当前 Markdown 文件里的这个代码块内容。
    // 4. 更新 textarea，保证源码模式立刻看到导图编辑后的结果。
    assignIds(this.root, '0');
    // 序列化时传入 this.structures，使 `@structures` 块随主题变更一起持久化。
    const nextSource = serializeMindDocument(
      this.root,
      this.documentConfigForSave(this.rawConfig),
      this.hasConfigBlock,
      this.plugin?.getGlobalDefaultValueConfig?.() || {},
      this.structures
    );
    // 只有源码真实变化时才压入撤销栈，避免重复点击失败或无效保存污染历史记录。
    if (nextSource !== this.source) {
      this.pushTopicUndoSnapshot(this.source);
    }

    // 全屏模式下跳过文件保存，避免触发 Obsidian 重渲染导致全屏退出。
    // 用统一判断覆盖物理全屏 pending、覆盖层和窗口全屏，不能只看 isFullscreen/isWindowFullscreen。
    // 仅在内存中更新并重新渲染导图，退出全屏时再统一写入文件。
    // 任务勾选这类轻量保存也要进入这里，否则全屏中写文件会打断全屏体验。
    if (this.isFullscreenViewportActive?.()) {
      this.source = nextSource;
      this.rawConfig = this.documentConfigForSave(this.rawConfig);
      this.refreshNormalizedConfig();
      this.syncSourceInput();
      // 全屏内的轻量编辑可以跳过重绘，但仍要记录待保存源码，退出全屏后统一写回。
      // shouldRender=false 时，调用方必须已经自行完成必要的局部视觉更新。
      if (shouldRender) {
        this.renderMap(true);
      }
      this._pendingFullscreenSave = nextSource;
      this.writeFullscreenDraftSnapshot(nextSource);
      return true;
    }

    const saved = await this.saveSourceToMarkdownFile(nextSource);
    // 保存失败时不更新 this.source，避免内存状态伪装成已经落盘。
    if (!saved) return false;

    this.source = nextSource;
    this.rawConfig = this.documentConfigForSave(this.rawConfig);
    this.refreshNormalizedConfig();
    this.syncSourceInput();
    // shouldRender=false 只用于确认不会改变布局的局部编辑；其它编辑默认仍完整重绘。
    // 对任务勾选而言，局部 SVG 已更新，这里重绘反而会造成可见跳动。
    if (shouldRender) {
      this.renderMap(true);
    }
    // shouldNotify=false 用于高频轻量操作，避免每次勾选任务都弹提示。
    if (shouldNotify) {
      new Notice(`yonxao-mindmap: ${successMessage || '已保存。'}`);
    }
    return true;
  },

  async saveRuntimeConfigToFile() {
    const runtimeDocument = this.buildRuntimeDocumentForSave();
    if (!runtimeDocument) return false;

    if (runtimeDocument.root) {
      this.root = runtimeDocument.root;
    }
    this.rawConfig = this.documentConfigForSave(runtimeDocument.rawConfig);
    this.refreshNormalizedConfig();
    this.hasConfigBlock = hasMeaningfulConfig(this.rawConfig);
    const nextSource = serializeMindSource(
      this.rawConfig,
      runtimeDocument.body,
      this.hasConfigBlock,
      this.plugin?.getGlobalDefaultValueConfig?.() || {}
    );
    const saved = await this.saveSourceToMarkdownFile(nextSource);
    if (!saved) return false;

    this.source = nextSource;
    this.syncSourceInput();
    return true;
  },

  buildRuntimeDocumentForSave() {
    if (this.isSourceMode && this.sourceInputEl) {
      try {
        const document = parseMindDocument(this.composeSourceFromSourceInputs());
        return {
          root: document.root,
          body: document.body,
          rawConfig: this.mergeRuntimeConfig(document.rawConfig || {}, this.rawConfig),
        };
      } catch (error) {
        new Notice(`yonxao-mindmap: 源码解析失败，暂未保存配置：${error.message || String(error)}`);
        return null;
      }
    }

    return {
      root: null,
      body: serializeMindDocument(
        this.root,
        {},
        false,
        this.plugin?.getGlobalDefaultValueConfig?.() || {},
        // 运行时保存时也传入 structures，保证 `@structures` 块在配置变更时不被丢弃。
        this.structures
      ),
      rawConfig: this.documentConfigForSave(this.rawConfig),
    };
  },

  mergeRuntimeConfig(baseConfig, runtimeConfig) {
    const next = mergeMindConfigObjects(
      canonicalizeMindConfig(baseConfig),
      canonicalizeMindConfig(runtimeConfig)
    );
    delete next.view;
    return next;
  },

  documentConfigForSave(config) {
    const globalDefaultValueConfig = this.plugin?.getGlobalDefaultValueConfig?.() || {};
    const configObj = config || {};

    // 开启"保存全部配置项"时不裁剪不活跃配置和默认值配置，保留完整配置区便于分享。
    if (configObj.display?.saveFullConfig) {
      return configObj;
    }

    let next = pruneInactiveMindConfig(configObj, globalDefaultValueConfig);
    next = this.pruneDocumentConfigDefaults(next);
    return next;
  },

  pruneDocumentConfigDefaults(config) {
    const globalDefaultValueConfig = this.plugin?.getGlobalDefaultValueConfig?.() || {};
    const normalizedGlobal = normalizeMindConfig(globalDefaultValueConfig);
    const normalizedDocument = normalizeMindConfig(this.buildEffectiveRawConfig(config));
    let next = config || {};

    for (const path of this.documentConfigDefaultPrunePaths(next)) {
      const currentValue = this.normalizedConfigValueForPath(normalizedDocument, path);
      const defaultValue = this.normalizedConfigValueForPath(normalizedGlobal, path);
      if (this.areConfigValuesEqual(currentValue, defaultValue)) {
        if (this.shouldKeepDefaultConfigPath(next, path, normalizedDocument, normalizedGlobal)) {
          continue;
        }
        next = deleteMindConfigPath(next, path);
      }
    }

    return next;
  },

  documentConfigDefaultPrunePaths(config) {
    const paths = [...DOCUMENT_CONFIG_DEFAULT_PRUNE_PATHS];
    const font = config?.font;
    const topicMaxWidth = config?.structure?.topicMaxWidth;

    if (this.isPlainObject(font)) {
      for (const levelKey of FONT_LEVEL_KEYS) {
        if (!this.isPlainObject(font[levelKey])) continue;
        for (const fieldKey of FONT_LEVEL_FIELD_KEYS) {
          paths.push(['font', levelKey, fieldKey]);
        }
      }
    }

    if (this.isPlainObject(topicMaxWidth)) {
      for (const levelKey of TOPIC_MAX_WIDTH_LEVEL_KEYS) {
        if (topicMaxWidth[levelKey] !== undefined) {
          paths.push(['structure', 'topicMaxWidth', levelKey]);
        }
      }
    }

    return paths;
  },

  shouldKeepDefaultConfigPath(config, path, normalizedDocument, normalizedGlobal) {
    const key = path.join('.');

    if (key === 'display.viewFit') {
      return this.hasMeaningfulFitViewChild(config, normalizedDocument, normalizedGlobal);
    }

    if (key === 'display.fitViewNoUpscale') {
      return this.hasMeaningfulFitViewMaxScale(config, normalizedDocument, normalizedGlobal);
    }

    if (key === 'structure.layout') {
      return this.hasMeaningfulBranchExpansion(config, normalizedDocument, normalizedGlobal);
    }

    if (key === 'structure.connectorStyle') {
      if (!CONNECTOR_STYLE_CONFIGURABLE_LAYOUTS.includes(normalizedDocument.layout)) return false;
      return this.hasMeaningfulBranchExpansion(config, normalizedDocument, normalizedGlobal);
    }

    if (key === 'structure.topicMaxWidth.global') {
      return this.doesDeletingConfigPathChangeLevelValues(
        config,
        path,
        normalizedDocument,
        TOPIC_MAX_WIDTH_LEVEL_KEYS.map((levelKey) => ['structure', 'topicMaxWidth', levelKey])
      );
    }

    const fontGlobalMatch = key.match(/^font\.(family|size|weight|lineHeight)$/);
    if (fontGlobalMatch) {
      const fontKey = fontGlobalMatch[1];
      return this.doesDeletingConfigPathChangeLevelValues(
        config,
        path,
        normalizedDocument,
        FONT_LEVEL_KEYS.map((levelKey) => ['font', levelKey, fontKey])
      );
    }

    return false;
  },

  doesDeletingConfigPathChangeLevelValues(config, path, normalizedDocument, dependentPaths) {
    const configWithoutPath = deleteMindConfigPath(config, path);
    const normalizedWithoutPath = normalizeMindConfig(
      this.buildEffectiveRawConfig(configWithoutPath)
    );

    return dependentPaths.some((dependentPath) => {
      const currentValue = this.normalizedConfigValueForPath(normalizedDocument, dependentPath);
      const valueWithoutPath = this.normalizedConfigValueForPath(
        normalizedWithoutPath,
        dependentPath
      );
      return !this.areConfigValuesEqual(currentValue, valueWithoutPath);
    });
  },

  hasMeaningfulFitViewChild(config, normalizedDocument, normalizedGlobal) {
    const display = this.isPlainObject(config?.display) ? config.display : {};

    if (
      display.fitViewNoUpscale !== undefined &&
      !this.areConfigValuesEqual(
        normalizedDocument.view?.fitNoUpscale,
        normalizedGlobal.view?.fitNoUpscale
      )
    ) {
      return true;
    }

    return this.hasMeaningfulFitViewMaxScale(config, normalizedDocument, normalizedGlobal);
  },

  hasMeaningfulFitViewMaxScale(config, normalizedDocument, normalizedGlobal) {
    const display = this.isPlainObject(config?.display) ? config.display : {};
    if (display.fitViewMaxScale === undefined) return false;

    return !this.areConfigValuesEqual(
      normalizedDocument.view?.fitMaxScale,
      normalizedGlobal.view?.fitMaxScale
    );
  },

  hasMeaningfulBranchExpansion(config, normalizedDocument, normalizedGlobal) {
    const structure = this.isPlainObject(config?.structure) ? config.structure : {};
    if (structure.branchExpansion === undefined) return false;

    return !this.areConfigValuesEqual(
      normalizedDocument.branch?.expansion,
      normalizedGlobal.branch?.expansion
    );
  },

  normalizedConfigValueForPath(config, path) {
    if (path[0] === 'font' && /^level[123]$/.test(path[1]) && path.length === 3) {
      const level = path[1].replace('level', '');
      const key = path[2];
      const levelConfig = config.font?.levels?.[level];
      if (this.isPlainObject(levelConfig) && levelConfig[key] !== undefined) {
        return levelConfig[key];
      }
      return config.font?.[key];
    }

    if (path[0] === 'structure' && path[1] === 'topicMaxWidth' && /^level[123]$/.test(path[2])) {
      const level = path[2].replace('level', '');
      const levelConfig = config.topic?.levels?.[level];
      if (this.isPlainObject(levelConfig) && levelConfig.maxWidth !== undefined) {
        return levelConfig.maxWidth;
      }
      return config.topic?.maxWidth;
    }

    const normalizedPathMap = {
      'display.canvasHeight': ['canvas', 'height'],
      'display.sourceHeight': ['source', 'height'],
      'display.viewFit': ['view', 'fit'],
      'display.fitViewNoUpscale': ['view', 'fitNoUpscale'],
      'display.fitViewMaxScale': ['view', 'fitMaxScale'],
      'structure.layout': ['layout'],
      'structure.connectorStyle': ['connector', 'style'],
      'structure.branchExpansion': ['branch', 'expansion'],
      'structure.topicMaxWidth.global': ['topic', 'maxWidth'],
      'color.scheme': ['theme'],
      'color.defaultTopicColor': ['topic', 'defaultColor'],
      'color.buttonColorMode': ['button', 'colorMode'],
      'color.buttonColor': ['button', 'color'],
      // advancedStructure 颜色路径映射到运行时 advancedStructureColor 子字段。
      'color.advancedStructure.relation': ['advancedStructureColor', 'relation'],
      'color.advancedStructure.summary': ['advancedStructureColor', 'summary'],
      'color.advancedStructure.boundary': ['advancedStructureColor', 'boundary'],
      'interaction.topicControlVisibility': ['button', 'topicControlVisibility'],
      'interaction.tabIndent': ['source', 'enableTabIndent'],
      'interaction.toolbar.corner': ['toolbar', 'corner'],
      'interaction.toolbar.placement': ['toolbar', 'placement'],
      'interaction.wheelZoom': ['interaction', 'wheelZoom'],
    };
    const mappedPath = normalizedPathMap[path.join('.')];
    if (mappedPath) return this.configValueAtPath(config, mappedPath);

    return this.configValueAtPath(config, path);
  },

  configValueAtPath(config, path) {
    let current = config;
    for (const key of path) {
      if (!current || typeof current !== 'object') return undefined;
      current = current[key];
    }
    return current;
  },

  areConfigValuesEqual(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  },

  isPlainObject(value) {
    return isPlainObject(value);
  },

  buildEffectiveRawConfig(documentConfig = this.rawConfig) {
    const globalDefaultValueConfig = this.plugin?.getGlobalDefaultValueConfig?.() || {};
    return mergeMindConfigSources(
      canonicalizeMindConfig(globalDefaultValueConfig),
      canonicalizeMindConfig(documentConfig || {})
    );
  },

  refreshNormalizedConfig() {
    this.config = normalizeMindConfig(this.buildEffectiveRawConfig(this.rawConfig));
  },

  applyGlobalDefaultValueConfig() {
    this.refreshNormalizedConfig();
    this.applyRuntimeConfigToView();

    if (this.isSourceMode) {
      this.scheduleSourceModeHeight();
      return;
    }

    this.renderMap(true);
  },
};
