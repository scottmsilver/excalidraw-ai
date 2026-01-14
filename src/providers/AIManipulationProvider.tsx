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
  useRef,
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
  /** Clean canvas image (data URL) - original without annotations */
  cleanCanvasImage: string;
  /** Annotated canvas image (data URL) - with user's drawings */
  annotatedCanvasImage: string;
  /** Set clean canvas image */
  setCleanCanvasImage: (image: string) => void;
  /** Set annotated canvas image */
  setAnnotatedCanvasImage: (image: string) => void;
  /** Export bounds for coordinate transformation (canvas to image coords) */
  exportBounds: ExportBounds | null;
  /** Set export bounds when exporting canvas */
  setExportBounds: (bounds: ExportBounds | null) => void;

  /** Scene elements snapshot (captured when entering AI mode, before annotations) */
  elementsSnapshot: readonly unknown[];
  /** Set elements snapshot */
  setElementsSnapshot: (elements: readonly unknown[]) => void;

  // AI Edit State
  /** Whether an AI edit is currently processing */
  isProcessing: boolean;
  /** Whether in review mode (AI finished, awaiting accept/reject) */
  isReviewing: boolean;
  /** Current progress event from SSE stream */
  progress: AIProgressEvent | null;
  /** All iteration images collected during processing */
  iterationImages: string[];
  /** Error from the last failed operation */
  error: Error | null;

  // AI Edit Actions
  /**
   * Execute an AI edit with the current reference points.
   * @param command - Natural language command (e.g., "Move A to B")
   * @param cleanBlob - Clean canvas image as Blob (without annotations)
   * @param annotatedBlob - Optional annotated canvas image as Blob (with annotations for AI guidance)
   * @returns Promise resolving to base64 image data URL
   */
  executeEdit: (
    command: string,
    cleanBlob: Blob,
    annotatedBlob?: Blob,
  ) => Promise<string>;
  /** Reset AI edit state (clear error, progress, etc.) */
  resetEditState: () => void;
  /** Manually set processing state (for components that manage their own edit execution) */
  setIsProcessing: (processing: boolean) => void;
  /** Manually set progress event (for components that manage their own edit execution) */
  setProgress: (event: AIProgressEvent | null) => void;
  /** Add an iteration image to the collection */
  addIterationImage: (image: string) => void;
  /** Enter review mode (AI finished, show accept/reject UI) */
  enterReviewMode: () => void;
  /** Accept the AI result at the given index */
  acceptResult: (index: number) => void;
  /** Reject the AI result and cancel */
  rejectResult: () => void;

  // AI Mode Undo Stack
  /** Whether AI mode undo is available */
  canAIUndo: boolean;
  /** Whether AI mode redo is available */
  canAIRedo: boolean;
  /** Initialize AI undo tracking with baseline state (called when entering AI mode) */
  initializeAIUndoState: (elements: readonly unknown[]) => void;
  /** Push current elements to AI undo stack (called when elements change in AI mode) */
  pushAIUndoEntry: (elements: readonly unknown[]) => void;
  /** Undo within AI mode - returns elements to restore, or null if nothing to undo */
  aiUndo: () => readonly unknown[] | null;
  /** Redo within AI mode - returns elements to restore, or null if nothing to redo */
  aiRedo: () => readonly unknown[] | null;
  /** Clear AI undo/redo stacks (called when exiting AI mode) */
  clearAIUndoStack: () => void;
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
    isProcessing: hookIsProcessing,
    progress: hookProgress,
    error,
    reset: resetAgenticEdit,
  } = useAgenticEdit();

  // Manual state overrides for components that call the service directly
  const [manualIsProcessing, setManualIsProcessing] = useState(false);
  const [manualProgress, setManualProgress] = useState<AIProgressEvent | null>(
    null,
  );
  const [isReviewing, setIsReviewing] = useState(false);
  const [iterationImages, setIterationImages] = useState<string[]>([]);

  // Combined state: either from hook or manual override
  const isProcessing = hookIsProcessing || manualIsProcessing;
  const progress = hookProgress || manualProgress;

  // Expose setters for manual control
  const setIsProcessing = useCallback((processing: boolean) => {
    setManualIsProcessing(processing);
    if (!processing) {
      // Clear progress when stopping processing
      setManualProgress(null);
    }
  }, []);

  // Add iteration image to collection
  const addIterationImage = useCallback((image: string) => {
    setIterationImages((prev) => [...prev, image]);
  }, []);

  // Enter review mode
  const enterReviewMode = useCallback(() => {
    setManualIsProcessing(false);
    setIsReviewing(true);
  }, []);

  // Accept result at given index
  const acceptResult = useCallback((_index: number) => {
    setIsReviewing(false);
    setIterationImages([]); // Clear images after accepting
  }, []);

  // Reject result
  const rejectResult = useCallback(() => {
    setIsReviewing(false);
    setIterationImages([]);
  }, []);

  const setProgress = useCallback((event: AIProgressEvent | null) => {
    setManualProgress(event);
  }, []);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [cleanCanvasImage, setCleanCanvasImageState] = useState("");
  const [annotatedCanvasImage, setAnnotatedCanvasImageState] = useState("");
  const [exportBounds, setExportBoundsState] = useState<ExportBounds | null>(
    null,
  );

  // Dialog actions
  const openDialog = useCallback(() => {
    setIsDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setIterationImages([]); // Clear images when dialog closes
    setIsReviewing(false);
  }, []);

  const setCleanCanvasImage = useCallback((image: string) => {
    setCleanCanvasImageState(image);
  }, []);

  const setAnnotatedCanvasImage = useCallback((image: string) => {
    setAnnotatedCanvasImageState(image);
  }, []);

  const setExportBounds = useCallback((bounds: ExportBounds | null) => {
    setExportBoundsState(bounds);
  }, []);

  // Elements snapshot - captures scene before annotations are added
  const [elementsSnapshot, setElementsSnapshotState] = useState<
    readonly unknown[]
  >([]);

  const setElementsSnapshot = useCallback((elements: readonly unknown[]) => {
    setElementsSnapshotState(elements);
  }, []);

  // AI Mode Undo Stack - using refs to avoid re-render loops
  // The onChange callback fires frequently, so we use refs to prevent infinite loops
  const aiUndoStackRef = useRef<Array<readonly unknown[]>>([]);
  const aiRedoStackRef = useRef<Array<readonly unknown[]>>([]);
  const currentAIElementsRef = useRef<readonly unknown[]>([]);
  const isRestoringRef = useRef(false); // Flag to skip onChange during restore

  // Force update trigger for canAIUndo/canAIRedo (only updates when explicitly needed)
  const [, forceUpdate] = useState(0);

  const canAIUndo = aiUndoStackRef.current.length > 0;
  const canAIRedo = aiRedoStackRef.current.length > 0;

  // Initialize AI undo tracking with the current state (called when entering AI mode)
  // This sets the baseline state without pushing to the undo stack
  const initializeAIUndoState = useCallback((elements: readonly unknown[]) => {
    currentAIElementsRef.current = elements;
    // Don't push to stack - this is the baseline state that we can't undo past
  }, []);

  // Push current elements to AI undo stack
  const pushAIUndoEntry = useCallback((elements: readonly unknown[]) => {
    // Skip if we're in the middle of restoring (undo/redo operation)
    if (isRestoringRef.current) {
      return;
    }

    const current = currentAIElementsRef.current;

    // Check if elements actually changed
    // Compare by length and element versions for a quick diff
    let hasChanged = current.length !== elements.length;
    if (!hasChanged && current.length > 0) {
      // Quick version check - if any element has different version, it changed
      const currentVersions = new Set(
        (current as Array<{ id: string; version: number }>).map(
          (el) => `${el.id}:${el.version}`
        )
      );
      hasChanged = (elements as Array<{ id: string; version: number }>).some(
        (el) => !currentVersions.has(`${el.id}:${el.version}`)
      );
    }

    // Push previous state to undo stack when something changed
    // Empty canvas is a valid state to undo to (allows undoing first drawn shape)
    if (hasChanged) {
      aiUndoStackRef.current = [...aiUndoStackRef.current, current];
      aiRedoStackRef.current = []; // Clear redo stack on new change
      forceUpdate((n) => n + 1); // Update canAIUndo/canAIRedo
    }

    currentAIElementsRef.current = elements;
  }, []);

  // Undo within AI mode
  const aiUndo = useCallback((): readonly unknown[] | null => {
    if (aiUndoStackRef.current.length === 0) {
      return null;
    }
    isRestoringRef.current = true; // Set flag to skip onChange
    const newStack = [...aiUndoStackRef.current];
    const previousElements = newStack.pop()!;
    aiUndoStackRef.current = newStack;
    aiRedoStackRef.current = [...aiRedoStackRef.current, currentAIElementsRef.current];
    currentAIElementsRef.current = previousElements;
    forceUpdate((n) => n + 1); // Update canAIUndo/canAIRedo
    // Reset flag after a tick to allow future onChange events
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 50);
    return previousElements;
  }, []);

  // Redo within AI mode
  const aiRedo = useCallback((): readonly unknown[] | null => {
    if (aiRedoStackRef.current.length === 0) {
      return null;
    }
    isRestoringRef.current = true; // Set flag to skip onChange
    const newStack = [...aiRedoStackRef.current];
    const nextElements = newStack.pop()!;
    aiRedoStackRef.current = newStack;
    aiUndoStackRef.current = [...aiUndoStackRef.current, currentAIElementsRef.current];
    currentAIElementsRef.current = nextElements;
    forceUpdate((n) => n + 1); // Update canAIUndo/canAIRedo
    // Reset flag after a tick to allow future onChange events
    setTimeout(() => {
      isRestoringRef.current = false;
    }, 50);
    return nextElements;
  }, []);

  // Clear AI undo/redo stacks
  const clearAIUndoStack = useCallback(() => {
    aiUndoStackRef.current = [];
    aiRedoStackRef.current = [];
    currentAIElementsRef.current = [];
    forceUpdate((n) => n + 1); // Update canAIUndo/canAIRedo
  }, []);

  // Execute edit - converts blob and calls agentic service
  const executeEdit = useCallback(
    async (
      command: string,
      cleanBlob: Blob,
      annotatedBlob?: Blob,
    ): Promise<string> => {
      const result = await executeAgenticEdit({
        cleanImageBlob: cleanBlob,
        annotatedImageBlob: annotatedBlob,
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
    cleanCanvasImage,
    annotatedCanvasImage,
    setCleanCanvasImage,
    setAnnotatedCanvasImage,
    exportBounds,
    setExportBounds,
    elementsSnapshot,
    setElementsSnapshot,

    // AI Edit state
    isProcessing,
    isReviewing,
    progress,
    iterationImages,
    error,

    // AI Edit actions
    executeEdit,
    resetEditState: () => {
      resetAgenticEdit();
      setIterationImages([]);
      setIsReviewing(false);
    },
    setIsProcessing,
    setProgress,
    addIterationImage,
    enterReviewMode,
    acceptResult,
    rejectResult,

    // AI Mode Undo Stack
    canAIUndo,
    canAIRedo,
    initializeAIUndoState,
    pushAIUndoEntry,
    aiUndo,
    aiRedo,
    clearAIUndoStack,
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
