import { useEffect, useId, useRef, useState } from "react";

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

import { chevronDownIcon } from "./icons";

import "./AutoContrastControls.scss";

import type { ReactNode } from "react";

import type { AppClassProperties } from "../types";

export const AutoContrastControls = ({
  elements,
  app,
  children,
}: {
  elements: readonly ExcalidrawElement[];
  app: AppClassProperties;
  children?: ReactNode;
}) => {
  const [expandedSelection, setExpandedSelection] = useState<string | null>(
    null,
  );
  const advancedId = useId();
  const advancedTrigger = useRef<HTMLButtonElement>(null);
  const selectionKey = elements
    .map((element) => element.id)
    .sort()
    .join(",");
  useEffect(() => setExpandedSelection(null), [selectionKey]);
  const scene = app.scene.getElementsIncludingDeleted();
  const targets = new Map<string, ExcalidrawElement>();
  let hasUnsupportedTargets = false;
  for (const element of elements) {
    const parent =
      element.type === "text" && element.containerId
        ? app.scene.getElement(element.containerId)
        : null;
    const owner = parent && supportsAutoContrast(parent) ? parent : element;
    if (!owner.isDeleted && supportsAutoContrast(owner)) {
      targets.set(owner.id, owner);
    } else {
      hasUnsupportedTargets = true;
    }
  }
  const owners = [...targets.values()];
  if (!owners.length) {
    return <>{children}</>;
  }
  const expanded = expandedSelection === selectionKey;
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
      <div key={field} className="auto-contrast__field">
        <span>
          {field === "foreground"
            ? "Stroke"
            : field === "opacity"
            ? "Fill opacity"
            : label}
        </span>
        <div
          className="auto-contrast__segments"
          role="group"
          aria-label={`${label} mode`}
        >
          {[true, false].map((automatic) => (
            <button
              key={String(automatic)}
              type="button"
              aria-label={`${
                automatic ? "Auto" : "Manual"
              } ${label.toLowerCase()}`}
              aria-pressed={automatic ? every : !some}
              onClick={() =>
                update(
                  (element) =>
                    setAutoContrastFields(element, { [field]: automatic }),
                  applicable,
                )
              }
            >
              {automatic ? "Auto" : "Manual"}
            </button>
          ))}
        </div>
      </div>
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
  const preview = (
    field: "foreground" | "background",
    label: string,
    applicable = owners,
  ) => {
    const values = applicable.map(
      (element) =>
        getAutoContrastResolved(element)?.[field] ??
        (field === "foreground"
          ? element.strokeColor
          : element.backgroundColor),
    );
    const mixed =
      values.some((value) => value !== values[0]) ||
      (field === "background" && mixedOpacity);
    const color = values[0];
    return (
      <div
        className="auto-contrast__preview"
        aria-label={`Current ${label.toLowerCase()} color`}
      >
        <span>{label}</span>
        <span
          className="auto-contrast__value"
          title={mixed ? "Mixed colors" : color}
        >
          <span className="auto-contrast__swatch" aria-hidden="true">
            <span
              style={{
                background: mixed
                  ? "linear-gradient(135deg, #fff 50%, #555 50%)"
                  : color,
                opacity: field === "background" && !mixed ? opacity / 100 : 1,
              }}
            />
          </span>
          {mixed
            ? "Mixed"
            : color === "transparent" ||
              (field === "background" && opacity === 0)
            ? "None"
            : color === "#000000"
            ? "Black"
            : color === "#ffffff"
            ? "White"
            : color}
        </span>
      </div>
    );
  };
  return (
    <section className="auto-contrast" role="group" aria-label="Colors">
      <div className="auto-contrast__header">
        <span className="auto-contrast__title">Colors</span>
        <div className="auto-contrast__toggle-group" data-active={any}>
          <button
            type="button"
            aria-label="Auto contrast"
            aria-pressed={any && !all ? "mixed" : all}
            title={
              any && !all
                ? "Some settings are manual. Enable all automatic settings."
                : "Automatically adapt colors to the artwork underneath"
            }
            onClick={() => {
              const value = !all;
              update((element) =>
                autoContrastChanges(element, {
                  modes: {
                    foreground: value,
                    background: value && hasAutoContrastFill(element),
                    opacity: value && hasAutoContrastFill(element),
                  },
                  // The master restores manual styling, unlike an Advanced
                  // field lock which deliberately freezes its displayed value.
                  manualColors: undefined,
                }),
              );
            }}
          >
            Auto contrast
          </button>
          <button
            type="button"
            ref={advancedTrigger}
            className="auto-contrast__chevron"
            aria-label="Advanced color settings"
            title="Advanced color settings"
            aria-expanded={expanded}
            aria-controls={advancedId}
            onClick={() => setExpandedSelection(expanded ? null : selectionKey)}
          >
            {chevronDownIcon}
          </button>
        </div>
      </div>
      {all && !hasUnsupportedTargets && (
        <div className="auto-contrast__previews">
          {preview("foreground", "Stroke")}
          {!!fillOwners.length &&
            preview("background", "Background", fillOwners)}
        </div>
      )}
      <div
        className="auto-contrast__manual"
        hidden={all && !hasUnsupportedTargets}
      >
        {children}
      </div>
      <div
        id={advancedId}
        className="auto-contrast__advanced"
        hidden={!expanded}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            setExpandedSelection(null);
            advancedTrigger.current?.focus();
          }
        }}
      >
        {any && !all && <small>Some settings are manual</small>}
        {fieldControl("foreground", "Foreground")}
        {!!fillOwners.length && (
          <>
            {fieldControl("background", "Background", fillOwners)}
            {fieldControl("opacity", "Background opacity", fillOwners)}
            <div className="auto-contrast__opacity-control">
              <span className="auto-contrast__opacity-label">
                <label htmlFor={`${advancedId}-opacity`}>Fill opacity</label>
                <output>
                  {mixedOpacity ? "Mixed" : `${Math.round(opacity)}%`}
                </output>
              </span>
              <input
                id={`${advancedId}-opacity`}
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
            </div>
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
      </div>
    </section>
  );
};
