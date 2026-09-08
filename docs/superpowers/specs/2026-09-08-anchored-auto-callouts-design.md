# Anchored callouts with sampled Auto styling

## User-approved intent

Moving, resizing, rotating, or editing the callout box must leave the arrow tip at its canvas position. Selecting the box and arrow together must allow moving the whole callout. New callouts default to Auto foreground, background, and opacity; sample the artwork **before** choosing those values. Preserve manual overrides.

This document specifies the interaction details for review before implementation. Base: deployed UI `d8f3ef3b`, app main `fc14e71`. No application code or deployment changes are part of this design commit.

## Selection and anchoring

- Clicking the box selects **Box only**, the default. Its selection frame and resize/rotate handles surround the box, not the tail. Double-clicking its text continues to enter text editing.
- Clicking the arrow shaft selects **Box + arrow**. A visible, keyboard-accessible two-option control in the callout properties panel exposes both modes without requiring a precise shaft click. Selected mode is clearly indicated.
- Box-only drag, arrow-key nudging, resize, rotation, alignment, and text-driven autoresize preserve the tip's world/scene coordinates. The attachment remains on the actual rounded box outline and the tail is recomputed from the changed box to the fixed tip.
- Whole-callout drag/nudge translates both box and tip. Whole-callout rotate/resize applies the same affine transform to both. Whole-callout selection uses bounds including the rendered tail and arrowhead. Switching modes does not change geometry.
- Dragging the tip handle explicitly changes the target in either mode. Dragging the attachment handle changes its position on the outline, without moving the target. Tail handle hit detection takes precedence over selecting the shaft.
- Multi-selection, grouping, duplicate/paste offsets, and whole-scene transforms treat callouts as whole objects. This keeps moving a group or duplicated drawing coherent. Box-only semantics apply to a single explicitly selected callout.
- Selection mode is transient editor state, not a persistent drawing attribute. Undo/redo stores the actual resulting box/tip geometry, not a recalculation from current selection mode. Existing locked-element restrictions remain effective.

## Sampling first

- Capture an offscreen, bounded-resolution rendering of the artwork behind the callout at its current scene position. Include the canvas background, lower-z-order shapes, and decoded images with their actual transforms, crops, transparency, and theme treatment. Exclude the callout, its bound text, selection handles, and interaction overlays. Content above the callout is not its background.
- Sample across the box interior, its perimeter, and the tail path/tip. Retain local luminance variation, not just a single average: dark and light regions of a photograph must both influence the choice.
- Only after sampling, generate light/dark foreground/background candidates and evaluate them. This is not a preset color chosen first and subsequently checked against one sampled pixel.
- Re-sample on creation, move/resize/rotation/text layout, relevant underlying scene/image changes, and theme/background changes, including during pointer gestures. User clarification: Auto must continuously adapt as artwork is moved or placed underneath. Cache unchanged inputs and retain equivalent prior choices to avoid unnecessary work and polarity flicker; do not freeze Auto until pointer release.
- Key sampling work by scene version, file readiness, and callout geometry; discard stale asynchronous results. Sample at a bounded pixel budget and coalesce rapid updates. A change to the callout's own resolved Auto colors must not trigger an endless resampling loop.

## Auto color and opacity policy

