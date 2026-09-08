# Anchored Auto callouts: verification

Implemented on `feature/anchored-auto-callouts-20260908`, based on `22b186d0` / the deployed UI `d8f3ef3b`. The active application checkout and Fly deployment were not changed.

## Behavior

- Box-only movement, nudging, resizing, rotation, text layout and property edits retain the arrow tip's scene position.
- Box + arrow selection transforms the whole callout, including grouped/frame-child movement, duplication and flips. Dragging a selected whole callout preserves that intent; a simple box click switches back to box-only.
- New callouts use independently selectable Auto foreground, background and body-fill opacity. The lower-z rendered artwork is sampled before choosing colors/opacity with the unmodified `apca-w3` implementation. Foreground and newly bound text start opaque.
- Manual fields remain locked; old callouts without Auto metadata retain their appearance. Dark-mode colors, fallback status and low-contrast notices are supported. Derived appearance does not increment element versions or add undo entries.
- Canvas, text editing, SVG, PNG and annotation exports use resolved appearance. Export resolution uses clones; interactive sampling responds throughout gestures and is invalidated by relevant scene/image/font/frame-rendering changes.

## Verification

- Full Vitest, without snapshot updates: **141 files, 2,056 passed, 47 skipped, 1 todo**.
- Full `yarn test:update`: **141 files, 2,056 passed, 47 skipped, 1 todo**.
- All 133 snapshot additions inspected: exclusively `calloutSelectionMode: "box"`. Existing arrow-text wrapping snapshots remain unchanged; its function-call expectation now includes the new optional selection-mode argument.
- TypeScript, all changed/new TypeScript ESLint, and `git diff --check`: pass.
- Production `Dockerfile.frontend` build: pass. Local-only container health: HTTP 200.
- Independent spec and code-quality review: no remaining blocking findings after regression-tested fixes.

Headless Chromium checks exercised imported black/white striped raster artwork, opaque bound text after a previously faded tool setting, box-only drag/resize, whole-callout dragging via the actual selection control, readable mixed-background fill, light/dark backgrounds, dark-theme text editing, real frame clipping, SVG/PNG exports without scene mutation, reload, and background undo/redo.

The built production container additionally passed existing callout/corner-attachment/capture tests (rectangle, lasso, polygon) and the mocked streaming AI workflow: annotation undo/redo, A/B markers, separate annotated/source payloads, progressive results, early acceptance, late-event rejection, and accepted-image reload. No paid AI requests were made. The production API route was redirected to a local mock solely inside the browser harness.

The contrast resolver's representative 49-box/85-edge mixed-sample benchmark improved from approximately 37 ms to 3.2 ms per resolution after hoisting invariant work and using the official direct luminance/contrast APIs. This is a local benchmark, not a performance guarantee. APCA-based selection is not a WCAG conformance claim.

## Reproduction and evidence

```sh
yarn test:app --run packages/excalidraw/tests/callout.test.tsx packages/excalidraw/tests/calloutAutoStyle.test.tsx packages/excalidraw/tests/calloutSampling.test.ts packages/element/tests/calloutContrast.test.ts packages/element/tests/calloutAppearance.test.ts packages/element/tests/calloutStyleData.test.ts --minWorkers=1 --maxWorkers=1
yarn test:app --run --minWorkers=1 --maxWorkers=2
yarn test:typecheck
```

Browser scripts, logs, screenshots and exported SVG/PNG evidence are archived locally at `/home/ssilver/development/snapshot-ai-callout-verification-20260908.tar.gz`. The isolated development server uses port 5194; the built production preview uses port 5196. The user's existing local app on port 5192 is unchanged.

Beads was unavailable for this isolated clone; no shared issue database was initialized or reset. Remote Mac offload was unreachable, so verification ran locally.

## Continuous Auto follow-up

Removed the pointer-gesture pause at the user's request. Auto now samples changed artwork during interaction, retaining fingerprint deduplication and manual-field locks. The updated sampling regression failed before the fix and passed afterward; the focused 67-test suite, TypeScript, and changed-file lint passed. The full `yarn test:update` run passed all 141 test files (2,056 tests passed, 47 skipped, one todo), with no snapshot changes. Independent review found no blockers and separately passed all eight sampling tests.

A real-browser regression dragged black artwork underneath a stationary callout and away again without releasing the mouse. Auto changed foreground in both directions before pointer release, with no callout version change or browser errors. Reproduction: `/tmp/current-upstream-browser.KCSede/callout-live-smoke.cjs`; screenshot: `/tmp/current-upstream-browser.KCSede/callout-live-underneath.png`; logs: `/tmp/callout-live-{red,green,browser,full,types,lint,build}.log`.

The production image was rebuilt and the isolated port-5196 preview refreshed. Its browser smoke test passed callout creation, bound-text editing, corner attachment, reload, and rectangle/lasso/polygon captures with no browser errors (`/tmp/callout-live-production-browser.log`). The prior preview container is retained, stopped, as `screenmark-callout-eval-20260908-before-live-auto`; main and the live deployment were not changed.
