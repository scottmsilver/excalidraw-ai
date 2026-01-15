import React, { useState, useCallback } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useCaptureOverlay, overlayStyle, selectionStyle } from "./useCaptureOverlay";
import { captureRegionFromCanvas, getStaticCanvas, isClickOnCaptureUI } from "./captureUtils";

interface Props {
  isActive: boolean;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onCaptureComplete: () => void;
}

const getBounds = (start: [number, number], end: [number, number]) => ({
  x: Math.min(start[0], end[0]),
  y: Math.min(start[1], end[1]),
  width: Math.abs(end[0] - start[0]),
  height: Math.abs(end[1] - start[1]),
});

export const CaptureRectangleOverlay: React.FC<Props> = (props) => {
  const [points, setPoints] = useState<[[number, number], [number, number]] | null>(null);
  const { isDrawing, startDrawing, getSceneCoords, getScreenBounds, finishCapture, appState } =
    useCaptureOverlay(props);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isClickOnCaptureUI(e.clientX, e.clientY)) return;
      e.stopPropagation();
      e.preventDefault();

      const coords = startDrawing(e.clientX, e.clientY);
      if (coords) setPoints([[coords.x, coords.y], [coords.x, coords.y]]);
    },
    [startDrawing],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !points) return;
      e.stopPropagation();

      const coords = getSceneCoords(e.clientX, e.clientY);
      if (coords) setPoints([points[0], [coords.x, coords.y]]);
    },
    [isDrawing, points, getSceneCoords],
  );

  const handleMouseUp = useCallback(
    async (e?: React.MouseEvent) => {
      if (!isDrawing || !points || !appState) return;
      if (e) e.stopPropagation();

      const bounds = getBounds(points[0], points[1]);
      setPoints(null);

      if (bounds.width < 10 || bounds.height < 10) return;

      const staticCanvas = getStaticCanvas();
      if (!staticCanvas) return;

      const captured = captureRegionFromCanvas(staticCanvas, bounds, appState);
      if (captured) await finishCapture(captured, bounds);
    },
    [isDrawing, points, appState, finishCapture],
  );

  if (!props.isActive) return null;

  const screenRect = points && getScreenBounds(getBounds(points[0], points[1]));

  return (
    <div
      data-capture-overlay
      style={overlayStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => isDrawing && handleMouseUp()}
    >
      {isDrawing && screenRect && (
        <div style={{ ...selectionStyle, position: "fixed", left: screenRect.x, top: screenRect.y, width: screenRect.width, height: screenRect.height }} />
      )}
    </div>
  );
};

export default CaptureRectangleOverlay;
