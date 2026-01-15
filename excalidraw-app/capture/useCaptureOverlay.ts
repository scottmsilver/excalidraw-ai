import { useState, useEffect, useRef, useCallback } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  createImageFromCapture,
  screenToScene,
  sceneToScreen,
  type CaptureRegionBounds,
} from "./captureUtils";

interface UseCaptureOverlayOptions {
  isActive: boolean;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onCaptureComplete: () => void;
}

/**
 * Shared hook for capture overlay components.
 * Handles tool switching, escape key, coordinate conversion, and capture completion.
 */
export const useCaptureOverlay = ({
  isActive,
  excalidrawAPI,
  onCaptureComplete,
}: UseCaptureOverlayOptions) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const previousToolRef = useRef<{ type: string } | null>(null);
  const captureCompletedRef = useRef(false);

  // Set hand tool when activated
  useEffect(() => {
    if (!excalidrawAPI) return;

    if (isActive) {
      const currentTool = excalidrawAPI.getAppState().activeTool;
      previousToolRef.current = { type: currentTool.type };
      captureCompletedRef.current = false;
      excalidrawAPI.setActiveTool({ type: "hand" });
    } else {
      if (previousToolRef.current && !captureCompletedRef.current) {
        excalidrawAPI.setActiveTool(previousToolRef.current as any);
      }
      previousToolRef.current = null;
      captureCompletedRef.current = false;
      setIsDrawing(false);
    }
  }, [isActive, excalidrawAPI]);

  // Handle escape key
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCaptureComplete();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, onCaptureComplete]);

  const getSceneCoords = useCallback(
    (clientX: number, clientY: number) => {
      if (!excalidrawAPI) return null;
      return screenToScene(clientX, clientY, excalidrawAPI.getAppState());
    },
    [excalidrawAPI],
  );

  const getScreenBounds = useCallback(
    (bounds: CaptureRegionBounds) => {
      if (!excalidrawAPI) return null;
      const appState = excalidrawAPI.getAppState();
      const topLeft = sceneToScreen(bounds.x, bounds.y, appState);
      const bottomRight = sceneToScreen(bounds.x + bounds.width, bounds.y + bounds.height, appState);
      return {
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
      };
    },
    [excalidrawAPI],
  );

  const getScreenPoints = useCallback(
    (points: Array<[number, number]>) => {
      if (!excalidrawAPI || points.length === 0) return [];
      const appState = excalidrawAPI.getAppState();
      return points.map(([x, y]) => {
        const screen = sceneToScreen(x, y, appState);
        return [screen.x, screen.y] as [number, number];
      });
    },
    [excalidrawAPI],
  );

  const startDrawing = useCallback(
    (clientX: number, clientY: number) => {
      const coords = getSceneCoords(clientX, clientY);
      if (coords) setIsDrawing(true);
      return coords;
    },
    [getSceneCoords],
  );

  const finishCapture = useCallback(
    async (canvas: HTMLCanvasElement, bounds: CaptureRegionBounds) => {
      if (!excalidrawAPI) return;
      await createImageFromCapture(excalidrawAPI, canvas, bounds);
      captureCompletedRef.current = true;
      onCaptureComplete();
    },
    [excalidrawAPI, onCaptureComplete],
  );

  return {
    isDrawing,
    startDrawing,
    getSceneCoords,
    getScreenBounds,
    getScreenPoints,
    finishCapture,
    appState: excalidrawAPI?.getAppState() ?? null,
  };
};

// Shared overlay container styles
export const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  cursor: "crosshair",
  zIndex: 999,
};

// Shared selection visual styles
export const selectionStyle: React.CSSProperties = {
  border: "2px solid #6965db",
  backgroundColor: "rgba(0, 0, 0, 0.3)",
  pointerEvents: "none",
  boxSizing: "border-box",
};
