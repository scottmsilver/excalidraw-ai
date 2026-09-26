# Shared Auto contrast implementation

Approved spec: `docs/superpowers/specs/2026-09-08-shared-auto-contrast.md`.

## Data and rendering

Add optional shared metadata in `packages/element/src/types.ts` and helpers in `packages/element/src/autoContrast.ts`: `supportsAutoContrast(element)`, `hasAutoContrastFill(element)`, `getAutoContrastModes(element)`, `getAutoContrastResolved(element)`, `getAutoContrastManualColors(element)`, `getAutoContrastFillOpacity(element)`. Callout legacy fields are fallback inputs. Mode return is undefined for absence, otherwise `{foreground,background,opacity}`. Fill applies only to callout/rectangle/ellipse/diamond. New generic data restore must validate fields and avoid enabling old drawings.

Write failing tests before extending `shape.ts`, `renderElement.ts`, `calloutAppearance.ts`, `textWysiwyg.tsx`, `staticSvgScene.ts` and `data/restore.ts` to honor shared resolved colors/fill opacity/halo. Preserve current callout rendering and text semantics; do not change geometric transforms.

## Sampling and export

Root owns `scene/calloutAutoStyle.ts` and `scene/export.ts`. Generalize the existing controller with compatibility aliases, support shape-aware sampling and generic result writes, skip independent bound-label evaluation when the parent owns contrast, propagate resolved changes into lower-z fingerprints. Keep deterministic synchronous updates and no extra scene versions. Add sampler/controller tests for opt-in shapes, text/stroke-only handling, continuously changing underlying artwork, unchanged-input deduplication, legacy callouts and downstream Auto dependencies.

## Controls

Root owns `components/Actions.tsx`, `components/CalloutStyleControls.tsx`, new `components/AutoContrastControls.tsx`, `actions/actionProperties.tsx` and related tests. Keep callout selection controls separate. Render one accessible master checkbox with mixed state, field checkboxes and fill-only opacity slider for supported selections. Enabling maps all supported fields to true; disabling captures current display values and maps all fields false. Manual palette edits clear the matching displayed-color override and disable only that field. Bound labels map to their supported owning shape. All explicit changes use existing action/history infrastructure.

## Verification

Failing tests first, then focused element/render/UI/controller suites. Verify browser toggles for shapes/text/lines, automatic callout defaults, per-field and mixed-selection overrides, real held-pointer contrast adaptation, save/reload, PNG/SVG consistency and immediate callout typing regression. Run `yarn test:update --minWorkers=1 --maxWorkers=2`, `yarn test:typecheck`, changed-file lint and production build. Independent spec and code review before commit/push. Main and live deployment stay unchanged pending user release request.
