import { useState, useCallback, useMemo } from "react";

import {
  generateLabel,
  type ReferencePoint,
  type ReferencePointLabel,
  type ReferencePointsState,
  type UseReferencePointsResult,
  type ExcalidrawElementLike,
} from "./types";

/**
 * Generate a unique ID for a reference point
 */
function generateId(): string {
  return `ref-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Initial state for the reference points system
 */
function createInitialState(): ReferencePointsState {
  return {
    points: [],
    isPlacementMode: false,
    placingLabel: null,
    nextIndex: 0,
  };
}

/**
 * Hook for managing reference point state.
 *
 * Reference points are labeled markers (A, B, C, ... Z, AA, AB, ...) that users can place on the canvas
 * to reference specific locations or elements in AI commands.
 *
 * @example
 * ```tsx
 * const {
 *   points,
 *   addPoint,
 *   setPoint,
 *   removePoint,
 *   clearAll,
 *   startPlacement,
 *   cancelPlacement,
 *   state,
 * } = useReferencePoints();
 *
 * // Add point with auto-assigned label
 * const newPoint = addPoint(100, 200);
 *
 * // Place point with specific label (legacy)
 * setPoint('A', 100, 200);
 *
 * // With element reference
 * setPoint('B', 300, 400, someExcalidrawElement);
 *
 * // Start placement mode
 * startPlacement();
 * ```
 */
export function useReferencePoints(): UseReferencePointsResult {
  const [state, setState] = useState<ReferencePointsState>(createInitialState);

  /**
   * Add a reference point with auto-assigned label
   */
  const addPoint = useCallback(
    (
      x: number,
      y: number,
      elementAtPoint?: ExcalidrawElementLike,
    ): ReferencePoint => {
      let newPoint: ReferencePoint | null = null;

      setState((prevState) => {
        const label = generateLabel(prevState.nextIndex);
        const point: ReferencePoint = {
          id: generateId(),
          label,
          index: prevState.nextIndex,
          x,
          y,
          elementAtPoint,
          createdAt: Date.now(),
        };

        newPoint = point;

        return {
          ...prevState,
          points: [...prevState.points, point],
          nextIndex: prevState.nextIndex + 1,
          // Exit placement mode after placing
          isPlacementMode: false,
          placingLabel: null,
        };
      });

      // Return the created point (will be set by setState callback)
      return newPoint!;
    },
    [],
  );

  /**
   * Set or update a reference point (legacy API for backwards compat)
   */
  const setPoint = useCallback(
    (
      label: ReferencePointLabel,
      x: number,
      y: number,
      elementAtPoint?: ExcalidrawElementLike,
    ) => {
      setState((prevState) => {
        const existingIndex = prevState.points.findIndex(
          (p) => p.label === label,
        );

        if (existingIndex >= 0) {
          // Update existing point
          const existing = prevState.points[existingIndex];
          const updatedPoint: ReferencePoint = {
            ...existing,
            x,
            y,
            elementAtPoint,
          };
          const newPoints = [...prevState.points];
          newPoints[existingIndex] = updatedPoint;
          return {
            ...prevState,
            points: newPoints,
            isPlacementMode: false,
            placingLabel: null,
          };
        }
        // Create new point with specified label
        const point: ReferencePoint = {
          id: generateId(),
          label,
          index: prevState.nextIndex,
          x,
          y,
          elementAtPoint,
          createdAt: Date.now(),
        };
        return {
          ...prevState,
          points: [...prevState.points, point],
          nextIndex: prevState.nextIndex + 1,
          isPlacementMode: false,
          placingLabel: null,
        };
      });
    },
    [],
  );

  /**
   * Remove a specific reference point by id
   */
  const removePoint = useCallback((id: string) => {
    setState((prevState) => ({
      ...prevState,
      points: prevState.points.filter((p) => p.id !== id),
    }));
  }, []);

  /**
   * Remove a reference point by label (legacy API)
   */
  const removePointByLabel = useCallback((label: ReferencePointLabel) => {
    setState((prevState) => ({
      ...prevState,
      points: prevState.points.filter((p) => p.label !== label),
    }));
  }, []);

  /**
   * Clear all reference points
   */
  const clearAll = useCallback(() => {
    setState((prevState) => ({
      ...prevState,
      points: [],
      isPlacementMode: false,
      placingLabel: null,
      nextIndex: 0,
    }));
  }, []);

  /**
   * Get a specific reference point by label
   */
  const getPoint = useCallback(
    (label: ReferencePointLabel): ReferencePoint | undefined => {
      return state.points.find((p) => p.label === label);
    },
    [state.points],
  );

  /**
   * Get all reference points as an array
   */
  const getAllPoints = useCallback((): ReferencePoint[] => {
    return state.points;
  }, [state.points]);

  /**
   * Enter placement mode for optional specific label
   */
  const startPlacement = useCallback((label?: ReferencePointLabel) => {
    setState((prevState) => ({
      ...prevState,
      isPlacementMode: true,
      placingLabel: label ?? generateLabel(prevState.nextIndex),
    }));
  }, []);

  /**
   * Exit placement mode without placing
   */
  const cancelPlacement = useCallback(() => {
    setState((prevState) => ({
      ...prevState,
      isPlacementMode: false,
      placingLabel: null,
    }));
  }, []);

  /**
   * Memoized array of all points
   */
  const points = useMemo(() => getAllPoints(), [getAllPoints]);

  /**
   * Get the next available label for placement.
   * Now always returns a label (unlimited).
   */
  const getNextLabel = useCallback((): ReferencePointLabel => {
    return generateLabel(state.nextIndex);
  }, [state.nextIndex]);

  /**
   * Computed properties
   */
  const hasPoints = points.length > 0;
  const pointCount = points.length;

  return {
    // State
    state,
    points,
    hasPoints,
    pointCount,
    // Actions
    addPoint,
    setPoint,
    removePoint,
    removePointByLabel,
    clearAll,
    getPoint,
    getAllPoints,
    startPlacement,
    cancelPlacement,
    getNextLabel,
  };
}

export default useReferencePoints;
