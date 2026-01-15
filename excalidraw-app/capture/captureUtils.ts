import { newImageElement, syncInvalidIndices } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import {
  randomId,
  viewportCoordsToSceneCoords,
  sceneCoordsToViewportCoords,
} from "@excalidraw/common";

import type { AppState, ExcalidrawImperativeAPI, DataURL } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

export interface CaptureRegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculate bounding box from an array of points.
 */
export const getBoundsFromPoints = (
  points: Array<[number, number]>,
): CaptureRegionBounds => {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const [minX, minY, maxX, maxY] = points.reduce(
    (acc, [x, y]) => [
      Math.min(acc[0], x),
      Math.min(acc[1], y),
      Math.max(acc[2], x),
      Math.max(acc[3], y),
    ],
    [Infinity, Infinity, -Infinity, -Infinity],
  );
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

/**
 * Convert viewport (screen) coordinates to scene coordinates.
 * Re-exports Excalidraw's utility with a simpler interface.
 */
export const screenToScene = (
  clientX: number,
  clientY: number,
  appState: AppState,
): { x: number; y: number } => {
  return viewportCoordsToSceneCoords({ clientX, clientY }, appState);
};

/**
 * Convert scene coordinates to viewport (screen) coordinates.
 * Re-exports Excalidraw's utility with a simpler interface.
 */
export const sceneToScreen = (
  sceneX: number,
  sceneY: number,
  appState: AppState,
): { x: number; y: number } => {
  return sceneCoordsToViewportCoords({ sceneX, sceneY }, appState);
};

/**
 * Capture a region from the static canvas.
 * Converts scene coordinates to canvas pixel coordinates and extracts that region.
 */
export const captureRegionFromCanvas = (
  sourceCanvas: HTMLCanvasElement,
  bounds: CaptureRegionBounds,
  appState: AppState,
): HTMLCanvasElement | null => {
  const { zoom, scrollX, scrollY } = appState;
  const scale = window.devicePixelRatio * zoom.value;

  // Convert scene coordinates to canvas pixel coordinates
  const canvasX = (bounds.x + scrollX) * scale;
  const canvasY = (bounds.y + scrollY) * scale;
  const canvasWidth = bounds.width * scale;
  const canvasHeight = bounds.height * scale;

  // Validate dimensions
  if (canvasWidth < 10 || canvasHeight < 10) {
    console.warn("Capture region too small");
    return null;
  }

  // Create output canvas at the captured size (accounting for DPI)
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = canvasWidth;
  outputCanvas.height = canvasHeight;

  const ctx = outputCanvas.getContext("2d");
  if (!ctx) {
    console.error("Failed to get canvas context");
    return null;
  }

  // Draw the captured region
  ctx.drawImage(
    sourceCanvas,
    canvasX,
    canvasY,
    canvasWidth,
    canvasHeight,
    0,
    0,
    canvasWidth,
    canvasHeight,
  );

  return outputCanvas;
};

/**
 * Create an image element from a captured canvas and add it to the scene.
 * The element is selected and the selection tool is activated.
 */
export const createImageFromCapture = async (
  excalidrawAPI: ExcalidrawImperativeAPI,
  canvas: HTMLCanvasElement,
  bounds: CaptureRegionBounds,
): Promise<string> => {
  const dataURL = canvas.toDataURL("image/png") as DataURL;
  const fileId = `capture-${Date.now()}-${randomId()}` as FileId;

  excalidrawAPI.addFiles([
    {
      id: fileId,
      dataURL,
      mimeType: "image/png",
      created: Date.now(),
    },
  ]);

  const imageElement = newImageElement({
    type: "image",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fileId,
    status: "saved",
  });

  const currentElements = excalidrawAPI.getSceneElements();
  const finalElements = syncInvalidIndices([...currentElements, imageElement]);

  excalidrawAPI.updateScene({
    elements: finalElements,
    appState: {
      selectedElementIds: { [imageElement.id]: true },
      activeTool: {
        type: "selection",
        lastActiveTool: null,
        locked: false,
        customType: null,
        fromSelection: false,
      },
    },
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  return imageElement.id;
};

/**
 * Check if a click is on the capture tool button or mode switcher.
 */
export const isClickOnCaptureUI = (clientX: number, clientY: number): boolean =>
  document.elementsFromPoint(clientX, clientY).some(
    (el) =>
      el instanceof HTMLElement &&
      (el.closest('[data-testid="capture-tool-button"]') ||
        el.closest('[data-capture-mode-switcher]')),
  );

/**
 * Get the static canvas element (first canvas with excalidraw__canvas class).
 */
export const getStaticCanvas = (): HTMLCanvasElement | null => {
  const canvas = document.querySelector(".excalidraw__canvas");
  return canvas instanceof HTMLCanvasElement ? canvas : null;
};

/**
 * Capture a region from the static canvas with a lasso mask.
 * Creates an image with transparency outside the lasso path.
 */
export const captureRegionWithMask = (
  sourceCanvas: HTMLCanvasElement,
  lassoPoints: Array<[number, number]>,
  appState: AppState,
): HTMLCanvasElement | null => {
  if (lassoPoints.length < 3) {
    console.warn("Lasso must have at least 3 points");
    return null;
  }

  const bounds = getBoundsFromPoints(lassoPoints);
  const { zoom, scrollX, scrollY } = appState;
  const scale = window.devicePixelRatio * zoom.value;

  // Validate dimensions
  if (bounds.width < 10 || bounds.height < 10) {
    console.warn("Capture region too small");
    return null;
  }

  // Output canvas at bounding box size
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = bounds.width * scale;
  outputCanvas.height = bounds.height * scale;

  const ctx = outputCanvas.getContext("2d");
  if (!ctx) {
    console.error("Failed to get canvas context");
    return null;
  }

  // Create clip path from lasso points (in canvas pixel coords relative to bounds)
  ctx.beginPath();
  lassoPoints.forEach(([x, y], i) => {
    const canvasX = (x - bounds.x) * scale;
    const canvasY = (y - bounds.y) * scale;
    if (i === 0) {
      ctx.moveTo(canvasX, canvasY);
    } else {
      ctx.lineTo(canvasX, canvasY);
    }
  });
  ctx.closePath();
  ctx.clip();

  // Draw source canvas region through clip
  const srcX = (bounds.x + scrollX) * scale;
  const srcY = (bounds.y + scrollY) * scale;
  ctx.drawImage(
    sourceCanvas,
    srcX,
    srcY,
    bounds.width * scale,
    bounds.height * scale,
    0,
    0,
    bounds.width * scale,
    bounds.height * scale,
  );

  return outputCanvas;
};
