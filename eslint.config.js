// @ts-check
import eslint from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Business modules (ARQ-01-API §3). `health` has no layers of its own beyond its module.
const MODULES = ['auth', 'users', 'progress', 'leaderboard', 'levels', 'health'];

const NEST_PRISMA_AND_LIBRARIES = [
  '@nestjs/*',
  '@prisma/*',
  'prisma',
  'pg',
  'argon2',
  'jsonwebtoken',
  'express',
];

/** `no-restricted-imports` entry that keeps the Clean Architecture dependency rule (ARQ-01-API §2, §8). */
const restrict = (patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

const domainRule = restrict([
  {
    group: NEST_PRISMA_AND_LIBRARIES,
    message: 'domain/ is plain TypeScript: no NestJS, Prisma or infrastructure libraries (RNF-12).',
  },
  {
    group: ['**/application/**', '**/presentation/**', '**/infrastructure/**'],
    message: 'domain/ is layer 1: it cannot import the layers around it.',
  },
]);

const applicationRule = restrict([
  {
    group: ['@prisma/*', 'prisma', 'pg', 'argon2', 'jsonwebtoken'],
    message: 'application/ talks to ports (interfaces), not to Prisma or other libraries (RNF-12).',
  },
  {
    group: ['**/presentation/**', '**/infrastructure/**'],
    message: 'application/ cannot import infrastructure/ or presentation/: use a port (RNF-12).',
  },
]);

/** A module never imports the infrastructure/ of another module (ARQ-01-API §3). */
const otherModulesInfrastructure = MODULES.map((name) => ({
  files: [`src/modules/${name}/**/*.ts`],
  rules: restrict([
    {
      group: MODULES.filter((other) => other !== name).map(
        (other) => `**/${other}/infrastructure/**`,
      ),
      message: 'A module cannot import the infrastructure/ of another module (ARQ-01-API §3).',
    },
  ]),
}));

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'docs', '.claude', 'src/prisma/generated'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: {
        projectService: { allowDefaultProject: ['*.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        // Nest reads constructor parameter types at runtime: keep those imports as values.
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // SEC-WEB-05: only parameterised queries.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name=/^\\$(query|execute)RawUnsafe$/]',
          message:
            'Unsafe raw SQL is forbidden (SEC-WEB-05). Use Prisma or $queryRaw with parameters.',
        },
      ],
    },
  },
  // Layer rules (the later blocks win over the earlier ones for the same files).
  ...otherModulesInfrastructure,
  { files: ['src/**/domain/**/*.ts'], rules: domainRule },
  { files: ['src/**/application/**/*.ts'], rules: applicationRule },
  {
    // Tests may use Jest and Nest testing helpers freely.
    files: ['test/**/*.ts', '**/*.spec.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },
  eslintConfigPrettier,
);
