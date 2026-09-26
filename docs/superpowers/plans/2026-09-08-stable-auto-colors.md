# Stable Auto contrast controls implementation plan

> Execute inline with test-first changes and independent review.

**Goal:** Implement the approved stable-colors mockup: existing Excalidraw switch styling, fixed color rows, floating advanced settings.

**Architecture:** Reuse Switch with optional accessible label/role/mixed-state support while preserving existing export-dialog callers. Keep existing color action children mounted in fixed rows; disable automatic fields using fieldsets and show derived color swatches over the existing current-color slot. Use Radix Popover in the app container for advanced settings, with collision handling, Escape/outside dismissal, focus return and selection reset. Compact Colors retains local parent popup state.

**Scope:** Isolated branch `feature/stable-auto-colors-20260908` from deployed UI `73464f32`. Update preview5196 only, not main/Fly. Preserve callout defaults, manual restoration, live sampling, undo and text entry. Advanced field switches maintain the previous per-field semantics; mixed states are explained accessibly. Do not change the underlying contrast solver.

**Files:** `components/AutoContrastControls.tsx/.scss`, `components/Switch.tsx/.scss`, compact color labels in `components/Actions.tsx`, `tests/autoContrast.test.tsx`, `tests/calloutAutoStyle.test.tsx`, new Switch keyboard tests if required.

1. Add failing tests for switch role, visible-but-disabled manual palettes, floating advanced settings, selection reset and accessible labels. Preserve manual-restoration/undo cases.
2. Implement master/advanced switches and permanent row wrappers. Native fieldset disabled state prevents keyboard activation; pointer interaction is also blocked for Auto rows. Derived swatches are visual-only overlays, so they cannot change row dimensions.
3. Implement floating advanced popover; keep its state independent of color pickers. Close on selection change and return keyboard focus correctly. Keep popup content width stable and fit phone viewport.
4. Verify with focused tests and real-browser geometry comparisons: switching on/off or opening settings must not move the Stroke width control or palette rows. Check keyboard Space activates exactly once, mixed fields, manual color edits, nested compact popovers, light/dark/mobile and immediate callout typing.
5. Run full `yarn test:update --minWorkers=1 --maxWorkers=2`, typecheck, changed-file lint, formatting, build and production browser smoke. Independent code review before handoff. Retain prior preview container for recovery.
