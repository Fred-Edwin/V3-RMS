/**
 * Feature boundary check (docs/PARALLEL_WORKFLOW.md, docs/CODING_STANDARDS.md §9).
 *
 * Code outside `features/<x>/` may import only `features/<x>/index.ts`.
 *   - ERROR when the importer is itself inside `features/` (a rebuilt feature): fix before merge.
 *   - WARN  when the importer is legacy code (app/, components/, hooks/, ...): the backlog of
 *     doors still to be built. Warnings never fail the run.
 *
 * Run: pnpm check:imports
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'feature-deep-import',
      comment:
        'A rebuilt feature reached into another feature\'s internals. Import that feature\'s index.ts instead, or add the thing you need to its index.ts.',
      severity: 'error',
      from: { path: '^features/([^/]+)/' },
      to: {
        path: '^features/[^/]+/',
        pathNot: ['^features/$1/', '^features/[^/]+/index\\.ts$'],
      },
    },
    {
      name: 'legacy-feature-deep-import',
      comment:
        'Legacy code (not in features/) reaches into a feature\'s internals. Warn only: move the import to the feature\'s index.ts when you next touch the file.',
      severity: 'warn',
      from: { path: '^(app|components|hooks|lib|services|store|types|middleware\\.ts)', pathNot: '^features/' },
      to: {
        path: '^features/[^/]+/',
        pathNot: '^features/[^/]+/index\\.ts$',
      },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    exclude: { path: ['\\.d\\.ts$', '^\\.next/'] },
  },
};
