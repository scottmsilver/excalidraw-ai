# Integrated Colors controls

Approved by the user after reviewing interactive mockup A. This supersedes the standalone Contrast checkbox and Advanced disclosure from the earlier shared-Auto design.

## Interface

The full sidebar has one Colors group. Its header pairs the Colors label with a compact Auto contrast toggle and attached chevron. Active is purple; inactive is neutral; partially automatic uses an accessible mixed pressed state. The chevron reveals deeper settings and exposes its expanded state to assistive technology. Escape closes those settings and returns focus to the chevron; changing selection resets the disclosure.

Fully automatic supported selections show resolved stroke/background swatches instead of manual palettes. Empty fills are labeled None; differing colors or fill alpha are Mixed. Manual or partially automatic selections retain existing color-picker actions. Mixed selections containing unsupported elements retain their manual controls. Stroke-only elements omit background controls.

Advanced settings use Auto/Manual segmented buttons for foreground, background and fill opacity. There are no checkbox inputs in these controls. The existing fill-opacity slider remains available with an explicit label and separate value output.

Compact and mobile layouts use one Colors palette-icon entry. Its local disclosure state lets nested pickers use the existing app popup state without closing the parent Colors panel. The previous separate color entries are retained only for unsupported selections and unselected drawing tools.

## Preserved behavior

Callouts default to Auto. Other supported shapes opt in. The master controls all applicable fields together; turning it off restores underlying manual styling. Advanced individual locks retain their existing freeze semantics. Explicit changes remain undoable, and underlying artwork continues driving resolved colors. No sampling, geometry, or immediate callout text-focus changes are part of this UI revision.

## Scope

Implementation and preview stay on the isolated feature clone/port 5196. No root main integration or Fly deployment is included.
