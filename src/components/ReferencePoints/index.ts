/**
 * Reference Points Module
 *
 * A system for placing labeled markers (A, B, C, ... Z, AA, AB, ...) on the canvas
 * for use with AI-assisted commands like "Move A to B".
 *
 * @example
 * ```tsx
 * import {
 *   useReferencePoints,
 *   ReferencePointsOverlay,
 *   ReferencePointMarker,
 *   generateLabel,
 * } from './components/ReferencePoints';
 *
 * function MyComponent() {
 *   const { points, addPoint, removePoint, clearAll } = useReferencePoints();
 *
 *   return (
 *     <ReferencePointsOverlay
 *       points={points}
 *       scale={1}
 *       scrollX={0}
 *       scrollY={0}
 *       onPointRemove={(p) => removePoint(p.id)}
 *     />
 *   );
 * }
 * ```
 */

// Types
export type {
  ReferencePoint,
  ReferencePointLabel,
  ReferencePointsState,
  ReferencePointsActions,
  ReferencePointMarkerProps,
  ReferencePointsOverlayProps,
  UseReferencePointsResult,
  ExcalidrawElementLike,
} from "./types";

// Functions and Constants
export { generateLabel, REFERENCE_POINT_LABELS } from "./types";

// Hook
export { useReferencePoints } from "./useReferencePoints";
export { default as useReferencePointsDefault } from "./useReferencePoints";

// Components
export { ReferencePointMarker } from "./ReferencePointMarker";
export { default as ReferencePointMarkerDefault } from "./ReferencePointMarker";

export {
  ReferencePointsOverlay,
  toApiReferencePoints,
} from "./ReferencePointsOverlay";
export { default as ReferencePointsOverlayDefault } from "./ReferencePointsOverlay";
