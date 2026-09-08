import { colorParsley } from "colorparsley";

import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawCalloutElement,
} from "./types";

export const restoreCalloutAppearance = (
  element: ExcalidrawCalloutElement,
): Partial<ExcalidrawCalloutElement> => {
  const restored: Partial<ExcalidrawCalloutElement> = {};
  const modes = element.calloutAutoStyle;
  if ("calloutAutoStyle" in element) {
    Object.assign(restored, {
      calloutAutoStyle:
        modes && typeof modes === "object"
          ? {
              foreground: modes.foreground === true,
              background: modes.background === true,
              opacity: modes.opacity === true,
            }
          : undefined,
    });
  }
  if ("calloutBackgroundOpacity" in element) {
    Object.assign(restored, {
      calloutBackgroundOpacity: Number.isFinite(
        element.calloutBackgroundOpacity,
      )
        ? Math.max(0, Math.min(100, element.calloutBackgroundOpacity!))
        : 100,
    });
  }
  if ("calloutManualColors" in element) {
    const colors = element.calloutManualColors;
    Object.assign(restored, {
      calloutManualColors: {
        foreground:
          typeof colors?.foreground === "string"
            ? colors.foreground
            : undefined,
        background:
          typeof colors?.background === "string"
            ? colors.background
            : undefined,
      },
    });
  }
  if ("calloutResolvedStyle" in element) {
    const result = element.calloutResolvedStyle;
    const valid =
      result &&
      typeof result.foreground === "string" &&
      typeof result.background === "string" &&
      (result.halo === null || typeof result.halo === "string") &&
      [
        result.backgroundOpacity,
        result.minContrast,
        result.targetContrast,
      ].every(Number.isFinite) &&
      typeof result.lowContrast === "boolean" &&
      typeof result.fallback === "boolean";
    Object.assign(restored, {
      calloutResolvedStyle: valid
        ? {
            ...result,
            backgroundOpacity: Math.max(
              0,
              Math.min(100, result.backgroundOpacity),
            ),
          }
        : undefined,
    });
  }
  return restored;
};

export const calloutFillColor = (color: string, opacity: number) => {
  if (color === "transparent") {
    return color;
  }
  const [r, g, b, a] = colorParsley(color);
  return `rgba(${r}, ${g}, ${b}, ${
    (a * Math.max(0, Math.min(100, opacity))) / 100
  })`;
};

/** Resolved colors already describe displayed pixels, including the scene theme. */
export const getCalloutTextColor = (
  element: ExcalidrawElement,
  elementsMap: ElementsMap,
) => {
  const container =
    element.type === "text" && element.containerId
      ? elementsMap.get(element.containerId)
      : null;
  return container?.type === "callout"
    ? container.calloutResolvedStyle?.foreground
    : undefined;
};
