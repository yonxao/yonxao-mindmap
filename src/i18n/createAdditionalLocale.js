/*
 * 文件作用：
 * 为新增语种生成当前主要界面使用的文案。
 *
 * 说明：
 * 这批语言先覆盖设置页、配置面板、工具栏、主题编辑和右键菜单等主要入口。
 * 未覆盖的长说明会继续回退到英文，避免出现 undefined。
 */

export function createAdditionalLocale(text) {
  return {
    'settings.description': text.settingsDescription,
    'settings.language.name': text.language,
    'settings.language.desc': text.languageDesc,
    'settings.globalDefaultValueConfigPanel.name': text.globalDefaultValueConfigPanel,
    'settings.globalDefaultValueConfigPanel.desc': text.globalDefaultDesc,
    'settings.globalDefaultValueConfigPanel.edit': text.editDefaults,
    'settings.globalDefaultValueConfigPanel.reset': text.resetDefaults,
    'settings.globalDefaultValueConfigPanel.empty': text.noDefaults,
    'settings.globalDefaultValueConfigPanel.summaryTitle': text.summaryTitle,
    'settings.summary.theme': text.theme,
    'settings.summary.layout': text.layout,
    'settings.summary.connector': text.connector,
    'settings.summary.branchExpansion': text.branchExpansion || 'Subtopic expansion',
    'settings.summary.branchExpansion.elbowOnly':
      text.branchExpansionElbowOnly || 'Only available with elbow lines',
    'settings.summary.branchExpansion.unsupported':
      text.branchExpansionUnsupported || 'Not supported by this layout',
    'settings.summary.wheelZoom': text.wheelZoom,
    'settings.summary.enabled': text.enabled,
    'settings.summary.disabled': text.disabled,
    'settings.summary.fontFamily': text.topicFont,
    'settings.summary.fontSize': text.topicFontSize,
    'toolbar.showSource': text.showSource,
    'toolbar.showMap': text.showMap,
    'toolbar.config': text.config,
    'toolbar.fitView': text.fitView,
    'toolbar.originalSize': text.originalSize || 'Original size',
    'toolbar.enterFullscreen': text.fullscreen || 'Fullscreen',
    'toolbar.exitFullscreen': text.exitFullscreen || 'Exit fullscreen',
    'toolbar.zoomIn': text.zoomIn,
    'toolbar.zoomOut': text.zoomOut,
    'toolbar.resetCollapse': text.resetCollapse,
    'toolbar.dragHandle': text.dragToolbar,
    'source.tab.config': text.configSection || 'Config',
    'source.tab.body': text.bodySection || 'Body',
    'notice.bodyCopied': text.bodyCopied || 'yonxao-mindmap: Body copied.',
    'notice.sourceCopied': text.sourceCopied || 'yonxao-mindmap: Source copied.',
    'notice.configCopied': text.configCopied || 'yonxao-mindmap: Config copied.',
    'notice.imageExported': text.imageExported || 'yonxao-mindmap: Image exported.',
    'notice.imageCopied': text.imageCopied || 'yonxao-mindmap: Image copied.',
    'notice.imageClipboardUnsupported':
      text.imageClipboardUnsupported ||
      'yonxao-mindmap: This environment does not support copying images to clipboard.',
    'notice.imageClipboardFocusRequired':
      text.imageClipboardFocusRequired ||
      'yonxao-mindmap: Please click the mind map first, then copy the image again.',
    'configModal.title': text.configPanel || text.config,
    'configModal.globalDefaultValueTitle': text.globalDefaultValueConfigPanel,
    'configModal.info.label': text.configRules || 'Config rules',
    'configModal.info.tooltip':
      text.configRulesTooltip ||
      'Config priority:\nTopic attributes > Code block config > Plugin global default value config > Plugin built-in defaults\n\nColor priority:\nTopic attribute color > Default topic color > Theme scheme\n\nSave cleanup logic:\nWhen a config value is the same as the effective default value from the plugin global default value config or plugin built-in defaults, it is removed to keep the config concise.',
    'configModal.tabs.basic': text.basic,
    'configModal.tabs.theme': text.theme,
    'configModal.tabs.layout': text.layout,
    'configModal.tabs.font': text.font,
    'configModal.tabs.source': text.source,
    'configModal.tabs.advanced': text.advanced,
    'configModal.actions.apply': text.apply,
    'configModal.actions.saveAndClose': text.saveAndClose,
    'configModal.actions.cancel': text.cancel,
    'configModal.actions.close': text.close || text.cancel || 'Close',
    'configModal.basic.canvasHeight': text.mapHeight,
    'configModal.basic.sourceHeight': text.sourceHeight,
    'configModal.basic.toolbarCorner': text.toolbarCorner || 'Toolbar corner',
    'configModal.basic.toolbarPlacement': text.toolbarPlacement || 'Toolbar placement',
    'configModal.toolbarCorner.topLeft': text.toolbarTopLeft || 'Top left',
    'configModal.toolbarCorner.topRight': text.toolbarTopRight || 'Top right',
    'configModal.toolbarCorner.bottomLeft': text.toolbarBottomLeft || 'Bottom left',
    'configModal.toolbarCorner.bottomRight': text.toolbarBottomRight || 'Bottom right',
    'configModal.toolbarPlacement.inside': text.toolbarInside || 'Inside',
    'configModal.toolbarPlacement.outside': text.toolbarOutside || 'Outside',
    'configModal.basic.placeholder.auto': text.auto,
    'configModal.basic.placeholder.default': text.defaultValue,
    'configModal.basic.viewFit': text.viewFit || 'View fit',
    'configModal.basic.viewFit.help':
      text.viewFitHelp ||
      'Controls the initial zoom when the map opens. Original size keeps text visually stable; fit view tries to show the whole map.',
    'configModal.basic.fitViewNoUpscale': text.fitViewNoUpscale || 'Do not enlarge in fit view',
    'configModal.basic.fitViewNoUpscale.help':
      text.fitViewNoUpscaleHelp ||
      'When enabled, fit view only shrinks maps that are too large; small maps keep their original scale.',
    'configModal.basic.fitViewMaxScale': text.fitViewMaxScale || 'Fit view max scale',
    'configModal.basic.fitViewMaxScale.help':
      text.fitViewMaxScaleHelp ||
      'Maximum enlargement used by fit view when "Do not enlarge" is disabled.',
    'configModal.viewFit.original': text.originalSize || 'Original size',
    'configModal.viewFit.fit': text.fitView || 'Fit view',
    'configModal.basic.featureSection': text.features || 'Features',
    'configModal.basic.wheelZoom': text.wheelZoom,
    'configModal.basic.tabIndent': text.tabIndent || 'Tab key changes topic level',
    'configModal.basic.tabIndent.help':
      text.tabIndentHelp ||
      'When enabled, Tab and Shift+Tab in source mode adjust the current line topic level.',
    'configModal.theme.scheme': text.themeScheme,
    'configModal.theme.defaultTopicColor': text.defaultTopicColor,
    'configModal.layout.type': text.layoutType,
    'configModal.layout.topicMaxWidth': text.topicMaxWidth,
    'configModal.layout.topicMaxWidthSection': text.topicMaxWidth,
    'configModal.layout.topicMaxWidth.help':
      text.topicMaxWidthHelp ||
      'Range: 120-800 px. Level-specific values inherit Global when left empty.',
    'configModal.layout.topicMaxWidthGlobal': text.global || 'Global',
    'configModal.layout.topicMaxWidthLevel1': text.level1Topic || 'Level 1 topic',
    'configModal.layout.topicMaxWidthLevel2': text.level2Topic || 'Level 2 topic',
    'configModal.layout.topicMaxWidthLevel3': text.level3Topic || 'Level 3 topic',
    'configModal.layout.topicMaxWidthInherit': text.inheritGlobal || 'Inherit global',
    'configModal.layout.connectorStyle': text.connectorStyle,
    'configModal.layout.branchExpansion': text.branchExpansion || 'Subtopic expansion',
    'configModal.layout.branchExpansion.elbowOnlyHelp':
      text.branchExpansionElbowOnlyHelp ||
      'Subtopic expansion only applies when the actual connector style is elbow.',
    'configModal.layout.branchExpansion.unsupportedHelp':
      text.branchExpansionUnsupportedHelp ||
      'The current layout does not support subtopic expansion.',
    'configModal.connector.curve': text.curve,
    'configModal.connector.straight': text.straight,
    'configModal.connector.elbow': text.elbow,
    'configModal.branchExpansion.side': text.branchExpansionSide || 'Side expansion',
    'configModal.branchExpansion.hanging': text.branchExpansionHanging || 'Hanging expansion',
    'topicEditor.title': text.topicEditPanel || 'Topic edit panel',
    'topicEditor.content': text.content || 'Content',
    'topicEditor.expandText': text.expandText || 'Open large text editor',
    'topicEditor.contentEditorTitle': text.editContent || 'Edit content',
    'topicEditor.applyText': text.apply || 'Apply',
    'topicEditor.color': text.color || 'Topic color',
    'topicEditor.icon': text.icon || 'Topic icon',
    'topicEditor.noIcon': text.noIcon || 'No icon',
    'topicEditor.fontFamily': text.font || 'Font',
    'topicEditor.fontSize': text.topicFontSize || 'Font size',
    'topicEditor.fontWeight': text.fontWeight || 'Font weight',
    'topicEditor.lineHeight': text.lineHeight || 'Line height',
    'topicEditor.maxWidth': text.maxWidth || 'Max width',
    'topicEditor.fontCustomPlaceholder': text.fontCustomPlaceholder || "'LXGW WenKai', sans-serif",
    'topicEditor.fontFamily.invalid':
      text.fontFamilyInvalid ||
      "Please enter a valid CSS font-family list, for example: 'SimSun', 'Songti SC', serif",
    'topicEditor.editContentAria': text.editContent || 'Edit content',
    'topicEditor.save': text.save,
    'topicEditor.addSubtopic': text.addSubtopic,
    'topicEditor.delete': text.delete,
    'topicEditor.cancel': text.cancel,
    'topicButton.addSubtopic': text.addSubtopic,
    'topicButton.editTopic': text.edit || 'Edit',
    'contextMenu.editTopic': text.edit || 'Edit',
    'contextMenu.topicEditPanel': text.topicEditPanel || 'Topic edit panel',
    'contextMenu.copyTopicContent': text.copyTopicContent,
    'contextMenu.copySubtreeBody': text.copySubtreeBody || 'Copy subtree',
    'contextMenu.copyIndentedSubtree': text.copyIndentedSubtree || 'Copy indented subtree',
    'contextMenu.addSubtopic': text.addSubtopic,
    'contextMenu.addSiblingAbove': text.addSiblingAbove,
    'contextMenu.addSiblingBelow': text.addSiblingBelow,
    'contextMenu.expandSubtopics': text.expandSubtopics,
    'contextMenu.collapseSubtopics': text.collapseSubtopics,
    'contextMenu.deleteTopic': text.deleteTopic,
    'contextMenu.copyBody': text.copyBody || 'Copy body',
    'contextMenu.copyIndentedBody': text.copyIndentedBody || 'Copy indented body',
    'contextMenu.copySource': text.copySource || 'Copy source',
    'contextMenu.copyConfig': text.copyConfig || 'Copy config',
    'contextMenu.exportPng': text.exportPng || 'Export image',
    'contextMenu.copyPng': text.copyPng || 'Copy image',
  };
}
