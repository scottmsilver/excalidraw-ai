# Directional callout attachment

## Goal

Make the second callout press the exact point where the arrow joins the box. Place the box on the side away from the initial arrow tip so a tap gives a useful default layout in every direction.

## Interaction

- Keep the existing first gesture, release-to-switch workflow. The first press fixes the arrow tip; the first release locks the leader preview. The second press may be anywhere on the canvas.
- Treat the second press as a fixed attachment point on the box outline. Compare the horizontal and vertical distance from the first tip to this point. The dominant axis selects the facing edge: a rightward arrow joins the left edge, a leftward arrow joins the right edge, a downward arrow joins the top edge, and an upward arrow joins the bottom edge. Horizontal wins an exact diagonal tie. If both points coincide, use the top edge and put the box below the press.
- Along the chosen edge, place the join one-third of the edge length from the corner closest to the first tip for a diagonal approach. A perfectly axis-aligned arrow joins at the midpoint. The join stays on a straight edge, including for rounded callouts. The box extends away from the arrow.
- A second tap makes the existing 160 by 100 scene-unit default box. A second drag sizes the box using the magnitude of pointer movement, independent of drag direction. Its starting press remains the exact attachment point. Preserve the box's existing minimum text height, growing away from the attachment when needed.
- The arrow tip stays fixed at the first press. The preview and final element use the same geometry, including text-height adjustments. Starting text editing must not move either endpoint or the box relative to the attachment.

## Feedback and recovery

Update the waiting hint to explain that the next press sets where the arrow joins the box and dragging sizes it. Keep the existing pointer cancellation, Escape, touch, tool-switch, undo, selection, save, and export behavior. The unfinished preview does not enter the scene.

## Verification

Cover all four dominant directions, diagonal edge offsets, axis-aligned arrows, coincident points, taps, drags in both directions, short drags at large font sizes, rounded boxes, and preview/final agreement. Confirm existing scene elements and viewport position stay unchanged, the original tip remains fixed, and text editing focuses after release.
