# Stable Auto contrast layout

The user approved the interactive stable-colors mockup after deploying the previous integrated Colors controls. This follow-up changes presentation and interaction, not the contrast solver.

- Use the existing Excalidraw Switch styling for the master and each advanced automatic field. Native keyboard activation must happen exactly once; canvas Space shortcuts must not consume the switch keypress.
- Keep the existing color rows mounted and fixed in size. Disable and dim each automatically controlled field. Keep manually controlled fields editable. Show the derived color in the current-color slot without changing row dimensions or modifying stored manual colors.
- Put advanced settings behind a separate settings icon. Use a floating Radix popover in the app container; it must not participate in sidebar layout. Open beside the trigger on desktop and below it on phones, with collision handling.
- Escape closes advanced settings and returns focus without clearing the selected annotation or closing the parent compact Colors popup. Outside clicks and selection changes close advanced settings without stealing text-editor focus.
- Preserve partial/mixed-selection semantics with a centered switch thumb and accessible explanation. Toggling a partially automatic master on enables all applicable fields.
- Preserve callout Auto defaults, off-restores-manual, advanced field-lock semantics, live artwork sampling, undo and immediate typing.

Verification includes native keyboard tests, matching trigger/dialog accessibility IDs, per-field disablement, selection retention on Escape, before/after DOM geometry equality, before/after canvas pixel equality, and nested mobile picker interactions.

Scope: feature branch and isolated preview5196 only. Main/local5192 and Fly stay on deployed UI73464f32 pending another release request.
