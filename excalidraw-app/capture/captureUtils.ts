import { newImageElement, syncInvalidIndices } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import { randomId } from "@excalidraw/common";

import type { AppState, ExcalidrawImperativeAPI, DataURL } from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/element/types";

export interface CaptureRegionBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
 * Follows the same pattern as handleResult in App.tsx.
 * Returns the created element ID so it can be selected.
 */
export const createImageFromCapture = async (
  excalidrawAPI: ExcalidrawImperativeAPI,
  canvas: HTMLCanvasElement,
  bounds: CaptureRegionBounds,
  selectAfterCreate: boolean = true,
): Promise<string> => {
  // Convert canvas to data URL
  const dataURL = canvas.toDataURL("image/png") as DataURL;

  // Generate unique file ID
  const fileId = `capture-${Date.now()}-${randomId()}` as FileId;

  // Add file to excalidraw's file storage
  excalidrawAPI.addFiles([
    {
      id: fileId,
      dataURL,
      mimeType: "image/png",
      created: Date.now(),
    },
  ]);

  // Create image element at the capture position
  const imageElement = newImageElement({
    type: "image",
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    fileId,
    status: "saved",
  });

  // Add to scene with undo support
  const currentElements = excalidrawAPI.getSceneElements();
  const finalElements = syncInvalidIndices([...currentElements, imageElement]);

  // Update scene and optionally select the new element
  excalidrawAPI.updateScene({
    elements: finalElements,
    appState: selectAfterCreate
      ? {
          selectedElementIds: { [imageElement.id]: true },
          // Switch to selection tool so user can move/resize the image
          activeTool: {
            type: "selection",
            lastActiveTool: null,
            locked: false,
            customType: null,
            fromSelection: false,
          },
        }
      : undefined,
    captureUpdate: CaptureUpdateAction.IMMEDIATELY,
  });

  return imageElement.id;
};

/**
 * Get the static canvas element from the Excalidraw container.
 */
export const getStaticCanvas = (): HTMLCanvasElement | null => {
  // The static canvas has the class "excalidraw__canvas" and is not interactive
  const canvases = document.querySelectorAll(".excalidraw__canvas");

  // There are typically two canvases - static and interactive
  // The static one renders the elements, the interactive one handles input
  // We want the static one which has the rendered content
  for (const canvas of canvases) {
    if (canvas instanceof HTMLCanvasElement) {
      // Return the first canvas (static canvas)
      return canvas;
    }
  }

  return null;
};

/**
 * Convert screen coordinates to scene coordinates.
 */
export const screenToScene = (
  screenX: number,
  screenY: number,
  canvasOffset: { left: number; top: number },
  appState: AppState,
): { x: number; y: number } => {
  const { zoom, scrollX, scrollY } = appState;

  return {
    x: (screenX - canvasOffset.left) / zoom.value - scrollX,
    y: (screenY - canvasOffset.top) / zoom.value - scrollY,
  };
};

/**
 * Get the canvas container offset for coordinate calculations.
 */
export const getCanvasOffset = (): { left: number; top: number } => {
  const container = document.querySelector(".excalidraw-container");
  if (container) {
    const rect = container.getBoundingClientRect();
    return { left: rect.left, top: rect.top };
  }
  return { left: 0, top: 0 };
};
