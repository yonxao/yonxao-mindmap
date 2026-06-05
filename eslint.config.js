// ESLint Flat Config 配置文件。
// 适用于：Obsidian 插件、普通 Node 工程、纯 JavaScript 项目。
// 职责：ESLint 负责发现代码问题；Prettier 负责代码格式化。
// 注意：不要把大量格式化规则放进 ESLint，避免和 Prettier 打架。

import js from '@eslint/js';
import globals from 'globals';

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

  // 项目自己的规则配置。
  {
    // 指定 ESLint 检查哪些文件。
    // 你现在主要是 main.js 和配置脚本，所以先覆盖 js/mjs/cjs 即可。
    files: ['**/*.{js,mjs,cjs}'],

    languageOptions: {
      // 使用较新的 ECMAScript 语法能力。
      // 这样可以正常识别现代 JS 语法。
      ecmaVersion: 'latest',

      // 你的 eslint.config.js 使用 import/export，所以这里按 ESM 处理。
      // 如果某些 .cjs 文件是 CommonJS，可以在下面单独 override。
      sourceType: 'module',

      // 全局变量声明。
      // Obsidian 插件代码同时可能接触浏览器环境、Node 构建环境、Obsidian 提供的运行环境。
      globals: {
        // 浏览器全局变量，例如 window、document、HTMLElement、console 等。
        ...globals.browser,

        // Node 全局变量，例如 process、Buffer、__dirname 等。
        ...globals.node,

        // ES2021 全局变量，例如 Promise、Map、Set 等。
        ...globals.es2021,

        // Obsidian 插件运行环境里常见的全局变量。
        // 如果你的代码没有直接使用 app/moment，也可以删掉这两行。
        app: 'readonly',
        moment: 'readonly',
      },
    },

    rules: {
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
    },
  },

  // CommonJS 文件单独配置。
  // 例如某些构建脚本、旧工具配置文件可能使用 require/module.exports。
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
    },
  },

  // 配置文件可以适当放宽 console。
  // 例如 eslint.config.js、构建脚本里输出日志是合理的。
  {
    files: ['eslint.config.js', '*.config.js', '*.config.mjs', 'scripts/**/*.{js,mjs,cjs}'],
    rules: {
      'no-console': 'off',
    },
  },
];