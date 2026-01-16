import React, { useState, useCallback } from "react";

import { useCaptureOverlay, overlayStyle, type CaptureOverlayProps } from "./useCaptureOverlay";
import { captureRegionFromCanvas, getStaticCanvas, isClickOnCaptureUI } from "./captureUtils";
import { SelectionOverlaySVG, MIN_CAPTURE_SIZE } from "./captureStyles";

const getBounds = (start: [number, number], end: [number, number]) => ({
  x: Math.min(start[0], end[0]),
  y: Math.min(start[1], end[1]),
  width: Math.abs(end[0] - start[0]),
  height: Math.abs(end[1] - start[1]),
});

export const CaptureRectangleOverlay: React.FC<CaptureOverlayProps> = (props) => {
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

      if (bounds.width < MIN_CAPTURE_SIZE || bounds.height < MIN_CAPTURE_SIZE) return;

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
      {isDrawing && screenRect && screenRect.width > 0 && screenRect.height > 0 && (
        <SelectionOverlaySVG id="rect" shape={{ type: "rect", ...screenRect }} />
      )}
    </div>
  );
};

export default CaptureRectangleOverlay;
