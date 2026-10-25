import js from '@eslint/js'
import lingui from 'eslint-plugin-lingui'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'src/gql'] },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      // Règles d'écriture des messages traduits (ADR 0047).
      lingui.configs['flat/recommended'],
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // Espaces insécables volontaires avant « : » dans les textes affichés.
      'no-irregular-whitespace': [
        'error',
        { skipTemplates: true, skipJSXText: true, skipStrings: true },
      ],
    },
  },
  {
    // Un texte affiché passe par Lingui (ADR 0047). La règle lit les composants et
    // les pages ; les modules de lib/ portent surtout des valeurs techniques
    // (couleurs, sélecteurs), et la relecture y suffit. Un texte sans espace
    // (nom de requête, valeur, marque) ne se signale pas : un libellé d'un seul
    // mot écrit en dur échappe donc à la règle.
    files: ['src/**/*.tsx'],
    rules: {
      'lingui/no-unlocalized-strings': [
        'error',
        {
          ignore: [
            '^\\S+$',
            // Classes, couleurs et dates techniques.
            '(^|\\s)rt-',
            'color-mix\\(',
            'T\\d\\d:\\d\\d',
          ],
          ignoreNames: [
            {
              regex: {
                pattern:
                  '^(className|style|key|type|id|href|src|rel|target|role|htmlType|refetchQueries|include)$',
              },
            },
          ],
          ignoreFunctions: [
            'graphql',
            'console.*',
            'Error',
            '*.closest',
            '*.querySelector',
            '*.querySelectorAll',
            'useSansRafraichissement',
          ],
        },
      ],
    },
  }
)
