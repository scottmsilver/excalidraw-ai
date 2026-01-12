import { useEffect, useState } from "react";

import { getElementAbsoluteCoords } from "@excalidraw/element";

import { sceneCoordsToViewportCoords } from "..";

import Spinner from "./Spinner";

import "./ConvertingOverlay.scss";

import type {
  ElementsMap,
  ExcalidrawImageElement,
} from "@excalidraw/element/types";
import type { AppState } from "../types";

interface ConvertingOverlayProps {
  convertingElementIds: Set<string>;
  elementsMap: ElementsMap;
  appState: AppState;
}

/**
 * Renders spinning overlays on top of elements that are being converted
 * (e.g., HEIC to JPEG conversion).
 */
export const ConvertingOverlay: React.FC<ConvertingOverlayProps> = ({
  convertingElementIds,
  elementsMap,
  appState,
}) => {
  const [overlays, setOverlays] = useState<
    Array<{ id: string; x: number; y: number; width: number; height: number }>
  >([]);

  useEffect(() => {
    if (convertingElementIds.size === 0) {
      setOverlays([]);
      return;
    }

    const newOverlays: typeof overlays = [];

    for (const elementId of convertingElementIds) {
      const element = elementsMap.get(elementId) as
        | ExcalidrawImageElement
        | undefined;
      if (!element) {
        continue;
      }

      const [x1, y1, x2, y2] = getElementAbsoluteCoords(element, elementsMap);

      // Convert scene coords to viewport coords
      const topLeft = sceneCoordsToViewportCoords(
        { sceneX: x1, sceneY: y1 },
        appState,
      );
      const bottomRight = sceneCoordsToViewportCoords(
        { sceneX: x2, sceneY: y2 },
        appState,
      );

      newOverlays.push({
        id: elementId,
        x: topLeft.x - appState.offsetLeft,
        y: topLeft.y - appState.offsetTop,
        width: (bottomRight.x - topLeft.x) * appState.zoom.value,
        height: (bottomRight.y - topLeft.y) * appState.zoom.value,
      });
    }

    setOverlays(newOverlays);
  }, [convertingElementIds, elementsMap, appState]);

  if (overlays.length === 0) {
    return null;
  }

  return (
    <>
      {overlays.map((overlay) => (
        <div
          key={overlay.id}
          className="ConvertingOverlay"
          style={{
            left: overlay.x,
            top: overlay.y,
            width: overlay.width,
            height: overlay.height,
          }}
        >
          <div className="ConvertingOverlay__content">
            <Spinner size="2em" />
            <span className="ConvertingOverlay__text">Converting...</span>
          </div>
        </div>
      ))}
    </>
  );
};
