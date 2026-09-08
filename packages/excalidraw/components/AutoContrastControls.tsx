import { CaptureUpdateAction, newElementWith } from "@excalidraw/element";
import {
  getAutoContrastModes,
  getAutoContrastResolved,
  getAutoContrastFillOpacity,
  hasAutoContrastFill,
  supportsAutoContrast,
} from "@excalidraw/element/autoContrast";
import {
  autoContrastChanges,
  setAutoContrastFields,
} from "@excalidraw/element/autoContrastUpdates";

import type {
  AutoContrastField,
  AutoContrastUpdate,
} from "@excalidraw/element/autoContrastUpdates";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AppClassProperties } from "../types";

export const AutoContrastControls = ({
  elements,
  app,
}: {
  elements: readonly ExcalidrawElement[];
  app: AppClassProperties;
}) => {
  const scene = app.scene.getElementsIncludingDeleted();
  const targets = new Map<string, ExcalidrawElement>();
  for (const element of elements) {
    const parent =
      element.type === "text" && element.containerId
        ? app.scene.getElement(element.containerId)
        : null;
    const owner = parent && supportsAutoContrast(parent) ? parent : element;
    if (!owner.isDeleted && supportsAutoContrast(owner)) {
      targets.set(owner.id, owner);
    }
  }
  const owners = [...targets.values()];
  if (!owners.length) {
    return null;
  }
  const fillOwners = owners.filter(hasAutoContrastFill);
  const mode = (element: ExcalidrawElement, field: AutoContrastField) =>
    getAutoContrastModes(element)?.[field] ?? false;
  const applicableFields = (element: ExcalidrawElement): AutoContrastField[] =>
    hasAutoContrastFill(element)
      ? ["foreground", "background", "opacity"]
      : ["foreground"];
  const all = owners.every((element) =>
    applicableFields(element).every((field) => mode(element, field)),
  );
  const any = owners.some((element) =>
    applicableFields(element).some((field) => mode(element, field)),
  );
  const update = (
    getChanges: (element: ExcalidrawElement) => AutoContrastUpdate,
    selected = owners,
  ) => {
    const ids = new Set(selected.map((element) => element.id));
    app.syncActionResult({
      elements: scene.map((element) =>
        ids.has(element.id)
          ? newElementWith(element, getChanges(element))
          : element,
      ),
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    });
  };
  const fieldControl = (
    field: AutoContrastField,
    label: string,
    applicable = owners,
  ) => {
    const every = applicable.every((element) => mode(element, field));
    const some = applicable.some((element) => mode(element, field));
    return (
      <label key={field} style={{ display: "block" }}>
        <input
          type="checkbox"
          aria-label={`Auto ${label.toLowerCase()}`}
          checked={every}
          ref={(input) => {
            if (input) {
              input.indeterminate = some && !every;
            }
          }}
          onChange={(event) =>
            update(
              (element) =>
                setAutoContrastFields(element, {
                  [field]: event.target.checked,
                }),
              applicable,
            )
          }
        />
        {label}: Auto
      </label>
    );
  };
  const opacity = fillOwners.length
    ? getAutoContrastResolved(fillOwners[0])?.backgroundOpacity ??
      getAutoContrastFillOpacity(fillOwners[0])
    : 100;
  const mixedOpacity = fillOwners.some(
    (element) =>
      (getAutoContrastResolved(element)?.backgroundOpacity ??
        getAutoContrastFillOpacity(element)) !== opacity,
  );
  return (
    <fieldset>
      <legend>Contrast</legend>
      <label style={{ display: "block" }}>
        <input
          type="checkbox"
          aria-label="Auto contrast"
          checked={all}
          ref={(input) => {
            if (input) {
              input.indeterminate = any && !all;
            }
          }}
          onChange={(event) => {
            const value = event.target.checked;
            update((element) =>
              setAutoContrastFields(element, {
                foreground: value,
                background: value,
                opacity: value,
              }),
            );
          }}
        />
        Auto contrast
      </label>
      <details
        key={owners
          .map((element) => element.id)
          .sort()
          .join(",")}
      >
        <summary>Advanced</summary>
        {any && !all && <small>Some settings are manual</small>}
        {fieldControl("foreground", "Foreground")}
        {!!fillOwners.length && (
          <>
            {fieldControl("background", "Background", fillOwners)}
            {fieldControl("opacity", "Background opacity", fillOwners)}
            <label>
              Fill opacity
              <input
                type="range"
                min={0}
                max={100}
                value={opacity}
                aria-label={
                  owners.length === 1 && owners[0].type === "callout"
                    ? "Callout background opacity"
                    : "Fill opacity"
                }
                onChange={(event) =>
                  update(
                    (element) => ({
                      ...(getAutoContrastModes(element)
                        ? setAutoContrastFields(element, { opacity: false })
                        : {}),
                      ...autoContrastChanges(element, {
                        fillOpacity: Number(event.target.value),
                      }),
                    }),
                    fillOwners,
                  )
                }
              />
              <output>
                {mixedOpacity ? "Mixed" : `${Math.round(opacity)}%`}
              </output>
            </label>
          </>
        )}
        {owners.some(
          (element) => getAutoContrastResolved(element)?.fallback,
        ) && (
          <p role="status">Artwork unavailable; using a contrast fallback.</p>
        )}
        {owners.some(
          (element) => getAutoContrastResolved(element)?.lowContrast,
        ) && (
          <p role="status">
            Low contrast: a single color may not be readable everywhere.
          </p>
        )}
      </details>
    </fieldset>
  );
};
