import React, { useState, useCallback } from "react";
import { simplify } from "points-on-curve";

import { useCaptureOverlay, overlayStyle, type CaptureOverlayProps } from "./useCaptureOverlay";
import { captureRegionWithMask, getBoundsFromPoints, getStaticCanvas, isClickOnCaptureUI } from "./captureUtils";
import { SelectionOverlaySVG, pointsToPolygonString, MIN_CAPTURE_SIZE } from "./captureStyles";

export const CaptureLassoOverlay: React.FC<CaptureOverlayProps> = (props) => {
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const { isDrawing, startDrawing, getSceneCoords, getScreenPoints, finishCapture, appState } =
    useCaptureOverlay(props);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isClickOnCaptureUI(e.clientX, e.clientY)) return;
      e.stopPropagation();
      e.preventDefault();

      const coords = startDrawing(e.clientX, e.clientY);
      if (coords) setPoints([[coords.x, coords.y]]);
    },
    [startDrawing],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing) return;
      e.stopPropagation();

      const coords = getSceneCoords(e.clientX, e.clientY);
      if (coords) setPoints((prev) => [...prev, [coords.x, coords.y]]);
    },
    [isDrawing, getSceneCoords],
  );

  const handleMouseUp = useCallback(
    async (e?: React.MouseEvent) => {
      if (!isDrawing || !appState) return;
      if (e) e.stopPropagation();

      const simplified = simplify(points, 5 / appState.zoom.value) as Array<[number, number]>;
      setPoints([]);

      if (simplified.length < 3) return;

      const bounds = getBoundsFromPoints(simplified);
      if (bounds.width < MIN_CAPTURE_SIZE || bounds.height < MIN_CAPTURE_SIZE) return;

      const staticCanvas = getStaticCanvas();
      if (!staticCanvas) return;

      const captured = captureRegionWithMask(staticCanvas, simplified, appState);
      if (captured) await finishCapture(captured, bounds, simplified);
    },
    [isDrawing, appState, points, finishCapture],
  );

  if (!props.isActive) return null;

  const screenPoints = getScreenPoints(points);
  const polygonStr = pointsToPolygonString(screenPoints);

  return (
    <div
      data-capture-overlay
      style={overlayStyle}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => isDrawing && handleMouseUp()}
    >
      {isDrawing && screenPoints.length >= 2 && (
        <SelectionOverlaySVG id="lasso" shape={{ type: "polygon", points: polygonStr }} />
      )}
    </div>
  );
};

export default CaptureLassoOverlay;
