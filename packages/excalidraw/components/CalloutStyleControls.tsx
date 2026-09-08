import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";

import type { ExcalidrawCalloutElement } from "@excalidraw/element/types";

import type { AppClassProperties } from "../types";

export const CalloutStyleControls = ({
  element,
  app,
}: {
  element: ExcalidrawCalloutElement;
  app: AppClassProperties;
}) => {
  const modes = element.calloutAutoStyle ?? {
    foreground: false,
    background: false,
    opacity: false,
  };
  const resolved = element.calloutResolvedStyle;
  const update = (changes: Partial<ExcalidrawCalloutElement>) =>
    app.syncActionResult({
      elements: app.scene
        .getElementsIncludingDeleted()
        .map((candidate) =>
          candidate.id === element.id
            ? newElementWith(element, changes)
            : candidate,
        ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  return (
    <>
      <fieldset>
        <legend>Callout selection</legend>
        {(
          [
            ["box", "Box only"],
            ["whole", "Box + arrow"],
          ] as const
        ).map(([mode, label]) => (
          <label key={mode} style={{ display: "block" }}>
            <input
              type="radio"
              name={`callout-selection-${element.id}`}
              value={mode}
              checked={app.state.calloutSelectionMode === mode}
              onChange={() => app.setAppState({ calloutSelectionMode: mode })}
            />
            {label}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>Callout appearance</legend>
        {(
          [
            ["foreground", "Foreground"],
            ["background", "Background"],
            ["opacity", "Background opacity"],
          ] as const
        ).map(([field, label]) => (
          <label key={field} style={{ display: "block" }}>
            <input
              type="checkbox"
              aria-label={`Auto ${label.toLowerCase()}`}
              checked={modes[field]}
              onChange={(event) =>
                update({
                  calloutAutoStyle: { ...modes, [field]: event.target.checked },
                  ...(!event.target.checked && resolved
                    ? field === "foreground"
                      ? {
                          strokeColor: resolved.foreground,
                          calloutManualColors: {
                            ...element.calloutManualColors,
                            foreground: resolved.foreground,
                          },
                        }
                      : field === "background"
                      ? {
                          backgroundColor: resolved.background,
                          calloutManualColors: {
                            ...element.calloutManualColors,
                            background: resolved.background,
                          },
                        }
                      : { calloutBackgroundOpacity: resolved.backgroundOpacity }
                    : {}),
                })
              }
            />
            {label}: Auto
          </label>
        ))}
        <label>
          Background opacity
          <input
            aria-label="Callout background opacity"
            type="range"
            min={0}
            max={100}
            value={
              resolved?.backgroundOpacity ??
              element.calloutBackgroundOpacity ??
              100
            }
            onChange={(event) =>
              update({
                calloutBackgroundOpacity: Number(event.target.value),
                calloutAutoStyle: { ...modes, opacity: false },
              })
            }
          />
          <output>
            {Math.round(
              resolved?.backgroundOpacity ??
                element.calloutBackgroundOpacity ??
                100,
            )}
            %
          </output>
        </label>
        {resolved?.fallback && (
          <p role="status">Artwork unavailable; using a contrast fallback.</p>
        )}
        {resolved?.lowContrast && (
          <p role="status">Low contrast: manual settings limit readability.</p>
        )}
      </fieldset>
    </>
  );
};
