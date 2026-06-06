// ESLint Flat Config 配置文件。
// 适用于：Obsidian 插件、普通 Node 工程、纯 JavaScript 项目。
// 职责：ESLint 负责发现代码问题；Prettier 负责代码格式化。
// 注意：不要把大量格式化规则放进 ESLint，避免和 Prettier 打架。
//
// 执行逻辑：
// npm run lint 会调用 ESLint，ESLint 自动读取这个 flat config。
// src/**/*.js 按 ESM 源码解析；*.mjs 和 scripts/**/*.mjs 按 ESM 工具脚本解析；
// dist/ 是发布/调试产物，根目录 main.js/styles.css 即使存在也视为生成产物，都不参与源码 lint。

import js from '@eslint/js';
import globals from 'globals';

const sharedGlobals = {
  // 浏览器全局变量，例如 window、document、HTMLElement、console 等。
  ...globals.browser,

  // Node 全局变量，例如 process、Buffer 等。源码由 esbuild 构建，配置/脚本由 Node 执行。
  ...globals.node,

  // ES2021 全局变量，例如 Promise、Map、Set 等。
  ...globals.es2021,

  // Obsidian 插件运行环境里常见的全局变量。
  // 如果你的代码没有直接使用 app/moment，也可以删掉这两行。
  app: 'readonly',
  moment: 'readonly',
};

const projectRules = {
  // 未使用变量：警告而不是报错。
  // 工业项目里建议开启，但插件开发阶段保留一定弹性。
  // 变量或参数以下划线开头时允许未使用，例如 _event、_unused。
  'no-unused-vars': [
    'warn',
    {
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      caughtErrorsIgnorePattern: '^_',
    },
  ],

  // 禁止使用未定义变量。
  // 这是 ESLint 推荐规则里已经开启的核心规则，这里显式写出是为了强调重要性。
  'no-undef': 'error',

  // 禁止重复声明变量。
  // 可以避免同一作用域内重复 const/let/var 造成逻辑混乱。
  'no-redeclare': 'error',

  // 禁止不可达代码。
  // 例如 return 后面继续写代码，这通常是 bug。
  'no-unreachable': 'error',

  // 禁止对 const 变量重新赋值。
  // 这类问题通常是明确 bug。
  'no-const-assign': 'error',

  // 禁止在条件判断里误写赋值。
  // 例如 if (value = true) 大多数时候是手误。
  'no-cond-assign': ['error', 'except-parens'],

  // console 不报错。
  // Obsidian 插件开发时 console.log 很常用，发布前可以手动清理。
  'no-console': 'off',

  // debugger 发布前不应该保留。
  // 开发时如果临时需要可以手动注释这条，或者用浏览器断点。
  'no-debugger': 'warn',

  // 建议使用 const。
  // 如果变量没有被重新赋值，用 const 更清晰。
  'prefer-const': 'warn',

  // 禁止 var。
  // 现代 JS 项目建议使用 const/let，作用域更清楚。
  'no-var': 'error',

  // 尽量使用 === / !==。
  // 避免隐式类型转换带来的意外行为。
  eqeqeq: ['warn', 'smart'],

  // 大括号风格：多行控制语句必须使用大括号。
  // 这能减少后续加代码时产生的隐藏 bug。
  curly: ['warn', 'multi-line'],

  // 禁止空代码块。
  // 如果确实需要空 catch，可以写注释说明。
  'no-empty': ['warn', { allowEmptyCatch: true }],
};

export default [
  // 全局忽略文件。
  // 这些文件/目录通常是依赖、构建产物、缓存、日志或系统文件，不需要 ESLint 检查。
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'coverage/**',
      '.cache/**',
      '.tmp/**',
      'temp/**',
      '*.min.js',
      '*.log',
      '.DS_Store',
    ],
  },

  // ESLint 官方推荐规则。
  // 主要用于发现常见 JS 问题，例如未定义变量、不可达代码、重复声明等。
  js.configs.recommended,

  // 业务源码使用 ESM。
  // 这部分文件会被 esbuild 打包成 dist/main.js，所以可以放心使用 import/export。
  {
    files: ['src/**/*.js'],

    languageOptions: {
      // 使用较新的 ECMAScript 语法能力。
      // 这样可以正常识别现代 JS 语法。
      ecmaVersion: 'latest',

      // src 目录是项目源码，统一使用 ESM import/export。
      sourceType: 'module',

      // 全局变量声明。
      // Obsidian 插件代码同时可能接触浏览器环境、Node 构建环境、Obsidian 提供的运行环境。
      globals: sharedGlobals,
    },

    rules: projectRules,
  },

  // 工具配置和脚本使用 ESM 的 .mjs 后缀。
  // 不在 package.json 设置 "type": "module"，是为了让 Obsidian 需要的 main.js 产物保持 CJS 语义。
  {
    files: ['**/*.mjs'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: sharedGlobals,
    },

    rules: projectRules,
  },

  // 配置文件可以适当放宽 console。
  // 例如 eslint.config.mjs、构建脚本里输出日志是合理的。
  {
    files: ['eslint.config.mjs', '*.config.mjs', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
];
