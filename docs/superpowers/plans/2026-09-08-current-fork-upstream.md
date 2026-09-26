# Current Fork Upstream Integration Plan

> Use superpowers:subagent-driven-development for implementation and independent review.

**Goal:** Produce a verified integration candidate combining upstream candidate `c05a2f54` with deployed fork `01932229`, without modifying production or the active app checkout.

**Architecture:** Merge the current fork into the retained, independently cloned upstream candidate on `integration/current-fork-upstream-20260908`. Preserve upstream APIs and toolbar architecture while porting every restored fork feature and subsequent fix. Pin the already-reviewed upstream revision `0361bdd9`; newer upstream updates are a separate follow-up.

**Tech stack:** TypeScript, React, Yarn workspaces, Vitest, Vite, Chromium, Docker.

## 1. Baseline and reconciliation

- Install frozen dependencies and run `yarn test:app --run --minWorkers=1 --maxWorkers=2` on candidate `c05a2f54` before merging.
- Merge exact fork commit `01932229` with `--no-commit`. Resolve content conflicts using upstream APIs, not wholesale side selection.
- Primary conflict files: `excalidraw-app/App.tsx`, `packages/excalidraw/components/{App,LayerUI}.tsx`, `packages/element/src/{bounds,comparisons,index,renderElement,shape,typeChecks}.ts`, `packages/excalidraw/{types.ts,renderer/interactiveScene.ts,package.json}`, `yarn.lock` and snapshots.
- Port callout tool registration into upstream toolbar (old `components/shapes.tsx` was removed). Preserve callout text behavior, rounded attachment geometry, persistence, SVG export and bounds.
- Preserve HEIC/PDF import, all capture modes, reference marker rasterization, immediate AI results, cloned AI undo history, and stale-callback guards after early acceptance.
- Reconcile dependency manifest additions then regenerate lockfile with Yarn; retain Node 24 frontend build and existing production config.

## 2. Regression and compatibility verification

- Run TypeScript and focused fork tests; debug failures from evidence and add focused failing tests for uncovered compatibility regressions before fixing.
- Existing regression paths: `packages/element/tests/calloutAttachment.test.ts`, `packages/excalidraw/tests/callout.test.tsx`, `excalidraw-app/capture/*.test.ts*`, `src/providers/AIManipulationProvider.undo.test.tsx`, `src/components/ManipulationDialog/ManipulationDialog.test.tsx`, `src/utils/referencePointImage.test.ts`, plus candidate AI integration tests.
- Run full `yarn test:update --minWorkers=1 --maxWorkers=2`; inspect every snapshot change rather than accepting blindly. Then run full suite without updates to confirm.
- Run `yarn test:typecheck`, changed-source ESLint, production Vite build and frozen-lockfile Docker build. Record warnings separately from failures.

## 3. Independent browser and code verification

- Use a localhost-only app and headless Chromium; block external services and mock AI SSE. No production writes or real Gemini calls.
- Verify image import, callout creation/text/rounded attachment/reload, rectangle/lasso/polygon capture, reference markers in submitted annotated PNG, progressive AI results, early acceptance and AI undo.
- Independently review preservation of custom features and then code quality; resolve findings and rerun affected checks.

## 4. Handoff

- Commit integration and report to the isolated branch; push only that integration branch to the fork remote.
- Record exact parents, commands/results, screenshots and unverified boundaries in `CURRENT_FORK_UPSTREAM_INTEGRATION.md`.
- Do not update parent app main/submodule pin, deploy, change domains/secrets, or enable scheduled automation. Bring user in with verified candidate and proposed landing action.

## Environment notes

- The prior temporary dependencies/browser artifacts no longer exist; rebuild validation resources.
- Mac offload SSH timed out; local machine has sufficient CPU/memory for Linux-compatible validation.
- Beads issue creation is blocked by an existing uninitialized database (missing issue_prefix); do not reinitialize shared tracking data.
