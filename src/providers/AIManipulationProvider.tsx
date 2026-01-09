/**
 * AIManipulationProvider
 *
 * A React context provider that coordinates all AI manipulation functionality:
 * - Reference points management (unlimited markers: A, B, C, ... Z, AA, AB, ...)
 * - Dialog state (open/close)
 * - AI edit execution with progress tracking
 *
 * This provider wraps the Excalidraw application and provides a unified API
 * for AI-assisted image manipulation features.
 *
 * @example
 * ```tsx
 * // Wrap your app
 * <AIManipulationProvider>
 *   <ExcalidrawApp />
 * </AIManipulationProvider>
 *
 * // Use in components
 * function MyComponent() {
 *   const {
 *     openDialog,
 *     addPoint,
 *     referencePoints
 *   } = useAIManipulation();
 *
 *   return (
 *     <button onClick={() => openDialog()}>AI Edit</button>
 *   );
 * }
 * ```
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import {
  useReferencePoints,
  type ReferencePoint,
  type ReferencePointLabel,
} from "../components/ReferencePoints";
import { useAIMode } from "../components/AIMode";
import { useAgenticEdit } from "../hooks/useAgenticEdit";

import type { AIProgressEvent } from "../services/types";
import type { ExportBounds } from "../components/ManipulationDialog/types";

// =============================================================================
// Types
// =============================================================================

/**
 * The value provided by AIManipulationContext
 */
export interface AIManipulationContextValue {
  // Reference Points State & Actions
  /** Array of currently placed reference points */
  referencePoints: ReferencePoint[];
  /** Whether any reference points are placed */
  hasReferencePoints: boolean;
  /** Number of reference points placed */
  referencePointCount: number;
  /** Set or update a reference point at given coordinates (legacy API) */
  setReferencePoint: (label: ReferencePointLabel, x: number, y: number) => void;
  /** Remove a specific reference point by ID */
  removeReferencePoint: (id: string) => void;
  /** Remove a specific reference point by label (legacy API) */
  removeReferencePointByLabel: (label: ReferencePointLabel) => void;
  /** Clear all reference points */
  clearReferencePoints: () => void;
  /** Start placement mode for a label (user will click to place) */
  startPlacement: (label: ReferencePointLabel) => void;
  /** Cancel placement mode */
  cancelPlacement: () => void;
  /** Whether currently in placement mode */
  isPlacementMode: boolean;
  /** Which label is being placed (null if not in placement mode) */
  placingLabel: ReferencePointLabel | null;
  /** Get the next available label (always available - unlimited) */
  getNextLabel: () => ReferencePointLabel;

  // AI Mode State & Actions
  /** Whether AI mode is active */
  isAIModeActive: boolean;
  /** Enter AI mode */
  enterAIMode: () => void;
  /** Exit AI mode */
  exitAIMode: () => void;
  /** Add a reference point at coordinates (auto-assigns label) */
  addPoint: (x: number, y: number) => ReferencePoint;

  // Dialog State
  /** Whether the manipulation dialog is open */
  isDialogOpen: boolean;
  /** Open the manipulation dialog with optional canvas image */
  openDialog: (canvasImage?: string) => void;
  /** Close the manipulation dialog */
  closeDialog: () => void;
  /** Current canvas image (data URL) for manipulation */
  canvasImage: string;
  /** Set canvas image */
  setCanvasImage: (image: string) => void;
  /** Export bounds for coordinate transformation (canvas to image coords) */
  exportBounds: ExportBounds | null;
  /** Set export bounds when exporting canvas */
  setExportBounds: (bounds: ExportBounds | null) => void;

  // AI Edit State
  /** Whether an AI edit is currently processing */
  isProcessing: boolean;
  /** Current progress event from SSE stream */
  progress: AIProgressEvent | null;
  /** Error from the last failed operation */
  error: Error | null;

