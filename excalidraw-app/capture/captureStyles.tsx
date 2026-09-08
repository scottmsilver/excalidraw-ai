import React from "react";

// =============================================================================
// Constants
// =============================================================================

/** Primary selection color (Excalidraw purple) */
export const SELECTION_COLOR = "#6965db";

/** Stroke width for selection outlines */
export const SELECTION_STROKE_WIDTH = 2;

/** Dash pattern for selection outlines */
export const SELECTION_DASH_ARRAY = "5,5";

/** Crosshatch pattern stroke color */
export const CROSSHATCH_COLOR = "rgba(0,0,0,0.1)";

/** Dim overlay color for negative space */
export const DIM_OVERLAY_COLOR = "rgba(128, 128, 128, 0.3)";

/** Minimum capture size in pixels */
export const MIN_CAPTURE_SIZE = 10;

// =============================================================================
// Shared Styles
// =============================================================================

/** Style for fullscreen SVG overlay */
export const fullscreenSvgStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  pointerEvents: "none",
};

/** Style for instruction toast at bottom of screen */
export const instructionToastStyle: React.CSSProperties = {
  position: "fixed",
  bottom: "20px",
  left: "50%",
  transform: "translateX(-50%)",
  backgroundColor: "rgba(0, 0, 0, 0.7)",
  color: "white",
  padding: "8px 16px",
  borderRadius: "4px",
  fontSize: "14px",
  pointerEvents: "none",
};

// =============================================================================
// Shared Components
// =============================================================================

/**
 * Crosshatch pattern definition for negative space overlay.
 * Must be used within an SVG <defs> element.
 */
export const CrosshatchPattern: React.FC<{ id: string }> = ({ id }) => (
  <pattern id={id} patternUnits="userSpaceOnUse" width="8" height="8">
    <path d="M0,0 L8,8 M8,0 L0,8" stroke={CROSSHATCH_COLOR} strokeWidth="1" />
  </pattern>
);

/**
 * Selection overlay SVG with crosshatch pattern on negative space.
 * Supports both rectangle and polygon shapes.
 * Accepts optional children for additional SVG elements (e.g., vertex circles).
 */
export const SelectionOverlaySVG: React.FC<{
  id: string;
  shape: { type: "rect"; x: number; y: number; width: number; height: number } | { type: "polygon"; points: string };
  children?: React.ReactNode;
}> = ({ id, shape, children }) => (
  <svg style={fullscreenSvgStyle}>
    <defs>
      <CrosshatchPattern id={`${id}-pattern`} />
      <mask id={`${id}-mask`}>
        <rect x="0" y="0" width="100%" height="100%" fill="white" />
        {shape.type === "rect" ? (
          <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} fill="black" />
        ) : (
          <polygon points={shape.points} fill="black" />
        )}
      </mask>
    </defs>
    <rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}-pattern)`} mask={`url(#${id}-mask)`} />
    {shape.type === "rect" ? (
      <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} {...selectionOutlineProps} />
    ) : (
      <polygon points={shape.points} {...selectionOutlineProps} />
    )}
    {children}
  </svg>
);

/**
 * Selection outline props for SVG shapes.
 * Spread these onto rect/polygon elements for consistent selection styling.
 */
export const selectionOutlineProps = {
  fill: "none",
  stroke: SELECTION_COLOR,
  strokeWidth: SELECTION_STROKE_WIDTH,
  strokeDasharray: SELECTION_DASH_ARRAY,
} as const;

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert an array of points to an SVG polygon points string.
 */
export const pointsToPolygonString = (points: Array<[number, number]>): string =>
  points.map(([x, y]) => `${x},${y}`).join(" ");

/**
 * Convert normalized points (0-1 range) to screen coordinates.
 */
export const denormalizePoints = (
  normalizedPoints: Array<[number, number]>,
  screenBounds: { x: number; y: number; width: number; height: number },
): Array<[number, number]> =>
  normalizedPoints.map(([nx, ny]) => [
    screenBounds.x + nx * screenBounds.width,
    screenBounds.y + ny * screenBounds.height,
  ]);

/**
 * Convert radians to degrees.
 */
export const radiansToDegrees = (radians: number): number =>
  (radians * 180) / Math.PI;
