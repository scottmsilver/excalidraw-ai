# Directional Callout Attachment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the second callout press the arrow's exact box attachment and place the box away from the first arrow tip.

**Architecture:** The existing `getCalloutPlacement` pure function remains the one source of geometry for preview and commit. It selects a facing edge from the first tip to second press, computes a fixed point one-third along that edge toward the near corner for diagonal approaches, and positions the box so the attachment equals the second press. The editor continues to supply minimum text height before insertion.

**Tech Stack:** TypeScript, React, Vitest, Excalidraw element geometry.

**Spec:** `docs/superpowers/specs/2026-09-26-directional-callout-attachment-design.md`

---

### Task 1: Place the box from the fixed attachment

**Files:**

- Modify: `packages/element/src/calloutCreation.ts`
- Test: `packages/element/tests/calloutCreation.test.ts`

- [ ] **Step 1: Write failing geometry tests.** Assert for each dominant direction that `perimeterRatioToPoint(tailAttachment)` plus `(x,y)` equals the second press, while `(x,y)` plus `tailTip` equals the first tip. Assert default 160×100, top-edge fallback for coincident points, edge midpoint for axis alignment, one-third from the near corner on diagonals, and the same attachment after reversing a sizing drag. Cover rounded boxes and a minimum-height increase.
- [ ] **Step 2: Run:** `yarn vitest run packages/element/tests/calloutCreation.test.ts`. Expect the new tests to fail against current bottom-center/corner sizing.
- [ ] **Step 3: Implement:** Select left/right/top/bottom by the dominant signed tip-to-press vector, with horizontal ties and top fallback for zero vector. Calculate width from `abs(boxEnd.x-boxStart.x)` and height from `abs(boxEnd.y-boxStart.y)` for a drag, and existing defaults for a tap; clamp height to the supplied minimum. For a diagonal, set the edge fraction to exactly `1/3` from the corner closest to the first tip; for an axis-aligned vector use `1/2`. Set `(x,y)` by subtracting the selected local edge point from `boxStart`. Derive `tailTip` from the first tip and `(x,y)`. Convert the local edge point to `tailAttachment` using `pointToPerimeterRatio`, and check that rounded rendering keeps the point on the straight edge.
- [ ] **Step 4: Run the same test file; expect all tests to pass.** Commit the geometry and tests.

### Task 2: Align editor feedback and end-to-end placement

**Files:**

- Modify: `packages/excalidraw/components/App.tsx`
- Modify: `packages/excalidraw/components/CalloutCreationPreview.tsx`
- Test: `packages/excalidraw/tests/callout.test.tsx`

- [ ] **Step 1: Write failing interaction tests.** Update obsolete box coordinates and hint assertions. Check second tap attachment and original tip in representative directions, short second drags after text focus, touch placement over existing artwork, and preview box/leader attachment matching the eventual element. Turn grid mode on and check that the first tip snaps once while the second press joins at its exact, unsnapped scene position. Assert existing elements and viewport do not move.
- [ ] **Step 2: Run:** `yarn vitest run packages/excalidraw/tests/callout.test.tsx`. Expect changed assertions to fail before the hint and geometry are updated.
- [ ] **Step 3: Update the waiting hint** to “Arrow set. Press where the arrow joins the box; drag to size.” In `packages/excalidraw/components/App.tsx`, retain grid snapping for the first tip and leader preview but store unsnapped `pointerDownState.origin` as the second `boxStart`; store unsnapped scene positions for `boxEnd` on move/up. Keep preview and final code calling the same geometry helper and minimum-height calculation. Change further editor code only if tests expose a mismatch.
- [ ] **Step 4: Run the same test file; expect all tests to pass.** Commit UI and tests.

### Task 3: Verify and integrate

**Files:**

- Review: changed code and docs

- [ ] **Step 1: Run:** `yarn vitest run packages/element/tests/calloutCreation.test.ts packages/excalidraw/tests/callout.test.tsx` and `yarn test:typecheck`. Expect passing tests and no type errors.
- [ ] **Step 2: Run changed-file lint and formatting, then the production app build.** Inspect output and correct any concrete failures.
- [ ] **Step 3: Review `git diff`, push the branch, and use the repository's existing squash-merge workflow.** Update the root submodule pointer, run root CI, and deploy the merged UI revision to `screenmark-app` as previously authorized.
- [ ] **Step 4: Verify the deployed revision and health endpoint, close any usable bead issue, and confirm clean Git status and no extra worktrees.**
