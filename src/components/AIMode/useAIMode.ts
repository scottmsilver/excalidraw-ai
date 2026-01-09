import { useState, useCallback } from "react";

import type { UseAIModeResult } from "./types";

/**
 * Hook for managing AI mode state.
 *
 * When AI mode is active, users can Shift+Click to place reference markers
 * while still being able to draw normally with regular clicks.
 *
 * @example
 * ```tsx
 * const { isActive, enterAIMode, exitAIMode } = useAIMode();
 *
 * // Enter AI mode (enables Shift+Click marker placement)
 * enterAIMode();
 *
 * // Exit AI mode
 * exitAIMode();
 * ```
 */
export function useAIMode(): UseAIModeResult {
  const [isActive, setIsActive] = useState(false);

  /**
   * Enter AI mode - enables Shift+Click marker placement
   */
  const enterAIMode = useCallback(() => {
    setIsActive(true);
  }, []);

  /**
   * Exit AI mode - returns to normal canvas interaction
   */
  const exitAIMode = useCallback(() => {
    setIsActive(false);
  }, []);

  return {
    isActive,
    enterAIMode,
    exitAIMode,
  };
}

export default useAIMode;
