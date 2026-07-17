/* fr 完整语言包；键集合以 zh-CN 为准。 */
export const frMessages = Object.freeze({
  // ── 插件设置页 ──
  'settings.description':
    'Configurez ici les valeurs par défaut globales du plugin. La zone de configuration placée en haut de chaque bloc yxmm reste prioritaire, ce qui permet de personnaliser une carte précise.',
  'settings.language.name': 'Langue',
  'settings.language.desc':
    "Contrôle le texte de l'interface de yonxao-mindmap. La langue initiale suit la langue actuelle d'Obsidian.",
  'settings.globalDefaultValueConfigPanel.name': 'Panneau des valeurs par défaut globales',
  'settings.globalDefaultValueConfigPanel.desc':
    'Sert de configuration de base pour tous les blocs yxmm ; la zone de configuration du document et les attributs des sujets restent prioritaires.',
  'settings.globalDefaultValueConfigPanel.edit': 'Modifier les valeurs par défaut',
  'settings.globalDefaultValueConfigPanel.reset': 'Rétablir les valeurs intégrées',
  'settings.globalDefaultValueConfigPanel.resetNotice':
    'yonxao-mindmap: Les valeurs intégrées du plugin ont été rétablies.',
  'settings.globalDefaultValueConfigPanel.savedNotice':
    'yonxao-mindmap: Configuration globale par défaut enregistrée.',
  'settings.globalDefaultValueConfigPanel.empty':
    'Aucune valeur par défaut globale n’est définie. Toutes les cartes utilisent les valeurs intégrées du plugin.',
  'settings.globalDefaultValueConfigPanel.summaryTitle':
    'Résumé de la configuration globale actuelle :',
  'settings.summary.theme': 'Thème',
  'settings.summary.layout': 'Disposition',
  'settings.summary.connector': 'Style de connecteur',
  'settings.summary.connector.fixedElbow': 'Ligne brisée fixe',
  'settings.summary.branchExpansion': 'Extension des sous-sujets',
  'settings.summary.branchExpansion.elbowOnly': 'Disponible uniquement avec lignes brisées',
  'settings.summary.branchExpansion.unsupported': 'Non pris en charge par cette disposition',
  'settings.summary.wheelZoom': 'Zoom à la molette',
  'settings.summary.enabled': 'Activé',
  'settings.summary.disabled': 'Désactivé',
  'settings.summary.fontFamily': 'Police du sujet',
  'settings.summary.fontSize': 'Taille du texte des sujets',

  // ── 工具栏 ──
  'toolbar.showSource': 'Afficher la source',
  'toolbar.showMap': 'Afficher la carte',
  'toolbar.sourceFallback': 'Code',
  'toolbar.mapFallback': 'Carte',
  'toolbar.config': 'Configuration',
  'toolbar.fitView': 'Ajuster la vue',
  'toolbar.originalSize': 'Taille originale',
  'toolbar.enterFullscreen': 'Plein écran',
  'toolbar.exitFullscreen': 'Quitter le plein écran',
  'toolbar.zoomIn': 'Zoom avant',
  'toolbar.zoomOut': 'Zoom arrière',
  'toolbar.resetCollapse': "Réinitialiser l'état de repli",
  'toolbar.dragHandle': "Déplacer la barre d'outils",

  // ── 源码视图 ──
  'source.tab.config': 'Configuration',
  'source.tab.body': 'Corps',
  'source.status.editable':
    'La source est modifiable. Revenez à la carte ou appuyez sur Ctrl/Cmd+S pour réécrire le Markdown.',
  'source.status.dirty':
    'La source a été modifiée. Revenez à la carte ou appuyez sur Ctrl/Cmd+S pour réécrire le Markdown.',
  'source.status.synced': 'La source correspond au contenu de la carte actuelle.',
  'source.status.saved': 'La source a été enregistrée dans le bloc de code Markdown actuel.',
  'source.status.saveFailed':
    "Échec de l'enregistrement de la source, veuillez vérifier le bloc de code Markdown actuel.",
  'canvas.resizeHandle': 'Faites glisser pour redimensionner la hauteur du canevas',

  // ── 通知消息 ──
  'notice.configSaved': 'yonxao-mindmap: Configuration enregistrée.',
  'notice.topicCopied': 'yonxao-mindmap: Contenu copié.',
  'notice.bodyCopied': 'yonxao-mindmap: Corps copié.',
  'notice.sourceCopied': 'yonxao-mindmap: Source copiée.',
  'notice.configCopied': 'yonxao-mindmap: Zone de configuration copiée.',
  'notice.imageExported': 'yonxao-mindmap: Image exportée.',
  'notice.imageCopied': 'yonxao-mindmap: Image copiée.',
  'notice.imageClipboardUnsupported':
    "yonxao-mindmap: Cet environnement ne prend pas en charge la copie d'images dans le presse-papiers.",
  'notice.imageClipboardFocusRequired':
    "yonxao-mindmap: Veuillez d'abord cliquer sur la carte, puis copier à nouveau l'image.",
  'notice.topicContentRequired': 'yonxao-mindmap: Le contenu ne peut pas être vide.',
  'notice.topicContentSaved': 'Contenu enregistré.',
  'notice.subtopicAdded': 'Sous-sujet ajouté.',
  'notice.siblingTopicAdded': 'Sujet de même niveau ajouté.',
  'notice.topicDeleted': 'Sujet supprimé.',
  'notice.rootCannotAddSibling':
    "yonxao-mindmap: Impossible d'ajouter un sujet de même niveau au sujet racine.",
  'notice.structureSelectRelation':
    "Veuillez sélectionner un autre sujet pour finaliser l'association.",
  'notice.structureSelectMulti':
    "Continuez à cliquer sur les sujets pour une sélection multiple, puis utilisez la barre d'action en bas pour finaliser la structure.",
  'notice.structureMinimumTopics': '{type} nécessite au moins {minimum} sujets.',
  'notice.structureCreated': '{type} créé.',
  'notice.structureSaved': '{type} enregistré.',
  'notice.structureDeleted': '{type} supprimé.',
  'notice.structureControlAdjusted': 'La ligne de liaison a été ajustée.',
  'structureSelection.status': '{type} : {count} sujets sélectionnés',
  'structureSelection.type.summary': 'Résumé',
  'structureSelection.type.boundary': 'Cadre',
  'structureSelection.cancel': 'Annuler',
  'structureSelection.create': 'Créer',
  'structureSelection.minimum': 'Veuillez sélectionner au moins {minimum} sujets.',
  'structureSelection.summarySameParent':
    'Le résumé ne peut inclure que des sujets appartenant au même parent.',
  'structureSelection.summaryContiguous':
    'Le résumé ne peut inclure que des sujets consécutifs de même niveau.',
  'structureSelection.summaryReady': 'Sélection valide, le résumé peut être finalisé.',
  'structureSelection.boundaryReady':
    'Vous pouvez continuer à sélectionner des sujets ou finaliser directement le cadre.',
  'notice.rootCannotDeleteInMap':
    'yonxao-mindmap: Le sujet racine ne peut pas être supprimé dans la vue carte.',
  'notice.rootCannotDelete': 'yonxao-mindmap: Le sujet racine ne peut pas être supprimé.',

  // ── 编辑器菜单 ──
  'editorMenu.insertMindMap': 'Insérer une carte mentale',

  // ── 确认弹窗 ──
  'confirm.deleteTopic': 'Supprimer "{topic}" ?',
  'confirm.deleteTopicWithDescendants': 'Supprimer "{topic}" et ses {count} sous-sujets ?',
  'confirm.cutTopic': 'Couper « {topic} » ?',
  'confirm.cutTopicWithDescendants': 'Couper « {topic} » et ses {count} sous-sujets ?',

  // ── 主题编辑面板 ──
  'topicEditor.title': 'Panneau de modification du sujet',
  'topicEditor.content': 'Contenu',
  'topicEditor.expandText': 'Ouvrir le grand éditeur de texte',
  'topicEditor.contentEditorTitle': 'Modifier le contenu',
  'topicEditor.applyText': 'Enregistrer',
  'topicEditor.color': 'Couleur du sujet',
  'topicEditor.icon': 'Icône du sujet',
  'topicEditor.noIcon': 'Aucune icône',
  'topicEditor.fontFamily': 'Police',
  'topicEditor.fontSize': 'Taille du texte',
  'topicEditor.fontWeight': 'Graisse',
  'topicEditor.lineHeight': 'Hauteur de ligne',
  'topicEditor.align': 'Alignement',
  'topicEditor.maxWidth': 'Largeur max',
  'topicEditor.fontCustomPlaceholder': "'Noto Sans', sans-serif",
  'topicEditor.fontFamily.invalid':
    "Veuillez entrer une liste CSS font-family valide, ex. : 'Noto Serif', serif",
  'topicEditor.editContentAria': 'Modifier le contenu',
  'topicEditor.save': 'Enregistrer',
  'topicEditor.cancel': 'Annuler',

  // ── 主题按钮 ──
  'topicButton.addSiblingLeft': 'Ajouter un sujet de même niveau à gauche',
  'topicButton.addSiblingRight': 'Ajouter un sujet de même niveau à droite',
  'topicButton.addSiblingBefore': 'Ajouter un sujet de même niveau avant',
  'topicButton.addSiblingAfter': 'Ajouter un sujet de même niveau après',
  'topicButton.addSubtopic': 'Ajouter un sous-sujet',
  'topicButton.editTopic': 'Modifier',

  // ── 右键菜单 ──
  'contextMenu.editTopic': 'Modifier',
  'contextMenu.topicEditPanel': 'Panneau de modification du sujet',
  'contextMenu.copyTopicContent': 'Copier le contenu',
  'contextMenu.copySubtreeBody': 'Copier le sous-arbre',
  'contextMenu.copyIndentedSubtree': 'Copier le sous-arbre indenté',
  'contextMenu.addSubtopic': 'Ajouter un sous-sujet',
  'contextMenu.addSiblingBefore': 'Ajouter un sujet de même niveau avant',
  'contextMenu.addSiblingAfter': 'Ajouter un sujet de même niveau après',
  'contextMenu.expandSubtopics': 'Développer les sous-sujets',
  'contextMenu.collapseSubtopics': 'Replier les sous-sujets',
  'contextMenu.expandAllSubtopics': 'Développer tous les sous-sujets',
  'contextMenu.collapseAllSubtopics': 'Replier tous les sous-sujets',
  'contextMenu.deleteTopic': 'Supprimer le sujet',
  'contextMenu.editStructure': 'Modifier la structure',
  'contextMenu.deleteStructure': 'Supprimer la structure',
  'contextMenu.finishStructure': 'Finaliser la structure',
  'contextMenu.cancelStructureSelection': 'Annuler la sélection de structure',
  'contextMenu.createRelation': 'Créer une relation',
  'contextMenu.createSummary': 'Créer un résumé',
  'contextMenu.createBoundary': 'Créer un cadre',
  'contextMenu.copyBody': 'Copier le corps',
  'contextMenu.copyIndentedBody': 'Copier le corps indenté',
  'contextMenu.copySource': 'Copier la source',
  'contextMenu.copyConfig': 'Copier la zone de configuration',
  'contextMenu.exportPng': 'Exporter en PNG',
  'contextMenu.copyPng': 'Copier en PNG',
  'contextMenu.deleteMindMap': 'Supprimer la carte mentale',

  // ── 结构编辑弹窗 ──
  'structureEditor.title.relation': 'Paramètres de relation',
  'structureEditor.title.summary': 'Paramètres du résumé',
  'structureEditor.title.boundary': 'Paramètres du cadre',
  'structureEditor.label.text': 'Texte',
  'structureEditor.label.direction': 'Direction',
  'structureEditor.label.lineStyle': 'Style de ligne',
  'structureEditor.direction.none': 'Aucune direction',
  'structureEditor.direction.forward': 'Avant',
  'structureEditor.direction.backward': 'Arrière',
  'structureEditor.direction.both': 'Bidirectionnel',
  'structureEditor.lineStyle.curve': 'Courbe',
  'structureEditor.lineStyle.straight': 'Ligne droite',
  'structureEditor.lineStyle.elbow': 'Ligne brisée',
  'structureEditor.action.cancel': 'Annuler',
  'structureEditor.action.save': 'Enregistrer',
  'structureEditor.placeholder.text': 'Optionnel',
  'structureEditor.placeholder.textMultiline':
    'Optionnel ; les sauts de ligne sont pris en charge et affichés selon la saisie.',

  // ── 配置面板：标题、标签页、操作、状态 ──
  'configModal.title': 'Panneau de configuration',
  'configModal.globalDefaultValueTitle': 'Panneau des valeurs par défaut globales',
  'configModal.info.label': 'Explication des règles de configuration',
  'configModal.info.tooltip':
    "Priorité de la configuration :\nAttributs du sujet > Zone de configuration du bloc de code > Valeurs par défaut globales du plugin > Valeurs intégrées du plugin\n\nPriorité des couleurs :\nAttribut color du sujet > Couleur de sujet par défaut > Palette du thème\n\nLogique d'enregistrement :\nLorsqu'une valeur est identique à la valeur par défaut effective (issue des valeurs par défaut globales ou des valeurs intégrées), elle est omise de la zone de configuration afin de garder celle-ci concise.",
  'configModal.tabs.display': 'Affichage',
  'configModal.tabs.structure': 'Structure',
  'configModal.tabs.color': 'Palette',
  'configModal.tabs.font': 'Police',
  'configModal.tabs.interaction': 'Interaction',
  'configModal.tabs.advanced': 'Avancé',
  'configModal.actions.apply': 'Appliquer',
  'configModal.actions.saveAndClose': 'Enregistrer et fermer',
  'configModal.actions.cancel': 'Annuler',
  'configModal.actions.close': 'Fermer',
  'configModal.status.saved': 'Configuration enregistrée.',
  'configModal.status.valid': 'La syntaxe de configuration est valide.',
  'configModal.status.invalid': 'Erreur de syntaxe de configuration : {message}',
  'configModal.footer.star':
    "Si l'outil vous est utile, laissez une étoile gratuite : cela encourage l'auteur.",

  // ── 配置面板：占位符 ──
  'configModal.placeholder.auto': 'Automatique',
  'configModal.placeholder.default': 'Par défaut',

  // ── 配置面板：显示标签页 ──
  'configModal.display.mapSection': 'Zone de la carte',
  'configModal.display.canvasHeight': 'Hauteur de la carte',
  'configModal.display.canvasHeight.help':
    'Laissez vide pour une hauteur automatique. Faire glisser le bas du canevas inscrit aussi cette valeur.',
  'configModal.display.viewFit': 'Ajustement de la vue',
  'configModal.display.viewFit.help':
    "Contrôle le zoom initial à l'ouverture de la carte. La taille originale garde le texte stable ; l'ajustement de la vue essaie d'afficher toute la carte.",
  'configModal.display.fitViewNoUpscale': "Ne pas agrandir lors de l'ajustement",
  'configModal.display.fitViewNoUpscale.help':
    "Si l’option est activée, l'ajustement de la vue réduit seulement les cartes trop grandes ; les petites cartes conservent une échelle proche de l'originale.",
  'configModal.display.fitViewMaxScale': "Échelle max. d'ajustement",
  'configModal.display.fitViewMaxScale.help':
    "S'applique lorsque « Ne pas agrandir lors de l'ajustement » est désactivé ; limite l'agrandissement maximal des petites cartes.",
  'configModal.display.sourceSection': 'Zone source',
  'configModal.display.sourceHeight': 'Hauteur de la source',
  'configModal.display.sourceHeight.help':
    "Le mode source a une hauteur indépendante et n'affecte pas la hauteur de la carte.",
  'configModal.display.saveFullConfig': 'Enregistrer tous les éléments de configuration',
  'configModal.display.saveFullConfig.help':
    'Si l’option est activée, toutes les valeurs sont enregistrées, y compris les valeurs par défaut, afin de conserver le même rendu après partage ou migration. Sinon, seules les valeurs différentes des valeurs par défaut sont enregistrées.',
  'configModal.viewFit.original': 'Taille originale',
  'configModal.viewFit.fit': 'Ajuster la vue',
  'configModal.topicControlVisibility.always': 'Toujours afficher tous les boutons',
  'configModal.topicControlVisibility.toggle-always':
    'Toujours afficher le bouton de repli ; afficher les autres au survol',
  'configModal.topicControlVisibility.hover': 'Afficher tous les boutons au survol',

  // ── 配置面板：颜色标签页 ──
  'configModal.color.schemeSection': 'Palette de couleurs',
  'configModal.color.customColor': 'Couleur personnalisée',
  'configModal.color.scheme': 'Palette de couleurs',
  'configModal.color.defaultTopicColor': 'Couleur par défaut du sujet',
  'configModal.color.defaultTopicColor.help':
    "Laissez vide pour utiliser les couleurs automatiques de la palette actuelle. Si une valeur est renseignée, elle remplace les couleurs automatiques, mais l'attribut color du sujet reste prioritaire.",
  'configModal.color.overrideWarning':
    'La palette actuelle attribue automatiquement des couleurs par branche. Définir une couleur de sujet par défaut masque ces couleurs.',
  'configModal.color.buttonSection': 'Couleur des boutons',
  'configModal.color.buttonColorMode': 'Couleur des boutons',
  'configModal.color.buttonColorMode.help':
    'Mode de couleur pour les boutons de repli, édition et ajout.',
  'configModal.color.buttonColor.inherit-accent': "Hériter de la couleur d'accentuation",
  'configModal.color.buttonColor.subtle': 'Discrète',
  'configModal.color.buttonColor.topic': 'Couleur du sujet',
  'configModal.color.buttonColor.custom': 'Personnalisée',
  'configModal.color.buttonColor': 'Couleur personnalisée des boutons',
  'configModal.color.buttonColor.help':
    'Couleur personnalisée pour les boutons, applicable uniquement en mode Personnalisée.',
  'configModal.color.advancedStructureSection': 'Couleurs des structures avancées',
  'configModal.color.advancedStructure.relation': 'Couleur des relations',
  'configModal.color.advancedStructure.summary': 'Couleur du résumé',
  'configModal.color.advancedStructure.boundary': 'Couleur du cadre extérieur',
  'configModal.color.advancedStructure.help':
    "Définit la couleur par défaut pour ce type de structure avancée ; la propriété color d'une structure précise reste prioritaire.",

  // ── 配置面板：结构标签页 ──
  'configModal.structure.layoutSection': 'Disposition',
  'configModal.structure.layout': 'Type de disposition',
  'configModal.structure.connectorSection': 'Liaisons et extension',
  'configModal.structure.connectorStyle': 'Style de connecteur',
  'configModal.structure.connectorStyle.fixedHelp':
    'Seules les dispositions de carte mentale peuvent choisir le style des liaisons. Les autres dispositions utilisent une ligne brisée fixe afin de préserver leur structure.',
  'configModal.structure.branchExpansion': 'Extension des sous-sujets',
  'configModal.structure.branchExpansion.elbowOnlyHelp':
    "L'extension des sous-sujets s'applique uniquement lorsque le connecteur est en ligne brisée.",
  'configModal.structure.topicMaxWidthSection': 'Largeur max. du sujet',
  'configModal.structure.topicMaxWidth.help': 'Plage : 120-2000 px.',
  'configModal.structure.topicMaxWidthGlobal': 'Global',
  'configModal.structure.topicMaxWidthLevel1': 'Niveau 1',
  'configModal.structure.topicMaxWidthLevel2': 'Niveau 2',
  'configModal.structure.topicMaxWidthLevel3': 'Niveau 3',
  'configModal.branchExpansion.side': 'Extension naturelle',
  'configModal.branchExpansion.hanging': 'Extension suspendue',

  // ── 配置面板：字体标签页 ──
  'configModal.font.globalSection': 'Police globale des sujets',
  'configModal.font.family': 'Police des sujets',
  'configModal.font.family.help':
    'Utilise par défaut la police de texte d’Obsidian. Vous pouvez choisir un préréglage ou sélectionner « Personnalisée » puis saisir une font-family CSS.',
  'configModal.font.size': 'Taille du texte des sujets',
  'configModal.font.size.help': "L'unité est le px et contrôle la taille du contenu du sujet.",
  'configModal.font.weight': 'Graisse des sujets',
  'configModal.font.weight.help': 'La graisse suit la plage CSS standard 100-900.',
  'configModal.font.lineHeight': 'Hauteur de ligne des sujets',
  'configModal.font.lineHeight.help':
    'La hauteur de ligne est la distance entre les lignes de texte SVG en px. Une valeur pratique est généralement 1,3-1,5 fois la taille de la police.',
  'configModal.font.align': 'Alignement du texte',
  'configModal.font.align.help':
    "L'alignement par défaut suit la direction de la mise en page. L'alignement à gauche, au centre et à droite remplace le texte des paragraphes normaux ; les listes et blocs de code restent alignés à gauche.",
  'configModal.font.align.auto': 'Alignement par défaut',
  'configModal.font.align.left': 'Aligner à gauche',
  'configModal.font.align.center': 'Centrer',
  'configModal.font.align.right': 'Aligner à droite',
  'configModal.font.levelSection': 'Remplacements par niveau de sujet',
  'configModal.font.levelTitle1': 'Sujet de niveau 1',
  'configModal.font.levelTitle2': 'Sujet de niveau 2',
  'configModal.font.levelTitle3': 'Sujet de niveau 3',
  'configModal.font.clearLevel': 'Effacer ce niveau',

  // ── 配置面板：交互标签页 ──
  'configModal.interaction.toolbarSection': "Barre d'outils",
  'configModal.interaction.toolbarCorner': "Coin de la barre d'outils",
  'configModal.interaction.toolbarPlacement': "Position de la barre d'outils",
  'configModal.toolbarCorner.topLeft': 'En haut à gauche',
  'configModal.toolbarCorner.topRight': 'En haut à droite',
  'configModal.toolbarCorner.bottomLeft': 'En bas à gauche',
  'configModal.toolbarCorner.bottomRight': 'En bas à droite',
  'configModal.toolbarPlacement.inside': 'Intérieur',
  'configModal.toolbarPlacement.outside': 'Extérieur',
  'configModal.interaction.topicButtonSection': 'Boutons du sujet',
  'configModal.interaction.topicControlVisibility': 'Visibilité des boutons du sujet',
  'configModal.interaction.topicControlVisibility.help':
    "Contrôle quand les boutons de modification, de repli et d'ajout de sujet sont affichés dans la carte. Les boutons de modification restent désactivés en mode lecture.",
  'configModal.interaction.inputSection': 'Souris et clavier',
  'configModal.interaction.wheelZoom': 'Zoom à la molette',
  'configModal.interaction.wheelZoom.help':
    'Si l’option est désactivée, la molette fait défiler la page Obsidian. Si elle est activée, la molette zoome la carte actuelle.',
  'configModal.interaction.tabIndent': 'Tab change le niveau du sujet',
  'configModal.interaction.tabIndent.help':
    'Si l’option est activée, Tab et Shift+Tab ajustent le niveau du sujet de la ligne actuelle en mode source.',

  // ── 配置面板：布局分组 ──
  'configModal.layout.group.mindmap': 'Carte mentale',
  'configModal.layout.group.tree': 'Diagramme arborescent',
  'configModal.layout.group.org': 'Organigramme',
  'configModal.layout.group.timeline': 'Chronologie',
  'configModal.layout.group.radial': 'Carte radiale',
  'configModal.layout.group.fishbone': 'Diagramme en arête de poisson',
  'configModal.layout.group.treeTable': 'Tableau arborescent',
  'configModal.layout.mindmapRight': 'Carte mentale vers la droite',
  'configModal.layout.mindmapLeft': 'Carte mentale vers la gauche',
  'configModal.layout.mindmapBidirectional': 'Carte mentale bidirectionnelle',
  'configModal.layout.mindmapUp': 'Carte mentale vers le haut',
  'configModal.layout.mindmapDown': 'Carte mentale vers le bas',
  'configModal.layout.mindmapVertical': 'Carte mentale verticale bidirectionnelle',
  'configModal.layout.tree': 'Diagramme arborescent',
  'configModal.layout.treeRight': 'Diagramme arborescent vers la droite',
  'configModal.layout.treeLeft': 'Diagramme arborescent vers la gauche',
  'configModal.layout.org': 'Organigramme',
  'configModal.layout.orgRight': 'Organigramme vers la droite',
  'configModal.layout.timeline': 'Chronologie',
  'configModal.layout.timelineUp': 'Chronologie supérieure',
  'configModal.layout.timelineDown': 'Chronologie inférieure',
  'configModal.layout.radial': 'Carte radiale',
  'configModal.layout.fishboneLeft': 'Diagramme en arête de poisson vers la gauche',
  'configModal.layout.fishboneRight': 'Diagramme en arête de poisson vers la droite',
  'configModal.layout.treeTable': 'Tableau arborescent',
  'configModal.layout.treeTableStepped': 'Tableau arborescent en escalier',
  'configModal.connector.curve': 'Courbe',
  'configModal.connector.straight': 'Ligne droite',
  'configModal.connector.elbow': 'Ligne brisée',

  // ── 配置面板：主题选择 ──
  'configModal.color.default': 'Par défaut : suivre Obsidian',
  'configModal.color.ocean': 'Océan : bleu-cyan technique',
  'configModal.color.forest': 'Forêt : vert apprentissage',
  'configModal.color.sunset': 'Coucher de soleil : orange-rouge créatif',
  'configModal.color.mono': 'Mono : documents formels',
  'configModal.color.rainbow': 'Arc-en-ciel : saturation élevée standard',
  'configModal.color.pastelRainbow': 'Arc-en-ciel pastel : lecture longue',
  'configModal.color.neonRainbow': 'Arc-en-ciel néon : présentation sombre',

  // ── 字体下拉 ──
  'font.group.inherit': 'Héritage et personnalisation',
  'font.group.obsidian': 'Obsidian',
  'font.group.chinese': 'Polices chinoises',
  'font.group.system': 'Polices système',
  'font.group.monospace': 'Polices à chasse fixe',
  'font.inherit': 'Hériter de la police globale',
  'font.custom': 'Personnalisé',
  'font.obsidian.interface': "Police d'interface Obsidian",
  'font.obsidian.text': 'Police de texte Obsidian',
  'font.obsidian.monospace': 'Police à chasse fixe Obsidian',
  'font.chinese.sans': 'Sans sérif chinois',
  'font.chinese.serif': 'Sérif chinois',
  'font.chinese.kaiti': 'KaiTi chinois',
  'font.chinese.fangsong': 'FangSong chinois',
  'font.chinese.microsoftYaHei': 'Microsoft YaHei',
  'font.chinese.pingFang': 'PingFang',
  'font.chinese.sourceHanSans': 'Source Han Sans',
  'font.chinese.sourceHanSerif': 'Source Han Serif',
  'font.chinese.lxgwWenkai': 'LXGW WenKai',
  'font.system.sans': 'Sans-sérif système',
  'font.system.serif': 'Sérif système',
  'font.system.monospace': 'À chasse fixe système',
  'font.monospace.cjkStack': 'Pile à chasse fixe CJK',
  'font.monospace.sarasa': 'Sarasa Gothic',
  'font.monospace.lxgwwenkai': 'LXGW WenKai Mono',
  'font.monospace.jetbrains': 'JetBrains Mono',
  'font.monospace.cascadia': 'Cascadia Mono',

  // ── 配置面板：高级标签页 ──
  'configModal.advanced.section': 'Source de configuration',
  'toolbar.enterWindowFullscreen': 'Plein écran de fenêtre',
  'toolbar.exitWindowFullscreen': 'Quitter le plein écran de fenêtre',
  'notice.attachmentCopied': "yonxao-mindmap: L'adresse de la pièce jointe a été copiée.",
  'notice.attachmentCopyUnsupported':
    "yonxao-mindmap: L'environnement actuel ne prend pas en charge la copie des adresses de pièces jointes.",
  'notice.attachmentMissing':
    'yonxao-mindmap: La pièce jointe est inexistante ou impossible à ouvrir.',
  'notice.topicCut': 'Le sujet a été coupé.',
  'notice.topicPasted': 'Le sujet a été collé.',
  'notice.topicWithAttributesCopied': 'Le sujet et ses attributs ont été copiés.',
  'notice.topicClipboardEmpty': 'yonxao-mindmap: Le presse-papiers est vide.',
  'notice.undoApplied': 'Annulé.',
  'notice.redoApplied': 'Rétabli.',
  'notice.undoUnavailable': 'yonxao-mindmap: Aucune action ne peut être annulée.',
  'notice.redoUnavailable': 'yonxao-mindmap: Aucune action ne peut être rétablie.',

  // ── 附件浮层 ──
  'attachment.open': 'Ouvrir',
  'attachment.copy': 'Copier',

  // ── 全屏编辑恢复 ──
  'fullscreenDraftRecovery.message':
    "Une fermeture anormale a été détectée la dernière fois ; certaines modifications n'ont peut-être pas été enregistrées. Vous pouvez les restaurer sous forme de nouvelle carte sous la carte actuelle, ou copier la source récupérable dans le presse-papiers.",
  'fullscreenDraftRecovery.createMap': 'Créer une nouvelle carte',
  'fullscreenDraftRecovery.copySource': 'Copier la source',
  'fullscreenDraftRecovery.inserted': 'yonxao-mindmap: Carte de récupération créée.',
  'fullscreenDraftRecovery.copied': 'yonxao-mindmap: Source récupérable copiée.',
  'fullscreenDraftRecovery.insertFailed':
    'yonxao-mindmap: Échec de la création de la carte de récupération.',
  'fullscreenDraftRecovery.copyFailed':
    'yonxao-mindmap: Échec de la copie de la source récupérable.',
  'fullscreenDraftRecovery.insertUnsupported':
    "yonxao-mindmap: L'environnement d'édition actuel ne permet pas de créer automatiquement une carte de récupération. Veuillez copier la source.",

  // 富文本编辑工具栏提示
  'topicEditor.richText.bold': 'Mettre en gras le texte sélectionné',
  'topicEditor.richText.italic': 'Mettre en italique le texte sélectionné',
  'topicEditor.richText.strike': 'Barrer le texte sélectionné',
  'topicEditor.richText.underline': 'Souligner le texte sélectionné',
  'topicEditor.richText.clear': 'Effacer le style du contenu',
  'topicEditor.richText.tag': 'Insérer un tag',
  'topicEditor.richText.link': 'Insérer un lien',
  'topicEditor.richText.unorderedList': 'Insérer une liste à puces',
  'topicEditor.richText.orderedList': 'Insérer une liste numérotée',
  'topicEditor.richText.task': 'Insérer une tâche',
  'topicEditor.richText.image': 'Insérer une image',
  'topicEditor.richText.note': 'Insérer une note',
  'topicEditor.richText.attachment': 'Insérer une pièce jointe',
  'topicEditor.richText.equation': 'Insérer une équation',
  'topicEditor.richText.codeBlock': 'Insérer un bloc de code',
  'topicEditor.richText.colorNamed': 'Définir le texte sélectionné en {color}',
  'topicEditor.richText.colorCustom': 'Définir une couleur pour le texte sélectionné',
  'topicEditor.richText.placeholder': 'Texte',
  'configModal.tabs.shortcuts': 'Raccourcis',
  'configModal.tabs.watermark': 'Filigrane',
  'configModal.watermark.locked.title': 'La fonction de filigrane n’est pas encore déverrouillée',
  'configModal.watermark.locked.description':
    "Si Yonxao Mind Map vous est utile, vous pouvez soutenir le développement en ajoutant une Star au projet sur GitHub. Une fois cette action faite, la fonction sera déverrouillée gratuitement. L'extension ne lit ni ne vérifie votre compte GitHub.",
  'configModal.watermark.locked.step.star.title': 'Aller sur GitHub pour soutenir le projet',
  'configModal.watermark.locked.step.star.description':
    'Ouvrez la page principale du projet et cliquez sur Star en haut à droite.',
  'configModal.watermark.locked.step.unlock.title': 'Revenir ici pour déverrouiller',
  'configModal.watermark.locked.step.unlock.description':
    'Après avoir cliqué sur Star, revenez dans cette fenêtre et confirmez pour déverrouiller.',
  'configModal.watermark.locked.star': 'Aller sur GitHub et cliquer sur Star',
  'configModal.watermark.locked.reopen': 'Rouvrir GitHub',
  'configModal.watermark.locked.unlock': "J'ai cliqué sur Star, déverrouiller",
  'configModal.watermark.locked.existingSupport':
    'Vous aviez déjà ajouté une Star ? Confirmez directement pour déverrouiller',
  'configModal.watermark.locked.unlocking': 'Déverrouillage en cours…',
  'configModal.watermark.locked.success':
    'La fonction filigrane est déverrouillée, merci pour votre soutien !',
  'configModal.watermark.locked.failed':
    'Échec de la sauvegarde du statut de déverrouillage, veuillez réessayer.',
  'configModal.watermark.enabled': 'Activer le filigrane',
  'configModal.watermark.enabled.help':
    "Une fois activé, il s'affiche immédiatement sur le canevas de la carte mentale, en plein écran et lors de l'exportation d'images.",
  'configModal.watermark.mode': 'Mode du filigrane',
  'configModal.watermark.mode.signature': 'Filigrane signature',
  'configModal.watermark.mode.normal': 'Filigrane standard',
  'configModal.watermark.signature.section': 'Filigrane signature',
  'configModal.watermark.normal.section': 'Filigrane standard',
  'configModal.watermark.signature.style': 'Style de signature',
  'configModal.watermark.signature.style.corner': 'Signature dans le coin',
  'configModal.watermark.signature.style.bar': 'Barre de filigrane',
  'configModal.watermark.content': 'Contenu du filigrane',
  'configModal.watermark.position': "Position d'affichage",
  'configModal.watermark.color': 'Couleur',
  'configModal.watermark.backgroundColor': 'Couleur de fond',
  'configModal.watermark.fontSize': 'Taille de la police',
  'configModal.watermark.opacity': 'Opacité',
  'configModal.watermark.barHeight': 'Hauteur de la barre de filigrane',
  'configModal.watermark.padding': 'Marge intérieure',
  'configModal.watermark.appearance': 'Apparence',
  'configModal.watermark.spacing': 'Dimensions et marges',
  'configModal.watermark.size': 'Taille du filigrane',
  'configModal.watermark.offset': 'Décalage de position',
  'configModal.watermark.gap': 'Espacement des répétitions',
  'configModal.watermark.transparent': 'Transparent',
  'configModal.watermark.value': 'Valeur',
  'configModal.watermark.decrease': 'Diminuer',
  'configModal.watermark.increase': 'Augmenter',
  'configModal.watermark.range': 'Plage autorisée :',
  'configModal.watermark.type': 'Type de filigrane',
  'configModal.watermark.type.text': 'Filigrane texte',
  'configModal.watermark.type.image': 'Filigrane image',
  'configModal.watermark.arrangement': 'Mode de disposition',
  'configModal.watermark.arrangement.single': 'Unique',
  'configModal.watermark.arrangement.tiled': 'Répété',
  'configModal.watermark.rotation': 'Angle de rotation',
  'configModal.watermark.width': 'Largeur',
  'configModal.watermark.height': 'Hauteur',
  'configModal.watermark.gapX': 'Espacement horizontal',
  'configModal.watermark.gapY': 'Espacement vertical',
  'configModal.watermark.offsetX': 'Décalage horizontal',
  'configModal.watermark.offsetY': 'Décalage vertical',
  'configModal.watermark.imageSourceType': "Source de l'image",
  'configModal.watermark.imageSourceType.url': "URL de l'image",
  'configModal.watermark.imageSourceType.vault': 'Coffre actuel',
  'configModal.watermark.imageSource': "Adresse de l'image",
  'configModal.watermark.imageSource.placeholder': 'https://… ou assets/watermark.png',
  'configModal.watermark.image.chooseVault': 'Sélectionner dans le coffre actuel',
  'configModal.watermark.image.searchPlaceholder':
    'Rechercher des fichiers image dans le coffre actuel',
  'configModal.watermark.image.upload': 'Importer dans le coffre',
  'configModal.watermark.image.uploaded':
    "yonxao-mindmap: L'image du filigrane a été importée dans le coffre.",
  'configModal.watermark.image.uploadFailed':
    "yonxao-mindmap: Échec de l'importation de l'image du filigrane :",
  'configModal.watermark.position.topLeft': 'En haut à gauche',
  'configModal.watermark.position.topCenter': 'Haut au centre',
  'configModal.watermark.position.topRight': 'En haut à droite',
  'configModal.watermark.position.centerLeft': 'Centre à gauche',
  'configModal.watermark.position.center': 'Centré',
  'configModal.watermark.position.centerRight': 'Centre à droite',
  'configModal.watermark.position.bottomLeft': 'En bas à gauche',
  'configModal.watermark.position.bottomCenter': 'Bas au centre',
  'configModal.watermark.position.bottomRight': 'En bas à droite',
  'configModal.watermark.position.top': 'Haut',
  'configModal.watermark.position.bottom': 'Bas',

  // ── 配置面板：快捷键标签页 ──
  'configModal.shortcuts.help':
    'Le raccourci actuel est en lecture seule et ne peut pas être modifié pour le moment',
  'configModal.shortcuts.topicCreateDeleteSection': 'Création et suppression de sujets',
  'configModal.shortcuts.topicEditSection': 'Modification des sujets',
  'configModal.shortcuts.topicNavigateCollapseSection': 'Navigation et repli des sujets',
  'configModal.shortcuts.topicClipboardHistorySection': 'Copier-coller et Annuler/Rétablir',
  'configModal.shortcuts.mapControlSection': 'Contrôle de la carte mentale',
  'configModal.shortcuts.viewControlSection': 'Contrôle de la vue',
  'configModal.shortcuts.header.action': 'Action',
  'configModal.shortcuts.header.windows': 'Windows',
  'configModal.shortcuts.header.mac': 'Mac',
  'configModal.shortcuts.header.description': 'Description',
  'configModal.shortcuts.action.addSubtopic': 'Insérer un sous-sujet',
  'configModal.shortcuts.action.addSiblingAfter': 'Insérer le sujet de même niveau suivant',
  'configModal.shortcuts.action.addSiblingBefore': 'Insérer le sujet de même niveau précédent',
  'configModal.shortcuts.action.deleteTopic': 'Supprimer le sujet',
  'configModal.shortcuts.action.openTopicEditor': 'Ouvrir le panneau de modification du sujet',
  'configModal.shortcuts.action.openInlineEditor': 'Édition rapide en ligne',
  'configModal.shortcuts.action.inlineNewline': "Saut de ligne lors de l'édition en ligne",
  'configModal.shortcuts.action.inlineSubmit': "Valider lors de l'édition en ligne",
  'configModal.shortcuts.action.inlineCancel': "Annuler lors de l'édition en ligne",
  'configModal.shortcuts.action.topicEditorSave': 'Enregistrer le panneau de modification du sujet',
  'configModal.shortcuts.action.contentEditorSave':
    "Enregistrer la fenêtre contextuelle d'édition de texte long",
  'configModal.shortcuts.action.navigateTopic': 'Changer le sujet sélectionné',
  'configModal.shortcuts.action.toggleCollapse': 'Développer/Replier les sous-sujets',
  'configModal.shortcuts.action.copyTopicContent': 'Copier le contenu du sujet',
  'configModal.shortcuts.action.cutTopicContent': 'Couper le sujet',
  'configModal.shortcuts.action.pasteTopicContent': 'Coller le sujet',
  'configModal.shortcuts.action.copyTopicWithAttributes': 'Copier le sujet et ses attributs',
  'configModal.shortcuts.action.pasteTopicWithAttributes': 'Coller le sujet et ses attributs',
  'configModal.shortcuts.action.undoTopicChange': 'Annuler',
  'configModal.shortcuts.action.redoTopicChange': 'Rétablir',
  'configModal.shortcuts.action.zoomIn': 'Zoom avant',
  'configModal.shortcuts.action.zoomOut': 'Zoom arrière',
  'configModal.shortcuts.action.fitView': 'Adapter la vue',
  'configModal.shortcuts.action.originalSize': 'Vue originale',
  'configModal.shortcuts.action.windowFullscreen': 'Plein écran de fenêtre',
  'configModal.shortcuts.action.fullscreen': 'Plein écran',
  'configModal.shortcuts.action.openConfigModal': 'Ouvrir le panneau de configuration',
  'configModal.shortcuts.description.addSubtopic': 'Créer un sous-sujet pour le sujet actuel',
  'configModal.shortcuts.description.addSiblingAfter':
    'Créer un sujet de même niveau après le sujet actuel',
  'configModal.shortcuts.description.addSiblingBefore':
    'Créer un sujet de même niveau avant le sujet actuel',
  'configModal.shortcuts.description.deleteTopic': 'Supprimer le sujet actuel',
  'configModal.shortcuts.description.openTopicEditor':
    'Ouvrir le panneau de modification du sujet actuel',
  'configModal.shortcuts.description.openInlineEditor':
    'Modifier rapidement le texte du sujet actuel',
  'configModal.shortcuts.description.inlineNewline':
    'Insérer un saut de ligne dans le texte du sujet',
  'configModal.shortcuts.description.inlineSubmit':
    'Enregistrer le texte et revenir au sujet actuel',
  'configModal.shortcuts.description.inlineCancel':
    'Abandonner les modifications et revenir au sujet actuel',
  'configModal.shortcuts.description.topicEditorSave':
    'Enregistrer toutes les modifications du panneau de modification du sujet',
  'configModal.shortcuts.description.contentEditorSave':
    'Enregistrer uniquement la fenêtre de texte long, sans enregistrer tout le panneau de modification du sujet',
  'configModal.shortcuts.description.navigateTopic':
    'Changer le sujet sélectionné ; les cartes mentales naviguent selon les relations parent/enfant et de même niveau, les autres dispositions selon la direction spatiale',
  'configModal.shortcuts.description.toggleCollapse': 'Développer ou replier les sous-sujets',
  'configModal.shortcuts.description.copyTopicContent': 'Copier le contenu du sujet sélectionné',
  'configModal.shortcuts.description.cutTopicContent':
    'Couper le sujet sélectionné, ses attributs et ses sous-sujets',
  'configModal.shortcuts.description.pasteTopicContent': 'Coller comme sous-sujet du sujet actuel',
  'configModal.shortcuts.description.copyTopicWithAttributes':
    'Copier le sujet sélectionné, ses attributs et ses sous-sujets',
  'configModal.shortcuts.description.pasteTopicWithAttributes':
    'Coller le sujet, ses attributs et ses sous-sujets',
  'configModal.shortcuts.description.undoTopicChange': 'Annuler la dernière action',
  'configModal.shortcuts.description.redoTopicChange': "Rétablir l'action annulée",
  'configModal.shortcuts.description.zoomIn': 'Zoomer',
  'configModal.shortcuts.description.zoomOut': 'Dézoomer',
  'configModal.shortcuts.description.fitView': 'Ajuster la vue selon la fenêtre actuelle',
  'configModal.shortcuts.description.originalSize': 'Revenir à la taille originale',
  'configModal.shortcuts.description.windowFullscreen':
    'Entrer/Quitter le mode plein écran de fenêtre',
  'configModal.shortcuts.description.fullscreen': 'Entrer/Quitter le mode plein écran',
  'configModal.shortcuts.description.openConfigModal': 'Ouvrir le panneau de configuration',
});
