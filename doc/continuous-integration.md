# Continuous Integration

## Workflow and triggers

[Application Build workflow](https://github.com/pkarlsso/FieldDay/blob/ci/application-build/.github/workflows/build.yml) runs on every branch push and on pull requests targeting `main` or `dev`. A manual trigger is also declared; it becomes available in the Actions UI once the workflow reaches the default branch. Draft PRs are not skipped.

## What the pipeline does

1. Checks out the revision into a fresh GitHub-hosted Ubuntu runner.
2. Installs Node.js 22 and runs `npm ci` from the repository root for both npm workspaces and the shared development tools.
3. Runs the team's existing ESLint configuration using `npm run lint`.
4. Checks all backend JavaScript syntax, validates the GraphQL schema, and loads the Mongoose models without connecting to a database.
5. Runs `npm run build`, which exports Expo production JavaScript/assets for web, Android, and iOS.
6. Uploads `frontend/dist/` as a downloadable artifact retained for seven days.

Every step has a descriptive `name`. A failure prevents the remaining build/artifact steps from succeeding. Repository admins can make the build check required through branch rules; the workflow itself does not configure merge protection.

## Isolation and dependency tracking

Each job runs in a new hosted VM instead of a developer's working directory. It installs dependencies from the checked-in root `package-lock.json`; `npm ci` fails if the manifests and lockfile disagree. The root workspace configuration covers `frontend/` and `backend/`. Dependency updates should change the relevant manifest and root lockfile together.

The Node setup action caches npm download data using the lockfile hash. It does not reuse `node_modules` or bypass installation. The job uses a read-only repository token and does not receive MongoDB credentials, seed the database, or deploy anything. Concurrent runs for the same Git ref are cancelled in favor of the latest revision.

## Run the same checks locally

With Node.js 22 installed, from the repository root:

```sh
npm ci
npm run lint
npm run check:backend
npm run build
```

## Build scope

The workflow checks the whole repository: root ESLint covers tracked JavaScript, backend validation covers all backend source files and its schema/models, and Expo builds the application from its entry point. Expanded prototype UI imports remain separate draft PRs. Expo exports production bundles and assets; it does not generate signed APK/AAB/IPA installers. The backend is plain JavaScript, so syntax/schema/model checks validate it without a separate transpilation step. This is not a live database integration test or a native-device test.

## Build log

The successful GitHub Actions run link will be recorded here after the first automated run completes.

## References

- [Expo CLI](https://docs.expo.dev/more/expo-cli/) — production export tooling.
- [GitHub setup-node](https://github.com/actions/setup-node) — Node installation and lockfile-based dependency caching.
- [GitHub-hosted runners](https://docs.github.com/en/actions/concepts/runners/github-hosted-runners) — isolated hosted execution environments.
