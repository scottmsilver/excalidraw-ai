# Immediate callout text editing

Approved behavior: creating a callout immediately focuses its bound text editor. Moving or resizing existing callouts does not start editing. Escape or clicking outside retains existing editor behavior.

Implementation: in `packages/excalidraw/components/App.tsx`, invoke the existing `startTextEditing` path in the creation-finalization state callback, only for a newly drawn callout. Do not add a second editor or change selection gestures. Support locked callout tools too.

Verification sequence: add failing creation/focus/typing regression tests in `packages/excalidraw/tests/callout.test.tsx`; verify failure; implement the callback; verify creation plus existing move/resize tests; run TypeScript and the full `yarn test:update` suite; exercise actual browser typing without an extra click. Commit only after checks pass.

Verification evidence: the initial focus regression failed because no editor existed. Browser harness `/tmp/current-upstream-browser.KCSede/callout-focus-smoke.cjs` passed actual drawing, keyboard typing without another click, Escape, undo/redo, and verified geometry changes during move/resize without reopening the editor. Screenshot: `/tmp/current-upstream-browser.KCSede/callout-focus-typing.png`. Independent read-only review found no blocking issues; locked-tool persistence after Escape is explicitly tested.

Final checks passed: 141 test files, 2,059 tests (47 skipped, one todo); TypeScript; changed-file ESLint; diff whitespace check. No snapshot changes. Logs: `/tmp/callout-focus-full-final.log`, `/tmp/callout-focus-types-final.log`, `/tmp/callout-focus-lint-final.log`, and `/tmp/callout-focus-browser-final.log`.
