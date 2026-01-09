/**
 * Coordinate Highlight Overlay
 *
 * Renders a visual indicator on the Excalidraw canvas when coordinates
 * are hovered in the AI log panel. Shows a crosshair for points and
 * a bounding box for regions.
 *
 * Coordinates from the AI are in IMAGE space, so we use the coordinateTransforms
 * utility to convert them to screen space for rendering.
 */

import React from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  imageToScreen,
  canvasToScreen,
  getViewportFromAppState,
} from "../../src/utils/coordinateTransforms";

import { useCoordinateHighlightOptional } from "./CoordinateHighlightContext";

import "./CoordinateHighlightOverlay.scss";

interface CoordinateHighlightOverlayProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

/**
 * Overlay component that renders coordinate highlights on the canvas.
 * This should be rendered inside the Excalidraw component wrapper.
 */
export const CoordinateHighlightOverlay: React.FC<
  CoordinateHighlightOverlayProps
> = ({ excalidrawAPI }) => {
  const coordContext = useCoordinateHighlightOptional();

  // Get app state for coordinate transformation
  const appState = excalidrawAPI?.getAppState();

  if (!coordContext?.highlightedCoord || !appState) {
    return null;
  }

  const { highlightedCoord, exportBounds } = coordContext;
  const viewport = getViewportFromAppState(appState);

  // Transform coordinates to screen space
  // If we have export bounds, coordinates are in image space → need full transformation
  // Otherwise, assume coordinates are in canvas space → only need canvas→screen
  const toScreen = (x: number, y: number) => {
    if (exportBounds) {
      return imageToScreen({ x, y }, exportBounds, viewport);
    }
    // Fallback: assume canvas coordinates
    return canvasToScreen({ x, y }, viewport);
  };

  if (highlightedCoord.type === "point") {
    const { x: imageX, y: imageY } = highlightedCoord;
    const screenPos = toScreen(imageX, imageY);
    return (
      <div className="coord-overlay">
        {/* Crosshair at point */}
        <div
          className="coord-overlay__crosshair"
          style={{
            left: screenPos.x,
            top: screenPos.y,
          }}
        >
          <div className="coord-overlay__crosshair-h" />
          <div className="coord-overlay__crosshair-v" />
          <div className="coord-overlay__point" />
        </div>
        {/* Coordinate label */}
        <div
          className="coord-overlay__label"
          style={{
            left: screenPos.x + 12,
            top: screenPos.y + 12,
          }}
        >
          ({Math.round(imageX)}, {Math.round(imageY)})
        </div>
      </div>
    );
  }

  if (highlightedCoord.type === "region") {
    const { x1, y1, x2, y2 } = highlightedCoord;
    const screen1 = toScreen(x1, y1);
    const screen2 = toScreen(x2, y2);

    const left = Math.min(screen1.x, screen2.x);
    const top = Math.min(screen1.y, screen2.y);
    const width = Math.abs(screen2.x - screen1.x);
    const height = Math.abs(screen2.y - screen1.y);

    return (
      <div className="coord-overlay">
        {/* Region bounding box */}
        <div
          className="coord-overlay__region"
          style={{
            left,
            top,
            width,
            height,
          }}
        />
        {/* Region label */}
        <div
          className="coord-overlay__label coord-overlay__label--region"
          style={{
            left,
            top: top - 24,
          }}
        >
          Region: {Math.round(Math.abs(x2 - x1))} x{" "}
          {Math.round(Math.abs(y2 - y1))}
        </div>
      </div>
    );
  }

  return null;
};

export default CoordinateHighlightOverlay;
