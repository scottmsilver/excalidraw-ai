# Integrated color controls implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this approved UI task inline, with independent review and regression checks.

**Goal:** Implement approved mockup A: Colors header with an Auto contrast toggle and attached advanced chevron; no checkboxes in the contrast controls.

**Architecture:** AutoContrastControls owns the Colors group and receives existing manual palette controls as children. Fully automatic selections show current resolved stroke/background swatches instead of palettes. Manual or mixed selections expose existing palette actions. The master preserves the recently corrected manual restoration semantics. Advanced settings use Auto/Manual segmented buttons with accessible pressed states. Selection changes collapse advanced settings. Existing callout selection controls remain separate. Compact properties use the same component and color actions.

**Tech stack:** React, TypeScript, SCSS, Vitest, Playwright, existing Excalidraw actions/history.

## Approved design and boundaries

- Match mockup A's quiet purple active state, neutral inactive state, compact header and grouping with colors.
- Master remains one action for all applicable fields. Partial state uses aria-pressed=mixed and the existing partial-to-all behavior.
- Chevron is keyboard accessible, exposes expanded state, and reveals segmented Auto/Manual controls. No input checkboxes, including in advanced settings.
- Color previews reflect resolved colors; mixed selections say Mixed rather than inventing a shared color. Stroke-only elements omit background.
- Existing manual color pickers remain available when manual or partially automatic; do not change contrast sampling, persistence or advanced field-lock semantics.
- Preserve default Auto callouts, off-restores-manual, immediate typing, undo/history, full and compact layout behavior.
- Work only in the isolated feature clone; update preview 5196, not main or Fly.

## Tasks

Completed and verified. See `docs/superpowers/reports/2026-09-08-integrated-color-controls.md`. The project has no separate SCSS linter; SCSS formatting and the production Sass build were checked.

- [x] Update `packages/excalidraw/tests/autoContrast.test.tsx` and `calloutAutoStyle.test.tsx` to assert pressed buttons instead of checked inputs, master placement in Colors, no checkboxes after opening Advanced, and preview/manual palette visibility. Observe red with `yarn test:update packages/excalidraw/tests/autoContrast.test.tsx packages/excalidraw/tests/calloutAutoStyle.test.tsx --minWorkers=1 --maxWorkers=2`.
- [x] Implement `packages/excalidraw/components/AutoContrastControls.tsx` and new `AutoContrastControls.scss`: header, attached disclosure, live color previews, segmented advanced controls, and existing manual children. Return manual children unchanged for unsupported selections.
- [x] Integrate color actions in `packages/excalidraw/components/Actions.tsx` for full sidebar and compact properties. Do not duplicate manual palettes within either container.
- [x] Run focused tests and inspect both layouts with real browser. Verify toggle, advanced selectors, selection reset, manual restoration, dark theme, keyboard operation and narrow/mobile fit.
- [x] Run full `yarn test:update --minWorkers=1 --maxWorkers=2`, `yarn test:typecheck`, changed-file ESLint, SCSS lint and `git diff --check`.
- [x] Build isolated production image using `Dockerfile.frontend`, preserve old preview container, update owned port 5196 and smoke-test production. Record verification and hand off without releasing main/Fly.