- Provide independently switchable **Auto** for foreground, background, and **background opacity**. Foreground covers the callout text, outline, tail, and arrowhead. Auto foreground remains opaque; automatic readability should not fade the letters and arrow.
- Evaluate text contrast using the official unmodified `apca-w3` implementation, retaining foreground/background order and signed polarity. Alpha-composite candidate fill over each sampled backdrop before evaluating its text contrast. Use font size/weight guidance from the package, with conservative treatment of handwriting fonts; do not label the result as WCAG conformance.
- Start with neutral light/dark candidate pairs. Choose a pair using the samples and the least background opacity that meets the text target across the sampled box region. Prefer the prior pair when equally suitable to avoid unnecessary light/dark flips. Increase fill opacity up to opaque for mixed/busy artwork when necessary.
- Check outline and arrow visibility against their local samples as a separate graphical concern. If one solid foreground cannot distinguish the arrow across both dark and light regions, use a narrow opposite-polarity halo in Auto foreground mode. Do not claim APCA text thresholds alone guarantee a visible arrow.
- A manual value locks only that field. The remaining Auto fields adapt around it. If a manual combination makes the target unattainable, retain the user's values and show a concise low-contrast notice rather than silently overriding them.
- If sampling fails (for example unreadable image pixels), preserve the last valid resolution; for a new callout use an opaque high-contrast light/dark fallback against the canvas background. Expose that Auto is using a fallback, without blocking editing.
- Preserve old callouts' existing explicit colors and overall opacity; do not restyle saved drawings automatically. New callouts get all three Auto modes enabled and overall opacity 100. Existing overall-opacity semantics remain available for old/manual callouts; background-only opacity is separately represented so text is not inadvertently faded.

## Data and rendering architecture

- Keep the callout as one scene element with its bound text; do not split it into unrelated box/arrow elements. Keep the current local-coordinate `tailTip` representation for file compatibility. A pure transform helper captures the previous world tip and computes its new local coordinates for box-only transforms, including rotation around the changed box center.
- Add optional callout style-mode metadata plus background-only opacity and resolved render values. Legacy restore defaults absent style modes to manual. Selection mode belongs to AppState, not element serialization.
- Separate the pure APCA candidate resolver, scene sampling adapter, and callout transform helper into focused modules. The sampler owns rendering/pixel access; the resolver receives only samples, font metrics, and manual constraints.
- Persist resolved colors/opacity/halo alongside Auto modes for stable reload and export fallbacks. Automatic resolution must not create extra undo steps or corrupt AI undo snapshots. Associate user-triggered resolution with the originating change; ignore stale results after undo/redo or document replacement.
- Canvas, bound-text editing overlay, PNG export, SVG export, and AI annotated-image export use the same resolved appearance. Export waits for pending relevant resolution (or a bounded fallback), and must never sample a render that already contains the target callout. Updating Auto render data invalidates the relevant shape/image caches.
- Use the mounted editor's ownerDocument/ownerWindow when adding DOM or canvas operations, consistent with upstream cross-document support.

## Verification and boundaries

- Geometry tests: all resize handles, text growth/shrinkage, move/nudge, rotation, rounded attachment, whole-callout transform, multi-selection/duplicate, undo/redo, and save/restore. Assert fixed world-tip coordinates for box-only operations and transformed coordinates for whole operations, including already rotated boxes.
- Contrast tests: sampled white, black, midtone, split light/dark, patterned/photo-like backgrounds; foreground/background polarity; alpha compositing; independent manual locks; opaque fallback; unavailable pixels; stale async results; stable repeated resolution.
- Browser checks: select both modes by pointer and keyboard; type and resize while the tip stays on a visible target; move the whole callout; move between light/dark artwork and inspect chosen appearance; compare rendered/exported PNG and SVG; reload and AI undo. Include actual image-backed sampling, not only canvas background colors.
- Run the full suite, TypeScript, changed-source lint, and production Docker build. Review regressions independently before landing. Keep current deployment untouched until implementation is verified.
- APCA is used as a readability heuristic for this web editor, not a legal accessibility certification. Review the selected package's license/integration requirements before adding it; do not reimplement or alter its constants.

## References

- APCA usage and compositing: https://github.com/Myndex/apca-w3/blob/master/README.md
- APCA integration/license terms: https://github.com/Myndex/apca-w3/blob/master/LICENSE.md

## Alternatives considered

The chosen design keeps one callout with explicit selection modes and samples the underlying scene before choosing styles. Splitting box and arrow into separate elements would complicate persistence, text binding, and whole-object undo. Selecting colors from the canvas background alone would be cheaper but would not satisfy image-backed readability or the user's sampling-first requirement.
