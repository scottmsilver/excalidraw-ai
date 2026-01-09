/**
 * useAgenticEdit Hook
 *
 * React hook for executing agentic image edits with state management.
 * Provides a clean API for components to trigger AI-powered edits
 * with automatic loading state, progress tracking, and error handling.
 *
 * @example
 * ```tsx
 * function EditComponent() {
 *   const { execute, isProcessing, progress, error, reset } = useAgenticEdit();
 *
 *   const handleEdit = async () => {
 *     try {
 *       const result = await execute({
 *         canvasBlob,
 *         referencePoints,
 *         command: "Move A to B",
 *       });
 *       console.log('Edit complete:', result.imageData);
 *     } catch (e) {
 *       console.error('Edit failed:', e);
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleEdit} disabled={isProcessing}>
 *         {isProcessing ? 'Processing...' : 'Edit'}
 *       </button>
 *       {progress && <div>{progress.step}: {progress.message}</div>}
 *       {error && <div className="error">{error.message}</div>}
 *     </div>
 *   );
 * }
 * ```
 */

import { useState, useCallback, useRef } from "react";

import {
  executeAgenticEdit,
  type AgenticEditParams,
  type AgenticEditResult,
  type AIProgressEvent,
} from "../services/agenticService";

// =============================================================================
// Types
// =============================================================================

/**
 * State returned by the useAgenticEdit hook.
 */
export interface UseAgenticEditState {
  /** Whether an edit operation is currently in progress */
  isProcessing: boolean;
  /** Current progress event from SSE stream (null if idle) */
  progress: AIProgressEvent | null;
  /** Error from the last failed operation (null if no error) */
  error: Error | null;
  /** Result from the last successful operation (null if no result yet) */
  result: AgenticEditResult | null;
}

/**
 * Return type of the useAgenticEdit hook.
 */
export interface UseAgenticEditReturn extends UseAgenticEditState {
  /**
   * Execute an agentic edit operation.
   * Returns a promise that resolves with the result or rejects with an error.
   * State is automatically managed during execution.
   */
  execute: (
    params: Omit<AgenticEditParams, "onProgress">,
  ) => Promise<AgenticEditResult>;
  /**
   * Reset all state to initial values.
   * Useful for clearing errors or results before starting a new operation.
   */
  reset: () => void;
  /**
   * Abort the current operation if one is in progress.
   * Note: This only clears state - the actual API call cannot be cancelled.
   */
  abort: () => void;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * React hook for managing agentic edit operations.
 *
 * Features:
 * - Automatic loading state management
 * - Real-time progress updates via SSE
 * - Error state management
 * - Result caching
 * - Reset and abort capabilities
 *
 * The hook handles all state transitions automatically:
 * - Before execute: isProcessing=false, progress=null, error=null
 * - During execute: isProcessing=true, progress=<current event>, error=null
 * - After success: isProcessing=false, progress=<final event>, result=<result>
 * - After error: isProcessing=false, error=<error>
 *
 * @returns Hook state and control functions
 */
export function useAgenticEdit(): UseAgenticEditReturn {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<AIProgressEvent | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<AgenticEditResult | null>(null);

  // Use ref to track if we should ignore results (for abort)
  const abortedRef = useRef(false);

  /**
   * Execute an agentic edit operation.
   */
  const execute = useCallback(
    async (
      params: Omit<AgenticEditParams, "onProgress">,
    ): Promise<AgenticEditResult> => {
      // Reset state before starting
      setIsProcessing(true);
      setProgress(null);
      setError(null);
      setResult(null);
      abortedRef.current = false;

      try {
        const editResult = await executeAgenticEdit({
          ...params,
          onProgress: (event) => {
            // Only update if not aborted
            if (!abortedRef.current) {
              setProgress(event);
            }
          },
        });

        // Only update state if not aborted
        if (!abortedRef.current) {
          setResult(editResult);
          return editResult;
        }

        // If aborted, throw to indicate the operation was cancelled
        throw new Error("Operation was aborted");
      } catch (e) {
        // Only update error state if not aborted
        if (!abortedRef.current) {
          const err = e instanceof Error ? e : new Error(String(e));
          setError(err);
          throw err;
        }
        throw e;
      } finally {
        // Always clear processing state if not aborted
        if (!abortedRef.current) {
          setIsProcessing(false);
        }
      }
    },
    [],
  );

  /**
   * Reset all state to initial values.
   */
  const reset = useCallback(() => {
    setIsProcessing(false);
    setProgress(null);
    setError(null);
    setResult(null);
    abortedRef.current = false;
  }, []);

  /**
   * Abort the current operation.
   * Note: This only clears local state - the API call cannot be cancelled.
   */
  const abort = useCallback(() => {
    abortedRef.current = true;
    setIsProcessing(false);
    setProgress(null);
    // Don't clear error or result - they represent the last completed operation
  }, []);

  return {
    isProcessing,
    progress,
    error,
    result,
    execute,
    reset,
    abort,
  };
}

// =============================================================================
// Default Export
// =============================================================================

export default useAgenticEdit;
