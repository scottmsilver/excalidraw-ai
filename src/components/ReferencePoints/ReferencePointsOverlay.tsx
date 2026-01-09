import React, { useMemo } from "react";

import { ReferencePointMarker } from "./ReferencePointMarker";

import type { ReferencePoint, ReferencePointsOverlayProps } from "./types";

/**
 * ReferencePointsOverlay Component
 *
 * A container component that renders all reference point markers as an overlay
 * on top of the excalidraw canvas. It handles coordinate transformation from
 * canvas space to screen space.
 *
 * Features:
 * - Renders all reference points with proper positioning
 * - Accounts for canvas zoom (scale) and pan (scroll)
 * - Passes through click and remove handlers
 * - Non-interactive background (pointer-events: none on container)
 * - Individual markers are interactive
 *
 * @example
 * ```tsx
 * <ReferencePointsOverlay
 *   points={referencePoints}
 *   scale={appState.zoom.value}
 *   scrollX={appState.scrollX}
 *   scrollY={appState.scrollY}
 *   onPointClick={(point) => console.log('Clicked:', point.label)}
 *   onPointRemove={(point) => removePoint(point.label)}
 * />
 * ```
 */
export const ReferencePointsOverlay: React.FC<ReferencePointsOverlayProps> = ({
  points,
  scale,
  scrollX,
  scrollY,
  onPointClick,
  onPointRemove,
}) => {
  /**
   * Transform canvas coordinates to screen coordinates
   * This accounts for zoom (scale) and pan (scroll)
   */
  const transformedPoints = useMemo(() => {
    return points.map((point) => ({
      ...point,
      // Transform from canvas space to screen space
      screenX: (point.x + scrollX) * scale,
      screenY: (point.y + scrollY) * scale,
    }));
  }, [points, scale, scrollX, scrollY]);

  // Don't render if no points
  if (points.length === 0) {
    return null;
  }

  return (
    <div
      className="reference-points-overlay"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 100,
      }}
      aria-label="Reference points overlay"
    >
      {transformedPoints.map((point) => (
        <ReferencePointMarker
          key={point.id}
          point={{
            ...point,
            x: point.screenX,
            y: point.screenY,
          }}
          scale={scale}
          onClick={onPointClick}
          onRemove={onPointRemove}
        />
      ))}
    </div>
  );
};

/**
 * Utility function to convert reference points to the format expected by the API
 * (simpler format without element references)
 */
export function toApiReferencePoints(
  points: ReferencePoint[],
): Array<{ label: string; x: number; y: number }> {
  return points.map((point) => ({
    label: point.label,
    x: point.x,
    y: point.y,
  }));
}

export default ReferencePointsOverlay;
