# Deployed-feature upstream integration

This local candidate merges upstream `0361bdd9cb832450f1232dd28931199a73b64b1d` into deployed fork `30885a90bcf0b13d9329e19a748972f48b312b44`. It deliberately excludes the 11 later fork-master commits, including custom capture/callout/import and isolated AI-history changes.

Workspace: `/tmp/snapshot-upstream-integration`. Branch: `integration/deployed-upstream-20260907`.

Durable review clone: `/home/ssilver/development/snapshot-ai-upstream-review`.

## Compatibility changes

- Keep the upstream API provider around the existing coordinate-highlight and AI providers. Adopt upstream's API lifecycle via `useExcalidrawAPI`.
- Put the existing AI toolbar tunnel outlet in upstream's new `Toolbar`, preserving the deployed desktop layout. Expose the AI toggle's pressed state.
- Subscribe AI overlays to editor zoom/pan state with `useExcalidrawStateValue`. A snapshot from `getAppState()` alone does not cause overlay rerenders.
- Filter clean-export snapshots through `getNonDeletedElements` to satisfy the updated image-export contract.
- Use the renamed upstream history-command icon in AI logs; preserve fork icons.
- Resolve the lockfile from upstream, adding only the existing fork's exact `lucide-react` and `marked` dependencies.
- Build the frontend container with Node 24, matching upstream's build runtime.
- Include the fork's `src` directory in the TypeScript project, including its new AI regression tests.

## Review and release boundaries

No production deployment, domain/config/secret changes, main/master push, parent-repository submodule update, or edits to the active app checkout were made. The Docker smoke environment uses localhost-only port 28080 and a nonproduction backend URL; browser checks block external network calls.

This candidate is for review before changing the production pin. Existing Gemini backend configuration is outside this frontend-only integration.

## Inherited behavior to review before release

These limitations are visible in deployed commit `30885a90`, not introduced by the upstream merge:

- Accepted-result placement calculates bounds using unrotated snapshot boxes. Rotated content, empty snapshots, frames, and annotations outside original content need explicit acceptance review.
- Clean and annotated exports crop independently; metadata uses annotated bounds. Annotations extending beyond the source can therefore change the coordinate correspondence between the two images.
- AI accept/reject uses the editor's default eventual history capture. Immediate AI undo behavior is not guaranteed; the later fork's isolated undo feature is excluded from this stage.
- `resetEditState()` does not reset manual processing/progress overrides.
- The deployed fork's AI button is desktop-only. The phone layout uses a separate toolbar without an AI tunnel outlet. This integration preserves that limitation; tests explicitly check the real phone layout rather than a stale desktop toolbar.

Mocked regressions cover AI mode/markers, snapshot preservation, review cleanup, failure/retry, coordinate transforms, arrow metadata, POST SSE parsing, toolbar placement, and live highlight position after zoom/pan. They do not substitute for real Gemini result quality or a protected preview's Cloudflare/backend checks.

## Verification

- `yarn test:typecheck` checks upstream packages, the host app, and fork sources.
- Focused ESLint uses `--max-warnings=0` on all integration and new test files.
- The four new AI test files contain 13 tests. The corrected phone test explicitly checks the inherited absence of an AI button in the actual mobile toolbar.
- Production Docker build passed with Node 24 and a frozen lockfile. Retained image: `snapshot-upstream-candidate:20260907`, ID `sha256:88aa793f5e407ceb9f94c1ca6e5610d7099dff90ac0af6813557238e6e76b870`.
- Chromium smoke imported the repository's deer-image fixture, entered AI mode, placed a reference marker, submitted separate clean/annotated images, consumed a mocked SSE result, reviewed and accepted the image, and reloaded the saved scene. No JavaScript page errors occurred. The temporary container was removed; the image and screenshots remain.
- The initial full `test:update` run had 1,880 passing tests and one Brave-browser loading timeout during concurrent compilation. The unchanged test passed in isolation on this candidate and pure upstream. Its snapshot was restored; no snapshot changes are included. A final full run avoids snapshot updates.

- Final full run: `yarn test:app --run --minWorkers=1 --maxWorkers=2` passed **127 files / 1,887 tests**, with 47 skipped and 1 todo. No snapshots changed.

Logs are retained at `/tmp/snapshot-upstream-*.log` and browser artifacts and the smoke script at `/tmp/snapshot-upstream-browser/`.
