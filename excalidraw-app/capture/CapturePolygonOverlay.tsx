import React, { useState, useCallback } from "react";

import { useCaptureOverlay, overlayStyle, type CaptureOverlayProps } from "./useCaptureOverlay";
import { captureRegionWithMask, getBoundsFromPoints, getStaticCanvas, isClickOnCaptureUI } from "./captureUtils";
import {
  SelectionOverlaySVG,
  selectionOutlineProps,
  fullscreenSvgStyle,
  pointsToPolygonString,
  instructionToastStyle,
  SELECTION_COLOR,
  MIN_CAPTURE_SIZE,
} from "./captureStyles";

/** Distance in pixels to close polygon by clicking near start point */
const CLOSE_THRESHOLD = 15;

/** Render vertex circles for polygon points */
const VertexCircles: React.FC<{ points: Array<[number, number]>; highlightFirst: boolean }> = ({ points, highlightFirst }) => (
  <>
    {points.map(([x, y], i) => (
      <circle
        key={i}
        cx={x}
        cy={y}
        r={highlightFirst && i === 0 ? 8 : 5}
        fill={i === 0 ? SELECTION_COLOR : "white"}
        stroke={SELECTION_COLOR}
        strokeWidth="2"
      />
    ))}
  </>
);

export const CapturePolygonOverlay: React.FC<CaptureOverlayProps> = (props) => {
  const [points, setPoints] = useState<Array<[number, number]>>([]);
  const { isDrawing, startDrawing, getSceneCoords, getScreenPoints, finishCapture, appState } =
    useCaptureOverlay(props);

  const completeCapture = useCallback(
    async (polygonPoints: Array<[number, number]>) => {
      if (!appState || polygonPoints.length < 3) return;

      const bounds = getBoundsFromPoints(polygonPoints);
      if (bounds.width < MIN_CAPTURE_SIZE || bounds.height < MIN_CAPTURE_SIZE) return;

      const staticCanvas = getStaticCanvas();
      if (!staticCanvas) return;

      const captured = captureRegionWithMask(staticCanvas, polygonPoints, appState);
      if (captured) await finishCapture(captured, bounds, polygonPoints);
    },
    [appState, finishCapture],
  );

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      if (isClickOnCaptureUI(e.clientX, e.clientY)) return;
      e.stopPropagation();
      e.preventDefault();

      const coords = isDrawing ? getSceneCoords(e.clientX, e.clientY) : startDrawing(e.clientX, e.clientY);
      if (!coords) return;

      // Check if clicking near the first point to close polygon
      if (points.length >= 3) {
        const screenPoints = getScreenPoints(points);
        const firstPoint = screenPoints[0];
        const distance = Math.hypot(e.clientX - firstPoint[0], e.clientY - firstPoint[1]);

        if (distance < CLOSE_THRESHOLD) {
          const finalPoints = [...points];
          setPoints([]);
          await completeCapture(finalPoints);
          return;
        }
      }

      setPoints((prev) => [...prev, [coords.x, coords.y]]);
    },
    [isDrawing, startDrawing, getSceneCoords, getScreenPoints, points, completeCapture],
  );

  const handleDoubleClick = useCallback(
    async (e: React.MouseEvent) => {
      if (isClickOnCaptureUI(e.clientX, e.clientY)) return;
      e.stopPropagation();
      e.preventDefault();

      if (points.length >= 3) {
        const finalPoints = [...points];
        setPoints([]);
        await completeCapture(finalPoints);
      }
    },
    [points, completeCapture],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && points.length >= 3) {
        const finalPoints = [...points];
        setPoints([]);
        await completeCapture(finalPoints);
      } else if (e.key === "Backspace" && points.length > 0) {
        setPoints((prev) => prev.slice(0, -1));
      }
    },
    [points, completeCapture],
  );

  if (!props.isActive) return null;

  const screenPoints = getScreenPoints(points);
  const polygonStr = pointsToPolygonString(screenPoints);

  return (
    <div
      data-capture-overlay
      style={overlayStyle}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {screenPoints.length >= 3 && (
        <SelectionOverlaySVG id="polygon" shape={{ type: "polygon", points: polygonStr }}>
          <VertexCircles points={screenPoints} highlightFirst />
        </SelectionOverlaySVG>
      )}
      {screenPoints.length > 0 && screenPoints.length < 3 && (
        <svg style={fullscreenSvgStyle}>
          {screenPoints.length === 2 && (
            <line
              x1={screenPoints[0][0]}
              y1={screenPoints[0][1]}
              x2={screenPoints[1][0]}
              y2={screenPoints[1][1]}
              {...selectionOutlineProps}
            />
          )}
          <VertexCircles points={screenPoints} highlightFirst={false} />
        </svg>
      )}
      {isDrawing && screenPoints.length > 0 && screenPoints.length < 3 && (
        <div style={instructionToastStyle}>
          Click to add points ({3 - screenPoints.length} more needed)
        </div>
      )}
      {isDrawing && screenPoints.length >= 3 && (
        <div style={instructionToastStyle}>
          Double-click or click first point to complete | Backspace to undo | Enter to finish
        </div>
      )}
    </div>
  );
};

export default CapturePolygonOverlay;
