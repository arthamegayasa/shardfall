// ESLint flat config (Lead Programmer). Enforces docs/tech/coding-standards.md sections 3 and 4.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Modules under src/ and the folders each one may NOT import (architecture.md section 5). */
const MODULE_BANS = {
  core: ['sim', 'render', 'ui', 'audio', 'app', 'content'],
  content: ['sim', 'render', 'ui', 'audio', 'app'],
  sim: ['render', 'ui', 'audio', 'app'],
  render: ['sim', 'ui', 'audio', 'app'],
  ui: ['sim', 'render', 'audio', 'app'],
  audio: ['sim', 'render', 'ui', 'app'],
};

/** Other modules are reached only through their index.ts (core also exposes dom.ts). */
const indexOnly = (self) =>
  ['core', 'content', 'sim', 'render', 'ui', 'audio']
    .filter((m) => m !== self)
    .map((m) => ({
      group: [`**/${m}/**`, `!**/${m}/index.ts`, ...(m === 'core' ? ['!**/core/dom.ts'] : [])],
      message: `Import ${m} only through src/${m}/index.ts (coding-standards 3.2).`,
    }));

const banned = (self) =>
  (MODULE_BANS[self] ?? []).map((m) => ({
    group: [`**/${m}/**`, `**/${m}`],
    message: `src/${self} must not import src/${m} (architecture.md section 5).`,
    // core/contracts may reference GameData from content as a type only (architecture.md section 19).
    ...(self === 'core' && m === 'content' ? { allowTypeImports: true } : {}),
  }));

const threeBan = {
  group: ['three', 'three/**'],
  message: 'three.js is allowed only in src/render (and src/app).',
};

const domBan = {
  group: ['**/core/dom.ts'],
  message: 'DOM contracts are for render, ui, and app only (tsconfig.sim.json excludes them).',
};

const restrictImports = (self, extra = []) => ({
  '@typescript-eslint/no-restricted-imports': [
    'error',
    { patterns: [...banned(self), ...indexOnly(self), ...extra] },
  ],
});

const SIM_MATH = [
  'sin',
  'cos',
  'tan',
  'atan2',
  'atan',
  'asin',
  'acos',
  'exp',
  'log',
  'pow',
  'hypot',
  'cbrt',
];

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'dist/',
      'dist-e2e/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'tests/out/',
      'content/generated/',
      // TODO(AD, M1-05): lint art/**/*.ts and tools/art once moved to .ts and src/core/math.
      'art/',
      'tools/art/',
      'audio/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.tools.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': [
        'error',
        { selector: 'ForInStatement', message: 'for...in is banned (coding-standards 4.2).' },
        {
          selector: 'TSEnumDeclaration',
          message: 'Use an `as const` object (coding-standards 1.2).',
        },
        { selector: "UnaryExpression[operator='delete']", message: 'No delete on objects (4.3).' },
      ],
      'no-restricted-exports': [
        'error',
        {
          restrictDefaultExports: {
            direct: true,
            named: true,
            defaultFrom: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
  // Plain JS config files are not part of a TS project.
  {
    files: ['**/*.js', '**/*.mjs'],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ...tseslint.configs.disableTypeChecked.languageOptions,
      globals: globals.node,
    },
  },
  {
    files: ['eslint.config.js', 'vite.config.ts', 'playwright.config.ts'],
    rules: { 'no-restricted-exports': 'off' },
  },
  // Whole src/: browser globals, no Math.random, no console outside the logger, no process.
  {
    files: ['src/**/*.ts'],
    languageOptions: { globals: globals.browser },
    rules: {
      'no-console': 'error',
      'no-restricted-globals': ['error', { name: 'process', message: 'No Node globals in src/.' }],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use createRng from src/core (4.2).' },
      ],
    },
  },
  { files: ['src/app/logger.ts'], rules: { 'no-console': 'off' } },
  // Pure modules: deterministic, no DOM, no wall clock (architecture 4.2).
  {
    files: ['src/sim/**/*.ts', 'src/core/**/*.ts', 'src/content/**/*.ts'],
    ignores: [
      'src/core/dom.ts',
      'src/core/contracts/render.ts',
      'src/core/contracts/ui.ts',
      'src/core/contracts/e2e.ts',
    ],
    languageOptions: { globals: {} },
    rules: {
      'no-restricted-globals': [
        'error',
        ...[
          'Date',
          'performance',
          'setTimeout',
          'setInterval',
          'requestAnimationFrame',
          'crypto',
          'window',
          'document',
          'navigator',
          'localStorage',
          'process',
        ].map((name) => ({
          name,
          message: `${name} is banned in pure modules (architecture 4.2).`,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        { selector: 'ForInStatement', message: 'for...in is banned (coding-standards 4.2).' },
        {
          selector: 'TSEnumDeclaration',
          message: 'Use an `as const` object (coding-standards 1.2).',
        },
        { selector: "UnaryExpression[operator='delete']", message: 'No delete on objects (4.3).' },
        {
          selector: "MetaProperty[meta.name='import']",
          message: 'No import.meta in pure modules (4.2).',
        },
      ],
    },
  },
  // Sim only: deterministic math (src/core/math is the exception that implements it).
  {
    files: ['src/sim/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Use the sim RNG streams (4.3).' },
        ...SIM_MATH.map((property) => ({
          object: 'Math',
          property,
          message: `Math.${property} is not deterministic across engines. Use src/core math (4.2).`,
        })),
      ],
    },
  },
  { files: ['src/core/**/*.ts'], rules: restrictImports('core', [threeBan]) },
  { files: ['src/content/**/*.ts'], rules: restrictImports('content', [threeBan, domBan]) },
  { files: ['src/sim/**/*.ts'], rules: restrictImports('sim', [threeBan, domBan]) },
  { files: ['src/render/**/*.ts'], rules: restrictImports('render') },
  { files: ['src/ui/**/*.ts'], rules: restrictImports('ui', [threeBan]) },
  { files: ['src/audio/**/*.ts'], rules: restrictImports('audio', [threeBan, domBan]) },
  { files: ['src/app/**/*.ts'], rules: restrictImports('app') },
  // Tests and tools run in Node.
  {
    files: ['tests/**/*.ts', 'tools/**/*.ts', '*.config.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ['tests/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
);
