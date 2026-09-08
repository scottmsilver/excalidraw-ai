import {
  getAutoContrastModes,
  getAutoContrastResolved,
  getAutoContrastManualColors,
  hasAutoContrastFill,
} from "./autoContrast";

import type { ExcalidrawElement, ExcalidrawCalloutElement } from "./types";

export type AutoContrastModes = {
  foreground: boolean;
  background: boolean;
  opacity: boolean;
};
export type AutoContrastField = keyof AutoContrastModes;
export type AutoContrastUpdate = Partial<
  Pick<
    ExcalidrawElement,
    | "autoContrast"
    | "autoContrastManualColors"
    | "fillOpacity"
    | "strokeColor"
    | "backgroundColor"
  > &
    Pick<
      ExcalidrawCalloutElement,
      "calloutAutoStyle" | "calloutManualColors" | "calloutBackgroundOpacity"
    >
>;
export const autoContrastChanges = (
  element: ExcalidrawElement,
  changes: {
    modes?: AutoContrastModes;
    manualColors?: { foreground?: string; background?: string };
    fillOpacity?: number;
  },
): AutoContrastUpdate => {
  const legacy = element.type === "callout" && !element.autoContrast;
  return {
    ...("modes" in changes
      ? { [legacy ? "calloutAutoStyle" : "autoContrast"]: changes.modes }
      : {}),
    ...("manualColors" in changes
      ? {
          [legacy ? "calloutManualColors" : "autoContrastManualColors"]:
            changes.manualColors,
        }
      : {}),
    ...("fillOpacity" in changes
      ? {
          [legacy ? "calloutBackgroundOpacity" : "fillOpacity"]:
            changes.fillOpacity,
        }
      : {}),
  };
};

export const setAutoContrastFields = (
  element: ExcalidrawElement,
  fields: Partial<AutoContrastModes>,
): AutoContrastUpdate => {
  const modes = {
    foreground: false,
    background: false,
    opacity: false,
    ...getAutoContrastModes(element),
    ...fields,
  };
  if (!hasAutoContrastFill(element)) {
    modes.background = modes.opacity = false;
  }
  const resolved = getAutoContrastResolved(element);
  const manualColors = { ...getAutoContrastManualColors(element) };
  if (resolved && fields.foreground === false) {
    manualColors.foreground = resolved.foreground;
  }
  if (resolved && fields.background === false) {
    manualColors.background = resolved.background;
  }
  return {
    ...autoContrastChanges(element, {
      modes,
      manualColors,
      ...(resolved && fields.opacity === false && hasAutoContrastFill(element)
        ? { fillOpacity: resolved.backgroundOpacity }
        : {}),
    }),
    ...(resolved && fields.foreground === false
      ? { strokeColor: resolved.foreground }
      : {}),
    ...(resolved && fields.background === false && hasAutoContrastFill(element)
      ? { backgroundColor: resolved.background }
      : {}),
  };
};

/** A palette edit restores normal theme semantics and locks just that color. */
export const lockAutoContrastColor = (
  element: ExcalidrawElement,
  field: "foreground" | "background",
) => {
  const modes = getAutoContrastModes(element);
  return modes
    ? autoContrastChanges(element, {
        modes: { ...modes, [field]: false },
        manualColors: {
          ...getAutoContrastManualColors(element),
          [field]: undefined,
        },
      })
    : {};
};
