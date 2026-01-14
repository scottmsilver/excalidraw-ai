import React, { useState, useCallback, useEffect, useRef } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import {
  captureRegionFromCanvas,
  createImageFromCapture,
  getStaticCanvas,
  screenToScene,
  getCanvasOffset,
  type CaptureRegionBounds,
} from "./captureUtils";

interface CaptureRectangleOverlayProps {
  isActive: boolean;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onCaptureComplete: () => void;
}

type SelectionPhase = "idle" | "drawing" | "selected" | "dragging";

interface SelectionState {
  phase: SelectionPhase;
  bounds: CaptureRegionBounds | null;
  // For drawing phase
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  // For dragging phase - offset from original position
  dragOffsetX: number;
  dragOffsetY: number;
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | null;

/**
 * Overlay component for selecting a capture region.
 * Shows the selection with handles. Creates image on drag or copy.
 */
export const CaptureRectangleOverlay: React.FC<CaptureRectangleOverlayProps> = ({
  isActive,
  excalidrawAPI,
  onCaptureComplete,
}) => {
  const [selection, setSelection] = useState<SelectionState>({
    phase: "idle",
    bounds: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    dragOffsetX: 0,
    dragOffsetY: 0,
  });

  const [snapshotDataUrl, setSnapshotDataUrl] = useState<string | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle>(null);

  const canvasOffsetRef = useRef({ left: 0, top: 0 });
  const dragStartRef = useRef({ x: 0, y: 0, bounds: null as CaptureRegionBounds | null });
  const originalBoundsRef = useRef<CaptureRegionBounds | null>(null);

  // Reset when deactivated
  useEffect(() => {
    if (!isActive) {
      setSelection({
        phase: "idle",
        bounds: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        dragOffsetX: 0,
        dragOffsetY: 0,
      });
      setSnapshotDataUrl(null);
      setActiveHandle(null);
    } else {
      canvasOffsetRef.current = getCanvasOffset();
    }
  }, [isActive]);

  // Capture snapshot when selection is complete
  useEffect(() => {
    if (selection.phase === "selected" && selection.bounds && !snapshotDataUrl && excalidrawAPI) {
      const staticCanvas = getStaticCanvas();
      if (staticCanvas) {
        const appState = excalidrawAPI.getAppState();
        const capturedCanvas = captureRegionFromCanvas(staticCanvas, selection.bounds, appState);
        if (capturedCanvas) {
          setSnapshotDataUrl(capturedCanvas.toDataURL("image/png"));
          originalBoundsRef.current = { ...selection.bounds };
        }
      }
    }
  }, [selection.phase, selection.bounds, snapshotDataUrl, excalidrawAPI]);

  const createImageAtPosition = useCallback(async () => {
    if (!excalidrawAPI || !selection.bounds || !originalBoundsRef.current) return;

    const staticCanvas = getStaticCanvas();
    if (!staticCanvas) {
      onCaptureComplete();
      return;
    }

    const appState = excalidrawAPI.getAppState();
    // Capture from original position
    const capturedCanvas = captureRegionFromCanvas(staticCanvas, originalBoundsRef.current, appState);

    if (capturedCanvas) {
      // Create at current position (which may have been dragged)
      await createImageFromCapture(excalidrawAPI, capturedCanvas, selection.bounds);
    }

    onCaptureComplete();
  }, [excalidrawAPI, selection.bounds, onCaptureComplete]);

  // Handle keyboard events (copy, escape)
  useEffect(() => {
    if (!isActive || (selection.phase !== "selected" && selection.phase !== "dragging")) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCaptureComplete();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "c" && selection.bounds) {
        e.preventDefault();
        await createImageAtPosition();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, selection.phase, selection.bounds, createImageAtPosition, onCaptureComplete]);

  const getHandleAtPosition = (
    sceneX: number,
    sceneY: number,
    bounds: CaptureRegionBounds,
  ): ResizeHandle => {
    const handleSize = 8;
    const { x, y, width, height } = bounds;

    // Check corners first
    if (Math.abs(sceneX - x) < handleSize && Math.abs(sceneY - y) < handleSize) return "nw";
    if (Math.abs(sceneX - (x + width)) < handleSize && Math.abs(sceneY - y) < handleSize) return "ne";
    if (Math.abs(sceneX - x) < handleSize && Math.abs(sceneY - (y + height)) < handleSize) return "sw";
    if (Math.abs(sceneX - (x + width)) < handleSize && Math.abs(sceneY - (y + height)) < handleSize) return "se";

    // Check edges
    if (Math.abs(sceneY - y) < handleSize && sceneX > x && sceneX < x + width) return "n";
    if (Math.abs(sceneY - (y + height)) < handleSize && sceneX > x && sceneX < x + width) return "s";
    if (Math.abs(sceneX - x) < handleSize && sceneY > y && sceneY < y + height) return "w";
    if (Math.abs(sceneX - (x + width)) < handleSize && sceneY > y && sceneY < y + height) return "e";

    return null;
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || !excalidrawAPI) return;

      canvasOffsetRef.current = getCanvasOffset();
      const appState = excalidrawAPI.getAppState();
      const sceneCoords = screenToScene(
        e.clientX,
        e.clientY,
        canvasOffsetRef.current,
        appState,
      );

      // If we have a selection, check for handle or inside click
      if (selection.phase === "selected" && selection.bounds) {
        const handle = getHandleAtPosition(sceneCoords.x, sceneCoords.y, selection.bounds);

        if (handle) {
          // Start resizing
          setActiveHandle(handle);
          dragStartRef.current = {
            x: sceneCoords.x,
            y: sceneCoords.y,
            bounds: { ...selection.bounds },
          };
          return;
        }

        const { x, y, width, height } = selection.bounds;
        const isInsideSelection =
          sceneCoords.x >= x &&
          sceneCoords.x <= x + width &&
          sceneCoords.y >= y &&
          sceneCoords.y <= y + height;

        if (isInsideSelection) {
          // Start dragging
          dragStartRef.current = {
            x: sceneCoords.x,
            y: sceneCoords.y,
            bounds: { ...selection.bounds },
          };
          setSelection((prev) => ({ ...prev, phase: "dragging" }));
          return;
        } else {
          // Clicked outside - start new selection
          setSnapshotDataUrl(null);
          originalBoundsRef.current = null;
          setSelection({
            phase: "drawing",
            bounds: null,
            startX: sceneCoords.x,
            startY: sceneCoords.y,
            currentX: sceneCoords.x,
            currentY: sceneCoords.y,
            dragOffsetX: 0,
            dragOffsetY: 0,
          });
          return;
        }
      }

      // Start drawing new selection
      setSnapshotDataUrl(null);
      originalBoundsRef.current = null;
      setSelection({
        phase: "drawing",
        bounds: null,
        startX: sceneCoords.x,
        startY: sceneCoords.y,
        currentX: sceneCoords.x,
        currentY: sceneCoords.y,
        dragOffsetX: 0,
        dragOffsetY: 0,
      });
    },
    [isActive, excalidrawAPI, selection.phase, selection.bounds],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!excalidrawAPI) return;

      const appState = excalidrawAPI.getAppState();
      const sceneCoords = screenToScene(
        e.clientX,
        e.clientY,
        canvasOffsetRef.current,
        appState,
      );

      // Resizing
      if (activeHandle && selection.bounds && dragStartRef.current.bounds) {
        const orig = dragStartRef.current.bounds;
        const dx = sceneCoords.x - dragStartRef.current.x;
        const dy = sceneCoords.y - dragStartRef.current.y;

        let newBounds = { ...orig };

        switch (activeHandle) {
          case "nw":
            newBounds.x = orig.x + dx;
            newBounds.y = orig.y + dy;
            newBounds.width = orig.width - dx;
            newBounds.height = orig.height - dy;
            break;
          case "ne":
            newBounds.y = orig.y + dy;
            newBounds.width = orig.width + dx;
            newBounds.height = orig.height - dy;
            break;
          case "sw":
            newBounds.x = orig.x + dx;
            newBounds.width = orig.width - dx;
            newBounds.height = orig.height + dy;
            break;
          case "se":
            newBounds.width = orig.width + dx;
            newBounds.height = orig.height + dy;
            break;
          case "n":
            newBounds.y = orig.y + dy;
            newBounds.height = orig.height - dy;
            break;
          case "s":
            newBounds.height = orig.height + dy;
            break;
          case "w":
            newBounds.x = orig.x + dx;
            newBounds.width = orig.width - dx;
            break;
          case "e":
            newBounds.width = orig.width + dx;
            break;
        }

        // Ensure minimum size
        if (newBounds.width >= 10 && newBounds.height >= 10) {
          setSelection((prev) => ({ ...prev, bounds: newBounds }));
        }
        return;
      }

      // Dragging the snapshot
      if (selection.phase === "dragging" && dragStartRef.current.bounds) {
        const dx = sceneCoords.x - dragStartRef.current.x;
        const dy = sceneCoords.y - dragStartRef.current.y;

        setSelection((prev) => ({
          ...prev,
          bounds: {
            ...dragStartRef.current.bounds!,
            x: dragStartRef.current.bounds!.x + dx,
            y: dragStartRef.current.bounds!.y + dy,
          },
        }));
        return;
      }

      // Drawing new selection
      if (selection.phase === "drawing") {
        setSelection((prev) => ({
          ...prev,
          currentX: sceneCoords.x,
          currentY: sceneCoords.y,
        }));
      }
    },
    [excalidrawAPI, selection.phase, selection.bounds, activeHandle],
  );

  const handleMouseUp = useCallback(async () => {
    if (!excalidrawAPI) return;

    // Finished resizing
    if (activeHandle) {
      setActiveHandle(null);
      // Re-capture the snapshot with new bounds
      if (selection.bounds) {
        const staticCanvas = getStaticCanvas();
        if (staticCanvas) {
          const appState = excalidrawAPI.getAppState();
          const capturedCanvas = captureRegionFromCanvas(staticCanvas, selection.bounds, appState);
          if (capturedCanvas) {
            setSnapshotDataUrl(capturedCanvas.toDataURL("image/png"));
            originalBoundsRef.current = { ...selection.bounds };
          }
        }
      }
      return;
    }

    // Finished dragging - create the image
    if (selection.phase === "dragging" && selection.bounds) {
      await createImageAtPosition();
      return;
    }

    // Finished drawing selection
    if (selection.phase === "drawing") {
      const bounds: CaptureRegionBounds = {
        x: Math.min(selection.startX, selection.currentX),
        y: Math.min(selection.startY, selection.currentY),
        width: Math.abs(selection.currentX - selection.startX),
        height: Math.abs(selection.currentY - selection.startY),
      };

      if (bounds.width < 10 || bounds.height < 10) {
        setSelection((prev) => ({ ...prev, phase: "idle", bounds: null }));
        return;
      }

      setSelection({
        phase: "selected",
        bounds,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        dragOffsetX: 0,
        dragOffsetY: 0,
      });
    }
  }, [excalidrawAPI, selection, activeHandle, createImageAtPosition]);

  // Calculate screen coordinates for the selection rectangle
  const getScreenRect = useCallback((): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null => {
    if (!excalidrawAPI) return null;

    const appState = excalidrawAPI.getAppState();
    const { zoom, scrollX, scrollY } = appState;

    let bounds: CaptureRegionBounds | null = null;

    if (selection.phase === "drawing") {
      bounds = {
        x: Math.min(selection.startX, selection.currentX),
        y: Math.min(selection.startY, selection.currentY),
        width: Math.abs(selection.currentX - selection.startX),
        height: Math.abs(selection.currentY - selection.startY),
      };
    } else if ((selection.phase === "selected" || selection.phase === "dragging") && selection.bounds) {
      bounds = selection.bounds;
    }

    if (!bounds || bounds.width < 1 || bounds.height < 1) return null;

    return {
      x: (bounds.x + scrollX) * zoom.value + canvasOffsetRef.current.left,
      y: (bounds.y + scrollY) * zoom.value + canvasOffsetRef.current.top,
      width: bounds.width * zoom.value,
      height: bounds.height * zoom.value,
    };
  }, [excalidrawAPI, selection]);

  const getCursorForHandle = (handle: ResizeHandle): string => {
    switch (handle) {
      case "nw":
      case "se":
        return "nwse-resize";
      case "ne":
      case "sw":
        return "nesw-resize";
      case "n":
      case "s":
        return "ns-resize";
      case "e":
      case "w":
        return "ew-resize";
      default:
        return "default";
    }
  };

  if (!isActive) return null;

  const screenRect = getScreenRect();
  const isSelected = selection.phase === "selected" || selection.phase === "dragging";
  const isDragging = selection.phase === "dragging";
  const handleSize = 8;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        cursor: selection.phase === "idle" || selection.phase === "drawing"
          ? "crosshair"
          : activeHandle
          ? getCursorForHandle(activeHandle)
          : "default",
        zIndex: 999,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        if (selection.phase === "drawing") {
          handleMouseUp();
        }
      }}
    >
      {/* Selection rectangle with gray overlay inside */}
      {screenRect && (
        <div
          style={{
            position: "fixed",
            left: screenRect.x,
            top: screenRect.y,
            width: screenRect.width,
            height: screenRect.height,
            border: "2px solid #6965db",
            boxSizing: "border-box",
            backgroundColor: isSelected ? "transparent" : "rgba(0, 0, 0, 0.3)",
            cursor: isSelected && !activeHandle ? "move" : undefined,
            pointerEvents: isSelected ? "auto" : "none",
          }}
        >
          {/* Show snapshot image when dragging */}
          {isDragging && snapshotDataUrl && (
            <img
              src={snapshotDataUrl}
              alt="Capture preview"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "fill",
                pointerEvents: "none",
                opacity: 0.8,
              }}
            />
          )}
        </div>
      )}

      {/* Resize handles */}
      {isSelected && screenRect && !isDragging && (
        <>
          {/* Corner handles */}
          {(["nw", "ne", "sw", "se"] as const).map((pos) => {
            const positions: Record<string, { left: number; top: number }> = {
              nw: { left: screenRect.x - handleSize / 2, top: screenRect.y - handleSize / 2 },
              ne: { left: screenRect.x + screenRect.width - handleSize / 2, top: screenRect.y - handleSize / 2 },
              sw: { left: screenRect.x - handleSize / 2, top: screenRect.y + screenRect.height - handleSize / 2 },
              se: { left: screenRect.x + screenRect.width - handleSize / 2, top: screenRect.y + screenRect.height - handleSize / 2 },
            };
            return (
              <div
                key={pos}
                style={{
                  position: "fixed",
                  left: positions[pos].left,
                  top: positions[pos].top,
                  width: handleSize,
                  height: handleSize,
                  backgroundColor: "#6965db",
                  border: "1px solid white",
                  cursor: getCursorForHandle(pos),
                  pointerEvents: "auto",
                }}
              />
            );
          })}
          {/* Edge handles */}
          {(["n", "s", "e", "w"] as const).map((pos) => {
            const positions: Record<string, { left: number; top: number; width: number; height: number }> = {
              n: { left: screenRect.x + screenRect.width / 2 - handleSize / 2, top: screenRect.y - handleSize / 2, width: handleSize, height: handleSize },
              s: { left: screenRect.x + screenRect.width / 2 - handleSize / 2, top: screenRect.y + screenRect.height - handleSize / 2, width: handleSize, height: handleSize },
              e: { left: screenRect.x + screenRect.width - handleSize / 2, top: screenRect.y + screenRect.height / 2 - handleSize / 2, width: handleSize, height: handleSize },
              w: { left: screenRect.x - handleSize / 2, top: screenRect.y + screenRect.height / 2 - handleSize / 2, width: handleSize, height: handleSize },
            };
            return (
              <div
                key={pos}
                style={{
                  position: "fixed",
                  ...positions[pos],
                  backgroundColor: "#6965db",
                  border: "1px solid white",
                  cursor: getCursorForHandle(pos),
                  pointerEvents: "auto",
                }}
              />
            );
          })}
        </>
      )}

      {/* Instructions when selected */}
      {isSelected && screenRect && !isDragging && (
        <div
          style={{
            position: "fixed",
            left: screenRect.x + screenRect.width / 2,
            top: screenRect.y + screenRect.height + 16,
            transform: "translateX(-50%)",
            backgroundColor: "rgba(0, 0, 0, 0.8)",
            color: "white",
            padding: "6px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
        >
          Drag to place • Ctrl+C to copy • Esc to cancel
        </div>
      )}
    </div>
  );
};

export default CaptureRectangleOverlay;
