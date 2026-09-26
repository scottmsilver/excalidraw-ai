import type { ExcalidrawElement, ElementsMap } from "./types";

export const supportsAutoContrast = (element: ExcalidrawElement) =>
  [
    "callout",
    "text",
    "rectangle",
    "ellipse",
    "diamond",
    "arrow",
    "line",
  ].includes(element.type);

export const hasAutoContrastFill = (element: ExcalidrawElement) =>
  ["callout", "rectangle", "ellipse", "diamond"].includes(element.type);

export const getAutoContrastModes = (element: ExcalidrawElement) =>
  supportsAutoContrast(element)
    ? element.autoContrast ??
      (element.type === "callout" ? element.calloutAutoStyle : undefined)
    : undefined;

export const getAutoContrastResolved = (element: ExcalidrawElement) => {
  const modes = getAutoContrastModes(element);
  // A cached automatic appearance must not override fully manual styling.
  if (modes && !modes.foreground && !modes.background && !modes.opacity) {
    return undefined;
  }
  return supportsAutoContrast(element)
    ? element.autoContrastResolved ??
        (element.type === "callout" ? element.calloutResolvedStyle : undefined)
    : undefined;
};

export const getAutoContrastManualColors = (element: ExcalidrawElement) =>
  supportsAutoContrast(element)
    ? element.autoContrastManualColors ??
      (element.type === "callout" ? element.calloutManualColors : undefined)
    : undefined;

export const getAutoContrastFillOpacity = (element: ExcalidrawElement) =>
  hasAutoContrastFill(element)
    ? element.fillOpacity ??
      (element.type === "callout"
        ? element.calloutBackgroundOpacity
        : undefined) ??
      100
    : 100;

export const getAutoContrastTextAppearance = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
) => {
  const owner =
    element.type === "text" && element.containerId
      ? elementsMap.get(element.containerId)
      : undefined;
  return (
    (owner && getAutoContrastResolved(owner)) ||
    getAutoContrastResolved(element)
  );
};
