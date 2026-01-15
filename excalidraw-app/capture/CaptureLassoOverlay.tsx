import React, { useState, useCallback } from "react";
import { simplify } from "points-on-curve";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useCaptureOverlay, overlayStyle } from "./useCaptureOverlay";
import { captureRegionWithMask, getBoundsFromPoints, getStaticCanvas, isClickOnCaptureUI } from "./captureUtils";

interface Props {
  isActive: boolean;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onCaptureComplete: () => void;
}

export const CaptureLassoOverlay: React.FC<Props> = (props) => {
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
      if (bounds.width < 10 || bounds.height < 10) return;

      const staticCanvas = getStaticCanvas();
      if (!staticCanvas) return;

      const captured = captureRegionWithMask(staticCanvas, simplified, appState);
      if (captured) await finishCapture(captured, bounds);
    },
    [isDrawing, appState, points, finishCapture],
  );

  if (!props.isActive) return null;

  const screenPoints = getScreenPoints(points);
  const polygonStr = screenPoints.map(([x, y]) => `${x},${y}`).join(" ");

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
        <svg style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
          <polygon
            points={polygonStr}
            fill="rgba(0, 0, 0, 0.3)"
            stroke="#6965db"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
        </svg>
      )}
    </div>
  );
};

export default CaptureLassoOverlay;
