import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Comparing against Date.now() during render (reminder chips, presets)
      // is deliberate here — the app re-renders on every data change anyway.
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      // ui/ files intentionally export small helpers alongside components.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