  // AI Edit Actions
  /**
   * Execute an AI edit with the current reference points.
   * @param command - Natural language command (e.g., "Move A to B")
   * @param canvasBlob - Canvas image as Blob
   * @returns Promise resolving to base64 image data URL
   */
  executeEdit: (command: string, canvasBlob: Blob) => Promise<string>;
  /** Reset AI edit state (clear error, progress, etc.) */
  resetEditState: () => void;
}

// =============================================================================
// Context
// =============================================================================

const AIManipulationContext = createContext<AIManipulationContextValue | null>(
  null,
);

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to access AI manipulation context.
 * Must be used within an AIManipulationProvider.
 *
 * @throws Error if used outside of AIManipulationProvider
 */
export function useAIManipulation(): AIManipulationContextValue {
  const context = useContext(AIManipulationContext);
  if (!context) {
    throw new Error(
      "useAIManipulation must be used within an AIManipulationProvider",
    );
  }
  return context;
}

// =============================================================================
// Provider Props
// =============================================================================

export interface AIManipulationProviderProps {
  children: ReactNode;
}

// =============================================================================
// Provider Component
// =============================================================================

/**
 * Provider component that coordinates AI manipulation functionality.
 *
 * Features:
 * - Manages reference points state via useReferencePoints hook
 * - Manages dialog open/close state
 * - Integrates useAgenticEdit for AI processing with progress tracking
 * - Provides unified API through context
 */
export function AIManipulationProvider({
  children,
}: AIManipulationProviderProps): React.JSX.Element {
  // Reference points management
  const {
    points,
    hasPoints,
    pointCount,
    addPoint,
    setPoint,
    removePoint,
    removePointByLabel,
    clearAll,
    startPlacement,
    cancelPlacement,
    getNextLabel,
    state: referencePointsState,
  } = useReferencePoints();

  // AI mode management
  const aiMode = useAIMode();

  // AI edit hook
  const {
    execute: executeAgenticEdit,
    isProcessing,
    progress,
    error,
    reset: resetAgenticEdit,
  } = useAgenticEdit();

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [canvasImage, setCanvasImageState] = useState("");
  const [exportBounds, setExportBoundsState] = useState<ExportBounds | null>(
    null,
  );

  // Dialog actions
  const openDialog = useCallback((image?: string) => {
    if (image) {
      setCanvasImageState(image);
    }
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
  }, []);

  const setCanvasImage = useCallback((image: string) => {
    setCanvasImageState(image);
  }, []);

  const setExportBounds = useCallback((bounds: ExportBounds | null) => {
    setExportBoundsState(bounds);
  }, []);

  // Execute edit - converts blob and calls agentic service
  const executeEdit = useCallback(
    async (command: string, canvasBlob: Blob): Promise<string> => {
      const result = await executeAgenticEdit({
        canvasBlob,
        referencePoints: points,
        command,
      });
      return result.imageData;
    },
    [executeAgenticEdit, points],
  );

  // Context value
  const value: AIManipulationContextValue = {
    // Reference points
    referencePoints: points,
    hasReferencePoints: hasPoints,
    referencePointCount: pointCount,
    setReferencePoint: setPoint,
    removeReferencePoint: removePoint,
    removeReferencePointByLabel: removePointByLabel,
    clearReferencePoints: clearAll,
    startPlacement,
    cancelPlacement,
    isPlacementMode: referencePointsState.isPlacementMode,
    placingLabel: referencePointsState.placingLabel,
    getNextLabel,

    // AI Mode
    isAIModeActive: aiMode.isActive,
    enterAIMode: aiMode.enterAIMode,
    exitAIMode: aiMode.exitAIMode,
    addPoint,

    // Dialog
    isDialogOpen,
    openDialog,
    closeDialog,
    canvasImage,
    setCanvasImage,
    exportBounds,
    setExportBounds,

    // AI Edit state
    isProcessing,
    progress,
    error,

    // AI Edit actions
    executeEdit,
    resetEditState: resetAgenticEdit,
  };

  return (
    <AIManipulationContext.Provider value={value}>
      {children}
    </AIManipulationContext.Provider>
  );
}

// =============================================================================
// Exports
// =============================================================================

export default AIManipulationProvider;
