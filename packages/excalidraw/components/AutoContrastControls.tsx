import { Children, useEffect, useId, useRef, useState } from "react";
import { Popover } from "radix-ui";

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

import { adjustmentsIcon } from "./icons";
import { Switch } from "./Switch";
import { useEditorInterface, useExcalidrawContainer } from "./App";

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
  const restoreFocus = useRef(false);
  const { container } = useExcalidrawContainer();
  const editorInterface = useEditorInterface();
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
        <Switch
          name={`${advancedId}-auto-${field}`}
          role="switch"
          label={`Auto ${label.toLowerCase()}`}
          checked={every}
          mixed={some && !every}
          description={some && !every ? `${advancedId}-mixed` : undefined}
          onChange={(automatic) =>
            update(
              (element) =>
                setAutoContrastFields(element, { [field]: automatic }),
              applicable,
            )
          }
        />
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
        </span>
      </div>
    );
  };
  return (
    <Popover.Root
      open={expanded}
      onOpenChange={(open) => setExpandedSelection(open ? selectionKey : null)}
    >
      <section className="auto-contrast" role="group" aria-label="Colors">
        <div className="auto-contrast__header">
          <span className="auto-contrast__title">Colors</span>
          <Popover.Trigger asChild>
            <button
              type="button"
              ref={advancedTrigger}
              className="auto-contrast__settings"
              aria-label="Advanced color settings"
              title="Advanced color settings"
            >
              {adjustmentsIcon}
            </button>
          </Popover.Trigger>
        </div>
        <div className="auto-contrast__mode">
          <label htmlFor={`${advancedId}-master`}>Auto contrast</label>
          <Switch
            name={`${advancedId}-master`}
            role="switch"
            label="Auto contrast"
            checked={all}
            mixed={any && !all}
            description={any && !all ? `${advancedId}-mixed` : undefined}
            title={
              any && !all
                ? "Some settings are manual. Enable all automatic settings."
                : "Automatically adapt colors to the artwork underneath"
            }
            onChange={(value) => {
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
          />
        </div>
        <span id={`${advancedId}-mixed`} className="auto-contrast__sr-only">
          Some settings are manual. Turn on to make all applicable settings
          automatic.
        </span>
        <div className="auto-contrast__manual">
          {Children.toArray(children).map((child, index) => {
            const field = index === 0 ? "foreground" : "background";
            const applicable = index === 0 ? owners : fillOwners;
            const automatic =
              !hasUnsupportedTargets &&
              applicable.length > 0 &&
              applicable.every((element) => mode(element, field));
            return (
              <div
                className="auto-contrast__color-row"
                key={field}
                data-automatic={automatic}
              >
                <fieldset disabled={automatic}>{child}</fieldset>
                {automatic &&
                  preview(
                    field,
                    index === 0 ? "Stroke" : "Background",
                    applicable,
                  )}
              </div>
            );
          })}
        </div>
      </section>
      {expanded && (
        <Popover.Portal container={container}>
          <Popover.Content
            className="auto-contrast auto-contrast__advanced"
            aria-label="Automatic color settings"
            side={editorInterface.formFactor === "phone" ? "bottom" : "right"}
            align="start"
            sideOffset={12}
            collisionPadding={12}
            collisionBoundary={container ?? undefined}
            onEscapeKeyDown={(event) => {
              event.stopPropagation();
              restoreFocus.current = true;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (restoreFocus.current) {
                restoreFocus.current = false;
                advancedTrigger.current?.focus();
              }
            }}
          >
            <h3>Automatic settings</h3>
            {any && !all && <small>Some settings are manual</small>}
            {fieldControl("foreground", "Foreground")}
            {!!fillOwners.length && (
              <>
                {fieldControl("background", "Background", fillOwners)}
                {fieldControl("opacity", "Background opacity", fillOwners)}
                <div className="auto-contrast__opacity-control">
                  <span className="auto-contrast__opacity-label">
                    <label htmlFor={`${advancedId}-opacity`}>
                      Fill opacity
                    </label>
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
              <p role="status">
                Artwork unavailable; using a contrast fallback.
              </p>
            )}
            {owners.some(
              (element) => getAutoContrastResolved(element)?.lowContrast,
            ) && (
              <p role="status">
                Low contrast: a single color may not be readable everywhere.
              </p>
            )}
          </Popover.Content>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
};
