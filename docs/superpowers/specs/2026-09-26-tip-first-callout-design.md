# Tip-first callout drawing

## Goal

Place a callout by pointing at the subject first, then drawing its box. The gesture must work with mouse, pen, and touch, and explain the second step on the canvas.

## Interaction

1. Choose the Callout tool. Press on the subject to set the arrow tip. Snap this scene point to the grid once, if grid snapping is enabled. Drag toward the intended box location. A temporary leader follows the pointer. A first click or tap without movement still enters the next phase.
2. Release to lock the tip and move to box placement. Show a short, visible hint near the pointer: **“Arrow set. Drag to place the callout.”** The hint remains until placement, cancellation, or a tool change. The first drag endpoint is a preview position, not a required target for the second press.
3. Press anywhere near the desired box and drag to size it. The second press anchors one box corner, and release sets the opposite corner. Normalize the rectangle for all four drag directions. The box previews during this drag. The arrow keeps its original tip and attaches to the nearest point on the actual rounded box perimeter, including when the tip lies inside the box.
4. Release to finish. A second click without meaningful movement places a 160 × 100 scene-unit box centered horizontally above the click, with its bottom edge at the click. A short second drag keeps the box bottom fixed when text editing needs more height; the preview and final geometry agree. Focus the callout text editor immediately. Respect tool locking as existing callout creation does.

The two press/release gestures are explicit. No pause, direction-change, or speed heuristic changes the phase. Do not require the second press to hit the leader endpoint.

## Feedback and recovery

- Show the first-step direction when the Callout tool is selected and the user has not started drawing, using existing tool-hint conventions where possible.
- After the first release, make the unfinished leader and on-canvas instruction visible. The next pointer down anywhere on the canvas begins box placement; it must not select an underlying element.
- Escape, tool change, pointer cancellation, a missing pointer-up replay, or a second touch that starts a pan cancels the unfinished callout cleanly. Cancellation leaves no scene element or undo entry.
- The arrow tip stays at the initial press position throughout both phases. Ordinary snapping may apply to pointer positions; the tip must not jump at phase changes.
- Once completed, the box and arrow are one existing callout element. Text typed afterward is the usual separate bound text scene element. Existing editing, auto contrast, save/restore, export, and box-only/whole selection behavior continue to work.

## State and data

Keep creation phase and temporary geometry in editor state only; do not serialize them. Commit one callout element on completion, with a local `tailTip` derived from the initial scene pointer position and a perimeter attachment derived from the final box. Use the current callout element format. The complete two-drag action creates one undo step. Preview rendering should not trigger auto contrast sampling or persistence until completion. The final tip must equal the once-snapped first press position, independent of later endpoint or box snapping.

The current editor inserts a callout on first pointer down and follows the generic first-up capture/focus path. The new callout path must bypass those actions until the second genuine pointer up. Its two pointer gestures still fire the public pointer down/up callbacks normally. Missing-up cleanup must not masquerade as successful completion.

The placement state machine is `idle → leader drag → awaiting box → box drag → complete`. Cancellation from any non-idle state returns to `idle`. Missing pointer-up cleanup must cancel rather than commit.

## Verification

- Pointer tests cover tip placement, leader release, second drag from a location unrelated to the endpoint, box geometry, final tip position, and immediate text focus.
- Verify a click-sized second gesture creates a useful default box. Verify Escape, tool switch, pointer cancellation, and a second touch discard pending creation with no scene/undo artifact.
- Verify locked and unlocked Callout tools, mouse and touch pointer paths, save/restore, and one undo/redo step.
- Check the on-canvas hint is visible during the waiting phase and clears on placement or cancellation. Check the feature visually at desktop and compact widths.
