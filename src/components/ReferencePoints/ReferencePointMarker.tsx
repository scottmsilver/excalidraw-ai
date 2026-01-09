import React, { useCallback } from "react";

import type { ReferencePointMarkerProps } from "./types";

/**
 * Color palette for markers - cycles through these colors
 */
const COLOR_PALETTE = [
  { bg: "#E53935", border: "#C62828", text: "#ffffff" }, // Red
  { bg: "#1E88E5", border: "#1565C0", text: "#ffffff" }, // Blue
  { bg: "#43A047", border: "#2E7D32", text: "#ffffff" }, // Green
  { bg: "#FB8C00", border: "#EF6C00", text: "#ffffff" }, // Orange
  { bg: "#8E24AA", border: "#6A1B9A", text: "#ffffff" }, // Purple
  { bg: "#00ACC1", border: "#00838F", text: "#ffffff" }, // Cyan
] as const;

/**
 * Visual styling constants for reference point markers
 */
const MARKER_STYLES = {
  /** Base size of the circular marker */
  size: 28,
  /** Font size for the label */
  fontSize: 14,
  /** Font weight for the label */
  fontWeight: 700,
  /** Border width */
  borderWidth: 2,
  /** Shadow for depth */
  shadow: "0 2px 4px rgba(0,0,0,0.2)",
  /** Remove button size */
  removeButtonSize: 16,
} as const;

/**
 * Get colors for a marker based on its index
 */
function getMarkerColors(index: number) {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

/**
 * ReferencePointMarker Component
 *
 * Renders a visual marker for a reference point on the canvas.
 * Displays as a colored circle with the label (A, B, C, ... Z, AA, AB, etc.) inside.
 *
 * Features:
 * - Color-coded by index (cycles through palette)
 * - Clickable with visual feedback
 * - Optional remove button on hover
 * - Scales with canvas zoom
 */
export const ReferencePointMarker: React.FC<ReferencePointMarkerProps> = ({
  point,
  scale = 1,
  isActive = false,
  onClick,
  onRemove,
}) => {
  const colors = getMarkerColors(point.index);
  const scaledSize = MARKER_STYLES.size / scale;
  const scaledFontSize = MARKER_STYLES.fontSize / scale;
  const scaledBorderWidth = MARKER_STYLES.borderWidth / scale;
  const scaledRemoveSize = MARKER_STYLES.removeButtonSize / scale;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onClick?.(point);
    },
    [onClick, point],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onRemove?.(point);
    },
    [onRemove, point],
  );

  return (
    <div
      className="reference-point-marker"
      style={{
        position: "absolute",
        left: point.x,
        top: point.y,
        // Center the marker on the coordinate
        transform: "translate(-50%, -50%)",
        zIndex: 1000,
        pointerEvents: "auto",
      }}
    >
      {/* Main marker circle */}
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label={`Reference point ${point.label}`}
        style={{
          width: scaledSize,
          height: scaledSize,
          borderRadius: "50%",
          backgroundColor: colors.bg,
          border: `${scaledBorderWidth}px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: MARKER_STYLES.shadow,
          transition: "transform 0.1s ease",
          transform: isActive ? "scale(1.15)" : "scale(1)",
          userSelect: "none",
          position: "relative",
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.(point);
          }
          if (e.key === "Delete" || e.key === "Backspace") {
            e.preventDefault();
            onRemove?.(point);
          }
        }}
      >
        <span
          style={{
            color: colors.text,
            fontSize: scaledFontSize,
            fontWeight: MARKER_STYLES.fontWeight,
            fontFamily: "system-ui, -apple-system, sans-serif",
            lineHeight: 1,
          }}
        >
          {point.label}
        </span>

        {/* Crosshair lines - show exact center position */}
        <div
          style={{
            position: "absolute",
            width: "1px",
            height: scaledSize * 0.3,
            backgroundColor: colors.text,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: "absolute",
            width: scaledSize * 0.3,
            height: "1px",
            backgroundColor: colors.text,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            opacity: 0.4,
          }}
        />
      </div>

      {/* Remove button (shown on hover via CSS) */}
      {onRemove && (
        <button
          className="reference-point-remove"
          onClick={handleRemove}
          aria-label={`Remove reference point ${point.label}`}
          style={{
            position: "absolute",
            top: -scaledRemoveSize / 3,
            right: -scaledRemoveSize / 3,
            width: scaledRemoveSize,
            height: scaledRemoveSize,
            borderRadius: "50%",
            backgroundColor: "#374151",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            transition: "opacity 0.15s ease",
            padding: 0,
          }}
        >
          <svg
            width={scaledRemoveSize * 0.6}
            height={scaledRemoveSize * 0.6}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      )}

      {/* Inline styles for hover effect */}
      <style>{`
        .reference-point-marker:hover .reference-point-remove {
          opacity: 1 !important;
        }
        .reference-point-marker:focus-within .reference-point-remove {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
};

export default ReferencePointMarker;
