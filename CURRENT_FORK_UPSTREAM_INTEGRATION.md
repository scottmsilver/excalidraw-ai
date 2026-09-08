# Current fork + upstream integration

## Scope

This candidate combines upstream integration `c05a2f5446e48e967d8469fa057fce74bfeb1053` with deployed fork `0193222932f3a2af9d8b50c6b6fa3a72b4f0a1e3` on `integration/current-fork-upstream-20260908`. Upstream itself is pinned to `0361bdd9cb832450f1232dd28931199a73b64b1d`, the revision examined in the earlier integration. This is not a claim that upstream has no newer commits.

Workspace: `/home/ssilver/development/snapshot-ai-upstream-review`. The earlier `integration/deployed-upstream-20260907` branch remains available. The app checkout, root main/submodule pin, Fly services, domains, and secrets are outside the mutation scope. No recurring upstream automation is being added.

## Verification evidence

Baseline before merging: `yarn test:app --run --minWorkers=1 --maxWorkers=2` passed 127 files / 1,887 tests (47 skipped, 1 todo), 143 seconds. Log: `/tmp/current-upstream-baseline.log`.

Combined-candidate `yarn test:update --minWorkers=1 --maxWorkers=2` passed 136 files / 1,982 tests (47 skipped, 1 todo). All 133 updated snapshots were inspected: every change adds only the `currentItemTailArrowhead: "arrow"` app-state default. The final no-update run independently passed the same 136 files / 1,982 tests in 151 seconds with no snapshot changes (`/tmp/current-upstream-tests-final.log`). Fresh TypeScript and changed-source ESLint also passed. The production Docker build passed with Node 24 and frozen dependencies; image tag `snapshot-current-upstream:20260908`. Separate headless Chromium runs passed against both Vite and that container on localhost port 28080:

- Callout creation, bound text via double-click, rounded-corner attachment drag, and scene reload preserving the callout/text.
- Rectangle, lasso, and polygon capture producing image elements.
- PNG drag/drop; two-page PDF preview, choosing page 2, and image import; real HEIC conversion and image import.
- AI mode activation; annotation undo/redo; A/B placement; separate original and annotated image POST bodies with visible A/B raster markers (PNG inspected).
- A result available before stream completion, early acceptance, late events ignored, and accepted image surviving reload.
- No JavaScript page errors in final development or production-browser runs.

The initial AI browser assertion assumed gesture-grouped undo. Inspection showed the inherited fork records each changed element version: one undo partially shrinks a newly dragged rectangle. Verification was corrected to assert state restoration/redo, without changing that inherited behavior.

## Compatibility adaptations

- Register Callout in upstream's composed desktop/mobile toolbar and tool registry; retain the capture toolbar tunnel and C shortcut.
- Move fork history pause/resume/override controls to upstream's API factory.
- Use current upstream arrowhead rendering/options, normalize legacy saved names, and retain rounded callout attachment and full tail export bounds.
- Adapt callout properties to current picker/style-panel contracts.
- Keep copied original element snapshots for AI acceptance, rejection, and exit, including original locked state, while following the nondeleted-element API.
- Preserve HEIC/PDF dependencies and larger PWA cache limit with Node 24 builds.

Independent feature-preservation and code-quality reviews found no actionable integration regressions. The exact final-source Docker rebuild passed, and all three browser scripts passed again against it. Final image ID: `sha256:c5dc746c4228b3bc2c8e184e8ae34aba29241b0e0df8e156d15009481a703baf`.

## Reproduction

With dependencies installed in this checkout:

```sh
yarn test:app --run --minWorkers=1 --maxWorkers=2
yarn test:typecheck
git diff --name-only c05a2f54 -- '*.ts' '*.tsx' '*.mts' '*.js' | xargs ./node_modules/.bin/eslint --max-warnings=0
docker build -f Dockerfile.frontend --build-arg VITE_API_BASE_URL=http://127.0.0.1:5195 -t snapshot-current-upstream:20260908 .
```

Browser scripts are `smoke.cjs`, `ai-smoke.cjs`, and `pdf-smoke.cjs` in the artifact directory. They require Playwright plus `/usr/bin/google-chrome`; use `SMOKE_URL=http://127.0.0.1:28080` for the built container. The AI script starts its own local mock on port 5195. The default URL is the Vite development server on port 5194. Run against an isolated browser context, as each script already does.

The local evidence archive is `/home/ssilver/development/snapshot-ai-upstream-verification-20260908.tar.gz` (scripts, fixtures, screenshots and logs; excludes installed dependencies).

## Browser test boundaries

Browser tests use a separate headless Chromium session against a localhost-only server, with external requests blocked. AI responses are streamed by a local mock server; no Gemini request or production write is made. Tests distinguish frontend integration correctness from model output quality and protected live deployment integration.

Artifacts and scripts: `/tmp/current-upstream-browser.KCSede/`. HEIC fixture: libheif's public `examples/example.heic`, downloaded from `https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic`. PDF fixture: two synthetic pages generated locally by Chromium. For deterministic PDF checks, the existing CDN worker request is served using the exact locally installed PDF.js worker; CDN availability itself is not tested.

## Tracking environment

Beads issue creation failed because the existing database lacks `issue_prefix`. The shared tracking database was not reinitialized. Mac offload SSH timed out; verification runs on the local Linux host.
