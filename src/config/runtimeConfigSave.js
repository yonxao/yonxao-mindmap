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
  hasMeaningfulConfig,
  mergeMindConfigObjects,
  mergeMindConfigSources,
  normalizeMindConfig,
  pruneInactiveMindConfig,
  serializeMindSource,
  assignIds,
  parseMindDocument,
  serializeMindDocument,
  DOCUMENT_CONFIG_DEFAULT_PRUNE_PATHS,
} from '../shared/rendererShared.js';

export const runtimeConfigSaveMethods = {
  async saveTreeToSourceAndFile(successMessage) {
    // 导图编辑的保存流程：
    // 1. 当前内存里的 root 已经被修改。
    // 2. serializeMindDocument(root, rawConfig) 把配置区和树重新变成 yxmm 文本。
    // 3. saveSourceToMarkdownFile(nextSource) 只替换当前 Markdown 文件里的这个代码块内容。
    // 4. 更新 textarea，保证源码模式立刻看到导图编辑后的结果。
    assignIds(this.root, '0');
    const nextSource = serializeMindDocument(
      this.root,
      this.documentConfigForSave(this.rawConfig),
      this.hasConfigBlock
    );
    const saved = await this.saveSourceToMarkdownFile(nextSource);
    if (!saved) return false;

    this.source = nextSource;
    this.rawConfig = this.documentConfigForSave(this.rawConfig);
    this.refreshNormalizedConfig();
    this.syncSourceInput();
    this.renderMap(true);
    new Notice(`yonxao-mindmap: ${successMessage || '已保存。'}`);
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
      this.hasConfigBlock
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
      body: serializeMindDocument(this.root, {}, false),
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
    let next = pruneInactiveMindConfig(config || {}, globalDefaultValueConfig);
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
      const defaultValue = this.normalizedDefaultValueForPath(normalizedGlobal, path);
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

    if (this.isPlainConfigObject(font)) {
      for (const levelKey of ['level1', 'level2', 'level3']) {
        if (!this.isPlainConfigObject(font[levelKey])) continue;
        paths.push(
          ['font', levelKey, 'family'],
          ['font', levelKey, 'size'],
          ['font', levelKey, 'weight'],
          ['font', levelKey, 'lineHeight']
        );
      }
    }

    if (this.isPlainConfigObject(topicMaxWidth)) {
      for (const levelKey of ['level1', 'level2', 'level3']) {
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
      return this.doesDeletingConfigPathChangeLevelValues(config, path, normalizedDocument, [
        ['structure', 'topicMaxWidth', 'level1'],
        ['structure', 'topicMaxWidth', 'level2'],
        ['structure', 'topicMaxWidth', 'level3'],
      ]);
    }

    const fontGlobalMatch = key.match(/^font\.(family|size|weight|lineHeight)$/);
    if (fontGlobalMatch) {
      const fontKey = fontGlobalMatch[1];
      return this.doesDeletingConfigPathChangeLevelValues(config, path, normalizedDocument, [
        ['font', 'level1', fontKey],
        ['font', 'level2', fontKey],
        ['font', 'level3', fontKey],
      ]);
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
    const display = this.isPlainConfigObject(config?.display) ? config.display : {};

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
    const display = this.isPlainConfigObject(config?.display) ? config.display : {};
    if (display.fitViewMaxScale === undefined) return false;

    return !this.areConfigValuesEqual(
      normalizedDocument.view?.fitMaxScale,
      normalizedGlobal.view?.fitMaxScale
    );
  },

  hasMeaningfulBranchExpansion(config, normalizedDocument, normalizedGlobal) {
    const structure = this.isPlainConfigObject(config?.structure) ? config.structure : {};
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
      if (this.isPlainConfigObject(levelConfig) && levelConfig[key] !== undefined) {
        return levelConfig[key];
      }
      return config.font?.[key];
    }

    if (path[0] === 'structure' && path[1] === 'topicMaxWidth' && /^level[123]$/.test(path[2])) {
      const level = path[2].replace('level', '');
      const levelConfig = config.topic?.levels?.[level];
      if (this.isPlainConfigObject(levelConfig) && levelConfig.maxWidth !== undefined) {
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

  normalizedDefaultValueForPath(config, path) {
    return this.normalizedConfigValueForPath(config, path);
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

  isPlainConfigObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
