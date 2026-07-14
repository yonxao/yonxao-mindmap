export default {
  extends: ['stylelint-config-standard'],
  rules: {
    // 主题状态和宿主覆盖样式依赖有意的级联顺序，不按单文件特异性排序。
    'no-descending-specificity': null,
    // MathJax 会在宿主 DOM 中生成该自定义元素。
    'selector-type-no-unknown': [true, { ignoreTypes: ['mjx-container'] }],
  },
};
