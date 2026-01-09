/**
 * Reference Points Types
 *
 * Types for the reference point marker system that allows users to place
 * labeled markers (A, B, C, ... Z, AA, AB, ...) on the canvas for AI-assisted commands.
 */

/**
 * Label for reference points - now supports any string label (A-Z, AA, AB, etc.)
 */
export type ReferencePointLabel = string;

/**
 * Generate a label from an index.
 * 0 -> "A", 1 -> "B", ... 25 -> "Z", 26 -> "AA", 27 -> "AB", etc.
 */
export function generateLabel(index: number): string {
  let label = "";
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

/**
 * Legacy constant for backwards compatibility
 * @deprecated Use generateLabel instead for unlimited labels
 */
export const REFERENCE_POINT_LABELS: ReferencePointLabel[] = ["A", "B", "C"];

/**
 * Generic type for excalidraw elements - allows flexibility without
 * depending on excalidraw package types at this level
 */
export interface ExcalidrawElementLike {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  [key: string]: unknown;
}

/**
 * A reference point marker placed on the canvas.
 * Used for AI-assisted commands that reference specific locations or elements.
 */
export interface ReferencePoint {
  /** Unique identifier for this reference point */
  id: string;
  /** The label displayed on the marker (A, B, C, ... Z, AA, AB, etc.) */
  label: ReferencePointLabel;
  /** The index used to generate this label (for color cycling) */
  index: number;
  /** X coordinate in canvas space */
  x: number;
  /** Y coordinate in canvas space */
  y: number;
  /** The excalidraw element located at this point, if any */
  elementAtPoint?: ExcalidrawElementLike;
  /** Timestamp when this point was created */
  createdAt: number;
}

/**
 * State for the reference points system
 */
export interface ReferencePointsState {
  /** Array of reference points (unlimited) */
  points: ReferencePoint[];
  /** Whether the user is currently in placement mode */
  isPlacementMode: boolean;
  /** The label being placed (if in placement mode) */
  placingLabel: ReferencePointLabel | null;
  /** Next index for auto-generating labels */
  nextIndex: number;
}

/**
 * Actions available for reference point management
 */
export interface ReferencePointsActions {
  /** Add a reference point at the given coordinates with auto-assigned label */
  addPoint: (
    x: number,
    y: number,
    elementAtPoint?: ExcalidrawElementLike,
  ) => ReferencePoint;
  /** Add or update a reference point at the given coordinates (legacy) */
  setPoint: (
    label: ReferencePointLabel,
    x: number,
    y: number,
    elementAtPoint?: ExcalidrawElementLike,
  ) => void;
  /** Remove a specific reference point by id */
  removePoint: (id: string) => void;
  /** Remove a reference point by label (legacy) */
  removePointByLabel: (label: ReferencePointLabel) => void;
  /** Clear all reference points */
  clearAll: () => void;
  /** Get a specific reference point by label */
  getPoint: (label: ReferencePointLabel) => ReferencePoint | undefined;
  /** Get all reference points as an array */
  getAllPoints: () => ReferencePoint[];
  /** Enter placement mode for auto-assigned label */
  startPlacement: (label?: ReferencePointLabel) => void;
  /** Exit placement mode */
  cancelPlacement: () => void;
  /** Get the next available label (always available, unlimited) */
  getNextLabel: () => ReferencePointLabel;
}

/**
 * Props for the ReferencePointMarker component
 */
export interface ReferencePointMarkerProps {
  /** The reference point to render */
  point: ReferencePoint;
  /** Scale factor for rendering (for zoom) */
  scale?: number;
  /** Whether this marker is selected/active */
  isActive?: boolean;
  /** Callback when marker is clicked */
  onClick?: (point: ReferencePoint) => void;
  /** Callback when marker is removed */
  onRemove?: (point: ReferencePoint) => void;
}

/**
 * Props for the ReferencePointsOverlay component
 */
export interface ReferencePointsOverlayProps {
  /** All reference points to render */
  points: ReferencePoint[];
  /** Current canvas scale/zoom */
  scale: number;
  /** Canvas scroll offset X */
  scrollX: number;
  /** Canvas scroll offset Y */
  scrollY: number;
  /** Callback when a point is clicked */
  onPointClick?: (point: ReferencePoint) => void;
  /** Callback when a point's remove button is clicked */
  onPointRemove?: (point: ReferencePoint) => void;
}

/**
 * Result of the useReferencePoints hook
 */
export interface UseReferencePointsResult extends ReferencePointsActions {
  /** Current state */
  state: ReferencePointsState;
  /** All points as an array for easy iteration */
  points: ReferencePoint[];
  /** Whether any points exist */
  hasPoints: boolean;
  /** Count of placed points */
  pointCount: number;
}
