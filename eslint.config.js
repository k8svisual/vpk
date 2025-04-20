import typescriptParser from '@typescript-eslint/parser';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    files: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.js'], // Include all files in src and subdirectories
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      prettier: prettierPlugin,
    },
    rules: {
      // Basic ESLint rules
      'no-unused-vars': ['warn'],
      'no-console': ['off'],
      'eqeqeq': ['error', 'always'],
      
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': ['warn'],
      '@typescript-eslint/explicit-function-return-type': ['off'],
      
      // Prettier formatting rules
      'prettier/prettier': [
        'error',
        {
          singleQuote: true,
          semi: true,
          trailingComma: 'all',
          tabWidth: 4,
          printWidth: 150,
        },
      ],
    },
  },
];
