// Jest in ESM mode: Nest 12 packages are ESM only, so tests run with
// `node --experimental-vm-modules` (see the scripts in package.json).
// Three projects (docs/testing/ESTRATEGIA-PRUEBAS.md §2): unit (no database), integration and e2e (PostgreSQL).

import { globSync, readFileSync } from 'node:fs';

const common = {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
  // See the comment in that file: it works around Jest's handling of require(esm).
  setupFilesAfterEnv: ['<rootDir>/test/support/preload.ts'],
  rootDir: '.',
  moduleNameMapper: {
    // Source files import with the `.js` extension (nodenext); Jest resolves the `.ts` file.
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.json' }],
  },
};

/** True when a TypeScript file declares executable code (a class or a function), not only types. */
function hasExecutableCode(file) {
  const source = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  return /\b(class|function)\b|=>/.test(source);
}

/** Coverage threshold for a layer, or nothing while the layer has no executable code yet. */
function thresholdIfCodeExists(pattern, lines) {
  return globSync(pattern).some(hasExecutableCode) ? { [`./${pattern}`]: { lines } } : {};
}

/** @type {import('jest').Config} */
export default {
  projects: [
    { ...common, displayName: 'unit', testMatch: ['<rootDir>/test/unit/**/*.spec.ts'] },
    {
      ...common,
      displayName: 'integration',
      testMatch: ['<rootDir>/test/integration/**/*.spec.ts'],
    },
    { ...common, displayName: 'e2e', testMatch: ['<rootDir>/test/e2e/**/*.spec.ts'] },
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    // Not counted (ESTRATEGIA-PRUEBAS §7): bootstrap, Nest modules and the Prisma connection.
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/prisma/**',
    '!src/**/*.d.ts',
  ],
  coverageDirectory: 'coverage',
  // Minimums that make CI fail (D-58): domain 90 %, use cases 80 %, total 70 %. Jest fails when a path
  // threshold matches no file, so the domain and use case thresholds switch on by themselves as soon as
  // the first executable code exists in those layers.
  coverageThreshold: {
    global: { lines: 70 },
    ...thresholdIfCodeExists('src/**/domain/**/*.ts', 90),
    ...thresholdIfCodeExists('src/**/application/**/*.ts', 80),
  },
};
