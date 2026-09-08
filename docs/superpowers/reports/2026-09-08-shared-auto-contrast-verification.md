# Shared Auto contrast verification

Implemented on `feature/shared-auto-contrast-20260908`, based on deployed UI `3d29b019`. Main, the normal local app on port 5192, and Fly were not changed.

## Behavior

Master-off correction: unchecking Auto now restores the underlying manual styling rather than freezing the automatic appearance. Both rectangle and callout failed the new regression before the fix. A real-browser before/on/off test verified that the restored canvas pixels exactly match the original manual colors, hatch and opacity. Evidence: `/tmp/auto-off-{red,green,browser,full,types,lint,build}.log`. The original freeze behavior described below is superseded for the master switch; Advanced individual locks remain unchanged.

Correction verification: 143 test files passed (2,088 passed, 47 skipped, one todo); TypeScript and changed-file lint passed. The production browser also passed the pixel-restoration check. Port 5196 now serves `screenmark-shared-auto-eval:20260908-off-restore`; main and Fly are unchanged.

Minimal-UI revision: only the Auto contrast master and a collapsed Advanced disclosure are visible initially. Individual overrides, fill opacity and explanatory statuses are inside Advanced. Changing selection closes Advanced. The master toggles all applicable fields together, and clicking a partial master enables all fields.

One **Auto contrast** master switch with independent foreground, background and fill-opacity overrides. Mixed overrides are indicated. Callouts default on; text, rectangles, ellipses, diamonds, arrows and lines are opt-in. Unsupported elements are ignored, including in mixed selections. Bound labels route controls to their supported owner. Turning Auto off freezes displayed colors/fill opacity and removes the automatic halo. Manual palette edits lock just that field. Manual fill-opacity edits do not activate Auto or change hatch patterns.

Shared accessors retain legacy callout data. Sampling uses lower-z composed artwork, shape interiors/perimeters, actual curved stroke/arrowhead paths, and bound-label bounds. Text and open strokes do not optimize nonexistent fills; closed lines account for their existing solid or hatched fill without changing it. Dependent Auto elements include upstream resolved appearance in their fingerprints, and owner-label lookup is indexed once per resolve. Derived updates do not increase element versions or add undo entries. Canvas, text editing and SVG/PNG exports use the same resolved appearance.

## Verification

- Full `yarn test:update --minWorkers=1 --maxWorkers=2`: 143 files passed; 2,085 tests passed, 47 skipped, one todo. No snapshot changes.
- TypeScript, changed-file ESLint and diff whitespace checks passed.
- Regression tests were observed failing before fixes for the new shared controls, non-callout resolution, bound-label sampling, text halos, closed-line fill contrast, manual fill-opacity preservation and owner label opacity.
- Independent spec/code review approved after findings were addressed.
- Real-browser checks: all seven types, callout default-on, other types default-off, independent overrides, held-pointer artwork movement changing contrast before release, frozen manual foreground, save/reload, SVG and PNG exports without mutating source scene data.
- Existing immediate callout typing, Escape, undo/redo, box movement and resizing browser regression passed.
- Production image `screenmark-shared-auto-eval:20260908` built successfully (image SHA `8eb5a2fe494089b1d2bfee7a23b4803f8aa98932c76ba4577a84bfc9fa9d397c`). Production-browser tests passed master switch, partial overrides, callout defaults, immediate typing and reload.

The isolated production preview is at `http://localhost:5196`; development preview at port 5194. The prior preview container is retained, stopped, as `screenmark-callout-eval-20260908-before-shared-auto`. No paid AI requests were made.

Evidence: `/tmp/shared-auto-{full-final,types-final,lint-final,build-final,browser-final,production-browser,focus-regression}.log`; browser harnesses and screenshots in `/tmp/current-upstream-browser.KCSede/`. Beads has no initialized database in this clone; no shared issue database was initialized or modified.

## Minimal-UI revision verification

- Regression reproduced before implementation; updated full suite: 143 files passed, 2,086 tests passed, 47 skipped, one todo.
- Production browser verified hidden overrides, opening Advanced, all-on/all-off behavior, partial-to-all behavior, selection collapsing Advanced, default-on callout, immediate typing and reload. Screenshot inspected: `/tmp/current-upstream-browser.KCSede/auto-minimal-production.png`.
- Preview at port 5196 now uses `screenmark-shared-auto-eval:20260908-minimal`; previous container retained as `screenmark-callout-eval-20260908-before-minimal`. Main and Fly remain unchanged.
- Evidence: `/tmp/auto-minimal-{red,green,full,types,lint,build,browser}.log`.
