import type { ExcalidrawCalloutElement } from "@excalidraw/element/types";

import type { AppClassProperties } from "../types";

export const CalloutStyleControls = ({
  element,
  app,
}: {
  element: ExcalidrawCalloutElement;
  app: AppClassProperties;
}) => (
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
);
