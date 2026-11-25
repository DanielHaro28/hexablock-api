// Jest runs the test files as ES modules, but `@nestjs/throttler` is CommonJS and `require`s `@nestjs/common`,
// which is ESM only (Nest 12). Jest refuses that `require(esm)` while `@nestjs/common` is still being evaluated
// in the same module graph ("in a cycle"). Loading both here, before any test file, evaluates `@nestjs/common`
// first, so the `require` finds it ready. Node itself has no such problem. Only the tests need this.
await import('@nestjs/common');
await import('@nestjs/throttler');

export {};
