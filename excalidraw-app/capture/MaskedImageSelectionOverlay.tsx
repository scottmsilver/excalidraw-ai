import React, { useState, useEffect } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { sceneToScreen, type CapturedMaskData } from "./captureUtils";
import {
  selectionOutlineProps,
  pointsToPolygonString,
  denormalizePoints,
  radiansToDegrees,
  DIM_OVERLAY_COLOR,
} from "./captureStyles";

interface Props {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

interface MaskedImageInfo {
  element: ExcalidrawElement;
  maskData: CapturedMaskData;
  screenBounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Renders a dim overlay on the negative space (area outside the mask but inside bounds)
 * for selected masked images (captured via lasso/polygon).
 */
export const MaskedImageSelectionOverlay: React.FC<Props> = ({ excalidrawAPI }) => {
  const [maskedImages, setMaskedImages] = useState<MaskedImageInfo[]>([]);

  // Subscribe to changes and update when selection changes
  useEffect(() => {
    if (!excalidrawAPI) return;

    const updateMaskedImages = () => {
      const appState = excalidrawAPI.getAppState();
      const selectedIds = appState.selectedElementIds;
      const elements = excalidrawAPI.getSceneElements();

      const result: MaskedImageInfo[] = [];

      for (const element of elements) {
        // Only process selected image elements with mask data
        if (
          selectedIds[element.id] &&
          element.type === "image" &&
          element.customData?.capturedMask
        ) {
          const maskData = element.customData.capturedMask as CapturedMaskData;

          // Convert scene coordinates to screen coordinates for the bounding box
          const topLeft = sceneToScreen(element.x, element.y, appState);
          const bottomRight = sceneToScreen(
            element.x + element.width,
            element.y + element.height,
            appState
          );

          result.push({
            element,
            maskData,
            screenBounds: {
              x: topLeft.x,
              y: topLeft.y,
              width: bottomRight.x - topLeft.x,
              height: bottomRight.y - topLeft.y,
            },
          });
        }
      }

      setMaskedImages(result);
    };

    // Initial update
    updateMaskedImages();

    // Subscribe to changes (selection changes, element updates, viewport changes)
    const unsubscribe = excalidrawAPI.onChange(() => {
      updateMaskedImages();
    });

    return () => {
      unsubscribe();
    };
  }, [excalidrawAPI]);

  if (maskedImages.length === 0) return null;

  return (
    <svg
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 50,
      }}
    >
      {maskedImages.map(({ element, maskData, screenBounds }) => {
        const screenPoints = denormalizePoints(maskData.normalizedPoints, screenBounds);
        const polygonStr = pointsToPolygonString(screenPoints);
        const centerX = screenBounds.x + screenBounds.width / 2;
        const centerY = screenBounds.y + screenBounds.height / 2;
        const angleDegrees = radiansToDegrees(element.angle);

        return (
          <g key={`selection-${element.id}`}>
            <defs>
              <mask id={`selection-mask-${element.id}`}>
                <rect x={screenBounds.x} y={screenBounds.y} width={screenBounds.width} height={screenBounds.height} fill="white" />
                <polygon points={polygonStr} fill="black" />
              </mask>
            </defs>
            <g transform={`rotate(${angleDegrees} ${centerX} ${centerY})`}>
              <rect
                x={screenBounds.x}
                y={screenBounds.y}
                width={screenBounds.width}
                height={screenBounds.height}
                fill={DIM_OVERLAY_COLOR}
                mask={`url(#selection-mask-${element.id})`}
              />
              <polygon points={polygonStr} {...selectionOutlineProps} />
            </g>
          </g>
        );
      })}
    </svg>
  );
};

export default MaskedImageSelectionOverlay;
