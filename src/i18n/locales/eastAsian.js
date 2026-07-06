import { createAdditionalLocale } from '../createAdditionalLocale.js';

export const eastAsianLocaleMessages = Object.freeze({
  ja: Object.freeze(
    createAdditionalLocale({
      // ── プラグイン設定ページ ──
      settingsDescription:
        'ここではプラグイン全体の既定設定を構成します。個別の yxmm コードブロック上部の設定ブロックが引き続き優先されます。',
      language: '言語',
      languageDesc:
        'yonxao-mindmap の UI テキストを制御します。初期既定言語は Obsidian の現在の言語に従います。',
      globalDefaultValueConfigPanel: 'グローバル既定値設定パネル',
      globalDefaultDesc:
        'すべての yxmm コードブロックの基本設定として使われます。ブロック設定とトピック属性が優先されます。',
      editDefaults: '既定設定を編集',
      resetDefaults: '内蔵既定値に戻す',
      noticeResetDefaults: 'yonxao-mindmap: 内蔵既定値に戻しました。',
      noticeDefaultsSaved: 'yonxao-mindmap: グローバル既定値設定を保存しました。',
      summaryTitle: '現在のグローバル既定設定の概要:',
      noDefaults: 'グローバル既定設定は未設定です。すべてのマップは内蔵既定値を使用します。',
      theme: 'テーマ',
      layout: 'レイアウト',
      connector: 'コネクタースタイル',
      fixedElbow: '固定折れ線',
      branchExpansion: 'サブトピック展開方式',
      branchExpansionElbowOnly: '折れ線でのみ利用可能',
      branchExpansionUnsupported: '現在のレイアウトでは非対応',
      wheelZoom: 'マウスホイールズーム',
      enabled: '有効',
      disabled: '無効',
      topicFont: 'トピックフォント',
      topicFontSize: 'トピック文字サイズ',

      // ── ツールバー ──
      showSource: 'ソースを表示',
      showMap: 'マップを表示',
      sourceFallback: 'src',
      mapFallback: 'map',
      config: '設定',
      fitView: '表示に合わせる',
      originalSize: '元のサイズ',
      fullscreen: '全画面表示',
      exitFullscreen: '全画面を終了',
      zoomIn: '拡大',
      zoomOut: '縮小',
      resetCollapse: '折りたたみ状態をリセット',
      dragToolbar: 'ツールバーをドラッグ',

      // ── ソースビュー ──
      configSection: '設定', // source.tab.config
      bodySection: '本文', // source.tab.body
      sourceEditable:
        'ソースは編集可能です。マップに戻るか Alt/Option+S で Markdown に書き込みます。',
      sourceDirty:
        'ソースが変更されました。マップに戻るか Alt/Option+S で Markdown に書き込みます。',
      sourceSynced: 'ソースは現在の Markdown コードブロックと同期しています。',
      resizeCanvas: 'キャンバスの高さをドラッグで調整',

      // ── 通知メッセージ ──
      noticeConfigSaved: 'yonxao-mindmap: 設定を保存しました。',
      noticeTopicCopied: 'yonxao-mindmap: トピック内容をコピーしました。',
      noticeBodyCopied: 'yonxao-mindmap: 本文をコピーしました。',
      noticeSourceCopied: 'yonxao-mindmap: ソースをコピーしました。',
      noticeConfigCopied: 'yonxao-mindmap: 設定をコピーしました。',
      noticeImageExported: 'yonxao-mindmap: 画像をエクスポートしました。',
      noticeImageCopied: 'yonxao-mindmap: 画像をコピーしました。',
      noticeClipboardUnsupported:
        'yonxao-mindmap: この環境では画像のクリップボードへのコピーに対応していません。',
      noticeClipboardFocusRequired:
        'yonxao-mindmap: マップをクリックしてから画像をコピーしてください。',
      noticeTopicContentRequired: 'yonxao-mindmap: 内容は空にできません。',
      noticeTopicContentSaved: '内容を保存しました。',
      noticeSubtopicAdded: 'サブトピックを追加しました。',
      noticeSiblingTopicAdded: '兄弟トピックを追加しました。',
      noticeTopicDeleted: 'トピックを削除しました。',
      noticeRootCannotAddSibling:
        'yonxao-mindmap: ルートトピックには兄弟トピックを追加できません。',
      noticeRootCannotDeleteInMap: 'yonxao-mindmap: ルートトピックはマップビューで削除できません。',
      noticeRootCannotDelete: 'yonxao-mindmap: ルートトピックは削除できません。',

      // ── エディターメニュー ──
      editorMenuInsertMindMap: 'マインドマップを挿入',

      // ── 確認ダイアログ ──
      confirmDeleteTopic: '「{topic}」を削除しますか？',
      confirmDeleteTopicWithDescendants:
        '「{topic}」とその {count} 個のサブトピックを削除しますか？',

      // ── トピック編集パネル ──
      topicEditPanel: 'トピック編集パネル',
      content: '内容',
      expandText: '大テキストエディターを開く',
      editContent: '内容を編集',
      apply: '適用',
      color: '色',
      icon: 'アイコン',
      noIcon: 'アイコンなし',
      fontWeight: 'フォントウェイト',
      lineHeight: '行の高さ',
      maxWidth: '最大幅',
      fontCustomPlaceholder: "'Sarasa Gothic', 'Noto Sans CJK JP', sans-serif",
      fontFamilyInvalid:
        "有効なCSSフォントファミリーリストを入力してください。例：'Hiragino Mincho', 'Noto Serif CJK JP', serif",
      save: '保存',
      cancel: 'キャンセル',

      // ── トピックボタン ──
      addSiblingLeft: '左に兄弟トピックを追加',
      addSiblingRight: '右に兄弟トピックを追加',
      addSiblingBefore: '前に兄弟トピックを追加',
      addSiblingAfter: '後に兄弟トピックを追加',
      addSubtopic: 'サブトピックを追加',
      edit: '編集',

      // ── 右クリックメニュー ──
      copyTopicContent: '内容をコピー',
      copySubtreeBody: 'サブツリーをコピー',
      copyIndentedSubtree: 'インデントされたサブツリーをコピー',
      expandSubtopics: 'サブトピックを展開',
      collapseSubtopics: 'サブトピックを折りたたむ',
      expandAllSubtopics: 'すべてのサブトピックを展開',
      collapseAllSubtopics: 'すべてのサブトピックを折りたたむ',
      deleteTopic: 'トピックを削除',
      copyBody: '本文をコピー',
      copyIndentedBody: 'インデントされた本文をコピー',
      copySource: 'ソースをコピー',
      copyConfig: '設定をコピー',
      exportPng: '画像をエクスポート',
      copyPng: '画像をコピー',
      deleteMindMap: 'コードブロックを削除',

      // ── 設定パネル：タイトル、タブ、操作、ステータス ──
      configPanel: '設定パネル',
      configRules: '設定ルール',
      configRulesTooltip:
        '設定優先順位：\nトピック属性 > コードブロック設定 > プラグイングローバル既定設定 > プラグイン内蔵既定値\n\n色の優先順位：\nトピック属性 color > 既定トピック色 > テーマ配色\n\n保存時のクリーンアップロジック：\n設定値が有効な既定値（グローバル既定設定またはプラグイン内蔵既定値）と同じ場合、設定を簡潔に保つために削除されます。',
      display: '表示',
      structure: '構造',
      font: 'フォント',
      interaction: '操作',
      advanced: '詳細',
      saveAndClose: '保存して閉じる',
      close: '閉じる',
      configStatusSaved: '設定を保存しました。',
      configStatusValid: '設定の構文は有効です。',
      configStatusInvalid: '設定の構文エラー：{message}',

      // ── 設定パネル：プレースホルダー ──
      auto: '自動',
      defaultValue: '既定値',

      // ── 設定パネル：表示タブ ──
      mapArea: 'マップエリア',
      mapHeight: 'マップの高さ',
      mapHeightHelp: '空欄で自動高さ。キャンバス下部をドラッグしてもこの値が書き込まれます。',
      viewFit: 'ビューフィット',
      viewFitHelp:
        'マップを開いたときの初期ズームを制御します。元のサイズは文字を安定して表示。ビューフィットはマップ全体を表示しようとします。',
      fitViewNoUpscale: 'ビューフィットで拡大しない',
      fitViewNoUpscaleHelp:
        '有効にすると、ビューフィットは大きなマップのみ縮小。小さいマップは元の倍率を維持します。',
      fitViewMaxScale: 'ビューフィット最大倍率',
      fitViewMaxScaleHelp:
        '「ビューフィットで拡大しない」が無効な場合、小さいマップの最大拡大倍率を制限します。',
      sourceArea: 'ソースエリア',
      sourceHeight: 'ソースの高さ',
      sourceHeightHelp: 'ソースモードは独立した高さを持ち、マップの高さに影響しません。',
      saveFullConfig: 'すべての設定項目を保存',
      saveFullConfigHelp:
        '有効にするとデフォルト値を含む全設定を保存。共有や移行後の一貫性に便利。無効の場合は既定値と異なる設定のみ保存。',
      visibilityAlways: '常にすべてのボタンを表示',
      visibilityToggleAlways: '折りたたみボタンは常時表示、その他はホバー表示',
      visibilityHover: 'すべてのボタンをホバー表示',

      // ── 設定パネル：操作タブ ──
      toolbar: 'ツールバー',
      toolbarCorner: 'ツールバーの角',
      toolbarPlacement: 'ツールバーの位置',
      toolbarTopLeft: '左上',
      toolbarTopRight: '右上',
      toolbarBottomLeft: '左下',
      toolbarBottomRight: '右下',
      toolbarInside: '内側',
      toolbarOutside: '外側',
      topicButtons: 'トピックボタン',
      topicControlVisibility: 'トピックボタンの表示設定',
      topicControlVisibilityHelp:
        '編集、折りたたみ、追加ボタンの表示タイミングを制御。リーディングビューでは編集ボタンは無効。',
      input: 'マウスとキーボード',
      wheelZoomHelp:
        '無効にするとホイールで Obsidian ページをスクロール。有効にするとホイールでマップをズーム。',
      tabIndent: 'Tab キーでトピックレベル調整',
      tabIndentHelp:
        '有効にすると、ソースモードで Tab / Shift+Tab が現在の行のトピックレベルを調整します。',

      // ── 設定パネル：タブ ──
      colorSchemeSection: '配色',
      defaultTopicColor: '既定トピック色',
      themeScheme: 'テーマ配色',
      defaultTopicColorHelp:
        '空欄で現在のテーマ自動配色を使用。設定するとテーマ自動配色を上書きしますが、トピック属性 color が優先されます。',
      colorOverrideWarning:
        '現在のテーマはブランチごとに色を割り当てます。既定トピック色を設定すると、それらのブランチ色は表示されません。',
      buttonSection: 'ボタンの色',
      buttonColorMode: 'ボタンの色',
      buttonColorModeHelp: '折りたたみ、編集、追加ボタンの色モード。',
      buttonColorAccent: 'アクセントカラーを継承',
      buttonColorSubtle: '控えめ色',
      buttonColorTopic: 'トピック色',
      buttonColorCustom: 'カスタム',
      buttonColorHelp: 'ボタンのカスタム色。カスタムモード選択時のみ有効。',

      // ── 設定パネル：構造タブ ──
      layoutType: 'レイアウトタイプ',
      connectorStyle: 'コネクタースタイル',
      topicMaxWidth: 'トピック最大幅',
      connectorAndExpansion: 'コネクターと展開',
      connectorFixedHelp:
        'マインドマップレイアウトのみコネクタースタイルを選択できます。他のレイアウトは構造を保つため固定折れ線を使用します。',
      branchExpansionElbowOnlyHelp:
        'サブトピック展開方式は実際のコネクターが折れ線の場合のみ有効です。',
      topicMaxWidthHelp: '範囲：120-2000 px。',
      global: 'グローバル',
      level1Topic: 'レベル1',
      level2Topic: 'レベル2',
      level3Topic: 'レベル3',
      branchExpansionSide: '自然展開',
      branchExpansionHanging: '吊り下げ展開',

      // ── 設定パネル：フォントタブ ──
      fontGlobalSection: 'グローバルフォント',
      fontFamilyHelp:
        'Obsidian テキストフォントをデフォルトに使用。プリセットを選ぶか、カスタムを選択して CSS font-family を入力。',
      fontSizeHelp: '単位はピクセル。トピックコンテンツのサイズを制御します。',
      fontWeightHelp: 'フォントウェイトは CSS 標準範囲 100-900 に従います。',
      fontLineHeightHelp:
        'SVG テキストの行間ピクセル数。実用的な値は文字サイズの約 1.3-1.5 倍です。',
      fontLevelSection: 'レベルごとの上書き',
      fontClearLevel: 'このレベルをクリア',

      // ── 設定パネル：詳細タブ ──
      advancedSection: '設定ソース',

      // ── 設定パネル：レイアウトグループ ──
      layoutGroupMindmap: 'マインドマップ',
      layoutGroupTree: 'ツリー図',
      layoutGroupOrg: '組織図',
      layoutGroupTimeline: 'タイムライン',
      layoutGroupRadial: 'ラジアルマップ',
      layoutGroupFishbone: 'フィッシュボーン図',
      layoutGroupTreeTable: 'ツリーテーブル',
      layoutMindmapRight: '右向きマインドマップ',
      layoutMindmapLeft: '左向きマインドマップ',
      layoutMindmapBidirectional: '双方向マインドマップ',
      layoutMindmapUp: '上向きマインドマップ',
      layoutMindmapDown: '下向きマインドマップ',
      layoutMindmapVertical: '垂直双方向マインドマップ',
      layoutTree: 'ツリー図',
      layoutTreeRight: '右向きツリー図',
      layoutTreeLeft: '左向きツリー図',
      layoutOrg: '組織図',
      layoutOrgRight: '右向き組織図',
      layoutTimeline: 'タイムライン',
      layoutTimelineUp: '上側タイムライン',
      layoutTimelineDown: '下側タイムライン',
      layoutRadial: 'ラジアルマップ',
      layoutFishboneLeft: '左向きフィッシュボーン図',
      layoutFishboneRight: '右向きフィッシュボーン図',
      layoutTreeTable: 'ツリーテーブル',
      layoutTreeTableStepped: '段付きツリーテーブル',
      curve: '曲線',
      straight: '直線',
      elbow: '折れ線',

      // ── 設定パネル：テーマ選択 ──
      colorDefault: '既定：Obsidian に従う',
      colorOcean: 'オーシャン：青系',
      colorForest: 'フォレスト：緑系',
      colorSunset: 'サンセット：橙赤系',
      colorMono: 'モノクロ：フォーマル',
      colorRainbow: 'レインボー：鮮やか',
      colorPastelRainbow: 'パステルレインボー：長期読書向け',
      colorNeonRainbow: 'ネオンレインボー：ダーク表示向け',

      // ── フォントドロップダウン ──
      fontGroupInherit: '継承とカスタム',
      fontGroupObsidian: 'Obsidian',
      fontGroupChinese: '中国語フォント',
      fontGroupSystem: 'システムフォント',
      fontGroupMonospace: '等幅フォント',
      fontInherit: 'グローバルフォントを継承',
      fontCustom: 'カスタム',
      fontObsidianInterface: 'Obsidian インターフェースフォント',
      fontObsidianText: 'Obsidian 本文フォント',
      fontObsidianMonospace: 'Obsidian 等幅フォント',
      fontChineseSans: '中国語サンセリフ',
      fontChineseSerif: '中国語セリフ',
      fontChineseKaiti: '中国語楷書',
      fontChineseFangsong: '中国語仿宋',
      fontChineseMicrosoftYaHei: 'Microsoft YaHei',
      fontChinesePingFang: 'PingFang',
      fontChineseSourceHanSans: 'Source Han Sans',
      fontChineseSourceHanSerif: 'Source Han Serif',
      fontChineseLxgwWenkai: 'LXGW WenKai',
      fontSystemSans: 'システムサンセリフ',
      fontSystemSerif: 'システムセリフ',
      fontSystemMonospace: 'システム等幅',
      fontMonospaceCjkStack: 'CJK 等幅スタック',
      fontMonospaceSarasa: 'Sarasa Gothic',
      fontMonospaceLxgwWenkai: 'LXGW WenKai Mono',
      fontMonospaceJetbrains: 'JetBrains Mono',
      fontMonospaceCascadia: 'Cascadia Mono',
    })
  ),
  ko: Object.freeze(
    createAdditionalLocale({
      // ── 플러그인 설정 페이지 ──
      settingsDescription:
        '여기에서 플러그인 전체 기본 설정을 구성합니다. 개별 yxmm 코드 블록 상단의 설정 블록이 계속 우선합니다.',
      language: '언어',
      languageDesc:
        'yonxao-mindmap UI 텍스트를 제어합니다. 초기 기본 언어는 현재 Obsidian 언어를 따릅니다.',
      globalDefaultValueConfigPanel: '전역 기본값 설정 패널',
      globalDefaultDesc:
        '모든 yxmm 코드 블록의 기본 설정으로 사용됩니다. 블록 설정과 주제 속성이 계속 우선합니다.',
      editDefaults: '기본값 편집',
      resetDefaults: '내장 기본값으로 재설정',
      noticeResetDefaults: 'yonxao-mindmap: 내장 기본값으로 복원되었습니다.',
      noticeDefaultsSaved: 'yonxao-mindmap: 전역 기본값 설정이 저장되었습니다.',
      summaryTitle: '현재 전역 기본 설정 요약:',
      noDefaults: '전역 기본 설정이 없습니다. 모든 맵은 플러그인 내장 기본값을 사용합니다.',
      theme: '테마',
      layout: '레이아웃',
      connector: '연결선 스타일',
      fixedElbow: '고정 꺾은선',
      branchExpansion: '하위 주제 확장 방식',
      branchExpansionElbowOnly: '꺾은선 연결에서만 사용 가능',
      branchExpansionUnsupported: '현재 레이아웃에서 지원 안 함',
      wheelZoom: '마우스 휠 확대/축소',
      enabled: '켜짐',
      disabled: '꺼짐',
      topicFont: '주제 글꼴',
      topicFontSize: '주제 글자 크기',

      // ── 툴바 ──
      showSource: '소스 표시',
      showMap: '맵 표시',
      sourceFallback: 'Src',
      mapFallback: 'Map',
      config: '설정',
      fitView: '화면에 맞춤',
      originalSize: '원래 크기',
      fullscreen: '전체 화면',
      exitFullscreen: '전체 화면 종료',
      zoomIn: '확대',
      zoomOut: '축소',
      resetCollapse: '접기 상태 재설정',
      dragToolbar: '도구 모음 드래그',

      // ── 소스 뷰 ──
      configSection: '설정', // source.tab.config
      bodySection: '본문', // source.tab.body
      sourceEditable:
        '소스를 편집할 수 있습니다. 맵으로 돌아가거나 Alt/Option+S로 Markdown에 씁니다.',
      sourceDirty: '소스가 변경되었습니다. 맵으로 돌아가거나 Alt/Option+S로 Markdown에 씁니다.',
      sourceSynced: '소스가 현재 Markdown 코드 블록과 동기화되었습니다.',
      resizeCanvas: '캔버스 높이 드래그 조정',

      // ── 알림 메시지 ──
      noticeConfigSaved: 'yonxao-mindmap: 설정이 저장되었습니다.',
      noticeTopicCopied: 'yonxao-mindmap: 주제 내용이 복사되었습니다.',
      noticeBodyCopied: 'yonxao-mindmap: 본문이 복사되었습니다.',
      noticeSourceCopied: 'yonxao-mindmap: 소스가 복사되었습니다.',
      noticeConfigCopied: 'yonxao-mindmap: 설정이 복사되었습니다.',
      noticeImageExported: 'yonxao-mindmap: 이미지가 내보내졌습니다.',
      noticeImageCopied: 'yonxao-mindmap: 이미지가 복사되었습니다.',
      noticeClipboardUnsupported:
        'yonxao-mindmap: 이 환경에서는 이미지를 클립보드에 복사할 수 없습니다.',
      noticeClipboardFocusRequired:
        'yonxao-mindmap: 맵을 먼저 클릭한 후 이미지를 다시 복사해 주세요.',
      noticeTopicContentRequired: 'yonxao-mindmap: 내용은 비워둘 수 없습니다.',
      noticeTopicContentSaved: '내용이 저장되었습니다.',
      noticeSubtopicAdded: '하위 주제가 추가되었습니다.',
      noticeSiblingTopicAdded: '형제 주제가 추가되었습니다.',
      noticeTopicDeleted: '주제가 삭제되었습니다.',
      noticeRootCannotAddSibling: 'yonxao-mindmap: 루트 주제에는 형제 주제를 추가할 수 없습니다.',
      noticeRootCannotDeleteInMap: 'yonxao-mindmap: 루트 주제는 맵 보기에서 삭제할 수 없습니다.',
      noticeRootCannotDelete: 'yonxao-mindmap: 루트 주제는 삭제할 수 없습니다.',

      // ── 에디터 메뉴 ──
      editorMenuInsertMindMap: '마인드맵 삽입',

      // ── 확인 대화상자 ──
      confirmDeleteTopic: '"{topic}"을(를) 삭제하시겠습니까?',
      confirmDeleteTopicWithDescendants:
        '"{topic}"과(와) 해당 {count}개의 하위 주제를 삭제하시겠습니까?',

      // ── 주제 편집 패널 ──
      topicEditPanel: '주제 편집 패널',
      content: '내용',
      expandText: '큰 텍스트 편집기 열기',
      editContent: '내용 편집',
      apply: '적용',
      color: '색상',
      icon: '아이콘',
      noIcon: '아이콘 없음',
      font: '글꼴',
      fontWeight: '글꼴 두께',
      lineHeight: '줄 높이',
      maxWidth: '최대 너비',
      fontCustomPlaceholder: "'Pretendard', 'Noto Sans KR', sans-serif",
      fontFamilyInvalid: "올바른 CSS font-family 목록을 입력하세요. 예: 'Noto Serif KR', serif",
      save: '저장',
      cancel: '취소',

      // ── 주제 버튼 ──
      addSiblingLeft: '왼쪽에 형제 주제 추가',
      addSiblingRight: '오른쪽에 형제 주제 추가',
      addSiblingBefore: '앞에 형제 주제 추가',
      addSiblingAfter: '뒤에 형제 주제 추가',
      addSubtopic: '하위 주제 추가',
      edit: '편집',

      // ── 오른쪽 클릭 메뉴 ──
      copyTopicContent: '내용 복사',
      copySubtreeBody: '서브트리 복사',
      copyIndentedSubtree: '들여쓰기된 서브트리 복사',
      expandSubtopics: '하위 주제 펼치기',
      collapseSubtopics: '하위 주제 접기',
      expandAllSubtopics: '모든 하위 주제 펼치기',
      collapseAllSubtopics: '모든 하위 주제 접기',
      deleteTopic: '주제 삭제',
      copyBody: '본문 복사',
      copyIndentedBody: '들여쓰기된 본문 복사',
      copySource: '소스 복사',
      copyConfig: '설정 복사',
      exportPng: '이미지 내보내기',
      copyPng: '이미지 복사',
      deleteMindMap: '코드 블록 삭제',

      // ── 설정 패널：제목, 탭, 작업, 상태 ──
      configPanel: '설정 패널',
      configRules: '설정 규칙',
      configRulesTooltip:
        '설정 우선 순위:\n주제 속성 > 코드 블록 설정 > 플러그인 전역 기본값 설정 > 플러그인 내장 기본값\n\n색상 우선 순위:\n주제 속성 color > 기본 주제 색상 > 테마 구성\n\n저장 정리 로직:\n설정값이 유효한 기본값(전역 기본값 설정 또는 플러그인 내장 기본값)과 같으면 설정을 간결하게 유지하기 위해 제거됩니다.',
      display: '기본',
      structure: '구조',
      interaction: '상호 작용',
      advanced: '고급',
      saveAndClose: '저장 후 닫기',
      close: '닫기',
      configStatusSaved: '설정이 저장되었습니다.',
      configStatusValid: '설정 구문이 유효합니다.',
      configStatusInvalid: '설정 구문 오류: {message}',

      // ── 설정 패널：플레이스홀더 ──
      auto: '자동',
      defaultValue: '기본값',

      // ── 설정 패널：표시 탭 ──
      mapArea: '맵 영역',
      mapHeight: '맵 높이',
      mapHeightHelp: '비우면 자동 높이. 캔버스 하단을 드래그해도 이 값이 기록됩니다.',
      viewFit: '화면 맞춤',
      viewFitHelp:
        '맵을 열 때의 초기 확대/축소를 제어합니다. 원래 크기는 텍스트를 안정적으로 표시하고, 화면 맞춤은 맵 전체를 보여주려고 합니다.',
      fitViewNoUpscale: '화면 맞춤에서 확대 안 함',
      fitViewNoUpscaleHelp:
        '활성화하면 화면 맞춤이 큰 맵만 축소하고 작은 맵은 원래 배율을 유지합니다.',
      fitViewMaxScale: '화면 맞춤 최대 배율',
      fitViewMaxScaleHelp:
        '"화면 맞춤에서 확대 안 함"이 비활성화된 경우 작은 맵의 최대 확대 배율을 제한합니다.',
      sourceArea: '소스 영역',
      sourceHeight: '소스 높이',
      sourceHeightHelp: '소스 모드는 독립적인 높이를 가지며 맵 높이에 영향을 주지 않습니다.',
      saveFullConfig: '모든 설정 항목 저장',
      saveFullConfigHelp:
        '활성화하면 기본값을 포함한 모든 설정을 저장하여 공유나 이전 후 일관성 유지에 편리합니다. 비활성화 시 기본값과 다른 설정만 저장합니다.',
      visibilityAlways: '항상 모든 버튼 표시',
      visibilityToggleAlways: '접기 버튼은 항상 표시, 나머지는 호버 시 표시',
      visibilityHover: '모든 버튼 호버 시 표시',

      // ── 설정 패널：상호 작용 탭 ──
      toolbar: '도구 모음',
      toolbarCorner: '도구 모음 코너',
      toolbarPlacement: '도구 모음 위치',
      toolbarTopLeft: '왼쪽 위',
      toolbarTopRight: '오른쪽 위',
      toolbarBottomLeft: '왼쪽 아래',
      toolbarBottomRight: '오른쪽 아래',
      toolbarInside: '안쪽',
      toolbarOutside: '바깥쪽',
      topicButtons: '주제 버튼',
      topicControlVisibility: '주제 버튼 표시 방식',
      topicControlVisibilityHelp:
        '편집, 접기, 추가 버튼의 표시 시점을 제어합니다. 읽기 보기에서는 편집 버튼이 비활성화됩니다.',
      input: '마우스와 키보드',
      wheelZoomHelp:
        '비활성화 시 휠로 Obsidian 페이지를 스크롤합니다. 활성화 시 휠로 맵을 확대/축소합니다.',
      tabIndent: 'Tab 키로 주제 레벨 조정',
      tabIndentHelp: '활성화하면 소스 모드에서 Tab/Shift+Tab이 현재 줄의 주제 레벨을 조정합니다.',

      // ── 설정 패널：색상 탭 ──
      colorSchemeSection: '배색',
      defaultTopicColor: '기본 주제 색상',
      themeScheme: '테마 구성',
      defaultTopicColorHelp:
        '비우면 현재 테마 자동 색상을 사용합니다. 설정하면 테마 자동 색상을 덮어쓰지만 주제 속성 color가 우선합니다.',
      colorOverrideWarning:
        '현재 테마는 가지별로 색상을 할당합니다. 기본 주제 색상을 설정하면 해당 가지 색상이 표시되지 않습니다.',
      buttonSection: '버튼 색상',
      buttonColorMode: '버튼 색상',
      buttonColorModeHelp: '접기, 편집, 추가 버튼의 색상 모드입니다.',
      buttonColorAccent: '강조 색상 상속',
      buttonColorSubtle: '절제된 색상',
      buttonColorTopic: '주제 색상',
      buttonColorCustom: '사용자 정의',
      buttonColorHelp: '버튼의 사용자 정의 색상입니다. 사용자 정의 모드 선택 시에만 적용됩니다.',

      // ── 설정 패널：구조 탭 ──
      layoutType: '레이아웃 유형',
      connectorStyle: '연결선 스타일',
      topicMaxWidth: '주제 최대 너비',
      connectorAndExpansion: '연결선과 확장',
      connectorFixedHelp:
        '마인드맵 레이아웃만 연결선 스타일을 선택할 수 있습니다. 다른 레이아웃은 구조를 유지하기 위해 고정 꺾은선을 사용합니다.',
      branchExpansionElbowOnlyHelp:
        '하위 주제 확장 방식은 실제 연결선이 꺾은선인 경우에만 적용됩니다.',
      topicMaxWidthHelp: '범위: 120-2000 px.',
      global: '전역',
      level1Topic: '레벨 1',
      level2Topic: '레벨 2',
      level3Topic: '레벨 3',
      branchExpansionSide: '자연 확장',
      branchExpansionHanging: '매달기 확장',

      // ── 설정 패널：글꼴 탭 ──
      fontGlobalSection: '전역 글꼴',
      fontFamilyHelp:
        '기본값으로 Obsidian 본문 글꼴을 사용합니다. 프리셋을 선택하거나 사용자 정의를 선택한 후 CSS font-family를 입력하세요.',
      fontSizeHelp: '단위는 픽셀(px)이며 주제 내용 크기를 제어합니다.',
      fontWeightHelp: '글꼴 두께는 CSS 표준 범위 100-900을 따릅니다.',
      fontLineHeightHelp:
        'SVG 텍스트 줄 간격(px)입니다. 실용적인 값은 보통 글꼴 크기의 1.3-1.5배입니다.',
      fontLevelSection: '레벨별 덮어쓰기',
      fontClearLevel: '이 레벨 지우기',

      // ── 설정 패널：고급 탭 ──
      advancedSection: '설정 소스',

      // ── 설정 패널：레이아웃 그룹 ──
      layoutGroupMindmap: '마인드맵',
      layoutGroupTree: '트리 다이어그램',
      layoutGroupOrg: '조직도',
      layoutGroupTimeline: '타임라인',
      layoutGroupRadial: '레이디얼 맵',
      layoutGroupFishbone: '생선뼈 다이어그램',
      layoutGroupTreeTable: '트리 테이블',
      layoutMindmapRight: '오른쪽 마인드맵',
      layoutMindmapLeft: '왼쪽 마인드맵',
      layoutMindmapBidirectional: '양방향 마인드맵',
      layoutMindmapUp: '위쪽 마인드맵',
      layoutMindmapDown: '아래쪽 마인드맵',
      layoutMindmapVertical: '수직 양방향 마인드맵',
      layoutTree: '트리 다이어그램',
      layoutTreeRight: '오른쪽 트리 다이어그램',
      layoutTreeLeft: '왼쪽 트리 다이어그램',
      layoutOrg: '조직도',
      layoutOrgRight: '오른쪽 조직도',
      layoutTimeline: '타임라인',
      layoutTimelineUp: '위쪽 타임라인',
      layoutTimelineDown: '아래쪽 타임라인',
      layoutRadial: '레이디얼 맵',
      layoutFishboneLeft: '왼쪽 생선뼈 다이어그램',
      layoutFishboneRight: '오른쪽 생선뼈 다이어그램',
      layoutTreeTable: '트리 테이블',
      layoutTreeTableStepped: '계단형 트리 테이블',
      curve: '곡선',
      straight: '직선',
      elbow: '꺾은선',

      // ── 설정 패널：테마 선택 ──
      colorDefault: '기본: Obsidian 따르기',
      colorOcean: '오션: 파란색 계열',
      colorForest: '포레스트: 초록색 계열',
      colorSunset: '선셋: 주황-빨강 계열',
      colorMono: '모노크롬: 공식 문서',
      colorRainbow: '레인보우: 선명한 채도',
      colorPastelRainbow: '파스텔 레인보우: 장시간 독서',
      colorNeonRainbow: '네온 레인보우: 다크 모드 전시',

      // ── 글꼴 드롭다운 ──
      fontGroupInherit: '상속 및 사용자 정의',
      fontGroupObsidian: 'Obsidian',
      fontGroupChinese: '중국어 글꼴',
      fontGroupSystem: '시스템 글꼴',
      fontGroupMonospace: '고정폭 글꼴',
      fontInherit: '전역 글꼴 상속',
      fontCustom: '사용자 정의',
      fontObsidianInterface: 'Obsidian 인터페이스 글꼴',
      fontObsidianText: 'Obsidian 본문 글꼴',
      fontObsidianMonospace: 'Obsidian 고정폭 글꼴',
      fontChineseSans: '중국어 산세리프',
      fontChineseSerif: '중국어 세리프',
      fontChineseKaiti: '중국어 해서체',
      fontChineseFangsong: '중국어 방송체',
      fontChineseMicrosoftYaHei: 'Microsoft YaHei',
      fontChinesePingFang: 'PingFang',
      fontChineseSourceHanSans: 'Source Han Sans',
      fontChineseSourceHanSerif: 'Source Han Serif',
      fontChineseLxgwWenkai: 'LXGW WenKai',
      fontSystemSans: '시스템 산세리프',
      fontSystemSerif: '시스템 세리프',
      fontSystemMonospace: '시스템 고정폭',
      fontMonospaceCjkStack: 'CJK 고정폭 스택',
      fontMonospaceSarasa: 'Sarasa Gothic',
      fontMonospaceLxgwWenkai: 'LXGW WenKai Mono',
      fontMonospaceJetbrains: 'JetBrains Mono',
      fontMonospaceCascadia: 'Cascadia Mono',
    })
  ),
});
