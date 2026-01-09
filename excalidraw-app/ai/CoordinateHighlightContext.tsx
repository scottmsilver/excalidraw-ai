/**
 * Coordinate Highlight Context
 *
 * Provides shared state for coordinate highlighting between the AI log panel
 * and the canvas overlay. When a user hovers over coordinates in the AI output,
 * this context updates to show a visual indicator on the canvas.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import type { HighlightedCoordinate } from "./coordinateMarkup";
import type { ExportBounds } from "../../src/utils/coordinateTransforms";

/**
 * Context type for coordinate highlighting
 */
export interface CoordinateHighlightContextType {
  /** Currently highlighted coordinate (null if none) */
  highlightedCoord: HighlightedCoordinate | null;
  /** Set the highlighted coordinate */
  setHighlightedCoord: (coord: HighlightedCoordinate | null) => void;
  /** Clear the highlighted coordinate */
  clearHighlight: () => void;
  /** Export bounds for inverse transformation (image → canvas coords) */
  exportBounds: ExportBounds | null;
  /** Set export bounds */
  setExportBounds: (bounds: ExportBounds | null) => void;
}

const CoordinateHighlightContext = createContext<
  CoordinateHighlightContextType | undefined
>(undefined);

/**
 * Provider for coordinate highlighting
 */
export const CoordinateHighlightProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [highlightedCoord, setHighlightedCoord] =
    useState<HighlightedCoordinate | null>(null);
  const [exportBounds, setExportBounds] = useState<ExportBounds | null>(null);

  const clearHighlight = useCallback(() => {
    setHighlightedCoord(null);
  }, []);

  return (
    <CoordinateHighlightContext.Provider
      value={{
        highlightedCoord,
        setHighlightedCoord,
        clearHighlight,
        exportBounds,
        setExportBounds,
      }}
    >
      {children}
    </CoordinateHighlightContext.Provider>
  );
};

/**
 * Hook to access coordinate highlight context
 * Throws if used outside provider
 */
export const useCoordinateHighlight = (): CoordinateHighlightContextType => {
  const context = useContext(CoordinateHighlightContext);
  if (!context) {
    throw new Error(
      "useCoordinateHighlight must be used within a CoordinateHighlightProvider",
    );
  }
  return context;
};

/**
 * Optional hook that returns null if outside provider
 * Safe to use in components that might not be wrapped
 */
export const useCoordinateHighlightOptional =
  (): CoordinateHighlightContextType | null => {
    return useContext(CoordinateHighlightContext) ?? null;
  };
