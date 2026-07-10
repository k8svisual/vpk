import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // A leading underscore is this codebase's convention for "deliberately unused" — e.g. destructuring a
      // field off an object just to drop it (`const { overlay: _overlay, ...rest } = x`).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['packages/web/src/**/*.tsx', 'packages/web/src/**/*.ts'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      // Only the two classic hooks rules — the plugin's v7 "recommended" configs also pull in a much broader
      // React-Compiler-oriented rule set (purity, immutability, set-state-in-render, ...) this codebase was
      // never written against; enabling those wholesale would need a separate, deliberate review pass.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
