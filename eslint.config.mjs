import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/test-output'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    // Règles TypeScript strictes — obligent le typage explicite dans tout le projet.
    // Ces règles complètent "strict: true" du tsconfig qui n'impose pas les annotations
    // explicites sur les types déjà inférables par TypeScript.
    rules: {
      // `no-inferrable-types` est activé par le preset nx/typescript : il interdit
      // d'annoter les types trivialement inférables (ex: `title: string = 'foo'`).
      // On le désactive ici car notre règle `typedef` impose l'annotation explicite
      // sur TOUS les membres de classe — y compris ceux à valeur littérale évidente.
      // Raison pédagogique : voir le type écrit aide à comprendre le contrat du code.
      '@typescript-eslint/no-inferrable-types': 'off',
      // Oblige un type de retour explicite sur toutes les fonctions et méthodes,
      // y compris les arrow functions (allowExpressions: false).
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: false,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: false,
        },
      ],
      // Idem, ciblé sur les exports publics des modules (API publique).
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      // Interdit l'utilisation de `any` — utiliser `unknown` et affiner le type.
      '@typescript-eslint/no-explicit-any': 'error',
      // Oblige les annotations de type sur :
      //   - parameter: true       → paramètres de fonction/méthode
      //   - propertyDeclaration   → propriétés de classe (ex: @Column() name: string)
      //   - memberVariableDeclaration → membres de classe (ex: private count: number)
      // variableDeclaration est délibérément false : annoter `const x: string = 'hello'`
      // est redondant et va à l'encontre des recommandations officielles TypeScript.
      '@typescript-eslint/typedef': [
        'error',
        {
          parameter: true,
          propertyDeclaration: true,
          memberVariableDeclaration: true,
          variableDeclaration: false,
        },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'],
    // Pas de règles TypeScript sur les fichiers JS (pas de types)
    rules: {},
  },
  {
    // Exemption pour les fichiers de test (*.spec.ts).
    // Les fonctions de setup Jest (describe, it, beforeEach…) sont des callbacks
    // passés en argument : imposer des types de retour serait verbeux et inutile.
    // La rigueur de typage s'applique au code de production, pas aux tests.
    files: ['**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/typedef': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
];
