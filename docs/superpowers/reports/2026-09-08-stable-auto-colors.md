# Stable Colors controls verification

Implemented on `feature/stable-auto-colors-20260908`, based on deployed UI `73464f32`. The standard Excalidraw switch replaces the master/advanced buttons. Color action rows remain mounted, with automatic fields disabled and dimmed and a resolved swatch occupying the existing current-color slot. Advanced settings use a floating, independently controlled Radix popover.

## Regression evidence

- Final suite: 144 test files passed, 2,091 tests passed, 47 skipped, one todo. TypeScript, zero-warning changed-file ESLint and diff whitespace checks passed. No snapshot changes.

- The new stable-row/switch test failed before implementation.
- A focused native-Space test exposed the old Switch's early keydown activation; it now allows native activation while stopping the canvas Space shortcut. Browser checks verify exactly one toggle per Space press.
- Trigger/dialog accessibility IDs match. Escape retains annotation selection and returns focus; selection changes reset the disclosure. Tests cover fixed row availability, per-field disabling, mixed explanation, callout defaults, manual restoration and undo.
- Independent review found an incorrect current-color CSS selector and mismatched Radix content ID. Both were fixed and re-reviewed; no additional findings remained.
- Browser checks compare the exact bounding boxes of palette rows and the Stroke width label before/after master, per-field, and advanced-open changes. All match. Mobile Colors bounds also match before/after switching.
- Before/after canvas screenshots are pixel-identical after returning to manual styling. Existing immediate callout typing remains working.
- Desktop/mobile browser checks passed focus restoration, nested popover Escape behavior, outside dismissal, manual nested color editing and 390px popup fit. Development checked dark theme; production checked the same interactions in the built artifact.

## Preview

Port 5196 serves `screenmark-stable-colors:20260908`, image `45b09e633f2da865a6a10c4293d4ca2a83769c6f6b9da5d7885e616d9fe42569`. Prior preview retained, stopped, as `screenmark-callout-eval-20260908-before-stable`.

Root main stays at `e524f39`, local5192 and Fly stay on `73464f32`. No release of this follow-up is included.

Evidence: `/tmp/stable-colors-{red,green-final,browser,production,build,full-final,types-verified,lint-verified}.log`, `/tmp/stable-switch-red.log`, and browser scripts/screenshots under `/tmp/current-upstream-browser.KCSede/stable-colors-*`.
