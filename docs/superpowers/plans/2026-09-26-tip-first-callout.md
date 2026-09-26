# Tip-First Callout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw a callout with a first pointer gesture from the arrow tip, release, then a second gesture anywhere to place its box, with a persistent on-canvas hint between gestures.

**Architecture:** Keep unfinished creation out of the scene in a small editor-only state machine. App's pointer handlers forward callout gestures to it and bypass generic callout creation/finalization until the second genuine pointer-up. A noninteractive SVG/HTML overlay renders the temporary leader, box, and hint. Final geometry becomes one ordinary callout element; existing bound text editing begins after insertion.

**Tech Stack:** React, TypeScript, Excalidraw scene/pointer APIs, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-26-tip-first-callout-design.md`

---

### Task 1: Pure placement geometry

**Files:**
- Create: `packages/element/src/calloutCreation.ts`
- Test: `packages/element/tests/calloutCreation.test.ts`

- [ ] **Step 1: Write failing geometry tests.** Cover all four second-drag quadrants, a click-sized second gesture giving a 160 × 100 box at the second press, and a tip inside the box. Assert the resulting `tailTip` puts the world tip at the once-snapped first press. Assert `tailAttachment` maps to the nearest point on the rounded perimeter. Include a zoomed/grid-snapped case to show that the tip is never re-snapped.
- [ ] **Step 2: Run:** `yarn vitest run packages/element/tests/calloutCreation.test.ts`. Expect failure because the helper does not exist.
- [ ] **Step 3: Implement:** Export `getCalloutPlacement(tip, boxStart, boxEnd, dragged, roundness)`. Normalize `x = min(start.x,end.x)` and `y = min(start.y,end.y)` and use absolute width/height when dragged; otherwise use `width=160,height=100,x=start.x,y=start.y`. Return `tailTip = pointFrom(tip.x-x,tip.y-y)` and `tailAttachment = pointToPerimeterRatio(tailTip,width,height,roundness)`. Preserve exact tip coordinates without re-snapping later. App computes `dragged` from unsnapped client coordinates using the existing `DRAGGING_THRESHOLD` of 10 CSS pixels; box positions may then use the current grid snap. The threshold must be independent of zoom.
- [ ] **Step 4: Re-run the targeted test and commit.**

### Task 2: Temporary preview and persistent instruction

**Files:**
- Create: `packages/excalidraw/components/CalloutCreationPreview.tsx`
- Create: `packages/excalidraw/components/CalloutCreationPreview.scss`
- Modify: `packages/excalidraw/components/App.tsx` (render the overlay beside `InteractiveCanvas`)
- Test: `packages/excalidraw/tests/callout.test.tsx`

- [ ] **Step 1: Add failing UI tests.** Selecting the Callout tool shows a first-step instruction. After the first release, assert a temporary leader and the text “Arrow set. Drag to place the callout.” are visible, no callout exists in the scene, and the hint does not time out. After the second pointer down, assert the hint is gone and a box preview is visible. Move/zoom/pan the viewport and assert the preview stays aligned to its scene points.
- [ ] **Step 2: Run:** `yarn vitest run packages/excalidraw/tests/callout.test.tsx`. Expect the new test to fail.
- [ ] **Step 3: Implement an editor-only creation state** with phases `leader`, `awaiting-box`, `box`; store tip, first-drag endpoint, box start/end, pointer type, and a phase transition method. Keep it out of serialized AppState and scene elements. Update an editor-local atom on pointer movement so the overlay rerenders without serializing preview data. Render a pointer-events-none overlay using `sceneCoordsToViewportCoords` and `appState.offsetLeft/offsetTop`, with a leader/box SVG and an HTML instruction near the pointer during `awaiting-box`. Keep that instruction visible until the next pointer down or cancellation, independent of `CursorHint`'s transient timeout. Show “Drag from the subject to start the arrow” when the Callout tool is selected and idle.
- [ ] **Step 4: Re-run the targeted test and commit.**

### Task 3: Connect two pointer gestures to App

**Files:**
- Modify: `packages/excalidraw/components/App.tsx` at callout pointer down, move, up, tool switch, Escape, and pointer cancellation paths
- Modify: `packages/excalidraw/tests/callout.test.tsx`

- [ ] **Step 1: Replace every old one-gesture creation assertion with failing two-gesture tests, including click placement and box-only mode.** Assert first down fixes tip, first move updates leader, first real up enters `awaiting-box` without scene insertion/text focus/undo; second down anywhere enters `box`, second move normalizes geometry, second real up inserts callout and focuses text. Cover locked/unlocked tools, first click/tap, second click/default box, a second press unrelated to the first endpoint and over an existing element, touch events, grid/zoom, and one undo/redo round trip.
- [ ] **Step 2: Run targeted tests and confirm expected failures.**
- [ ] **Step 3: Route callout pointer down/move/up through the creation state.** On first down, snap tip once with existing grid logic. On first genuine up, keep only preview state. On second genuine up, compute geometry through Task 1, create `newCalloutElement` using existing style fields, insert once, capture once, return to the selection tool unless locked, and call `startTextEditing` after state settles. Preserve normal public pointer down/up callbacks for both gestures. Intercept callout completion immediately after the existing pointer listener teardown and public callback block around `App.tsx:12120`, then return before the generic capture/finalize block around `App.tsx:12850`. Do not insert a provisional scene element; first release must leave the undo stack unchanged.
- [ ] **Step 4: Run targeted tests and commit.**

### Task 4: Cancellation and regression verification

**Files:**
- Modify: `packages/excalidraw/components/App.tsx`
- Modify: `packages/excalidraw/tests/callout.test.tsx`

- [ ] **Step 1: Add failing cancellation tests.** Escape, switching tools, pointercancel during each drag and while awaiting the box, missing pointer-up replay, and a second touch/pan clear preview and hint, leave zero scene elements, and do not add an undo step. Assert a finished callout can be undone/redone in one step and retains tip/box geometry after save/restore. Exercise mouse and touch paths.
- [ ] **Step 2: Run targeted tests and confirm failures.**
- [ ] **Step 3: Add one cancellation method** used by each interruption path. Make canvas/window `pointercancel` reach the active callout gesture's teardown, rather than only `removePointer`; remove the same window move/up/key/cancel listeners, clear the missing-up emitter, and retain normal public pointer callbacks with the cancellation event. Distinguish a genuine `pointerup` from replayed pointerdown/`pointercancel` before committing. Clear unfinished state before the next tool gesture. Do not schedule capture for cancelled creation.
- [ ] **Step 4: Run targeted tests; run `yarn test:code`, `yarn test:typecheck`, the relevant callout/Auto contrast suites, and the app build. Perform desktop and compact-width visual checks. Review the actual outputs, fix failures, then commit.**

### Task 5: Integrate and deploy

**Files:**
- Modify: root `excalidraw-ui` submodule pointer after UI commit

- [ ] **Step 1: Push UI `master`, commit/push the root `main` submodule pointer, and check CI.**
- [ ] **Step 2: Deploy Fly from the committed UI head with `VITE_APP_GIT_SHA` and check `/health` and machine image.**
- [ ] **Step 3: Confirm both checkouts are clean and each repo has only its intended worktree.**
