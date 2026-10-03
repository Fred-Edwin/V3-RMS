/**
 * Module boundary check (docs/PARALLEL_WORKFLOW.md, docs/CODING_STANDARDS.md §4).
 *
 * Code outside `src/modules/<x>/` may import only `src/modules/<x>/index.ts`.
 *   - ERROR when the importer is itself inside `src/modules/` (a rebuilt feature): fix before merge.
 *   - WARN  when the importer is legacy code (routes, scripts, old controllers, tests): the backlog
 *     of doors still to be built. Warnings never fail the run.
 *
 * Run: pnpm check:imports
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'module-deep-import',
      comment:
        'A rebuilt module reached into another module\'s internals. Import that module\'s index.ts instead, or add the thing you need to its index.ts.',
      severity: 'error',
      from: { path: '^src/modules/([^/]+)/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: ['^src/modules/$1/', '^src/modules/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'legacy-module-deep-import',
      comment:
        'Legacy code (not in src/modules) reaches into a module\'s internals. Warn only: becomes an error once the legacy file is moved into a module or the module exposes an index.ts.',
      severity: 'warn',
      from: { path: '^(src|tests)/', pathNot: '^src/modules/' },
      to: {
        path: '^src/modules/[^/]+/',
        pathNot: '^src/modules/[^/]+/index\\.ts$',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: '\\.d\\.ts$' },
  },
};
