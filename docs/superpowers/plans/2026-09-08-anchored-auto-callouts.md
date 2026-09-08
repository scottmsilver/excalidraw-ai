# Anchored Auto Callouts Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development and test-driven-development. User approved the design and execution; no further planning-choice gate is needed.

**Goal:** Implement the approved box-only/whole-callout transforms and sampling-first APCA Auto appearance without changing production until verified.

**Architecture:** Keep one callout element. Geometry helpers preserve or transform its world tip according to transient selection mode. A pure contrast resolver consumes scene samples and manual constraints; an editor-side sampling adapter resolves persisted appearance used consistently by canvas/text/export paths.

**Stack:** TypeScript, React, existing Excalidraw scene renderer, official apca-w3, Vitest, headless Chromium.

**Spec:** `docs/superpowers/specs/2026-09-08-anchored-auto-callouts-design.md`.

## 1. Geometry and selection

Files: new `packages/element/src/calloutTransform.ts`; `packages/excalidraw/components/App.tsx`, `types.ts`, `appState.ts`, selection properties component, `renderer/interactiveScene.ts`; element drag/resize/text-layout helpers as required. Tests: new `packages/excalidraw/tests/calloutTransform.test.tsx` and element helper tests.

1. Write failing tests for a rotated box's world tip staying fixed across box-only move, nudge, resize and text-driven changes; whole selection must translate/rotate/scale both.
2. Run focused Vitest and confirm missing behavior fails.
3. Implement pure world/local tip conversion around old/new box centers; wire gesture intent without changing stored local tail schema or undo semantics.
4. Add transient selected-callout mode, default box; shaft click chooses whole, explicit accessible Box only/Box + arrow control, separate selection bounds, handle priority. Multi/group/duplicate transforms remain whole.
5. Verify resize handles, text editing, both modes, grouped moves and undo/redo; run focused tests and typecheck.

## 2. Pure contrast policy and style data

Files: new `packages/element/src/calloutContrast.ts`, `packages/element/tests/calloutContrast.test.ts`; `packages/element/src/types.ts`, `newElement.ts`; `packages/excalidraw/data/restore.ts`; owning workspace dependency manifest and `yarn.lock`.

1. Add tests before resolver implementation: white/black/midtone/split samples, foreground polarity, fill alpha compositing, font-aware target, manual locks, busy-background halo, fallback and deterministic tie breaking.
2. Add official unmodified `apca-w3` dependency, inspect its distributed license/API, and provide a narrow type declaration if needed.
3. Implement resolver taking box/edge/tail RGB samples and explicit constraints. Choose light/dark candidates after samples arrive; search opacity from transparent to opaque; respect manual fields and retain prior equivalent choices.
4. Define optional mode/fill-opacity/resolved-state metadata. New constructors enable Auto; restoration of absent legacy metadata remains manual. Add restore roundtrip tests.

## 3. Sampling, controls and shared appearance

Files: new `packages/excalidraw/components/CalloutStyleControls.tsx`, new `packages/excalidraw/scene/calloutAutoStyle.ts`; editor App lifecycle, existing color/opacity actions; `packages/element/src/{shape,renderElement,mutateElement}.ts`, `packages/excalidraw/renderer/staticSvgScene.ts`, bound text editor/render paths and `packages/utils/src/export.ts` as required.

1. Write failing sampler/scheduling/UI tests: lower-z artwork only, target+boundtext excluded, image-backed pixels, live drag sampling, stale result cancellation, no self-trigger loop, manual value disables only matching Auto mode, legacy styles unaffected.
2. Render underlying scene into a bounded offscreen canvas using ownerDocument; map rotated box/interior/perimeter/tail samples into it. Sample actual crops/alpha/theme, not original image bytes alone.
3. Resolve after geometry/scene/file changes, including during interaction, and cache unchanged inputs. Update resolved fields and bound text coherently without standalone undo/history entries; avoid overwriting manual fields or older undo/document state.
4. Add independent Auto controls and background-only opacity; low-contrast/fallback status. Preserve legacy overall opacity semantics.
5. Apply fill alpha only to body fill; opaque auto foreground including text; optional arrow/outline halo. Share resolved appearance with SVG/PNG/AI exports and text editing overlay. Ensure export flushes needed resolution with bounded fallback and no recursive sampling.
6. Verify rendering and export tests and focused browser interactions before broad validation.

## 4. Verification, review and handoff

1. Run `yarn test:update --minWorkers=1 --maxWorkers=2`; inspect every snapshot change. Run full no-update suite afterward.
2. Run `yarn test:typecheck`, changed-source ESLint, production Docker build.
3. Headless Chromium: draw callout on image, move/resize/edit/rotate with fixed visible target; switch whole mode and move all; mixed/light/dark backgrounds, manual overrides, undo/reload and exported pixels. Preserve existing capture/AI smoke coverage.
4. Independent spec-compliance review then code-quality review; fix findings and rerun affected checks.
5. Commit/push only verified feature branch and provide evidence/report. Do not update app main, deploy Fly, modify secrets, or restart the user's live local instance without an explicit landing request.

## Execution boundaries

Use the existing isolated clone `/home/ssilver/development/snapshot-ai-upstream-review` on `feature/anchored-auto-callouts-20260908`. Baseline 1,982 tests passed before this docs-only branch. Geometry implementer owns geometry/selection paths; main initially owns only new contrast files/dependency/data definitions. Coordinate shared file edits explicitly. One implementation subagent at a time; review can run alongside independent validation. Mac offload is unavailable; local host has sufficient capacity. Existing Beads DB is unavailable/uninitialized; do not reset shared issue data.

## Completion

All implementation tasks and independent reviews are complete. Full updated and non-updated suites pass (2,056 tests), as do typecheck, lint, production build, and headless browser checks. See `../reports/2026-09-08-anchored-auto-callouts-verification.md` for evidence and reproduction. Main and Fly remain unchanged pending a separate landing request.
