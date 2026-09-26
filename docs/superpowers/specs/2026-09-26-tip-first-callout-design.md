# Tip-first callout drawing

## Goal

Place a callout by pointing at the subject first, then drawing its box. The gesture must work with mouse, pen, and touch, and explain the second step on the canvas.

## Interaction

1. Choose the Callout tool. Press on the subject to set the arrow tip. Drag toward the intended box location. A temporary leader follows the pointer.
2. Release to lock the tip and move to box placement. Show a short, visible hint near the pointer: **“Arrow set. Drag to place the callout.”** The hint remains until placement, cancellation, or a tool change. The first drag endpoint is a preview position, not a required target for the second press.
3. Press anywhere near the desired box and drag to size it. The box previews during this drag. The arrow keeps its original tip and attaches to the nearest suitable point on the box perimeter as the box changes.
4. Release to finish. A second click without meaningful movement places a default-size box at the clicked position. Focus the callout text editor immediately. Respect tool locking as existing callout creation does.

The two drags are explicit. No pause, direction-change, or speed heuristic changes the phase. Do not require the second press to hit the leader endpoint.

## Feedback and recovery

- Show the first-step direction when the Callout tool is selected and the user has not started drawing, using existing tool-hint conventions where possible.
- After the first release, make the unfinished leader and on-canvas instruction visible. The next pointer down anywhere on the canvas begins box placement; it must not select an underlying element.
- Escape, tool change, pointer cancellation, or a second touch that starts a pan cancels the unfinished callout cleanly. Cancellation leaves no scene element or undo entry.
- The arrow tip stays at the initial press position throughout both phases. Ordinary snapping may apply to pointer positions; the tip must not jump at phase changes.
- Once completed, the callout is the existing single callout element with bound text. Existing editing, auto contrast, save/restore, export, and box-only/whole selection behavior continue to work.

## State and data

Keep creation phase and temporary geometry in editor state only; do not serialize them. Commit one callout element on completion, with a local `tailTip` derived from the initial world-space pointer position and a perimeter attachment derived from the final box. Use the current callout element format. The complete two-drag action creates one undo step. Preview rendering should not trigger auto contrast sampling or persistence until completion.

The placement state machine is `idle → leader drag → awaiting box → box drag → complete`. Cancellation from any non-idle state returns to `idle`. Missing pointer-up cleanup must cancel rather than commit.

## Verification

- Pointer tests cover tip placement, leader release, second drag from a location unrelated to the endpoint, box geometry, final tip position, and immediate text focus.
- Verify a click-sized second gesture creates a useful default box. Verify Escape, tool switch, pointer cancellation, and a second touch discard pending creation with no scene/undo artifact.
- Verify locked and unlocked Callout tools, mouse and touch pointer paths, save/restore, and one undo/redo step.
- Check the on-canvas hint is visible during the waiting phase and clears on placement or cancellation. Check the feature visually at desktop and compact widths.
